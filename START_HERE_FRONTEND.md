> **Pembaruan login:** panduan ini menjelaskan starter pertama. Setelah memasang login, ikuti `LOGIN_SETUP_ID.md`; frontend kini memakai Supabase dan memerlukan `.env.local`.

# CourtHost — get the first page running

## Where you are

You have a hosted Supabase backend and a host profile. This package adds the first
React frontend to your existing Windows VS Code workspace.

The goal of THIS step: open a CourtHost welcome page in your browser and switch
between English and Indonesian. Login, player management, and Figma session
screens come after this step.

The welcome page is a provisional starter, not the final approved Figma design.
Its comments mark exactly where later work belongs. No Supabase requests are made
by this page; seeing it load is not a database connection test.

## 1. Check your terminal

Open VS Code's Git Bash terminal in your existing CourtHost folder:

```bash
# Print the current folder. It should end with /CourtHost.
pwd

# Check tools. Node must be 22.13.0 or newer for this package.
node --version
pnpm --version
```

Your original package used pnpm 10.8.0, so the starter preserves that declaration.
If Node is too old, install a supported Node LTS version from https://nodejs.org/
and reopen VS Code. No WSL or Docker is required for this frontend.

## 2. Add the files to the EXISTING folder

Extract CourtHost_Frontend_Starter.zip outside your project first. Open the extracted
`courthost-frontend-starter` folder.

Copy its CONTENTS into your current `CourtHost` project root — the same level as
`AGENTS.md` and your existing `package.json`.

Before replacing package.json, you can back up the small original:

```bash
# Run once, before copying the starter over package.json.
cp -n package.json package.backup.json
```

The replacement package.json keeps the Supabase CLI and adds frontend packages.
The package name changes from CourtHost to lowercase courthost for package-name
conventions. The visible product name remains CourtHost.

Copy:

- `src/` — a NEW folder containing your frontend source
- `scripts/` — a small render/translation smoke check
- `MULAI_DI_SINI.md` — Indonesian quick-start guide
- `VERIFICATION.md` — what was checked and remaining limitations
- `index.html`
- `package.json` — replace the original manifest you sent
- `pnpm-lock.yaml` — replace the existing dependency lockfile with the tested one
- `tsconfig.json`
- `vite.config.ts`
- `eslint.config.js`
- `START_HERE_FRONTEND.md`
- `GITIGNORE_FRONTEND.txt`

Your project root should now contain BOTH `src/` and `supabase/`.
Do not put the starter under `supabase/`, and do not create
`CourtHost/courthost-frontend-starter/src/` as your active application.

The archive does not contain your original docs, migrations, AGENTS.md, or
Supabase config. Leave those existing files in place.

### Your database.types.ts is already included

You do not need to create this folder yourself:

`src/lib/supabase/database.types.ts`

It is the generated file from the backend handoff, copied into the correct
location. It provides autocomplete and type checking. It never creates tables or
runs migrations. Do not edit generated types manually.

### Keep local files out of Git

Open your EXISTING root `.gitignore` and add the rules in
`GITIGNORE_FRONTEND.txt`. Keep any rules already there. Alternatively:

```bash
# Append rules; do not overwrite your existing ignore file.
cat GITIGNORE_FRONTEND.txt >> .gitignore
```

No environment file or API key is needed at this stage.

## 3. Install and run

From the CourtHost root:

```bash
# Download the libraries listed in package.json into node_modules.
pnpm install

# Start the local website. Leave this terminal running.
pnpm dev
```

The first install may take a while depending on your connection. Later starts
are faster; you do not need to reinstall every time.

Open the Local address printed by Vite, normally:

http://127.0.0.1:5173

If that port is busy, Vite may choose a different one; use the printed address.
Stop the server with Ctrl+C when finished.

Expected result:

- CourtHost branding and “More tennis. Less paperwork.”
- A message saying the first page is running
- EN and ID buttons that change the page language
- A list of the next development steps

