"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export type ActionResult = { ok?: boolean; error?: string } | undefined;

/**
 * Closes a dialog when a `useActionState` result transitions to success, using
 * React's adjust-state-during-render pattern instead of `setState` inside an
 * effect (which triggers cascading renders).
 */
export function useCloseOnSuccess(
  state: ActionResult,
  setOpen: (open: boolean) => void,
) {
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setOpen(false);
  }
}

/** Shows a toast whenever the action result changes. Safe to call in effects. */
export function useActionToast(
  state: ActionResult,
  messages?: { success?: string; error?: string },
) {
  const t = useTranslations("common");
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(messages?.success ?? t("success"));
    else if (state.error) toast.error(messages?.error ?? t("required"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
