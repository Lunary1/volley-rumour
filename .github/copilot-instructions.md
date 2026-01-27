# Copilot Instructions for Volley-Rumour

## Project Overview

**Volley-Rumour** is a Next.js community platform for Belgian volleyball transfers and player/team listings. Users post transfer rumors ("geruchten"), confirm transfers, engage in discussions, create classified ads ("zoekertjes"), and earn reputation through community voting.

Key features: Transfer Talk (rumors), Confirmed Transfers, Leaderboard (reputation), Messages, Classifieds, User Profiles.

## Architecture & Key Patterns

### Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **UI**: Radix UI primitives + shadcn/ui components
- **Styling**: Tailwind CSS
- **Real-time**: Supabase Realtime subscriptions
- **Language**: TypeScript (strict mode, build errors ignored in config)

### Core Data Model

The database (see [schema.sql](schema.sql)) has three main content types:

1. **Rumours** → confirmed as **Transfers** (cross-table confirmation flow)
2. **Classifieds** (ad types: `team_seeks_trainer`, `player_seeks_team`, etc.)
3. **Conversations** & **Messages** (linked to transfers or classifieds via `ad_id` + `ad_type`)

Trust/reputation tracked via `profiles.trust_score` (incremented when rumors are confirmed).

### Server vs. Client Split

- **Server Actions** ([app/actions/](app/actions/)): All data mutations, auth checks, admin operations. Use `"use server"` directive.
- **Client Components**: Forms, real-time subscriptions, interactive UI. Use `"use client"` directive.
- **Hybrid**: Pages are Server Components by default; use `ChatInterface`, `HeaderClient`, etc. for client interactivity.

### Supabase Client Strategy

