"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  saveCustomer,
  type ActionState,
} from "@/app/[locale]/(app)/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { useCloseOnSuccess } from "@/components/shared/use-action-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export type CustomerValues = {
  id?: string;
  name: string;
  nameAr: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  address: string | null;
  segment: string | null;
  creditLimit: string | null;
  notes: string | null;
  isActive: boolean;
};

export function CustomerFormDialog({
  customer,
  trigger,
}: {
  customer?: CustomerValues;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(saveCustomer, undefined);
  useCloseOnSuccess(state, setOpen);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("saved"));
    } else if (state?.error) {
      toast.error(tc("required"));
    }
  }, [state, t, tc]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus />
            {t("new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer ? t("edit") : t("new")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          {customer?.id && <input type="hidden" name="id" value={customer.id} />}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="name">{tc("name")}</Label>
            <Input id="name" name="name" defaultValue={customer?.name ?? ""} required />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="nameAr">{t("nameAr")}</Label>
            <Input id="nameAr" name="nameAr" defaultValue={customer?.nameAr ?? ""} dir="rtl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone2">{t("phone2")}</Label>
            <Input id="phone2" name="phone2" defaultValue={customer?.phone2 ?? ""} dir="ltr" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} dir="ltr" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="address">{t("address")}</Label>
            <Input id="address" name="address" defaultValue={customer?.address ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segment">{t("segment")}</Label>
            <Input id="segment" name="segment" defaultValue={customer?.segment ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="creditLimit">{t("creditLimit")}</Label>
            <Input id="creditLimit" name="creditLimit" type="number" step="0.01" defaultValue={customer?.creditLimit ?? ""} dir="ltr" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="notes">{tc("notes")}</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={customer?.notes ?? ""} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={customer?.isActive ?? true} className="size-4 rounded border-input" />
            {tc("active")}
          </label>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingLabel={tc("saving")}>{tc("save")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
