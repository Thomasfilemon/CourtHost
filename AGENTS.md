# CourtHost Codex Instructions

These instructions apply to the entire repository. Read `COURTHOST_PRODUCT_SPEC.md` and `COURTHOST_DATABASE_MODEL.md` before changing domain logic, database migrations, authorization, matchmaking, scoring, or session state.

## Product invariants

Never violate these rules unless the specification is deliberately updated first:

- CourtHost manages one tennis venue, one host, and one court in the MVP.
- A session is either singles or doubles, never mixed.
- Only one match may be playing in a session.
- A completed match distributes exactly four match points.
- Valid final scores are `4-0`, `3-1`, `2-2`, `1-3`, and `0-4`.
- Finishing a match never starts the next match automatically.
- Leaderboards are per session and rank individual players.
- Doubles players each receive their team's full result.
- Completed matches survive withdrawals and future schedule regeneration.
- Completed/cancelled sessions are read-only.
- Players have no accounts; shared links are anonymous and read-only.
- All privileged writes must be protected by Supabase Auth and RLS/database functions.
- Visible copy must come from English/Indonesian translation resources.

## Preferred stack

- TypeScript with strict mode
- React + Vite
- React Router
- Tailwind CSS
- Radix UI primitives where accessible behavior is useful
- React Hook Form + Zod
- TanStack Query
- Supabase JS
- i18next + react-i18next
- Vitest + Testing Library
- Playwright only for critical end-to-end flows
- pnpm

Do not introduce Next.js, Redux, Zustand, a custom backend server, an ORM, or a heavyweight component framework without a written reason and user approval.

## Architecture rules

- Organize by feature/domain rather than one giant components folder.
- Keep domain logic in pure TypeScript modules that are easy to unit test.
- Keep Supabase calls in explicit data-access modules; React components must not contain raw SQL-shaped business logic.
- Treat server data as TanStack Query state, form input as React Hook Form state, URL state as router state, and small transient UI state as local React state.
- Do not duplicate derived state in a global store.
- Validate at UI boundaries with Zod and enforce critical rules again in PostgreSQL.
- Generate database types from Supabase and do not hand-edit generated files.
- Use stable enum keys internally; translate them only for display.
- Prefer named exports and small, composable functions.
- Avoid premature abstractions. Two similar blocks are cheaper than one bad framework invented at 2 a.m.

Suggested source layout:

```text
src/
  app/
  components/
  features/
    auth/
    players/
    sessions/
    matches/
    leaderboard/
    public-session/
  lib/
    i18n/
    supabase/
  routes/
  test/
supabase/
  migrations/
  seed.sql
```

## Matchmaking implementation

- Implement generation as deterministic pure functions when supplied a seeded random source.
- Return a proposed schedule; persistence happens separately in a transaction.
- Prioritize the fewest appearances, then format validity, then balance, then partner rotation.
- Random mode must still preserve appearance fairness.
- Skill mode compares player rating difference for singles and team rating sums for doubles.
- Never use previous sessions.
- Include tests for 2–12 players, odd player counts, ties, repeated generation batches, and withdrawals.
- Never use unbounded combinatorial search. Keep the algorithm responsive on an old laptop and ordinary phone.

## Supabase and migrations

- Never edit an already-applied migration. Add a new timestamped migration.
- Use lowercase snake_case for database identifiers.
- Enable RLS on every application table.
- Never solve authorization by hiding UI controls.
- Anonymous users receive public session data only through the approved token-scoped interface.
- Never expose `service_role` credentials to the browser.
- Use RPC/database functions for multi-row state transitions.
- Migrations must include constraints, indexes, RLS policies, grants, and comments where behavior is non-obvious.
- Add database tests for every new invariant.
- Preserve skill and name snapshots for history.

## UI and copy

- Implement mobile-first, then enhance for wider screens.
- Match the approved Figma direction; do not redesign unrelated screens while implementing a feature.
- Host UI can edit; public player UI is strictly read-only.
- Use semantic HTML and basic keyboard/focus support even though formal accessibility certification is outside MVP.
- Avoid heavy animation, large runtime libraries, autoplay media, and oversized images.
- Every loading, empty, error, disconnected, and success state needs deliberate copy.
- Do not hardcode user-visible text in components.

## Performance constraints

The development machine is an older Windows 10 laptop using Git Bash.

- Prefer targeted commands over whole-repository work.
- Do not start multiple dev servers or watchers unless required.
- Avoid Docker for the normal frontend workflow. Use the Supabase CLI only when database/local-stack work requires it.
- Avoid dependencies that duplicate existing capability.
- Use dynamic imports only for genuinely heavy, infrequently used routes.
- Keep tests focused during iteration; run the full suite before handoff.

## Working method

Before editing:

1. Inspect the relevant files and current git diff.
2. State the intended change briefly.
3. Identify which product/database invariants are affected.

While editing:

1. Make the smallest coherent change.
2. Preserve unrelated user work.
3. Add or update tests with the implementation.
4. Do not silently invent product behavior. Ask when the specs do not decide a material outcome.

After editing:

1. Run the narrowest relevant checks first.
2. Run typecheck, lint, and affected tests.
3. For migrations, test both forward behavior and RLS/permission boundaries.
4. Summarize changed files, behavior, verification, and any remaining risk.

## Commands

Prefer repository scripts. Expected commands once scaffolded:

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

In Git Bash, use forward-slash paths. Do not assume PowerShell syntax. Do not require globally installed Node packages when `pnpm dlx` or a project script can do the job.

## Definition of done

A change is complete only when:

- The requested behavior works in the applicable host and/or public flow.
- Domain rules remain consistent with the product spec.
- Authorization is enforced at the database boundary.
- English and Indonesian keys exist for new copy.
- Loading/error/empty states are handled.
- Relevant tests pass.
- Typecheck and lint pass.
- No secrets, generated clutter, or unrelated edits are committed.

