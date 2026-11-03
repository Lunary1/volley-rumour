import { NextResponse, type NextRequest } from "next/server";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  isConsent,
} from "@/lib/consent-cookie";

// The cookie banner's choice, set again from the server (#288): Safari caps a
// cookie set by JavaScript at 7 days, one set by the server lasts the full
// six months. The browser already holds the choice; this only extends it.
export async function POST(request: NextRequest) {
  const choice = (await request.text()).trim();
  if (!isConsent(choice)) {
    return new NextResponse(null, { status: 400 });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(CONSENT_COOKIE, choice, {
    maxAge: CONSENT_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}
