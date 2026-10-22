import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A message box for the result of an action or a load error (#208). The
 * text says what happened; the colour only supports it.
 */
const alertVariants = cva("rounded-xl border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "border-border bg-card text-foreground",
      success: "border-transparent bg-success-soft text-success-text",
      destructive:
        "border-transparent bg-destructive-soft text-destructive-text",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Alert, alertVariants };
