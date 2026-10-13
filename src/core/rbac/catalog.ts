/**
 * Central RBAC catalogue: permissions and role → permission mapping.
 * Enforcement happens server-side (see core/rbac/index.ts).
 * `prisma/seed.ts` and `prisma/bootstrap.ts` both expand this catalogue.
 */

export const MODULES = [
  "dashboard",
  "products",
  "inventory",
  "pos",
  "sales",
  "customers",
  "suppliers",
  "purchasing",
  "expenses",
  "employees",
  "branches",
  "reports",
  "subscription",
  "settings",
  "users",
  "audit",
] as const;

export const ACTIONS = [
  "read",
  "write",
  "manage",
  "discount",
  "refund",
  "cancel",
  "stocktake",
  "transfer",
  "receive",
  "export",
] as const;

export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];

export type PermissionSpec = {
  code: string;
  module: Module;
  action: Action;
  descriptionAr: string;
  descriptionEn: string;
};

export const PERMISSION_CATALOG: PermissionSpec[] = [
  h("dashboard", "read", "عرض لوحة التحكم", "View dashboard"),
  // products
  h("products", "read", "عرض المنتجات", "View products"),
  h("products", "write", "إنشاء وتعديل المنتجات", "Create/update products"),
  h("products", "manage", "إدارة الكتالوج والعلامات والأصناف", "Manage catalog, brands & categories"),
  // inventory
  h("inventory", "read", "عرض المخزون", "View inventory"),
  h("inventory", "write", "تسوية المخزون والحركات", "Adjust stock & movements"),
  h("inventory", "stocktake", "القيام بجرد المخزون", "Run stocktakes"),
  h("inventory", "transfer", "نقل المخزون بين الفروع", "Transfer stock between branches"),
  // POS
  h("pos", "read", "فتح شاشة البيع", "Open POS"),
  h("pos", "write", "إجراء عمليات البيع", "Make sales"),
  h("pos", "discount", "منح الخصومات", "Apply discounts"),
  h("pos", "refund", "معالجة المرتجعات", "Process refunds"),
  h("pos", "cancel", "إلغاء عمليات البيع", "Cancel sales"),
  // sales
  h("sales", "read", "عرض سجل المبيعات", "View sales history"),
  h("sales", "write", "تعديل المبيعات", "Edit sales"),
  h("sales", "refund", "معالجة استرداد المبيعات", "Process sale refunds"),
  h("sales", "cancel", "إلغاء المبيعات", "Cancel sales"),
  h("sales", "export", "تصدير بيانات المبيعات", "Export sales data"),
  // customers
  h("customers", "read", "عرض العملاء", "View customers"),
  h("customers", "write", "إنشاء وتعديل العملاء", "Create/update customers"),
  h("customers", "manage", "إدارة شرائح العملاء والبرامج", "Manage segments & programs"),
  // suppliers
  h("suppliers", "read", "عرض الموردين", "View suppliers"),
  h("suppliers", "write", "إدارة الموردين", "Manage suppliers"),
  // purchasing
  h("purchasing", "read", "عرض أوامر الشراء", "View purchase orders"),
  h("purchasing", "write", "إنشاء وتعديل أوامر الشراء", "Create/update purchase orders"),
  h("purchasing", "receive", "استلام البضاعة", "Receive goods"),
  // expenses
  h("expenses", "read", "عرض المصروفات", "View expenses"),
  h("expenses", "write", "تسجيل المصروفات", "Record expenses"),
  // employees
  h("employees", "read", "عرض الموظفين", "View employees"),
  h("employees", "write", "إدارة الموظفين وحساباتهم", "Manage employees & accounts"),
  // branches
  h("branches", "read", "عرض الفروع", "View branches"),
  h("branches", "write", "إدارة الفروع", "Manage branches"),
  // reports
  h("reports", "read", "عرض التقارير", "View reports"),
  h("reports", "export", "تصدير التقارير", "Export reports"),
  // subscription
  h("subscription", "read", "عرض الاشتراك", "View subscription"),
  h("subscription", "manage", "إدارة الاشتراك والخطة", "Manage subscription & plan"),
  // settings
  h("settings", "read", "عرض الإعدادات", "View settings"),
  h("settings", "write", "تعديل إعدادات المتجر", "Edit store settings"),
  // users & audit
  h("users", "manage", "إدارة الأعضاء والأدوار", "Manage members & roles"),
  h("audit", "read", "عرض سجل التدقيق", "View audit log"),
];

function h(
  module: Module,
  action: Action,
  descriptionAr: string,
  descriptionEn: string,
): PermissionSpec {
  return {
    code: `${module}:${action}`,
    module,
    action,
    descriptionAr,
    descriptionEn,
  };
}

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]["code"];

export const ROLE_CODES = [
  "platform_admin", // SaaS platform administrator
  "owner", // store owner
  "manager", // store manager
  "inventory_manager", // inventory manager
  "cashier", // cashier
  "sales_employee", // sales employee
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

/** Bilingual display names for each role, shared by the seed and the bootstrap. */
export const ROLE_NAMES: Record<RoleCode, { ar: string; en: string }> = {
  platform_admin: { ar: "مسؤول المنصة", en: "Platform Administrator" },
  owner: { ar: "مالك المتجر", en: "Store Owner" },
  manager: { ar: "مدير المتجر", en: "Store Manager" },
  inventory_manager: { ar: "مدير المخزون", en: "Inventory Manager" },
  cashier: { ar: "أمين صندوق", en: "Cashier" },
  sales_employee: { ar: "موظف مبيعات", en: "Sales Employee" },
};

const ALL = PERMISSION_CATALOG.map((p) => p.code as PermissionCode);

/** Grant list per role (expanded at seed time against PERMISSION_CATALOG). */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  platform_admin: ALL,
  owner: ALL,
  manager: [
    "dashboard:read",
    "products:read", "products:write",
    "inventory:read", "inventory:write", "inventory:stocktake", "inventory:transfer",
    "pos:read", "pos:write", "pos:discount", "pos:refund", "pos:cancel",
    "sales:read", "sales:refund", "sales:cancel", "sales:export",
    "customers:read", "customers:write",
    "suppliers:read", "suppliers:write",
    "purchasing:read", "purchasing:write", "purchasing:receive",
    "expenses:read", "expenses:write",
    "employees:read", "employees:write",
    "branches:read",
    "reports:read", "reports:export",
    "subscription:read",
    "settings:read",
    "audit:read",
  ],
  inventory_manager: [
    "dashboard:read",
    "products:read", "products:write",
    "inventory:read", "inventory:write", "inventory:stocktake", "inventory:transfer",
    "suppliers:read",
    "purchasing:read", "purchasing:write", "purchasing:receive",
    "branches:read",
    "reports:read",
    "pos:read",
  ],
  cashier: [
    "dashboard:read",
    "products:read",
    "inventory:read",
    "pos:read", "pos:write",
    "sales:read",
    "customers:read", "customers:write",
    "branches:read",
  ],
  sales_employee: [
    "dashboard:read",
    "products:read",
    "inventory:read",
    "pos:read", "pos:write", "pos:discount",
    "sales:read",
    "customers:read", "customers:write",
    "branches:read",
  ],
};