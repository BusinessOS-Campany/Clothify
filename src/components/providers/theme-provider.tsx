"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  // next-themes injects an inline <script> to prevent theme flash (FOUC).
  // On the server it renders as normal JS so it runs before paint; on the
  // client React 19 warns about <script> tags rendered inside components.
  // Marking the client copy as a data block (`application/json`) satisfies
  // React's `isScriptDataBlock` check without disabling FOUC prevention.
  const scriptProps =
    typeof window === "undefined"
      ? undefined
      : ({ type: "application/json" } as const);

  return (
    <NextThemesProvider
      {...props}
      scriptProps={{ ...props.scriptProps, ...scriptProps }}
    >
      {children}
    </NextThemesProvider>
  );
}