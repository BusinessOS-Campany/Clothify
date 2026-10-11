"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  updateEmployee,
  setEmployeePassword,
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
import { Pencil, KeyRound } from "lucide-react";
import { toast } from "sonner";

type Branch = { id: string; nameAr: string; nameEn: string };
export type EmployeeValues = {
  memberId: string;
  user: { nameEn: string | null; nameAr: string | null; phone: string | null; email: string; username: string | null };
  roleCode: string;
  jobTitle: string | null;
  hireDate: string | null;
  isActive: boolean;
  branchIds: string[];
};

export function EmployeeEditDialog({
  branches,
  employee,
}: {
  branches: Branch[];
  employee: EmployeeValues;
}) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(updateEmployee, undefined);
  const [pwdState, pwdAction] = useActionState<ActionState, FormData>(setEmployeePassword, undefined);
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
        <Button variant="ghost" size="icon" title={tc("edit")}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="memberId" value={employee.memberId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-nameEn">Name (EN)</Label>
            <Input id="u-nameEn" name="nameEn" defaultValue={employee.user.nameEn ?? ""} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-nameAr">Name (AR)</Label>
            <Input id="u-nameAr" name="nameAr" defaultValue={employee.user.nameAr ?? ""} required dir="rtl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("phone")}</Label>
            <Input name="phone" defaultValue={employee.user.phone ?? ""} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("email")}</Label>
            <Input value={employee.user.email} disabled dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("role")}</Label>
            <select
              name="roleCode"
              defaultValue={employee.roleCode}
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
            <Label>{t("jobTitle")}</Label>
            <Input name="jobTitle" defaultValue={employee.jobTitle ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("hireDate")}</Label>
            <Input name="hireDate" type="date" defaultValue={employee.hireDate ?? ""} dir="ltr" />
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <Checkbox name="isActive" value="true" defaultChecked={employee.isActive} />
            {t("active")}
          </label>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>{t("branches")}</Label>
            <div className="flex flex-wrap gap-4">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    name="branchIds"
                    value={b.id}
                    defaultChecked={employee.branchIds.includes(b.id)}
                  />
                  {locale === "ar" ? b.nameAr : b.nameEn}
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingLabel={tc("saving")}>{tc("save")}</SubmitButton>
          </div>
        </form>

        <form action={pwdAction} className="mt-2 flex items-end gap-2 rounded-lg border bg-muted/30 p-3">
          <input type="hidden" name="memberId" value={employee.memberId} />
          <div className="flex flex-1 flex-col gap-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <KeyRound className="size-3" /> Set password
            </Label>
            <Input name="password" type="password" minLength={6} placeholder="••••••" dir="ltr" required />
          </div>
          <SubmitButton variant="secondary" pendingLabel={tc("saving")} disabled={false}>
            {tc("save")}
          </SubmitButton>
        </form>
        {pwdState?.ok && <p className="text-xs text-emerald-600">{tc("success")}</p>}
      </DialogContent>
    </Dialog>
  );
}
