"use client";

import { useActionState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  inviteEmployee,
  type ActionState,
} from "@/app/[locale]/(app)/employees/actions";
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
import { EMPLOYEE_ROLES } from "@/components/employees/roles";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

type Branch = { id: string; nameAr: string; nameEn: string };

export function InviteEmployeeDialog({ branches }: { branches: Branch[] }) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(inviteEmployee, undefined);
  useCloseOnSuccess(state, setOpen);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("saved"));
    } else if (state?.error === "exists") {
      toast.error(t("email") + " — already a member");
    } else if (state?.error) {
      toast.error(tc("required"));
    }
  }, [state, t, tc]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" />
          {t("new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-nameEn">Name (EN)</Label>
            <Input id="i-nameEn" name="nameEn" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-nameAr">Name (AR)</Label>
            <Input id="i-nameAr" name="nameAr" required dir="rtl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-email">{t("email")}</Label>
            <Input id="i-email" name="email" type="email" required dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-username">Username</Label>
            <Input id="i-username" name="username" required dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-phone">{t("phone")}</Label>
            <Input id="i-phone" name="phone" dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-password">Password</Label>
            <Input id="i-password" name="password" type="password" required minLength={6} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-role">{t("role")}</Label>
            <select
              id="i-role"
              name="roleCode"
              required
              defaultValue="cashier"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {EMPLOYEE_ROLES.map((r) => (
                <option key={r.code} value={r.code}>
                  {t(r.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-job">{t("jobTitle")}</Label>
            <Input id="i-job" name="jobTitle" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-hire">{t("hireDate")}</Label>
            <Input id="i-hire" name="hireDate" type="date" dir="ltr" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>{t("branches")}</Label>
            <div className="flex flex-wrap gap-4">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <Checkbox name="branchIds" value={b.id} />
                  {locale === "ar" ? b.nameAr : b.nameEn}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {locale === "ar" ? "اترك الكل فارغاً للوصول لكل الفروع" : "Leave all unchecked for access to every branch."}
            </p>
          </div>
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
