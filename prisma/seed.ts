import "dotenv/config";
import { prisma } from "../src/lib/db";
import { auth } from "../src/core/auth/server";
import { hashPassword } from "better-auth/crypto";
import {
  PERMISSION_CATALOG,
  ROLE_CODES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  type RoleCode,
} from "../src/core/rbac/catalog";
import { SUBSCRIPTION_PLANS } from "../src/core/plans";
import { computeTotals } from "../src/lib/pricing";
import { adjustStock } from "../src/lib/inventory";

// ---------------------------------------------------------------------------
// Deterministic PRNG so seeded demo data is stable across runs.
// ---------------------------------------------------------------------------
let seedState = 987654321;
function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}
function randInt(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const STORE_CONFIG = {
  taxEnabled: true,
  taxRate: 5,
  taxNameAr: "ضريبة القيمة المضافة",
  taxNameEn: "VAT",
  discountEnabled: true,
  maxDiscountPercent: 20,
  allowNegativeInventory: false,
  lowStockThreshold: 6,
  enableLoyalty: true,
  loyaltyPointsPerMoney: 1,
  receiptHeaderAr: "متجر زهرة للأزياء",
  receiptHeaderEn: "Zahra Fashion Store",
  receiptFooterAr: "شكراً لتسوقكم معنا — الاستبدال خلال 14 يوماً مع الفاتورة",
  receiptFooterEn: "Thank you for shopping with us — exchange within 14 days with receipt",
  showLogoOnReceipt: true,
};

type ColorDef = { en: string; ar: string; code: string };
const C = {
  black: { en: "Black", ar: "أسود", code: "BLK" },
  white: { en: "White", ar: "أبيض", code: "WHT" },
  navy: { en: "Navy", ar: "كحلي", code: "NVY" },
  beige: { en: "Beige", ar: "بيج", code: "BGE" },
  blue: { en: "Blue", ar: "أزرق", code: "BLU" },
  lblue: { en: "Light Blue", ar: "أزرق فاتح", code: "LBL" },
  pink: { en: "Pink", ar: "وردي", code: "PNK" },
  olive: { en: "Olive", ar: "زيتي", code: "OLV" },
  grey: { en: "Grey", ar: "رمادي", code: "GRY" },
  neon: { en: "Neon Green", ar: "أخضر نيون", code: "NEO" },
  brown: { en: "Brown", ar: "بني", code: "BRN" },
  charcoal: { en: "Charcoal", ar: "فحمي", code: "CHR" },
  red: { en: "Red", ar: "أحمر", code: "RED" },
  sand: { en: "Sand", ar: "رملي", code: "SND" },
  green: { en: "Green", ar: "أخضر", code: "GRN" },
  camel: { en: "Camel", ar: "جملي", code: "CML" },
  fblue: { en: "Floral Blue", ar: "أزرق مزهر", code: "FBU" },
  fpink: { en: "Floral Pink", ar: "وردي مزهر", code: "FPK" },
};

const APPAREL_SIZES = ["S", "M", "L", "XL"];
const JEAN_SIZES = ["26", "28", "30", "32"];
const MENS_SIZES = ["30", "32", "34", "36"];
const SHOE_SIZES = ["40", "41", "42", "43"];
const KID_SIZES = ["4Y", "6Y", "8Y", "10Y"];
const ONE = [""];

type ProductDef = {
  sku: string;
  nameEn: string;
  nameAr: string;
  category: string;
  brand: string;
  supplier: string;
  cost: number;
  price: number;
  gender: "UNISEX" | "MEN" | "WOMEN" | "KIDS";
  material: string;
  season: string;
  sizes: string[];
  colors: ColorDef[];
  sizeLabel?: string;
};

const PRODUCTS: ProductDef[] = [
  { sku: "TS-001", nameEn: "Classic Cotton Tee", nameAr: "تي شيرت قطن كلاسيكي", category: "T-Shirts", brand: "Urban Threads", supplier: "Zenith Apparel", cost: 6, price: 18, gender: "UNISEX", material: "100% Cotton", season: "All Season", sizes: APPAREL_SIZES, colors: [C.black, C.white, C.navy] },
  { sku: "TS-002", nameEn: "Performance Running Tee", nameAr: "تي شيرت رياضي للأداء", category: "Sportswear", brand: "ActiveLine", supplier: "Zenith Apparel", cost: 9, price: 27, gender: "UNISEX", material: "Polyester Blend", season: "Summer", sizes: ["S", "M", "L"], colors: [C.grey, C.neon] },
  { sku: "SH-001", nameEn: "Oxford Button-Down Shirt", nameAr: "قميص أوكسفورد بأزرار", category: "Shirts", brand: "Urban Threads", supplier: "Metro Textiles", cost: 13, price: 39, gender: "MEN", material: "Oxford Cotton", season: "All Season", sizes: APPAREL_SIZES, colors: [C.white, C.lblue] },
  { sku: "SH-002", nameEn: "Linen Casual Shirt", nameAr: "قميص كتان كاجوال", category: "Shirts", brand: "Bloom", supplier: "Metro Textiles", cost: 15, price: 45, gender: "MEN", material: "Linen", season: "Summer", sizes: ["M", "L", "XL"], colors: [C.sand, C.white] },
  { sku: "TR-001", nameEn: "Slim Fit Chino Trousers", nameAr: "بنطال تشينو ضيق", category: "Trousers", brand: "Urban Threads", supplier: "Metro Textiles", cost: 14, price: 42, gender: "MEN", material: "Cotton Twill", season: "All Season", sizes: MENS_SIZES, colors: [C.beige, C.navy] },
  { sku: "JE-001", nameEn: "High-Rise Skinny Jeans", nameAr: "جينز ضيق بخصر عالٍ", category: "Jeans", brand: "Denim Co.", supplier: "Metro Textiles", cost: 16, price: 48, gender: "WOMEN", material: "Stretch Denim", season: "All Season", sizes: JEAN_SIZES, colors: [C.blue, C.black] },
  { sku: "DR-001", nameEn: "Floral Summer Dress", nameAr: "فستان صيفي مزهّر", category: "Dresses", brand: "Bloom", supplier: "Zenith Apparel", cost: 18, price: 55, gender: "WOMEN", material: "Viscose", season: "Summer", sizes: ["S", "M", "L"], colors: [C.fblue, C.fpink] },
  { sku: "DR-002", nameEn: "Pleated Midi Skirt", nameAr: "تنورة ميدي بكسرات", category: "Dresses", brand: "Bloom", supplier: "Zenith Apparel", cost: 12, price: 38, gender: "WOMEN", material: "Polyester", season: "Spring", sizes: ["S", "M", "L"], colors: [C.beige, C.green] },
  { sku: "JK-001", nameEn: "Puffer Winter Jacket", nameAr: "جاكيت شتوي منفوش", category: "Jackets", brand: "ActiveLine", supplier: "Global Footwear", cost: 30, price: 89, gender: "UNISEX", material: "Nylon Shell", season: "Winter", sizes: ["M", "L", "XL"], colors: [C.black, C.olive] },
  { sku: "JK-002", nameEn: "Wool Blend Coat", nameAr: "معطف صوف", category: "Jackets", brand: "Bloom", supplier: "Metro Textiles", cost: 45, price: 129, gender: "WOMEN", material: "Wool Blend", season: "Winter", sizes: ["S", "M", "L"], colors: [C.camel, C.black] },
  { sku: "SO-001", nameEn: "Canvas Sneakers", nameAr: "أحذية رياضية قماشية", category: "Shoes", brand: "Stride", supplier: "Global Footwear", cost: 20, price: 59, gender: "UNISEX", material: "Canvas", season: "All Season", sizes: SHOE_SIZES, colors: [C.white, C.black], sizeLabel: "EU" },
  { sku: "AC-001", nameEn: "Leather Belt", nameAr: "حزام جلدي", category: "Accessories", brand: "Stride", supplier: "Global Footwear", cost: 5, price: 19, gender: "MEN", material: "Genuine Leather", season: "All Season", sizes: ONE, colors: [C.brown, C.black] },
  { sku: "AC-002", nameEn: "Knit Beanie", nameAr: "قبعة صوف", category: "Accessories", brand: "ActiveLine", supplier: "Zenith Apparel", cost: 4, price: 14, gender: "UNISEX", material: "Acrylic Knit", season: "Winter", sizes: ONE, colors: [C.charcoal, C.red] },
  { sku: "KD-001", nameEn: "Kids Graphic Hoodie", nameAr: "هودي أطفال بطبعات", category: "Kids", brand: "Urban Threads", supplier: "Zenith Apparel", cost: 11, price: 32, gender: "KIDS", material: "Cotton Fleece", season: "Winter", sizes: KID_SIZES, colors: [C.blue, C.grey] },
];

const CUSTOMERS = [
  { name: "Layla Hassan", nameAr: "ليلى حسن", phone: "+1-555-0101", segment: "VIP" },
  { name: "Omar Khalid", nameAr: "عمر خالد", phone: "+1-555-0102", segment: "Regular" },
  { name: "Sara Nasser", nameAr: "سارة ناصر", phone: "+1-555-0103", segment: "Regular" },
  { name: "Yousef Ali", nameAr: "يوسف علي", phone: "+1-555-0104", segment: "VIP" },
  { name: "Mona Ibrahim", nameAr: "منى إبراهيم", phone: "+1-555-0105", segment: "New" },
  { name: "Hani Saleh", nameAr: "هاني صالح", phone: "+1-555-0106", segment: "Regular" },
  { name: "Noor Abdullah", nameAr: "نور عبدالله", phone: "+1-555-0107", segment: "VIP" },
  { name: "Tariq Mahmoud", nameAr: "طارق محمود", phone: "+1-555-0108", segment: "Regular" },
  { name: "Rania Fares", nameAr: "رانيا فارس", phone: "+1-555-0109", segment: "New" },
  { name: "Bilal Zaid", nameAr: "بلال زيد", phone: "+1-555-0110", segment: "Regular" },
];

async function getOrCreateUser(input: {
  email: string;
  password: string;
  name: string;
  username: string;
  nameAr: string;
  nameEn?: string;
  phone?: string;
  isPlatformAdmin?: boolean;
}): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    const hashed = await hashPassword(input.password);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: input.username,
        displayUsername: input.username,
        nameAr: input.nameAr,
        nameEn: input.nameEn ?? input.name,
        phone: input.phone ?? null,
        isPlatformAdmin: input.isPlatformAdmin ?? false,
      },
    });
    await prisma.account.updateMany({
      where: { userId: existing.id, providerId: "credential" },
      data: { password: hashed },
    });
    return existing.id;
  }

  const res = await auth.api.signUpEmail({
    body: {
      email: input.email,
      password: input.password,
      name: input.name,
      username: input.username,
      nameAr: input.nameAr,
      nameEn: input.nameEn ?? input.name,
      phone: input.phone ?? null,
    },
  });
  if (input.isPlatformAdmin) {
    await prisma.user.update({
      where: { id: res.user.id },
      data: { isPlatformAdmin: true },
    });
  }
  return res.user.id;
}

