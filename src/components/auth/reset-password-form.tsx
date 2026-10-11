"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/core/auth/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock } from "lucide-react";

const schema = z
  .object({
    password: z.string().min(6),
    confirm: z.string().min(6),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "mismatch",
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: FormValues) {
    if (!token) {
      setError("root", { message: t("invalidToken") });
      return;
    }
    setSubmitting(true);
    try {
      const res = await authClient.resetPassword({
        newPassword: values.password,
        token,
      });
      if (res.error) {
        setError("root", { message: t("invalidToken") });
        return;
      }
      toast.success(tc("passwordUpdated"));
      router.push("/login");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-0 overflow-hidden border-border/60 bg-card/80 shadow-xl backdrop-blur-sm">
      <CardHeader className="items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Lock className="size-5" aria-hidden />
        </div>
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-xl">{t("resetTitle")}</CardTitle>
          <CardDescription>{t("resetSubtitle")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              className="h-10"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{t("passwordTooShort")}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">{t("confirmPassword")}</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              className="h-10"
              {...register("confirm")}
            />
            {errors.confirm && (
              <p className="text-sm text-destructive">{t("passwordMismatch")}</p>
            )}
          </div>
          {errors.root && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <Button type="submit" disabled={submitting} className="h-10 w-full">
            {submitting ? t("saving") : t("resetPassword")}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/login">{t("backToSignIn")}</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}