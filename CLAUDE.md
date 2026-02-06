# CLAUDE.md

## Project Overview

**Volley-Rumour** (volleyrumours.be) is a community-driven Belgian volleyball transfers platform built with Next.js. Users post transfer rumours, confirm transfers, create classified ads, message each other, and earn reputation through community voting. All user-facing content is in **Dutch (nl)**.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Language**: TypeScript 5 (strict mode)
- **Database/Auth**: Supabase (PostgreSQL with RLS, Supabase Auth with SSR)
- **UI**: shadcn/ui (new-york style) with Radix UI primitives
- **Styling**: Tailwind CSS 4 with CSS variables (oklch color format), dark mode via `next-themes`
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Supabase Realtime subscriptions
- **Icons**: Lucide React
- **Analytics**: Vercel Analytics & Speed Insights
- **Deployment**: Vercel

## Commands

```bash
npm run dev       # Start dev server on localhost:3000
npm run build     # Production build (TypeScript errors are ignored via next.config.mjs)
npm run start     # Start production server
npm run lint      # Run ESLint
```

There is no test framework configured. Linting (`npm run lint`) is the primary code quality check.

## Project Structure

```
app/
  actions/          # Server Actions (auth, rumour, vote, messages, profile, contact)
  auth/             # Auth pages (login, sign-up)
  geruchten/        # Rumours pages (list, create new)
  zoekertjes/       # Classifieds pages (list, create, detail)
  messages/         # Messaging pages (list, conversation)
  transfers/        # Confirmed transfers page
  leaderboard/      # Reputation leaderboard
  profile/          # User profile
  contact/          # Contact form
  layout.tsx        # Root layout
  page.tsx          # Homepage
components/
  ui/               # shadcn/ui primitives (button, card, dialog, select, etc.)
  header.tsx        # Navigation header
  rumour-card.tsx   # Rumour display + rumour-detail-modal.tsx
  classified-card.tsx  # Classified display
  chat-interface.tsx   # Real-time chat with Supabase subscriptions
  *-interactive.tsx    # Client wrappers adding interactivity to card components
lib/
  supabase/
    server.ts       # Server-side Supabase client (SSR with cookies)
    client.ts       # Browser-side Supabase client
    proxy.ts        # Middleware for session refresh
  schemas.ts        # Zod validation schemas (Dutch error messages)
  response.ts       # ActionResponse<T> type and helper functions
  utils.ts          # General utilities
  client-utils.ts   # Client-side helpers (toast handling for server action responses)
  classifieds-utils.ts  # Lookup tables (divisions, provinces, ad types)
hooks/              # React hooks (use-current-user-name, use-current-user-image)
public/             # Static assets (logos, placeholders)
```

## Architecture Patterns

### Server vs Client Split

- **Pages** are async Server Components by default. Data is fetched directly in page components.
- **Server Actions** (`app/actions/`) handle all mutations with `"use server"` directive.
- **Client Components** use `"use client"` for forms, real-time subscriptions, and interactive UI.
- Static revalidation is set to 60 seconds on key pages (home, rumours, transfers).

### Supabase Client Strategy

- **Server**: `createClient()` from `@/lib/supabase/server` — uses SSR cookies pattern. Always create a new instance inside each async function (never store globally) for Fluid Compute compatibility.
- **Browser**: `createClient()` from `@/lib/supabase/client` — standard browser client.
- **Admin**: `createAdminClient()` from `@/lib/supabase/server` — uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS. Use sparingly for privileged operations only.

### Server Action Response Pattern

All server actions return `ActionResponse<T>`:

```typescript
import { successResponse, errorResponse } from "@/lib/response";

// Success: { success: true, data: T }
return successResponse(data);

// Error: { success: false, error: string }
return errorResponse("Error message in Dutch");
```

On the client, use `handleServerActionResponse()` from `@/lib/client-utils` for toast-based feedback.

### Component Split Pattern

Card components follow a two-file pattern:
- `*-card.tsx` — Pure display (can be server component)
- `*-card-interactive.tsx` — Client wrapper adding buttons, modals, voting

