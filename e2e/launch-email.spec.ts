import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";
import { emailsTo, waitForEmails } from "./mailpit";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// The launch email (#253): scripts/launch-email.mjs sends it to the waitlist
// on the local stack, through Mailpit's SMTP port, and never sends an address
// twice.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const run = (args: string[], state: string) =>
  execFileSync("node", ["scripts/launch-email.mjs", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "54325",
      SMTP_USER: "",
      LAUNCH_EMAIL_STATE: state,
    },
  });

test("the launch email reaches every waitlist address once", async () => {
  const id = randomUUID().slice(0, 8);
  const addresses = [
    `launch-a-${id}@example.com`,
    `launch-b-${id}@example.com`,
  ];
  const { error } = await admin
    .from("waitlist_subscribers")
    .insert(addresses.map((email) => ({ email })));
  expect(error).toBeNull();

  try {
    const state = join(mkdtempSync(join(tmpdir(), "launch-")), "sent.json");
    const sentAt = new Date(Date.now() - 1_000);

    // Without --send it only counts.
    expect(run([], state)).toContain("Nothing sent");
    expect(await emailsTo(addresses[0], sentAt)).toHaveLength(0);

    run(["--send", "--limit", "10000"], state);
    for (const address of addresses) {
      const [email] = await waitForEmails(address, sentAt);
      expect(email.Subject).toBe("VolleyRumours is live");
      expect(email.HTML).toContain("Maak je account");
      expect(email.HTML).toContain(
        "https://volleyrumours.be/auth/sign-up?utm_source=waitlist",
      );
      expect(email.Text).toContain("op de wachtlijst van volleyrumours.be");
    }
    expect(JSON.parse(readFileSync(state, "utf8"))).toEqual(
      expect.arrayContaining(addresses),
    );

    // A second run sends nothing to them again.
    expect(run(["--send", "--limit", "10000"], state)).toContain(
      "0 still to go",
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    for (const address of addresses) {
      expect(await emailsTo(address, sentAt)).toHaveLength(1);
    }
  } finally {
    await admin.from("waitlist_subscribers").delete().in("email", addresses);
  }
});
