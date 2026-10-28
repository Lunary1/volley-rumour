import { expect, test } from "./fixtures";

// Security headers on every response (#266): no framing by other sites, no
// full URLs leaking to them, no MIME sniffing, and no camera, microphone or
// location.

const EXPECTED = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

for (const path of ["/", "/privacy", "/zoekertjes"]) {
  test(`${path} sends the security headers`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    for (const [name, value] of Object.entries(EXPECTED)) {
      expect(headers[name], name).toBe(value);
    }
  });
}