### Form Validation

All forms use React Hook Form with Zod schemas from `@/lib/schemas.ts`. Validation messages are in Dutch.

### Real-time Subscriptions

Used in `ChatInterface` and vote components:

```typescript
const channel = supabase
  .channel(`channel-name`)
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tablename", filter: "..." }, callback)
  .subscribe();

// Cleanup on unmount
return () => { supabase.removeChannel(channel); };
```

### Cache Invalidation

Server actions call `revalidatePath()` after mutations to refresh affected routes:

```typescript
revalidatePath("/geruchten");
revalidatePath("/");
```

## Key Conventions

### Language and Localization

- All UI text, error messages, form validation, and toast messages are in **Dutch**.
- Date formatting uses `date-fns` with the Dutch locale: `import { nl } from "date-fns/locale"`.
- Keep all new user-facing strings in Dutch for consistency.

### Authentication Pattern

```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return errorResponse("Je moet ingelogd zijn");
```

### Conversation Model

Conversations are bidirectional between initiator and recipient, linked to a transfer or classified via `ad_id` + `ad_type`. Always query both directions:

```typescript
.or(`and(initiator_id.eq.${userId},recipient_id.eq.${otherId}),and(initiator_id.eq.${otherId},recipient_id.eq.${userId})`)
```

### Imports

Use the `@/` path alias for all imports (maps to project root via tsconfig):

```typescript
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
```

### Styling

- Tailwind CSS utility classes with custom CSS variables in oklch format.
- Use `cn()` utility from `@/lib/utils` for conditional/merged class names.
- Dark mode supported via `next-themes` — use `dark:` variant classes.
- The design uses a cyberpunk/neon gradient aesthetic.

### Error Handling

- Server actions use `extractErrorMessage()` from `@/lib/response` to normalize Supabase errors.
- Common Supabase error codes are mapped to Dutch messages (e.g., `23505` -> "Dit item bestaat al").
- Default fallback: "Er ging iets mis. Probeer het later opnieuw."

## Environment Variables

Required:

```
NEXT_PUBLIC_SUPABASE_URL       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anonymous key (public)
SUPABASE_SERVICE_ROLE_KEY      # Supabase service role key (server-only, never expose to browser)
```

## Build Notes

- TypeScript build errors are **ignored** (`typescript.ignoreBuildErrors: true` in `next.config.mjs`). Use `npm run lint` for code quality checks.
- Images are unoptimized (`images.unoptimized: true`).
- No test suite is configured — no test runner, no test files.

## Common Tasks

### Adding a New Page

1. Create `app/[route]/page.tsx` as an async server component
2. Fetch data with Supabase directly in the page
3. Extract interactive parts into separate `"use client"` components
4. Add navigation entry in `components/header.tsx` (`navItems` array)

### Adding a Server Action

1. Add to or create a file in `app/actions/` with `"use server"` at top
2. Authenticate: `const { data: { user } } = await supabase.auth.getUser()`
3. Validate input with Zod schema from `@/lib/schemas.ts`
4. Perform DB operation via Supabase client
5. Call `revalidatePath()` for affected routes
6. Return `successResponse()` or `errorResponse()`

### Adding a shadcn/ui Component

The project uses shadcn/ui with the `new-york` style. Components are in `components/ui/`. The config is in `components.json` with Supabase registry support.

## Business Domain

- **Rumours** ("geruchten"): Community-posted transfer rumours with upvote/downvote voting
- **Transfers**: Confirmed rumours promoted to official transfers
- **Classifieds** ("zoekertjes"): Marketplace listings — types: `player_seeks_team`, `team_seeks_player`, `trainer_seeks_team`, `team_seeks_trainer`
- **Trust/Reputation**: Users earn trust points when their rumours are confirmed (+5 via `increment_trust_score` RPC). Leaderboard ranks by `trust_score`.
- **Divisions**: Belgian volleyball league hierarchy (Liga, Nationale 1-3, Promo 1-4) plus international leagues
