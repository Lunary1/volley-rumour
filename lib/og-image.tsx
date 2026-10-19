import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Share images (#99): one look for the site, zoekertjes and rumours. They
// show only what the page itself shows, never the poster or the author.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// The dark theme's colours (app/globals.css).
const BACKGROUND = "#0b1220";
const FOREGROUND = "#f5f5f5";
const MUTED = "#a3a3a3";
const PRIMARY = "#2fb35a";

let logo: Promise<string> | undefined;

/** The white wordmark as a data URL, read once per server. */
function logoDataUrl(): Promise<string> {
  logo ??= readFile(
    join(process.cwd(), "public/volleyrumours_logo_text_inverted.png"),
  ).then((data) => `data:image/png;base64,${data.toString("base64")}`);
  return logo;
}

export async function brandImage({
  eyebrow,
  title,
  subtitle,
}: {
  /** Small label above the title, e.g. "Zoekertje" */
  eyebrow: string;
  title: string;
  subtitle?: string;
}): Promise<ImageResponse> {
  const titleSize = title.length > 60 ? 56 : title.length > 32 ? 68 : 84;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: BACKGROUND,
        color: FOREGROUND,
        borderTop: `16px solid ${PRIMARY}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img */}
      <img src={await logoDataUrl()} alt="" width={420} height={86} />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 600,
            color: PRIMARY,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.1,
            // Two or three lines at most; longer titles are cut off.
            maxHeight: titleSize * 1.1 * 3,
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ display: "flex", fontSize: 36, color: MUTED }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
        volleyrumours.be
      </div>
    </div>,
    OG_SIZE,
  );
}
