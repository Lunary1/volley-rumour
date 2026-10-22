"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  hasTemplatePlaceholder,
  type ModerationTemplate,
} from "@/lib/moderation-templates";

/**
 * "Sjabloon invoegen" above a note field (#93): picking a template replaces
 * the note, which the moderator can still edit.
 */
export function TemplatePicker({
  templates,
  onPick,
}: {
  templates: ModerationTemplate[];
  onPick: (text: string) => void;
}) {
  const id = useId();
  if (!templates.length) return null;

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Sjabloon invoegen</Label>
      <select
        id={id}
        value=""
        onChange={(e) => {
          const template = templates[Number(e.target.value)];
          if (template) onPick(template.text);
        }}
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs sm:w-72 dark:bg-input/30"
      >
        <option value="" disabled>
          Kies een sjabloon…
        </option>
        {templates.map((template, index) => (
          <option key={template.label} value={index}>
            {template.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Shown under a note that still has a [placeholder] from a template. */
export function PlaceholderHint({ text }: { text: string }) {
  if (!hasTemplatePlaceholder(text)) return null;
  return (
    <p className="text-sm text-destructive-text">
      Vervang de tekst tussen [ ] voor je verstuurt.
    </p>
  );
}