- **Server**: `createClient()` ([lib/supabase/server.ts](lib/supabase/server.ts)) — uses SSR pattern with cookies; create new instance per function.
- **Client**: `createClient()` ([lib/supabase/client.ts](lib/supabase/client.ts)) — browser-based.
- **Admin**: `createAdminClient()` — uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS; used sparingly for privileged operations (e.g., [rumour.ts#L67](app/actions/rumour.ts#L67) when confirming rumors).

⚠️ Critical: Always create server clients inside async functions, not globally, for Fluid compute compatibility.

### Real-time Subscriptions

[chat-interface.tsx](components/chat-interface.tsx#L63) demonstrates the pattern:

- Subscribe via `supabase.channel()` → `.on("postgres_changes", {...})` → `.subscribe()`
- Filter by `conversation_id` to avoid unnecessary updates
- Handle INSERT, UPDATE, DELETE events selectively
- Unsubscribe on component unmount

### Conversation Model

Conversations are bidirectional (see [messages.ts#L43](app/actions/messages.ts#L43)):

- Created between user and ad creator (`initiator_id`, `recipient_id`)
- Linked to ad via (`ad_id`, `ad_type`: `transfer_talk` or `classified`)
- Check both directions: `or(and(initiator_id.eq.X,recipient_id.eq.Y),and(initiator_id.eq.Y,recipient_id.eq.X))`

## Developer Workflows

### Local Development

```bash
npm run dev           # Start dev server (localhost:3000)
npm run build        # Build for production
npm run lint         # Run ESLint
npm start            # Prod start
```

### Environment Variables

Required for Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, for admin operations)

### Path Aliases

Use `@/` prefix: `import { createClient } from "@/lib/supabase/server"` (configured in [tsconfig.json](tsconfig.json#L32)).

### Cache Invalidation

Server Actions use `revalidatePath()` after mutations:

```typescript
await supabase.from("rumours").insert(rumourData);
revalidatePath("/geruchten"); // Refresh rumors list
revalidatePath("/"); // Refresh homepage
```

## Project-Specific Conventions

### File Organization

- **[app/actions/](app/actions/)**: Server Actions grouped by domain (auth.ts, rumour.ts, messages.ts, profile.ts, vote.ts)
- **[components/](components/)**: Reusable UI pieces; card patterns (rumour-card.tsx, transfer-card.tsx) wrap interactivity
- **[app/](app/)** page structure mirrors routes: `/app/geruchten/page.tsx` → `/geruchten`
- **[lib/supabase/](lib/supabase/)**: Client factories (client.ts, server.ts, proxy.ts for server-side proxying)
- **[hooks/](hooks/)**: Simple query hooks (use-current-user-name.ts, use-current-user-image.ts)

### Component Patterns

1. **Card Components**: `*-card.tsx` is the base display component; `*-card-interactive.tsx` wraps it with interactivity (buttons, modals).
   - Example: [classified-card.tsx](components/classified-card.tsx) + [classified-card-interactive.tsx](components/classified-card-interactive.tsx)
2. **Modal Dialogs**: Use Radix UI `Dialog` wrapped in client components (e.g., `ContactModal`)
3. **Forms**: React Hook Form + Resolvers for validation; submit via server actions
4. **Lists**: Paginate or lazy-load when needed; don't fetch all items at once

### Language & Localization

Content is in **Dutch** (nl locale). Use `date-fns/locale/nl` for dates:

```typescript
import { nl } from "date-fns/locale";
formatDistanceToNow(date, { locale: nl }); // e.g., "2 uur geleden"
```

### Error Handling

- Server Actions return `{ error: string }` or `{ success: true, data }` objects
- UI displays errors via toast or inline feedback
- Log errors to console during development; in production, consider Sentry

### Trust/Reputation System

- Users gain trust when rumors are confirmed (see [rumour.ts#L101](app/actions/rumour.ts#L101): `increment_trust_score` RPC)
- Leaderboard ranks users by `trust_score` (descending)
- Used for community credibility

## Integration Points & External Dependencies

### Supabase RLS (Row-Level Security)

- Profiles are readable but user data restricted; use admin client to bypass when needed
- Messages: Only visible to conversation participants
- Rumours/Transfers: Visible to all; only creator can edit
- Classifieds: Only creator can edit; visible to all

### Vercel Analytics

Integrated at [layout.tsx#L7](app/layout.tsx#L7): `<Analytics />` component tracks page views.

### Icons & Images

- **Icons**: Lucide React (e.g., `Flame`, `Menu` in header)
- **Avatars**: Supabase storage URLs or Lucide placeholders; use `Avatar` + `AvatarFallback` components

### Build Configuration

- TypeScript errors ignored by design ([next.config.mjs](next.config.mjs#L2)) — check lint instead
- Images unoptimized for static export compatibility

## Common Tasks

### Adding a New Page

1. Create `app/[feature]/page.tsx` (server component)
2. If interactive, extract client logic to separate file with `"use client"`
3. Fetch data in server component; pass as props to client components
4. Add nav item to `navItems` in [components/header.tsx](components/header.tsx#L7)

### Adding a Server Action

1. Create or add to [app/actions/domain.ts](app/actions/) with `"use server"` at top
2. Get auth user: `const { data: { user } } = await supabase.auth.getUser()`
3. Validate user permissions; return error if unauthorized
4. Perform DB operation; revalidate affected paths
5. Return success/error object

### Real-time Messaging

1. Use `ChatInterface` component ([components/chat-interface.tsx](components/chat-interface.tsx)) for established conversations
2. On mount, fetch initial messages via `getMessages()` server action
3. Subscribe to `messages` table changes; filter by `conversation_id`
4. Send messages via `sendMessage()` server action; component auto-adds optimistically

### Voting/Confirmation Flow

See [rumour.ts](app/actions/rumour.ts):

- `createRumour()` — user posts rumor
- `confirmRumour()` — moderator or admin confirms → creates transfer, increments trust
- Vote actions in [vote.ts](app/actions/vote.ts) likely handle up/down votes on rumors

## Testing & Debugging

- **ESLint**: `npm run lint` — enforce code quality
- **TypeScript**: Check types but build ignores errors; fix lint warnings proactively
- **Supabase Logs**: Check dashboard for RLS violations, query errors
- **Real-time Issues**: Verify `conversation_id` filtering; check Realtime settings in Supabase console
- **Auth Issues**: Inspect `supabase.auth.getUser()` response; confirm session cookies are set

## Known Quirks & Gotchas

1. **Server Client Creation**: Don't store `createClient()` result globally; always create per function to support Fluid compute
2. **Admin Client**: Only use with `SUPABASE_SERVICE_ROLE_KEY`; never expose in browser
3. **Bidirectional Queries**: Conversations queries need `or()` logic to work both ways
4. **Build Warnings**: TypeScript errors are ignored; rely on `npm run lint` instead
5. **Dutch Content**: All UI text, errors, and messages in Dutch; consistency is important

---

**Last updated**: January 2026 | Generated for AI-assisted development
