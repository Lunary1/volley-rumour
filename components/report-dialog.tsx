"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadClient } from "@/lib/supabase/load-client";
import type { ReportTargetType } from "@/lib/reports";
import { cn } from "@/lib/utils";

// The form loads on the first click, not with the page: a list page has a
// "Melden" on every card (#200).
const loadForm = () => import("@/components/report-form-dialog");
const ReportFormDialog = dynamic(
  () => loadForm().then((module) => module.ReportFormDialog),
  { ssr: false },
);

interface ReportDialogProps {
  targetType: ReportTargetType;
  targetId: string;
  /** Rumours: offers the takedown form to the person it is about (#68). */
  takedownHref?: string;
  /** Conversations: the other participant, who can be blocked too (#87). */
  otherUserName?: string;
  className?: string;
  size?: "sm" | "default";
}

/**
 * "Melden" button and dialog for a rumour, zoekertje or conversation (#79,
 * #87). Logged-out visitors go to the login page and come back here. The
 * content stays visible until a moderator decides (D-015).
 */
export function ReportDialog({
  targetType,
  targetId,
  takedownHref,
  otherUserName,
  className,
  size = "sm",
}: ReportDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Each opening gets a fresh, empty form.
  const [opened, setOpened] = useState(0);

  async function start() {
    const [supabase] = await Promise.all([loadClient(), loadForm()]);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push(`/auth/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setOpened((count) => count + 1);
    setOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size}
        className={cn("gap-1.5 text-muted-foreground", className)}
        onClick={start}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Melden
      </Button>
      {opened > 0 && (
        <ReportFormDialog
          key={opened}
          targetType={targetType}
          targetId={targetId}
          takedownHref={takedownHref}
          otherUserName={otherUserName}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
