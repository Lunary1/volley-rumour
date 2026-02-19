"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.volleyrumours.be";

interface ShareButtonProps {
  /** Title of the post to share */
  title: string;
  /** Path to the post, e.g. "/zoekertjes/abc" (will be prefixed with site URL) */
  url?: string;
  /** Custom introductory text for the share message (shown before the link) */
  shareText?: string;
  /** Visual variant */
  variant?: "outline" | "ghost" | "default";
  /** Button size */
  size?: "sm" | "default" | "lg" | "icon";
  /** Additional class names */
  className?: string;
}

/**
 * Reusable share button with:
 *  - Native Web Share API on mobile
 *  - WhatsApp + Copy link fallback on desktop
 */
export function ShareButton({
  title,
  url,
  shareText,
  variant = "outline",
  size = "sm",
  className,
}: ShareButtonProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Build the absolute shareable URL using the production domain. */
  const resolveUrl = () => {
    if (url) {
      if (url.startsWith("http")) return url;
      return `${SITE_URL}${url}`;
    }
    // Fallback: replace origin with production domain
    return window.location.href.replace(
      window.location.origin,
      SITE_URL,
    );
  };

  /** Build the full share message (intro text + link). */
  const buildShareMessage = (shareUrl: string) => {
    const intro = shareText ?? title;
    return `${intro}\n${shareUrl}`;
  };

  const handleShare = async () => {
    const shareUrl = resolveUrl();

    // On mobile / environments with Web Share API → use native share sheet
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText ?? title,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed — ignore AbortError
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
      return;
    }

    // Desktop fallback: toggle dropdown with WhatsApp + Copy link
    setShowOptions((prev) => !prev);
  };

  const handleWhatsApp = () => {
    const shareUrl = resolveUrl();
    const message = buildShareMessage(shareUrl);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setShowOptions(false);
  };

  const handleCopyLink = async () => {
    const shareUrl = resolveUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link gekopieerd!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopiëren mislukt");
    }
    setShowOptions(false);
  };

  return (
    <div className="relative inline-block">
      <Button
        variant={variant}
        size={size}
        onClick={handleShare}
        className={`gap-2 min-h-11 min-w-11 ${className ?? ""}`}
        aria-label="Delen"
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Delen</span>
      </Button>

      {/* Desktop dropdown fallback */}
      {showOptions && (
        <>
          {/* Invisible backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowOptions(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-45 rounded-md border border-border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
            <button
              onClick={handleWhatsApp}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent rounded-t-md transition-colors"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Deel via WhatsApp
            </button>
            <button
              onClick={handleCopyLink}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent rounded-b-md transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Kopieer link
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Simple inline WhatsApp SVG icon */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
