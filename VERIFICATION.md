# Players update verification

- TypeScript strict check passed (`tsc --noEmit`).
- ESLint passed.
- All 20 Vitest tests passed: prior auth/config tests plus roster interaction and API contract tests.
- Server-render, EN/ID translation, and language storage smoke script passed.
- Vite production build passed; existing dependency annotation warnings and >500 kB chunk warning remain. Main JavaScript gzip: about 199 kB.
- Exported assets have valid SVG/PNG signatures; local fonts have TrueType signatures and OFL license.

Tests cover search/filter/pagination, blank names and skill boundaries, trimmed submission, archive confirmation/cancel, restore, retained fields after errors, pending-write protection, reference-protected deletion, list retry/empty state, stable query ordering and escaped wildcard search. API tests use mocks, not a live database. Auth tests isolate the roster component and ensure a non-host cannot reach it.

The checks used installed project binaries directly with Node 24.19; the environment's default pnpm differs from the project's pinned pnpm 10.8.0, so it was not used to reinstall or rewrite the lockfile. Dependencies and lockfile are unchanged from the login update.

## Limits

No hosted player records, migrations, grants, or Auth configuration were changed. Existing SQL/RPC contract was inspected; new browser-to-hosted-database CRUD must be tried with the user's account. All writes use courthost_command. No service-role credential is included.

jsdom verifies DOM interactions, not CSS layout or native dialog focus trapping. Browser visual QA could not run because the Chromium download failed. Responsive CSS and Figma values were reviewed, but pixel fidelity and native keyboard behavior still require a real browser check. Match and History remain disabled.

## Design source

- Roster: https://www.figma.com/design/AvWVgJiSI8JZVxPpdyP4UB/Belajar--Copy-?node-id=4190-5708
- Edit: https://www.figma.com/design/AvWVgJiSI8JZVxPpdyP4UB/Belajar--Copy-?node-id=4247-2000
- Logo, empty illustration and navigation/search icons exported read-only from the same file.
- Font: https://github.com/google/fonts/tree/main/ofl/plusjakartasans

Intentional functional/contrast adaptations are documented in PLAYERS_SETUP_ID.md.
