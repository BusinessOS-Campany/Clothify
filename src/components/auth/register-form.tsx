"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signUp } from "@/core/auth/client";
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
import { Store, UserPlus } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      if (res.error) {
        setError("root", { message: res.error.message ?? "error" });
        return;
      }
      toast.success(tc("accountCreated"));
      router.push("/onboarding");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-0 overflow-hidden border-border/60 bg-card/80 shadow-xl backdrop-blur-sm">
      <CardHeader className="items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Store className="size-5" aria-hidden />
        </div>
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-xl">{t("createAccountTitle")}</CardTitle>
          <CardDescription>{t("createAccountSubtitle")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("fullName")}</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder={t("fullName")}
              className="h-10"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{t("nameInvalid")}</p>
            )}
          </div>
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-10"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{t("passwordTooShort")}</p>
            )}
          </div>

          {errors.root && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="mt-1 h-10 w-full gap-2"
          >
            <UserPlus className="size-4" />
            {submitting ? t("creatingAccount") : t("register")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}