async function resetDemoData(tenantId: string) {
  console.log("→ Resetting existing demo transactions & catalogue…");
  await prisma.refundItem.deleteMany({ where: { refund: { tenantId } } });
  await prisma.payment.deleteMany({
    where: { OR: [{ sale: { tenantId } }, { refund: { tenantId } }] },
  });
  await prisma.refund.deleteMany({ where: { tenantId } });
  await prisma.saleItem.deleteMany({ where: { sale: { tenantId } } });
  await prisma.sale.deleteMany({ where: { tenantId } });
  await prisma.goodsReceiptItem.deleteMany({ where: { receipt: { tenantId } } });
  await prisma.goodsReceipt.deleteMany({ where: { tenantId } });
  await prisma.purchaseOrderItem.deleteMany({ where: { po: { tenantId } } });
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } });
  await prisma.inventoryMovement.deleteMany({ where: { tenantId } });
  await prisma.inventoryBalance.deleteMany({ where: { tenantId } });
  await prisma.inventoryTransferItem.deleteMany({ where: { transfer: { tenantId } } });
  await prisma.inventoryTransfer.deleteMany({ where: { tenantId } });
  await prisma.stocktakeItem.deleteMany({ where: { stocktake: { tenantId } } });
  await prisma.stocktake.deleteMany({ where: { tenantId } });
  await prisma.expense.deleteMany({ where: { tenantId } });
  await prisma.productImage.deleteMany({ where: { tenantId } });
  await prisma.productVariant.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.category.deleteMany({ where: { tenantId } });
  await prisma.brand.deleteMany({ where: { tenantId } });
  await prisma.supplier.deleteMany({ where: { tenantId } });
  await prisma.numberSequence.deleteMany({ where: { tenantId } });
}