Do not run supabase db push, db reset, or any migration for this step.

## 4. What each file does

| File | Plain-English purpose |
|---|---|
| package.json | Shopping list of libraries plus shortcuts such as dev and build. JSON does not allow comments, so its explanations live here. |
| pnpm-lock.yaml | Exact dependency versions so another install uses the same dependency tree. Generated, not hand-written. |
| index.html | The browser's first file; provides the root container for React. |
| src/main.tsx | Starts React, loads translations/styles, and displays App. |
| src/app/App.tsx | The visible welcome page. Start reading here. |
| src/styles.css | The starter page's appearance and responsive layout. Provisional styling is clearly marked. |
| src/lib/i18n/index.ts | Sets up translations and remembers the language preference. |
| src/lib/i18n/en.json | English words shown on screen. |
| src/lib/i18n/id.json | Indonesian words shown on screen. |
| src/lib/supabase/database.types.ts | Types describing the existing database. No connection is created here. |
| vite.config.ts | Vite setup for React, Tailwind, and the local dev server. |
| tsconfig.json | TypeScript's code-checking rules. This config format permits explanatory comments. |
| eslint.config.js | Checks for common coding mistakes. |

The loading order is: index.html loads main.tsx, main.tsx initializes translations
and styles, and React draws App.tsx in the root container.

### CLI versus browser client

The existing `supabase` dependency is a developer CLI used in Git Bash.
It does not automatically connect the website to the database.

Later, we will add `@supabase/supabase-js` and create
`src/lib/supabase/client.ts` for the website's database connection.
That step will include clearly labeled URL/key placeholders and a host-login flow.

### Why not install every planned library yet?

React, Vite, TypeScript, Tailwind, translation support, and linting are enough for
this small step. Routing, query caching, forms, and tests for domain behavior will
be added when the corresponding feature needs them. This keeps the first lesson
and the old laptop's workload manageable.

## 5. A safe first edit

While pnpm dev is running:

1. Open `src/lib/i18n/en.json`.
2. Find `title`.
3. Temporarily change its value to `CourtHost is alive.`.
4. Save. Your browser should update automatically.
5. Switch to ID: the Indonesian title stays independent.

That automatic browser update is Vite's hot reload. It affects your local page;
it does not change Supabase or publish a website.

## 6. Optional code checks

```bash
# Check TypeScript types.
pnpm typecheck

# Check for common source-code mistakes.
pnpm lint

# Produce deployable frontend files in dist/. This does NOT deploy them.
pnpm build
```

Run pnpm dev on ordinary development days. The other commands are useful before
committing or sharing changes. Run `pnpm test` for a small React render and translation check. This uses mocked
browser storage; it does not replace a real browser or database test.

## Troubleshooting

| Symptom | What to do |
|---|---|
| Missing script: dev | You are in the wrong folder or the replacement package.json was not copied. |
| Cannot find module / vite not found | Run pnpm install in the CourtHost root. |
| Node version warning | Install a supported Node LTS at or above 22.13, then reopen VS Code. |
| Browser cannot connect | Keep pnpm dev running and use its printed Local URL. |
| Port changed | Use the URL Vite prints; another application is using 5173. |
| A command fails | Stop at that step and share the terminal error text. Do not start resetting Supabase. |
| I cannot log in yet | Expected: host login is the next feature, not present on this starter page. |

## Next step after the page works

Host sign-in and the frontend Supabase client. Then we implement player/session
screens using the approved Figma design and existing backend RPCs.

Frontend code must use the backend handoff's current API:
`courthost_command` for writes and `get_public_session` for anonymous session
reads. Do not reintroduce obsolete functions such as submit_score or
generate_next_match, and do not recreate the database.

## Checked references

- Vite installation and Node requirements: https://vite.dev/guide/
- Existing backend contract: your courthost-backend/README.md
