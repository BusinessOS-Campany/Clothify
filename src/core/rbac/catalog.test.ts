import { describe, expect, it } from "vitest";
import {
  PERMISSION_CATALOG,
  ROLE_CODES,
  ROLE_PERMISSIONS,
  type PermissionCode,
  type RoleCode,
} from "./catalog";

const codes = new Set(PERMISSION_CATALOG.map((p) => p.code));

describe("PERMISSION_CATALOG", () => {
  it("has unique permission codes", () => {
    expect(codes.size).toBe(PERMISSION_CATALOG.length);
  });

  it("exposes the core module permissions used by the app", () => {
    for (const required of [
      "dashboard:read",
      "products:write",
      "inventory:stocktake",
      "inventory:transfer",
      "pos:write",
      "pos:discount",
      "sales:refund",
      "customers:write",
      "suppliers:write",
      "purchasing:receive",
      "expenses:write",
      "employees:write",
      "branches:read",
      "reports:export",
      "subscription:read",
      "settings:read",
      "audit:read",
    ]) {
      expect(codes.has(required)).toBe(true);
    }
  });
});

describe("ROLE_PERMISSIONS", () => {
  it("defines grants for every role code", () => {
    for (const role of ROLE_CODES) {
      expect(Array.isArray(ROLE_PERMISSIONS[role as RoleCode])).toBe(true);
    }
  });

  it("only references known permission codes", () => {
    for (const grants of Object.values(ROLE_PERMISSIONS)) {
      for (const code of grants) {
        expect(codes.has(code as PermissionCode)).toBe(true);
      }
    }
  });

  it("gives owner and platform_admin every permission", () => {
    expect(ROLE_PERMISSIONS.owner.length).toBe(PERMISSION_CATALOG.length);
    expect(ROLE_PERMISSIONS.platform_admin.length).toBe(
      PERMISSION_CATALOG.length,
    );
  });

  it("restricts discounts to roles that are allowed to grant them", () => {
    const withDiscount = ROLE_CODES.filter((r) =>
      ROLE_PERMISSIONS[r as RoleCode].includes("pos:discount"),
    );
    expect(withDiscount).toContain("owner");
    expect(withDiscount).toContain("manager");
    expect(withDiscount).toContain("sales_employee");
    expect(withDiscount).not.toContain("cashier");
    expect(withDiscount).not.toContain("inventory_manager");
  });

  it("does not let cashiers process refunds or cancel sales", () => {
    expect(ROLE_PERMISSIONS.cashier).not.toContain("pos:refund");
    expect(ROLE_PERMISSIONS.cashier).not.toContain("sales:cancel");
  });
});
