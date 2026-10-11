"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
import { KeyRound } from "lucide-react";

const schema = z.object({ email: z.string().trim().email() });
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: "/reset-password",
      });
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-0 overflow-hidden border-border/60 bg-card/80 shadow-xl backdrop-blur-sm">
      <CardHeader className="items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <KeyRound className="size-5" aria-hidden />
        </div>
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-xl">{t("forgotTitle")}</CardTitle>
          <CardDescription>{t("forgotSubtitle")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-md border border-primary/25 bg-primary/5 px-3 py-3 text-sm text-foreground">
              {t("resetRequested")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("resetDevNote")}
            </p>
            <Button variant="outline" asChild>
              <Link href="/login">{t("backToSignIn")}</Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@store.com"
                className="h-10"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{t("emailInvalid")}</p>
              )}
            </div>
            <Button type="submit" disabled={submitting} className="h-10 w-full">
              {submitting ? t("sending") : t("sendResetLink")}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">{t("backToSignIn")}</Link>
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}