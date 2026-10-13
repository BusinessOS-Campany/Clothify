import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  authSecret,
  systemBasePath,
} from "./session-config";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: authSecret(),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  plugins: [username()],
  advanced: {
    /**
     * Platform-hosted clones terminate TLS at the platform proxy, so the app
     * itself serves plain HTTP; a `__Secure-` prefix would make the browser drop
     * the cookie. `false` here also covers the HTTP demo.
     */
    useSecureCookies: false,
    cookies: {
      session_token: {
        /**
         * The dot-less name and per-mount path let the platform relay this
         * cookie back to the browser and recognise it as the system's session.
         */
        name: SESSION_COOKIE,
        attributes: { path: systemBasePath() },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    /**
     * No transactional email provider is configured in development. The reset
     * link is logged server-side and surfaced through the request API so a
     * real deployment can swap this for an email transport. Never fake a
     * successful delivery: the UI states clearly whether an email was sent.
     */
    sendResetPassword: async ({ user, url }) => {
      console.info(
        `[auth] password reset requested for ${user.email}: ${url}`,
      );
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh every 24h
  },
  user: {
    additionalFields: {
      nameAr: { type: "string", required: false },
      nameEn: { type: "string", required: false },
      phone: { type: "string", required: false },
      isPlatformAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false, // never settable by the client
      },
      currentTenantId: { type: "string", required: false },
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
});