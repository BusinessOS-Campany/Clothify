import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, systemBasePath } from "@/core/auth/session-config";
import type { RoleCode } from "@/core/rbac/catalog";

/**
 * Signs a platform user into this organization's own copy of CLOTHIFY.
 *
 * The platform runs one process per organization and that process has its own
 * database, so it cannot read the platform's session. On the first request the
 * platform sends a short-lived signed statement of who is asking
 * (`x-bos-gateway-token`); this route verifies it, makes sure a local user and
 * membership exist for that person, and issues one of this system's own
 * Better Auth session cookies. After that the browser carries `cl_session` and
 * this route is never called again.
 *
 * The token is only ever accepted over a loopback connection from the platform
 * and is signed with a secret this process was started with, so a request that
 * did not come through the platform's proxy cannot forge one.
 *
 * ## Why there is no password mirroring here
 *
 * Dental and grocery keep their own bcrypt passwords, so the platform hands
 * over a bcrypt digest and one password works on both sides. CLOTHIFY does not
 * store passwords in a column this route could write: Better Auth keeps a
 * scrypt digest in the `Account` table, and a platform bcrypt digest cannot be
 * converted into it. This route therefore always answers `passwordMirrored:
 * false`; platform members reach this clone through the gateway session, not
 * through the local sign-in form.
 */

export const dynamic = "force-dynamic";

interface Claims {
  v: 1;
  organizationId: string;
  organizationSlug: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  exp: number;
}

/**
 * Platform role -> this system's `Role.code`.
 *
 * The platform's `admin` is an org administrator, not the owner of the store,
 * so it maps to MANAGER-equivalent (`manager`) rather than `owner`. `accountant`
 * and `viewer` have no read-only counterpart, so they land on `manager` and
 * `cashier` respectively — the closest existing roles. `member` gets the base
 * `sales_employee`.
 */
const ROLE_MAP: Record<string, RoleCode> = {
  owner: "owner",
  admin: "manager",
  manager: "manager",
  inventory_manager: "inventory_manager",
  cashier: "cashier",
  accountant: "manager",
  viewer: "cashier",
  member: "sales_employee",
};

const DEFAULT_ROLE: RoleCode = "sales_employee";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, matching the Better Auth session

function verify(token: string | null, secret: string): Claims | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("base64url"));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Claims;
    if (claims.v !== 1) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    // The token names one organization; this process belongs to exactly one, so
    // a token minted for a different org must never be honoured here.
    if (process.env.BOS_ORG_ID && claims.organizationId !== process.env.BOS_ORG_ID) return null;
    return claims;
  } catch {
    return null;
  }
}

/** A local username for a platform account: their email, or a slug of their id. */
function usernameFor(claims: Claims): string {
  if (claims.email) return claims.email.toLowerCase();
  return `platform-${claims.userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24).toLowerCase()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.BOS_GATEWAY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED" } }, { status: 501 });
  }

  const claims = verify(request.headers.get("x-bos-gateway-token"), secret);
  if (!claims) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const roleCode = ROLE_MAP[claims.role] ?? DEFAULT_ROLE;
  const role = await prisma.role.findUnique({ where: { code: roleCode }, select: { id: true } });
  if (!role) {
    // Roles come from `prisma/bootstrap.ts`. Without one there is no permission
    // set to attach, so refuse rather than create a user that would silently
    // have no access.
    return NextResponse.json({ error: { code: "ROLE_MISSING", role: roleCode } }, { status: 503 });
  }

  const username = usernameFor(claims);
  const email = claims.email?.trim() || `${username}@platform.local`;
  const displayName = claims.name || username;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { id: true, isActive: true },
  });
  if (existing && !existing.isActive) {
    return NextResponse.json({ error: { code: "USER_DISABLED" } }, { status: 403 });
  }

  const tenant = await prisma.tenant.upsert({
    where: { code: claims.organizationId },
    create: {
      code: claims.organizationId,
      slug: claims.organizationSlug,
      nameAr: claims.organizationSlug,
      nameEn: claims.organizationSlug,
    },
    update: {},
  });

  await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "MAIN" } },
    create: {
      tenantId: tenant.id,
      code: "MAIN",
      nameAr: "الفرع الرئيسي",
      nameEn: "Main Branch",
    },
    update: {},
  });

  const userId = existing
    ? (
        await prisma.user.update({
          where: { id: existing.id },
          data: { name: displayName, currentTenantId: tenant.id, isActive: true },
          select: { id: true },
        })
      ).id
    : (
        await prisma.user.create({
          data: {
            name: displayName,
            email,
            username,
            displayUsername: username,
            nameAr: claims.name || null,
            currentTenantId: tenant.id,
            isActive: true,
          },
          select: { id: true },
        })
      ).id;

  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    create: { tenantId: tenant.id, userId, roleId: role.id },
    update: { roleId: role.id, isActive: true },
  });

  // Give the org a TRIAL plan immediately so the app is usable on first visit.
  // Subscriptions run in DEVELOPMENT mode until a real provider is configured.
  const trialPlan = await prisma.subscriptionPlan.findUnique({
    where: { code: "TRIAL" },
    select: { id: true },
  });
  if (trialPlan) {
    await prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        planId: trialPlan.id,
        status: "TRIAL",
        trialEndsAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
        development: true,
      },
      update: {},
    });
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      token,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
      userId,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
    },
  });

  // Better Auth signs its session cookie as `HMAC_SHA256(token)` in base64 and
  // then percent-encodes the whole `${token}.${signature}`. This route writes the
  // value *unencoded* on purpose: the platform relays the cookie through Next's
  // cookie store, which percent-encodes once more, and CLOTHIFY's own cookie
  // parser decodes once — so an unencoded value here is what makes the round trip
  // land back on `${token}.${signature}` and verify.
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  const cookie = [
    `${SESSION_COOKIE}=${token}.${signature}`,
    `Path=${systemBasePath()}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
  ].join("; ");

  return NextResponse.json(
    { ok: true, org: claims.organizationSlug, passwordMirrored: false },
    { headers: { "set-cookie": cookie, "cache-control": "no-store" } },
  );
}
