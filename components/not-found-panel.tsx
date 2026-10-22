import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { MessagePanel } from "@/components/ui/message-panel";

/** The body of a "niet gevonden" page (#90): icon, heading, text, links. */
export function NotFoundPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <MessagePanel icon={SearchX} title={title} description={description}>
      {children}
    </MessagePanel>
  );
}
