"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  saveBranch,
  type ActionState,
} from "@/app/[locale]/(app)/branches/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

type Member = { id: string; label: string };

export type BranchValues = {
  id?: string;
  code: string;
  nameEn: string;
  nameAr: string;
  address: string | null;
  phone: string | null;
  managerId: string | null;
  openingHours: string;
  isActive: boolean;
};

export function BranchFormDialog({
  members,
  branch,
  trigger,
}: {
  members: Member[];
  branch?: BranchValues;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("branches");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(saveBranch, undefined);
  useCloseOnSuccess(state, setOpen);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("saved"));
    } else if (state?.error) {
      toast.error(state.error === "duplicate" ? t("code") : tc("required"));
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
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          {branch?.id && <input type="hidden" name="id" value={branch.id} />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-code">{t("code")}</Label>
            <Input id="b-code" name="code" defaultValue={branch?.code ?? ""} required dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-phone">{t("phone")}</Label>
            <Input id="b-phone" name="phone" defaultValue={branch?.phone ?? ""} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-nameEn">{t("nameEn")}</Label>
            <Input id="b-nameEn" name="nameEn" defaultValue={branch?.nameEn ?? ""} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-nameAr">{t("nameAr")}</Label>
            <Input id="b-nameAr" name="nameAr" defaultValue={branch?.nameAr ?? ""} required dir="rtl" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="b-address">{t("address")}</Label>
            <Input id="b-address" name="address" defaultValue={branch?.address ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-manager">{t("manager")}</Label>
            <select
              id="b-manager"
              name="managerId"
              defaultValue={branch?.managerId ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-hours">{t("openingHours")}</Label>
            <Input id="b-hours" name="openingHours" defaultValue={branch?.openingHours ?? ""} placeholder="09:00 - 22:00" dir="ltr" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox name="isActive" value="true" defaultChecked={branch?.isActive ?? true} />
            {t("active")}
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
