# volleyrumours.be

A Dutch-language community site for Belgian volleyball. Players, coaches and
clubs post classifieds (*zoekertjes*), and the community shares moderated
transfer rumours (*geruchten*).

**Before you change anything, read [CLAUDE.md](CLAUDE.md).** It holds the
workflow, the Definition of Done and the code conventions, for humans and AI
agents alike.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres + RLS,
Auth, Realtime) · shadcn/ui · Tailwind 4 · Playwright · Vercel.

## Getting started

You need Node 22, npm and Docker.

```bash
npm ci
npm run db:start      # local Supabase stack with seeded test data
npx supabase status   # prints the local API URL and keys
```

`db:start` skips Studio and the logging services, like CI does. Use
`npm run db:start:studio` when you want to browse the data in Studio
(http://127.0.0.1:54323). The stack takes a lot of RAM, so run
`npm run db:stop` when you're done testing.

Create `.env.local` with the local values from `npx supabase status`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
NEXT_PUBLIC_COMING_SOON=false
```

Then run `npm run dev` and open http://localhost:3000. Every seeded account
signs in with the password `test-wachtwoord`. The accounts are listed at the
top of [supabase/seed.sql](supabase/seed.sql).

## Checks

```bash
npm run typecheck
npm run lint
npm run format:check  # Prettier; npm run format fixes it
npm run build
npm run db:test       # pgTAP database tests
npm run test:e2e      # Playwright, against the local stack
```

CI runs all of these on every pull request. The full command list and the
other environment variables are in [CLAUDE.md](CLAUDE.md).

## Where things are

| Path | What |
| --- | --- |
| `app/` | Routes (Server Components) and Server Actions in `app/actions/` |
| `components/` | UI; shadcn primitives in `components/ui/` |
| `lib/` | Supabase clients, helpers, schemas |
| `supabase/` | Migrations (the schema's source of truth), seed data, database tests |
| `e2e/` | Playwright tests |
| `docs/product/` | User journeys, decision log, gap audit |

## Deployment

`main` is production. Every merge deploys to volleyrumours.be through Vercel.
Production database migrations are applied by the owner after merge.