async function seed() {
  console.log("→ Seeding permissions…");
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        module: p.module,
        action: p.action,
        descriptionAr: p.descriptionAr,
        descriptionEn: p.descriptionEn,
      },
      update: {
        module: p.module,
        action: p.action,
        descriptionAr: p.descriptionAr,
        descriptionEn: p.descriptionEn,
      },
    });
  }
  const allPerms = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permIdByCode = new Map(allPerms.map((p) => [p.code, p.id]));

  console.log("→ Seeding roles…");
  const roleIds = new Map<string, string>();
  for (const code of ROLE_CODES) {
    const names = ROLE_NAMES[code];
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, nameAr: names.ar, nameEn: names.en, description: `System role: ${names.en}`, isSystem: true },
      update: { nameAr: names.ar, nameEn: names.en },
    });
    roleIds.set(code, role.id);
  }

  console.log("→ Seeding role permissions…");
  for (const [code, grants] of Object.entries(ROLE_PERMISSIONS) as [RoleCode, string[]][]) {
    const roleId = roleIds.get(code);
    if (!roleId) continue;
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    const data = grants
      .map((perm) => {
        const permissionId = permIdByCode.get(perm);
        return permissionId ? { roleId, permissionId } : null;
      })
      .filter((x): x is { roleId: string; permissionId: string } => x !== null);
    if (data.length) await prisma.rolePermission.createMany({ data });
  }

  console.log("→ Seeding subscription plans…");
  const planIds = new Map<string, string>();
  for (const plan of SUBSCRIPTION_PLANS) {
    const row = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        descriptionAr: plan.descriptionAr,
        descriptionEn: plan.descriptionEn,
        priceMonthly: plan.priceMonthly,
        staffLimit: plan.staffLimit,
        branchLimit: plan.branchLimit,
        productLimit: plan.productLimit,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      update: {
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        descriptionAr: plan.descriptionAr,
        descriptionEn: plan.descriptionEn,
        priceMonthly: plan.priceMonthly,
        staffLimit: plan.staffLimit,
        branchLimit: plan.branchLimit,
        productLimit: plan.productLimit,
        sortOrder: plan.sortOrder,
      },
    });
    planIds.set(plan.code, row.id);
  }

  // -------------------------------------------------------------------------
  // Platform administrator
  // -------------------------------------------------------------------------
  console.log("→ Seeding platform admin…");
  const adminEmail = process.env.CLOTHIFY_PLATFORM_ADMIN_EMAIL ?? "admin@clothify.local";
  const adminPassword = process.env.CLOTHIFY_PLATFORM_ADMIN_PASSWORD ?? "ChangeMe!123";
  const adminId = await getOrCreateUser({
    email: adminEmail,
    password: adminPassword,
    name: "Platform Admin",
    username: "admin",
    nameAr: "مسؤول المنصة",
    nameEn: "Platform Admin",
    isPlatformAdmin: true,
  });

  // -------------------------------------------------------------------------
  // Demo tenant
  // -------------------------------------------------------------------------
  console.log("→ Seeding demo store…");
  const tenant = await prisma.tenant.upsert({
    where: { code: "ZAHRA" },
    create: {
      code: "ZAHRA",
      slug: "zahra-fashion",
      nameAr: "متجر زهرة للأزياء",
      nameEn: "Zahra Fashion",
      phone: "+1-555-9000",
      email: "hello@zahrafashion.local",
      address: "12 Market Street, Downtown",
      vatNumber: "VAT-300123456",
      currency: "USD",
      currencySymbol: "$",
      timezone: "Asia/Aden",
      locale: "ar",
      dateFormat: "dd/MM/yyyy",
      config: STORE_CONFIG,
      isActive: true,
    },
    update: { config: STORE_CONFIG },
  });
  const tenantId = tenant.id;

  // Branches
  const mainBranch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId, code: "MAIN" } },
    create: { tenantId, code: "MAIN", nameEn: "Main Branch", nameAr: "الفرع الرئيسي", address: "12 Market Street, Downtown", phone: "+1-555-9001", isActive: true, sortOrder: 0 },
    update: {},
  });
  const mallBranch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId, code: "MALL" } },
    create: { tenantId, code: "MALL", nameEn: "City Mall Branch", nameAr: "فرع سيتي مول", address: "City Mall, Level 2, Unit 210", phone: "+1-555-9002", isActive: true, sortOrder: 1 },
    update: {},
  });

  // Subscription (Professional, active)
  await prisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      planId: planIds.get("PROFESSIONAL")!,
      status: "ACTIVE",
      currentPeriodStart: new Date(Date.now() - 15 * 864e5),
      currentPeriodEnd: new Date(Date.now() + 15 * 864e5),
      development: true,
    },
    update: {},
  });
  await prisma.billingHistory.create({
    data: {
      tenantId,
      subscriptionId: (await prisma.subscription.findUniqueOrThrow({ where: { tenantId } })).id,
      periodStart: new Date(Date.now() - 15 * 864e5),
      periodEnd: new Date(Date.now() + 15 * 864e5),
      amount: 49,
      status: "paid",
      description: "Professional plan (development mode — no charge)",
    },
  });

  // Expense categories
  const expenseCategories = [
    { nameEn: "Rent", nameAr: "الإيجار", color: "#6366f1" },
    { nameEn: "Salaries", nameAr: "الرواتب", color: "#0ea5e9" },
    { nameEn: "Utilities", nameAr: "المرافق", color: "#14b8a6" },
    { nameEn: "Marketing", nameAr: "التسويق", color: "#f59e0b" },
    { nameEn: "Shipping", nameAr: "الشحن", color: "#ec4899" },
    { nameEn: "Other", nameAr: "أخرى", color: "#64748b" },
  ];
  for (const c of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { tenantId_nameEn: { tenantId, nameEn: c.nameEn } },
      create: { tenantId, nameEn: c.nameEn, nameAr: c.nameAr, color: c.color, isSystem: true },
      update: { nameAr: c.nameAr, color: c.color },
    });
  }
  const expCats = await prisma.expenseCategory.findMany({ where: { tenantId } });
  const catByEn = new Map(expCats.map((c) => [c.nameEn, c.id]));

  // Reset demo transactional & catalogue data so the seed is re-runnable.
  await resetDemoData(tenantId);

  // Categories / brands / suppliers
  const categories = [
    { en: "T-Shirts", ar: "تي شيرت" },
    { en: "Shirts", ar: "قمصان" },
    { en: "Dresses", ar: "فساتين" },
    { en: "Jeans", ar: "جينز" },
    { en: "Trousers", ar: "بناطيل" },
    { en: "Jackets", ar: "جاكيتات" },
    { en: "Sportswear", ar: "ملابس رياضية" },
    { en: "Shoes", ar: "أحذية" },
    { en: "Accessories", ar: "إكسسوارات" },
    { en: "Kids", ar: "أطفال" },
  ];
  const categoryIdByName = new Map<string, string>();
  let sort = 0;
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { tenantId_nameEn: { tenantId, nameEn: c.en } },
      create: { tenantId, nameEn: c.en, nameAr: c.ar, sortOrder: sort++, isActive: true },
      update: { nameAr: c.ar },
    });
    categoryIdByName.set(c.en, row.id);
  }

  const brands = [
    { en: "Urban Threads", ar: "أوربان ثريدز" },
    { en: "Denim Co.", ar: "دينم كو" },
    { en: "Bloom", ar: "بلوم" },
    { en: "Stride", ar: "سترايد" },
    { en: "ActiveLine", ar: "أكتيف لاين" },
  ];
  const brandIdByName = new Map<string, string>();
  for (const b of brands) {
    const row = await prisma.brand.upsert({
      where: { tenantId_nameEn: { tenantId, nameEn: b.en } },
      create: { tenantId, nameEn: b.en, nameAr: b.ar, isActive: true },
      update: { nameAr: b.ar },
    });
    brandIdByName.set(b.en, row.id);
  }

  const suppliersData = [
    { name: "Zenith Apparel", nameAr: "زينيث للملابس", contactName: "Mr. Adel", phone: "+1-555-2001", email: "sales@zenith.local", address: "Industrial Zone A, Lot 14", taxId: "SUP-1001" },
    { name: "Metro Textiles", nameAr: "مترو للمنسوجات", contactName: "Ms. Huda", phone: "+1-555-2002", email: "orders@metro.local", address: "Textile Park, Building 3", taxId: "SUP-1002" },
    { name: "Global Footwear", nameAr: "جلوبال للأحذية", contactName: "Mr. Sami", phone: "+1-555-2003", email: "info@globalfoot.local", address: "Harbor District, Warehouse 7", taxId: "SUP-1003" },
  ];
  const supplierIdByName = new Map<string, string>();
  for (const s of suppliersData) {
    const existing = await prisma.supplier.findFirst({ where: { tenantId, name: s.name } });
    const row = existing ?? (await prisma.supplier.create({ data: { tenantId, ...s, isActive: true } }));
    supplierIdByName.set(s.name, row.id);
  }

  // Products + variants + initial stock
  console.log("→ Seeding products & inventory…");
  type VariantRec = {
    id: string;
    productId: string;
    productNameEn: string;
    productNameAr: string;
    variantLabel: string;
    cost: number;
    price: number;
    optionEn: string;
    optionAr: string;
  };
  const allVariants: VariantRec[] = [];
  const stockLevel = new Map<string, number>();
  const skey = (branchId: string, variantId: string) => `${branchId}|${variantId}`;

  for (const def of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        tenantId,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        sku: def.sku,
        descriptionEn: `${def.nameEn} in ${def.material}.`,
        descriptionAr: `${def.nameAr} من ${def.material}.`,
        categoryId: categoryIdByName.get(def.category) ?? null,
        brandId: brandIdByName.get(def.brand) ?? null,
        supplierId: supplierIdByName.get(def.supplier) ?? null,
        cost: def.cost,
        price: def.price,
        compareAtPrice: rnd() > 0.6 ? r2(def.price * 1.25) : null,
        gender: def.gender,
        season: def.season,
        material: def.material,
        tags: [def.category.toLowerCase(), def.gender.toLowerCase()],
        status: "ACTIVE",
        isActive: true,
      },
    });

    for (const color of def.colors) {
      const sizes = def.sizes.length ? def.sizes : ONE;
      for (const size of sizes) {
        const sizePart = size ? `-${size}` : "";
        const optionEn = size ? `${color.en} / ${size}` : color.en;
        const optionAr = size ? `${color.ar} / ${size}` : color.ar;
        const variant = await prisma.productVariant.create({
          data: {
            tenantId,
            productId: product.id,
            sku: `${def.sku}-${color.code}${sizePart}`,
            barcode: `${def.sku}${color.code}${size}`.replace(/[^A-Za-z0-9]/g, ""),
            attributes: { size: size || null, color: color.en },
            optionEn,
            optionAr,
            cost: def.cost,
            price: def.price,
            isActive: true,
          },
        });
        allVariants.push({
          id: variant.id,
          productId: product.id,
          productNameEn: def.nameEn,
          productNameAr: def.nameAr,
          variantLabel: optionEn,
          cost: def.cost,
          price: def.price,
          optionEn,
          optionAr,
        });

        const qtyMain = randInt(18, 55);
        await prisma.$transaction(async (tx) => {
          await adjustStock(tx, {
            tenantId,
            branchId: mainBranch.id,
            variantId: variant.id,
            type: "INITIAL",
            quantity: qtyMain,
            unitCost: def.cost,
            reference: "OPENING",
            notes: "Opening stock (seed)",
          });
        });
        stockLevel.set(skey(mainBranch.id, variant.id), qtyMain);
        if (rnd() > 0.25) {
          const qtyMall = randInt(8, 26);
          await prisma.$transaction(async (tx) => {
            await adjustStock(tx, {
              tenantId,
              branchId: mallBranch.id,
              variantId: variant.id,
              type: "INITIAL",
              quantity: qtyMall,
              unitCost: def.cost,
              reference: "OPENING",
              notes: "Opening stock (seed)",
            });
          });
          stockLevel.set(skey(mallBranch.id, variant.id), qtyMall);
        }
      }
    }
  }
  console.log(`  created ${PRODUCTS.length} products / ${allVariants.length} variants`);

  // Customers
  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const row = await prisma.customer.create({
      data: {
        tenantId,
        name: c.name,
        nameAr: c.nameAr,
        phone: c.phone,
        email: `${c.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        address: "Downtown",
        segment: c.segment,
        isActive: true,
      },
      select: { id: true },
    });
    customerIds.push(row.id);
  }

  // Staff users / members
  await finishMembers({ tenantId, adminId, mainBranch, mallBranch, roleIds });

  const cashierUsers = await prisma.tenantMember.findMany({
    where: { tenantId, role: { code: { in: ["cashier", "sales_employee", "manager", "owner"] } } },
    select: { userId: true },
  });
  const cashierIds = cashierUsers.map((m) => m.userId);

  // -------------------------------------------------------------------------
  // Sales history (last 75 days)
  // -------------------------------------------------------------------------
  console.log("→ Seeding sales history…");
  const cfg = {
    taxEnabled: STORE_CONFIG.taxEnabled,
    taxRate: STORE_CONFIG.taxRate,
    enableLoyalty: STORE_CONFIG.enableLoyalty,
  };
  let saleCounter = 0;
  const NUM_SALES = 150;
  const createdSales: { id: string; saleNo: string; saleDate: Date; branchId: string; items: { id: string; variantId: string | null; quantity: number; unitPrice: number }[] }[] = [];

  for (let i = 0; i < NUM_SALES; i++) {
    const daysAgo = Math.floor(Math.pow(rnd(), 1.4) * 75);
    const at = new Date(Date.now() - daysAgo * 864e5);
    at.setHours(randInt(9, 21), randInt(0, 59), randInt(0, 59), 0);

    let branch = rnd() > 0.35 ? mainBranch : mallBranch;
    let candidates = allVariants.filter((v) => (stockLevel.get(skey(branch.id, v.id)) ?? 0) >= 1);
    if (candidates.length === 0) {
      branch = branch.id === mainBranch.id ? mallBranch : mainBranch;
      candidates = allVariants.filter((v) => (stockLevel.get(skey(branch.id, v.id)) ?? 0) >= 1);
    }
    if (candidates.length === 0) continue;

    const cashierId = pick(cashierIds);
    const customerId = rnd() > 0.3 ? pick(customerIds) : null;

    const lineCount = Math.min(randInt(1, 3), candidates.length);
    const chosen = new Set<number>();
    while (chosen.size < lineCount) chosen.add(Math.floor(rnd() * candidates.length));

    const lines: { v: VariantRec; qty: number; discount: number }[] = [];
    for (const idx of chosen) {
      const v = candidates[idx]!;
      const available = stockLevel.get(skey(branch.id, v.id)) ?? 0;
      const desired = rnd() > 0.75 ? randInt(2, 3) : 1;
      const qty = Math.min(desired, available);
      if (qty < 1) continue;
      stockLevel.set(skey(branch.id, v.id), available - qty);
      const lineDiscount = rnd() > 0.85 ? r2(v.price * qty * 0.1) : 0;
      lines.push({ v, qty, discount: lineDiscount });
    }
    if (lines.length === 0) continue;

    const saleDiscount = rnd() > 0.88 ? r2(randInt(2, 8)) : 0;
    const totals = computeTotals(
      lines.map((l) => ({ unitPrice: l.v.price, quantity: l.qty, discount: l.discount })),
      cfg,
      saleDiscount,
      STORE_CONFIG.loyaltyPointsPerMoney,
    );

    saleCounter++;
    const saleNo = `SALE-${String(saleCounter).padStart(5, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          tenantId,
          branchId: branch.id,
          customerId,
          saleNo,
          status: "COMPLETED",
          subtotal: totals.subtotal,
          discount: totals.discount + totals.lineDiscounts,
          taxRate: totals.taxRate,
          taxAmount: totals.taxAmount,
          total: totals.total,
          cashierId,
          saleDate: at,
        },
      });
      const itemRows: { id: string; variantId: string; quantity: number; unitPrice: number }[] = [];
      for (const l of lines) {
        const item = await tx.saleItem.create({
          data: {
            saleId: s.id,
            productId: l.v.productId,
            variantId: l.v.id,
            productNameEn: l.v.productNameEn,
            productNameAr: l.v.productNameAr,
            variantLabel: l.v.variantLabel,
            quantity: l.qty,
            unitPrice: l.v.price,
            unitCost: l.v.cost,
            discount: l.discount,
            total: r2(l.v.price * l.qty - l.discount),
          },
        });
        itemRows.push({ id: item.id, variantId: l.v.id, quantity: l.qty, unitPrice: l.v.price });
        await adjustStock(tx, {
          tenantId,
          branchId: branch.id,
          variantId: l.v.id,
          type: "SALE",
          quantity: -l.qty,
          unitCost: l.v.cost,
          reference: saleNo,
          referenceId: s.id,
          createdBy: cashierId,
          allowNegative: false,
        });
      }

      const method = pick(["CASH", "CARD", "CARD", "MOBILE_WALLET", "BANK_TRANSFER"] as const);
      if (rnd() > 0.9 && totals.total > 30) {
        const part = r2(totals.total * 0.4);
        await tx.payment.create({ data: { saleId: s.id, method: "CASH", amount: part } });
        await tx.payment.create({ data: { saleId: s.id, method, amount: r2(totals.total - part) } });
      } else {
        await tx.payment.create({ data: { saleId: s.id, method, amount: totals.total } });
      }

      if (customerId && STORE_CONFIG.enableLoyalty) {
        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { increment: totals.loyaltyPointsEarned } },
        });
      }
      return { sale: s, items: itemRows };
    });

    createdSales.push({ id: result.sale.id, saleNo, saleDate: at, branchId: branch.id, items: result.items });
  }
  console.log(`  created ${createdSales.length} sales`);

  // -------------------------------------------------------------------------
  // One refund (partial, damaged item)
  // -------------------------------------------------------------------------
  console.log("→ Seeding a sample refund…");
  const refundTarget = createdSales[Math.floor(createdSales.length * 0.3)];
  if (refundTarget && refundTarget.items[0]) {
    const item = refundTarget.items[0]!;
    await prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          tenantId,
          branchId: refundTarget.branchId,
          saleId: refundTarget.id,
          refundNo: "REF-00001",
          amount: r2(item.unitPrice),
          status: "COMPLETED",
          reason: "Defective stitching on arrival",
          processedBy: adminId,
          refundDate: new Date(refundTarget.saleDate.getTime() + 2 * 864e5),
        },
      });
      await tx.refundItem.create({
        data: {
          refundId: refund.id,
          saleItemId: item.id,
          productId: allVariants.find((v) => v.id === item.variantId)?.productId ?? allVariants[0]!.productId,
          variantId: item.variantId,
          quantity: 1,
          unitPrice: item.unitPrice,
          total: r2(item.unitPrice),
          condition: "DAMAGED",
          restocked: false,
        },
      });
      await tx.payment.create({
        data: { saleId: refundTarget.id, refundId: refund.id, method: "CARD", amount: r2(item.unitPrice) },
      });
      await tx.saleItem.update({ where: { id: item.id }, data: { returnedQty: 1 } });
      await tx.sale.update({ where: { id: refundTarget.id }, data: { status: "PARTIALLY_REFUNDED" } });
      // Damaged → not restocked.
    });
  }

  // -------------------------------------------------------------------------
  // Expense history
  // -------------------------------------------------------------------------
  console.log("→ Seeding expenses…");
  const expenseSeed = [
    { cat: "Rent", desc: "Monthly store rent", amt: 3500, monthsAgo: [0, 1, 2] },
    { cat: "Salaries", desc: "Staff salaries", amt: 6200, monthsAgo: [0, 1, 2] },
    { cat: "Utilities", desc: "Electricity & water", amt: 420, monthsAgo: [0, 1, 2] },
    { cat: "Marketing", desc: "Social media ads", amt: 800, monthsAgo: [0, 1] },
    { cat: "Shipping", desc: "Courier charges", amt: 260, monthsAgo: [0, 1, 2] },
  ];
  let expenseNo = 0;
  for (const e of expenseSeed) {
    for (const m of e.monthsAgo) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      d.setDate(randInt(2, 26));
      expenseNo++;
      await prisma.expense.create({
        data: {
          tenantId,
          branchId: mainBranch.id,
          categoryId: catByEn.get(e.cat) ?? null,
          description: e.desc,
          amount: r2(e.amt * (0.95 + rnd() * 0.1)),
          expenseDate: d,
          paymentMethod: "BANK_TRANSFER",
          recordedBy: adminId,
          notes: `Seed expense #${expenseNo}`,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Purchase orders (one received, one ordered)
  // -------------------------------------------------------------------------
  console.log("→ Seeding purchase orders…");
  const supplierZenith = supplierIdByName.get("Zenith Apparel")!;
  const supplierMetro = supplierIdByName.get("Metro Textiles")!;

  // Received PO
  {
    const poVariants = [allVariants[0]!, allVariants[2]!, allVariants[5]!];
    const items = poVariants.map((v) => ({ v, qty: randInt(20, 40), unitCost: v.cost }));
    const subtotal = r2(items.reduce((a, i) => a + i.unitCost * i.qty, 0));
    const taxAmount = r2(subtotal * (STORE_CONFIG.taxRate / 100));
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        branchId: mainBranch.id,
        supplierId: supplierZenith,
        poNo: "PO-00001",
        status: "RECEIVED",
        subtotal,
        taxRate: STORE_CONFIG.taxRate,
        taxAmount,
        total: r2(subtotal + taxAmount),
        expectedDeliveryDate: new Date(Date.now() - 20 * 864e5),
        notes: "Restock best sellers",
        createdBy: adminId,
        items: {
          create: items.map((i) => ({
            variantId: i.v.id,
            quantity: i.qty,
            unitCost: i.unitCost,
            receivedQuantity: i.qty,
            lineTotal: r2(i.unitCost * i.qty),
          })),
        },
      },
    });
    await prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          tenantId,
          branchId: mainBranch.id,
          poId: po.id,
          receiptNo: "GRN-00001",
          receivedBy: adminId,
          receivedAt: new Date(Date.now() - 18 * 864e5),
          notes: "All items received in good condition",
        },
      });
      for (const i of items) {
        await tx.goodsReceiptItem.create({
          data: { receiptId: receipt.id, variantId: i.v.id, quantity: i.qty, unitCost: i.unitCost },
        });
        await adjustStock(tx, {
          tenantId,
          branchId: mainBranch.id,
          variantId: i.v.id,
          type: "RECEIPT",
          quantity: i.qty,
          unitCost: i.unitCost,
          reference: "GRN-00001",
          referenceId: receipt.id,
          createdBy: adminId,
        });
      }
    });
  }

  // Ordered (pending) PO
  {
    const poVariants = [allVariants[8] ?? allVariants[0]!, allVariants[11] ?? allVariants[1]!];
    const items = poVariants.map((v) => ({ v, qty: randInt(15, 30), unitCost: v.cost }));
    const subtotal = r2(items.reduce((a, i) => a + i.unitCost * i.qty, 0));
    const taxAmount = r2(subtotal * (STORE_CONFIG.taxRate / 100));
    await prisma.purchaseOrder.create({
      data: {
        tenantId,
        branchId: mallBranch.id,
        supplierId: supplierMetro,
        poNo: "PO-00002",
        status: "ORDERED",
        subtotal,
        taxRate: STORE_CONFIG.taxRate,
        taxAmount,
        total: r2(subtotal + taxAmount),
        expectedDeliveryDate: new Date(Date.now() + 7 * 864e5),
        notes: "New season stock",
        createdBy: adminId,
        items: {
          create: items.map((i) => ({
            variantId: i.v.id,
            quantity: i.qty,
            unitCost: i.unitCost,
            lineTotal: r2(i.unitCost * i.qty),
          })),
        },
      },
    });
  }

  console.log("✓ Seed complete.");
  console.log("");
  console.log("  Demo store : Zahra Fashion (slug: zahra-fashion)");
  console.log(`  Admin      : admin / ${adminEmail} / ${adminPassword}`);
  console.log("  Owner      : owner@zahra.local / owner123");
  console.log("  Manager    : manager@zahra.local / manager123");
  console.log("  Cashier    : cashier@zahra.local / cashier123");
  console.log("  Inventory  : stock@zahra.local / stock123");
}

