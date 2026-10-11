"use client";

import { useTranslations } from "next-intl";
import { cancelSale } from "@/app/[locale]/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { XCircle } from "lucide-react";

export function CancelSaleButton({ saleId }: { saleId: string }) {
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <XCircle className="size-4" />
          {t("cancelSale")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("cancelSale")}</AlertDialogTitle>
          <AlertDialogDescription>{t("cancelConfirm")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
          <form action={cancelSale}>
            <input type="hidden" name="saleId" value={saleId} />
            <AlertDialogAction type="submit" className="bg-destructive text-white hover:bg-destructive/90">
              {tc("confirm")}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
