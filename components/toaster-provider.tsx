"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function ToasterProvider() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme as "light" | "dark" | "system"}
      position="bottom-right"
      richColors
      closeButton
      expand
    />
  );
}
