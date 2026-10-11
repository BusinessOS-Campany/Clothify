"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  checkout,
  quickCreateCustomer,
  type CheckoutState,
  type QuickCustomerState,
  type Receipt,
} from "@/app/[locale]/(app)/pos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Minus,
  Plus,
  Printer,
  ScanLine,
  ShoppingCart,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

export type PosVariant = {
  id: string;
  sku: string;
  barcode: string | null;
  label: string | null;
  price: number;
  stockByBranch: Record<string, number>;
};
export type PosProduct = {
  id: string;
  nameEn: string;
  nameAr: string;
  categoryId: string | null;
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  variants: PosVariant[];
};
type Branch = { id: string; nameAr: string; nameEn: string };
type Category = { id: string; nameEn: string; nameAr: string };
type CustomerOpt = { id: string; name: string; phone: string | null };

type CartLine = {
  variantId: string;
  productId: string;
  name: string;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
  stock: number;
};

type Method = "CASH" | "CARD" | "MOBILE_WALLET" | "BANK_TRANSFER" | "OTHER";

export function PosTerminal({
  branches,
  initialBranchId,
  products,
  categories,
  customers,
  currencySymbol,
  taxEnabled,
  taxRate,
  taxName,
  enableLoyalty,
  discountEnabled,
  maxDiscountPercent,
  allowNegative,
}: {
  branches: Branch[];
  initialBranchId: string;
  products: PosProduct[];
  categories: Category[];
  customers: CustomerOpt[];
  currencySymbol: string;
  taxEnabled: boolean;
  taxRate: number;
  taxName: string;
  enableLoyalty: boolean;
  discountEnabled: boolean;
  maxDiscountPercent: number;
  allowNegative: boolean;
}) {
  const t = useTranslations("pos");
  const tc = useTranslations("common");
  const locale = useLocale();

  const [branchId, setBranchId] = useState(initialBranchId);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [customerList, setCustomerList] = useState<CustomerOpt[]>(customers);
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<{ method: Method; amount: number }[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [custOpen, setCustOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState<CheckoutState, FormData>(checkout, undefined);
  const [custState, custAction] = useActionState<QuickCustomerState, FormData>(
    quickCreateCustomer,
    undefined,
  );

  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const [handledCheckout, setHandledCheckout] = useState<CheckoutState>(undefined);
  if (state !== handledCheckout) {
    setHandledCheckout(state);
    if (state && "ok" in state && state.ok) {
      setReceipt(state.receipt);
      setPayOpen(false);
      setCart([]);
      setSaleDiscount(0);
      setCustomerId("");
      setPayments([]);
    }
  }

  const [handledCust, setHandledCust] = useState<QuickCustomerState>(undefined);
  if (custState !== handledCust) {
    setHandledCust(custState);
    if (custState?.ok && custState.id) {
      setCustomerList((l) => [{ id: custState.id!, name: custState.name!, phone: null }, ...l]);
      setCustomerId(custState.id);
      setCustOpen(false);
    }
  }

  useEffect(() => {
    if (state && "error" in state) {
      const map: Record<string, string> = {
        insufficientStock: t("insufficientStock"),
        discountNotAllowed: t("discountNotAllowed"),
        underpaid: t("remaining"),
        noPayment: t("addPayment"),
        empty: t("emptyCart"),
      };
      toast.error(map[state.error] ?? tc("required"));
    }
  }, [state, t, tc]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (categoryId ? p.categoryId === categoryId : true))
      .map((p) => {
        const variants = p.variants.filter((v) => {
          if (!q) return true;
          return (
            p.nameEn.toLowerCase().includes(q) ||
            p.nameAr.includes(query.trim()) ||
            v.sku.toLowerCase().includes(q) ||
            (v.barcode ?? "").toLowerCase() === q
          );
        });
        return { p, variants };
      })
      .filter((x) => x.variants.length > 0);
  }, [products, query, categoryId]);

  function addVariant(p: PosProduct, v: PosVariant) {
    setCart((c) => {
      const existing = c.find((l) => l.variantId === v.id);
      const name = locale === "ar" ? p.nameAr : p.nameEn;
      if (existing) {
        return c.map((l) =>
          l.variantId === v.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...c,
        {
          variantId: v.id,
          productId: p.id,
          name,
          variantLabel: v.label,
          unitPrice: v.price,
          quantity: 1,
          stock: v.stockByBranch[branchId] ?? 0,
        },
      ];
    });
  }

  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = query.trim().toLowerCase();
    if (!q) return;
    for (const p of products) {
      const hit = p.variants.find((v) => v.sku.toLowerCase() === q || (v.barcode ?? "").toLowerCase() === q);
      if (hit) {
        addVariant(p, hit);
        setQuery("");
        return;
      }
    }
  }

  function setQty(variantId: string, qty: number) {
    setCart((c) => c.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, qty) } : l)));
  }

  const subtotal = r2(cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const discount = Math.min(saleDiscount, subtotal);
  const taxable = r2(Math.max(subtotal - discount, 0));
  const effectiveTaxRate = taxEnabled ? taxRate : 0;
  const taxAmount = r2((taxable * effectiveTaxRate) / 100);
  const total = r2(taxable + taxAmount);
  const maxDiscount = r2((subtotal * maxDiscountPercent) / 100);

  const paid = r2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const remaining = r2(Math.max(total - paid, 0));
  const change = r2(Math.max(paid - total, 0));

  function openPayment() {
    if (cart.length === 0) {
      toast.error(t("emptyCart"));
      return;
    }
    setPayments([{ method: "CASH", amount: total }]);
    setPayOpen(true);
  }

  function submitCheckout() {
    const fd = new FormData();
    fd.set("branchId", branchId);
    fd.set("customerId", customerId);
    fd.set("saleDiscount", String(discount));
    fd.set(
      "items",
      JSON.stringify(cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity }))),
    );
    fd.set(
      "payments",
      JSON.stringify(payments.filter((p) => p.amount > 0)),
    );
    action(fd);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Left: catalogue */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <ScanLine className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onScan}
              placeholder={t("search")}
              className="ps-9"
              autoFocus
            />
          </div>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {locale === "ar" ? b.nameAr : b.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              !categoryId ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            {tc("all")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                categoryId === c.id ? "bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              {locale === "ar" ? c.nameAr : c.nameEn}
            </button>
          ))}
        </div>

        <div className="grid max-h-[calc(100vh-320px)] gap-2 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {t("noResults")}
            </p>
          )}
          {filtered.map(({ p, variants }) => (
            <div key={p.id} className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-tight">
                  {locale === "ar" ? p.nameAr : p.nameEn}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.categoryNameEn ? (locale === "ar" ? p.categoryNameAr : p.categoryNameEn) : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((v) => {
                  const stock = v.stockByBranch[branchId] ?? 0;
                  const disabled = !allowNegative && stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => addVariant(p, v)}
                      className={cn(
                        "flex flex-col rounded-lg border px-2 py-1 text-start text-xs transition-colors",
                        disabled
                          ? "cursor-not-allowed opacity-40"
                          : "hover:border-primary hover:bg-primary/5",
                      )}
                    >
                      <span className="font-medium">{v.label ?? v.sku}</span>
                      <span className="text-muted-foreground" dir="ltr">
                        {fmtMoney(v.price)} {currencySymbol}
                        {!allowNegative && <span className="ms-1">· {stock}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: cart */}
      <Card className="flex h-fit flex-col lg:sticky lg:top-4">
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-4 text-muted-foreground" />
            <span className="font-semibold">{t("cart")}</span>
            {cart.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ms-auto text-destructive hover:text-destructive"
                onClick={() => setCart([])}
              >
                <Trash2 className="size-4" />
                {t("clear")}
              </Button>
            )}
          </div>

          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">{t("walkIn")}</option>
            {customerList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => setCustOpen(true)}>
            <UserPlus className="size-4" />
            {t("addCustomer")}
          </Button>

          <div className="flex flex-col gap-2 border-y py-3">
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("emptyCart")}
              </p>
            ) : (
              cart.map((l) => (
                <div key={l.variantId} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.variantLabel ?? ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setQty(l.variantId, l.quantity - 1)}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Input
                      value={l.quantity}
                      onChange={(e) => setQty(l.variantId, Number(e.target.value))}
                      className="h-7 w-12 px-1 text-center"
                      dir="ltr"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setQty(l.variantId, l.quantity + 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <span className="w-16 text-end text-sm" dir="ltr">
                    {fmtMoney(l.unitPrice * l.quantity)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={() => setCart((c) => c.filter((x) => x.variantId !== l.variantId))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <span dir="ltr">{fmtMoney(subtotal)}</span>
            </div>
            {discountEnabled && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("discount")}</span>
                <Input
                  type="number"
                  min={0}
                  max={maxDiscount}
                  value={saleDiscount || ""}
                  onChange={(e) => setSaleDiscount(Number(e.target.value) || 0)}
                  className="h-7 w-24 text-end"
                  dir="ltr"
                  placeholder="0"
                />
              </div>
            )}
            {taxEnabled && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {taxName} ({taxRate}%)
                </span>
                <span dir="ltr">{fmtMoney(taxAmount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
              <span>{t("total")}</span>
              <span dir="ltr">
                {fmtMoney(total)} {currencySymbol}
              </span>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={cart.length === 0}
            onClick={openPayment}
          >
            {t("checkout")}
          </Button>
        </CardContent>
      </Card>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("payment")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {payments.map((p, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label className="text-xs">{t("payment")}</Label>
                  <select
                    value={p.method}
                    onChange={(e) =>
                      setPayments((ps) =>
                        ps.map((x, i) => (i === idx ? { ...x, method: e.target.value as Method } : x)),
                      )
                    }
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="CASH">{t("cash")}</option>
                    <option value="CARD">{t("card")}</option>
                    <option value="MOBILE_WALLET">{t("mobileWallet")}</option>
                    <option value="BANK_TRANSFER">{t("bankTransfer")}</option>
                    <option value="OTHER">{t("other")}</option>
                  </select>
                </div>
                <div className="flex w-28 flex-col gap-1.5">
                  <Label className="text-xs">{tc("amount")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={p.amount}
                    onChange={(e) =>
                      setPayments((ps) =>
                        ps.map((x, i) => (i === idx ? { ...x, amount: Number(e.target.value) } : x)),
                      )
                    }
                    dir="ltr"
                  />
                </div>
                {payments.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => setPayments((ps) => ps.filter((_, i) => i !== idx))}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPayments((ps) => [...ps, { method: "CASH", amount: remaining }])}
            >
              <Plus className="size-4" />
              {t("addPayment")}
            </Button>

            <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("total")}</span>
                <span dir="ltr">{fmtMoney(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("amountPaid")}</span>
                <span dir="ltr">{fmtMoney(paid)}</span>
              </div>
              {change > 0 ? (
                <div className="flex justify-between font-semibold text-emerald-600">
                  <span>{t("change")}</span>
                  <span dir="ltr">{fmtMoney(change)}</span>
                </div>
              ) : (
                <div className="flex justify-between font-semibold">
                  <span>{t("remaining")}</span>
                  <span dir="ltr">{fmtMoney(remaining)}</span>
                </div>
              )}
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={pending || remaining > 0}
              onClick={submitCheckout}
            >
              {pending ? tc("loading") : t("completeSale")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick add customer */}
      <Dialog open={custOpen} onOpenChange={setCustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("addCustomer")}</DialogTitle>
          </DialogHeader>
          <form action={custAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cust-name">{tc("name")}</Label>
              <Input id="cust-name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cust-phone">Phone</Label>
              <Input id="cust-phone" name="phone" dir="ltr" />
            </div>
            <Button type="submit" disabled={pending}>
              {tc("save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("saleComplete")}</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div id="pos-receipt" className="flex flex-col gap-2 text-sm">
              {receipt.header && (
                <p className="text-center text-xs text-muted-foreground">{receipt.header}</p>
              )}
              <div className="text-center">
                <p className="font-mono font-semibold">{receipt.saleNo}</p>
                <p className="text-xs text-muted-foreground">
                  {receipt.branchName} · {new Date(receipt.dateISO).toLocaleString()}
                </p>
              </div>
              <div className="border-y py-2">
                {receipt.lines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="truncate">
                      {l.qty}× {l.name}
                      {l.variant ? ` (${l.variant})` : ""}
                    </span>
                    <span dir="ltr">{fmtMoney(l.total)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <span>{t("subtotal")}</span>
                <span dir="ltr">{fmtMoney(receipt.subtotal)}</span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex justify-between">
                  <span>{t("discount")}</span>
                  <span dir="ltr">-{fmtMoney(receipt.discount)}</span>
                </div>
              )}
              {receipt.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>
                    {receipt.taxName} ({receipt.taxRate}%)
                  </span>
                  <span dir="ltr">{fmtMoney(receipt.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>{t("total")}</span>
                <span dir="ltr">
                  {fmtMoney(receipt.total)} {receipt.currencySymbol}
                </span>
              </div>
              {receipt.change > 0 && (
                <div className="flex justify-between">
                  <span>{t("change")}</span>
                  <span dir="ltr">{fmtMoney(receipt.change)}</span>
                </div>
              )}
              {enableLoyalty && receipt.customerName && receipt.pointsEarned > 0 && (
                <p className="text-xs text-muted-foreground">
                  {receipt.customerName} · +{receipt.pointsEarned}
                </p>
              )}
              <p className="text-center text-xs text-muted-foreground">{receipt.footer}</p>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => window.print()}>
                  <Printer className="size-4" />
                  {t("printReceipt")}
                </Button>
                <Button type="button" className="flex-1" onClick={() => setReceipt(null)}>
                  {t("newSale")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
