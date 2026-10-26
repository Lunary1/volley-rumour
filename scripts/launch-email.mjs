// Sends the launch email (emails/launch.mjs) to the waitlist (#253, #95).
// Run by the owner, once, at launch: docs/supabase.md "Launch email" has the
// steps. Agents never run it against production.
//
//   npm run launch-email -- --preview launch.html  write the email to a file
//   npm run launch-email -- --to you@example.com   send one test email
//   npm run launch-email                           count, send nothing
//   npm run launch-email -- --send                 send the next batch
//   npm run launch-email -- --send --limit 500     a bigger batch (Resend Pro)
//
// Env (put production values in .env.production.local and run with
// `node --env-file=.env.production.local scripts/launch-email.mjs ...`):
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to read the waitlist,
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM to send, as
// for the app (lib/email.ts).
//
// Every address gets its own email. Each address that was sent is written to
// a state file (.launch-email-sent.json, git-ignored) straight away, so a
// second run, the next day's batch or a run after an error never sends the
// same address twice. The default batch of 90 stays under Resend's free 100
// emails a day, with room for the day's sign-up emails.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { launchEmail } from "../emails/launch.mjs";

const { values: args } = parseArgs({
  options: {
    preview: { type: "string" },
    to: { type: "string" },
    send: { type: "boolean", default: false },
    limit: { type: "string", default: "90" },
    state: {
      type: "string",
      default: process.env.LAUNCH_EMAIL_STATE ?? ".launch-email-sent.json",
    },
  },
});

const email = launchEmail();

if (args.preview) {
  writeFileSync(args.preview, email.html);
  console.log(`Wrote ${args.preview} ("${email.subject}")`);
  process.exit(0);
}

function transport() {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_HOST is not set: nothing can be sent.");
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASSWORD } : undefined,
  });
}

const FROM = process.env.EMAIL_FROM ?? "VolleyRumours <info@volleyrumours.be>";

async function sendTo(smtp, to) {
  await smtp.sendMail({
    from: FROM,
    replyTo: "info@volleyrumours.be",
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

if (args.to) {
  await sendTo(transport(), args.to);
  console.log(`Test email sent to ${args.to}.`);
  process.exit(0);
}

// Once Supabase has been read, the script ends on its own instead of with
// process.exit(): on Windows, exiting while fetch's connection is still open
// crashes Node ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)").
async function sendToWaitlist() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to read the waitlist.",
    );
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from("waitlist_subscribers")
    .select("email")
    .order("subscribed_at", { ascending: true });
  if (error) throw error;

  const sent = new Set(
    existsSync(args.state) ? JSON.parse(readFileSync(args.state, "utf8")) : [],
  );
  const all = [...new Set(data.map((row) => row.email.trim().toLowerCase()))];
  const todo = all.filter((address) => !sent.has(address));
  const limit = Number(args.limit);
  const batch = todo.slice(0, limit);

  console.log(
    `Waitlist on ${new URL(url).host}: ${all.length} addresses, ${all.length - todo.length} already sent, ${todo.length} to go.`,
  );

  if (!args.send) {
    console.log(
      `Nothing sent. Add --send to send the next ${batch.length} (--limit ${limit}).`,
    );
    return;
  }

  const smtp = transport();
  let failed = 0;
  for (const [i, address] of batch.entries()) {
    try {
      await sendTo(smtp, address);
      sent.add(address);
      writeFileSync(args.state, JSON.stringify([...sent], null, 2));
      console.log(`${i + 1}/${batch.length} sent`);
    } catch (err) {
      failed += 1;
      console.error(`${i + 1}/${batch.length} failed: ${err.message}`);
    }
    // Resend allows a few emails a second; stay well under it.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  const left = todo.length - (batch.length - failed);
  console.log(
    `Done: ${batch.length - failed} sent, ${failed} failed, ${left} still to go.` +
      (left === 0
        ? " Everyone has it: delete the waitlist now (docs/supabase.md)."
        : " Run again with --send for the rest."),
  );
  if (failed > 0) process.exitCode = 1;
}

await sendToWaitlist();