async function finishMembers(args: {
  tenantId: string;
  adminId: string;
  mainBranch: { id: string };
  mallBranch: { id: string };
  roleIds: Map<string, string>;
}) {
  const { tenantId, adminId, mainBranch, mallBranch, roleIds } = args;

  const staff = [
    { email: "owner@zahra.local", password: "owner123", username: "owner", name: "Store Owner", nameAr: "مالك المتجر", nameEn: "Store Owner", phone: "+1-555-8001", role: "owner", jobTitle: "Owner", allBranches: true },
    { email: "manager@zahra.local", password: "manager123", username: "manager", name: "Store Manager", nameAr: "مدير المتجر", nameEn: "Store Manager", phone: "+1-555-8002", role: "manager", jobTitle: "General Manager", allBranches: true },
    { email: "cashier@zahra.local", password: "cashier123", username: "cashier", name: "Front Cashier", nameAr: "أمين صندوق", nameEn: "Front Cashier", phone: "+1-555-8003", role: "cashier", jobTitle: "Cashier", allBranches: false },
    { email: "stock@zahra.local", password: "stock123", username: "stock", name: "Inventory Lead", nameAr: "مدير المخزون", nameEn: "Inventory Lead", phone: "+1-555-8004", role: "inventory_manager", jobTitle: "Inventory Manager", allBranches: true },
  ];

  // Admin is also the platform-wide owner of the demo store so the demo is
  // immediately usable when signed in as admin.
  const memberships: { userId: string; roleCode: string; jobTitle: string; allBranches: boolean }[] = [
    { userId: adminId, roleCode: "owner", jobTitle: "Platform Owner", allBranches: true },
  ];

  for (const s of staff) {
    const uid = await getOrCreateUser({
      email: s.email,
      password: s.password,
      name: s.name,
      username: s.username,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      phone: s.phone,
    });
    memberships.push({ userId: uid, roleCode: s.role, jobTitle: s.jobTitle, allBranches: s.allBranches });
  }

  for (const m of memberships) {
    const roleId = roleIds.get(m.roleCode)!;
    const member = await prisma.tenantMember.upsert({
      where: { tenantId_userId: { tenantId, userId: m.userId } },
      create: { tenantId, userId: m.userId, roleId, jobTitle: m.jobTitle, isActive: true },
      update: { roleId, jobTitle: m.jobTitle, isActive: true },
    });
    const branchIds = m.allBranches ? [mainBranch.id, mallBranch.id] : [mainBranch.id];
    await prisma.tenantMemberBranch.deleteMany({ where: { memberId: member.id } });
    await prisma.tenantMemberBranch.createMany({
      data: branchIds.map((branchId) => ({ memberId: member.id, branchId })),
      skipDuplicates: true,
    });
    await prisma.user.update({
      where: { id: m.userId },
      data: { currentTenantId: tenantId },
    });
  }
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
