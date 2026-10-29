"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/lib/use-is-client";

interface ThemeToggleProps {
  // In the mobile menu the toggle is a row like the links above it, with the
  // current theme as its label (#284). On desktop it shows only its icon.
  isMobile?: boolean;
}

const themeLabels: Record<string, string> = {
  light: "Thema: licht",
  dark: "Thema: donker",
  system: "Thema: systeem",
};

export function ThemeToggle({ isMobile = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();

  const buttonProps = isMobile
    ? ({ size: "sm", className: "w-full justify-start" } as const)
    : ({ size: "icon", className: "h-9 w-9" } as const);

  if (!isClient) {
    // Prevent hydration mismatch — render placeholder with same dimensions
    return (
      <Button variant="ghost" {...buttonProps} disabled>
        <Sun className="h-4 w-4" />
        <span className={isMobile ? "" : "sr-only"}>
          {isMobile ? "Thema" : "Thema wisselen"}
        </span>
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <Button
      variant="ghost"
      {...buttonProps}
      onClick={cycleTheme}
      title={
        theme === "light"
          ? "Schakel naar donker thema"
          : theme === "dark"
            ? "Schakel naar systeemthema"
            : "Schakel naar licht thema"
      }
    >
      {theme === "light" && <Sun className="h-4 w-4" />}
      {theme === "dark" && <Moon className="h-4 w-4" />}
      {theme === "system" && <Monitor className="h-4 w-4" />}
      {isMobile ? (
        <span>{themeLabels[theme ?? "system"] ?? themeLabels.system}</span>
      ) : (
        <span className="sr-only">Thema wisselen</span>
      )}
    </Button>
  );
}
