"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  saveSupplier,
  type ActionState,
} from "@/app/[locale]/(app)/suppliers/actions";
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

export type SupplierValues = {
  id?: string;
  name: string;
  nameAr: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
};

export function SupplierFormDialog({
  supplier,
  trigger,
}: {
  supplier?: SupplierValues;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(saveSupplier, undefined);
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
          <DialogTitle>{supplier ? t("edit") : t("new")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          {supplier?.id && <input type="hidden" name="id" value={supplier.id} />}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="s-name">{t("name")}</Label>
            <Input id="s-name" name="name" defaultValue={supplier?.name ?? ""} required />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="s-nameAr">{t("nameAr")}</Label>
            <Input id="s-nameAr" name="nameAr" defaultValue={supplier?.nameAr ?? ""} dir="rtl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-contact">{t("contactName")}</Label>
            <Input id="s-contact" name="contactName" defaultValue={supplier?.contactName ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-phone">{t("phone")}</Label>
            <Input id="s-phone" name="phone" defaultValue={supplier?.phone ?? ""} dir="ltr" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="s-email">{t("email")}</Label>
            <Input id="s-email" name="email" type="email" defaultValue={supplier?.email ?? ""} dir="ltr" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="s-address">{t("address")}</Label>
            <Input id="s-address" name="address" defaultValue={supplier?.address ?? ""} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="s-taxId">{t("taxId")}</Label>
            <Input id="s-taxId" name="taxId" defaultValue={supplier?.taxId ?? ""} dir="ltr" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="s-notes">{tc("notes")}</Label>
            <Textarea id="s-notes" name="notes" rows={2} defaultValue={supplier?.notes ?? ""} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={supplier?.isActive ?? true} className="size-4 rounded border-input" />
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
