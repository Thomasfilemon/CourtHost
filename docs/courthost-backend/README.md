# CourtHost backend handoff

Applied to Supabase project `testing` (`obqcnqkaqescgayxarwb`) on 2026-09-16.

## What is already done

The existing tables were repaired in place. Do not run the bundled applied migrations again in this project.

Recorded migration versions:

- `20260916172355_courthost_repair_backend`
- `20260916172556_courthost_fix_generator_aliases`

These are incremental migrations against the inspected existing database, NOT a complete baseline for an empty project. Keep the six original SQL files as historical source material. The old generator and other standalone functions were not included in those six files; rebuilding a separate environment needs a consolidated baseline first.

Copy `applied-migrations/*.sql` into your repository's `supabase/migrations/` with these exact filenames. Copy `database.types.ts` to `src/lib/supabase/database.types.ts`. Keep the tests and this guide in the repository too. No Docker is needed to use the hosted backend.

## Verification

- Core rollback-only SQL suite: 53 checks passed.
- Extended rollback-only SQL suite: 30 checks passed.
- Coverage includes singles 2–12 players, doubles 4–12 players, repeated batch fairness, valid doubles team partitions, scoring, permission denials, withdrawal, finalization, token rotation/revocation, and historical stability.
- Database invalidation broadcast was received by a real anonymous WebSocket client.
- Supabase security advisor returned no findings after the repairs.
- Tests rolled back fixture Auth users, host profiles, players, and sessions.
- This is database/API verification, not a finished frontend or browser UI test.
- Head-to-head ranking is implemented but has not received a dedicated fixture test in these two suites.
- Parallel request stress testing and large-roster load testing have not been performed.

The extended suite assumes a Realtime client has joined the project recently. Supabase creates its daily message partitions on first connection. Without a connection, the broadcast assertion can fail even though the trigger is installed correctly. See https://supabase.com/docs/guides/troubleshooting/realtime-warn-sending-broadcast-message

## Provision the one host

No host account or profile was created for you. The database allows one profile in this MVP.

1. In Supabase Authentication, create/select the intended Auth user. Use a real email you control. Do not share credentials in chat.
2. Copy that user's UUID.
3. Run this in the Supabase SQL Editor, replacing both placeholders:

```sql
insert into public.profiles (id, full_name, role)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid, 'REPLACE_WITH_HOST_NAME', 'host');
```

Regular signups do not receive a host profile. Profiles cannot be inserted or edited by browser clients.

Configure Auth Site URL and redirect URLs for your local Vite app and eventual deployed app. Choose OTP/Magic Link in the frontend. Email delivery, Auth redirects, and login UX still need frontend integration and validation.

## Current schema names

Keep the existing names in frontend code:

| Concept | Database |
|---|---|
| Session format | `game_mode: singles / doubles` |
| Generator | `matchmaking_mode: random / skill_based` |
| Live session | `status: active` |
| Session states | `draft / scheduled / active / completed / cancelled` |
| Upcoming match | `status: scheduled` |
| Playing match | `status: in_progress` |
| Participants | `match_players`, `team: 1 / 2` |
| Four-point scores | `team1_score / team2_score` |
| Frozen name/rating | `session_players.name_snapshot / skill_rating` |
| Final leaderboard | `sessions.final_leaderboard` JSON snapshot |

The earlier database-model document is conceptual. This guide and the generated types describe the implemented API. This implementation retains a single shared venue roster, uses a single-host constraint, and stores final leaderboards on sessions instead of in another table.

## Reads and writes

Authenticated hosts can SELECT their session data and the venue roster using the Supabase client. Direct client INSERT/UPDATE/DELETE is disabled. All mutations use:

```ts
const { data, error } = await supabase.rpc('courthost_command', {
  p_action: 'create_player',
  p_data: { name: 'Andi', skill: 7 },
});
if (error) throw error;
```

An authenticated account without the provisioned profile cannot mutate data.

### Action reference

| p_action | p_data |
|---|---|
| create_player | name, optional skill (default 5) |
| update_player | player_id, optional name, skill, is_active |
| archive_player | player_id |
| delete_player | player_id; only if unreferenced |
| create_session | name, start_time (ISO timestamp), duration_minutes, game_mode, matchmaking_mode, optional estimated_match_minutes (default 20), optional player_ids UUID array |
| edit_session | session_id and any setup fields above except player_ids; draft only |
| add_player | session_id, player_id; draft only |
| remove_player | session_id, player_id; draft only |
| generate_batch | session_id, optional allow_overtime boolean |
| reset_schedule | session_id; draft/scheduled only; removes schedule and returns to draft |
| start_match | match_id |
| save_score | match_id, team1_score, team2_score |
| finish_match | match_id, optional team1_score and team2_score; otherwise uses saved scores |
| correct_result | match_id, team1_score, team2_score; active session only |
| cancel_match | match_id, optional reason |
| withdraw_player | session_id, session_player_id |
| end_session | session_id |
| cancel_session | session_id; no completed results permitted |
| revoke_share | session_id |
| rotate_share | session_id; returns new public_code |
| delete_session | session_id; terminal sessions only; soft deletion |

Inputs and return values use JSON. Add typed feature-level Zod schemas in the frontend; generated database types cannot express all per-action JSON shapes.

Show confirmation dialogs before resetting schedules, cancelling matches, correcting results, ending/deleting sessions, and rotating/revoking links.

## Flow examples

```ts
// Create a draft with selected roster players.
await supabase.rpc('courthost_command', {
  p_action: 'create_session',
  p_data: {
    name: 'Saturday Tennis',
    start_time: new Date().toISOString(),
    duration_minutes: 120,
    estimated_match_minutes: 20,
    game_mode: 'doubles',
    matchmaking_mode: 'skill_based',
    player_ids: selectedPlayerIds,
  },
});

// Generate the first fair batch; this changes draft to scheduled.
await supabase.rpc('courthost_command', {
  p_action: 'generate_batch', p_data: { session_id: sessionId },
});

// Each action is explicitly initiated by the host.
await supabase.rpc('courthost_command', {
  p_action: 'start_match', p_data: { match_id: matchId },
});
await supabase.rpc('courthost_command', {
  p_action: 'save_score',
  p_data: { match_id: matchId, team1_score: 1, team2_score: 1 },
});
await supabase.rpc('courthost_command', {
  p_action: 'finish_match',
  p_data: { match_id: matchId, team1_score: 3, team2_score: 1 },
});
```

Handle `error` for every call; the condensed examples omit repetitive handling.

Finish does not auto-start the next match. End Session rejects an in-progress match: finish it or explicitly cancel it first. A single active session and playing match are enforced across the venue.

For a withdrawal, first finish/cancel any playing match containing that player. Then call withdraw_player. Completed results remain; affected upcoming matches are cancelled. Call generate_batch to append a new fair batch using remaining players. Unaffected upcoming matches remain.

Before session start, full regeneration is reset_schedule followed by generate_batch. If generation fails, the session remains a valid editable draft. Manual match reordering and substitute-player insertion are not exposed in this iteration.

## Matchmaking guarantees and limits

The server uses a greedy algorithm with appearance counts from all non-cancelled assignments, including upcoming matches. Each batch covers every available player. Among equally used players, uncovered players are preferred.

Random mode shuffles fair candidates. Skill singles picks a fair first player and the closest equally eligible opponent. Skill doubles compares all three team partitions for the selected four players, then prefers less-repeated partners. This is a bounded heuristic, not a global optimizer over every possible schedule. It does not use historical sessions or auto-update ratings.

The implementation lives in a database function so one transaction validates and persists the schedule. This supersedes the earlier AGENTS.md suggestion to put the generator exclusively in pure TypeScript. A future frontend preview can use a pure TypeScript generator, but must not bypass server authorization and persistence rules.

If estimated booked duration would be exceeded, the RPC rejects generation. Explain the warning and retry with allow_overtime:true only after host confirmation.

## Public links

Host-owned session rows contain `public_code`. Share:

```text
/s/<public_code>
```

Tokens contain 32 random bytes, encoded as 64 hexadecimal characters. They are stored only in host-readable session rows so the host can copy the same link again. This is a deliberate change from the earlier hash-only proposal.

Anonymous viewers do not read application tables. They call:

```ts
const { data, error } = await supabase.rpc('get_public_session', {
  p_token: tokenFromUrl,
});
```

The response contains session summary, participants, matches, leaderboard, and realtime_topic. It excludes host identity, roster player IDs, skill ratings, and the bearer token itself. Draft, deleted, revoked, or invalid links are rejected.

Use no-referrer policy for the share page, avoid logging full share URLs, and do not send tokens to analytics.

## Realtime client contract

The returned realtime_topic is a separate random capability. This is a PUBLIC Broadcast channel that carries only invalidation signals, never names, scores, bearer share tokens, or leaderboards.

```ts
const channel = supabase
  .channel(snapshot.realtime_topic)
  .on('broadcast', { event: 'session_changed' }, () => {
    // Debounce and refetch get_public_session using the original URL token.
    // Never apply event payloads as authoritative match data.
    refreshSession();
  })
  .subscribe(status => {
    if (status === 'SUBSCRIBED') refreshSession();
  });
// On unmount: await supabase.removeChannel(channel);
```

Someone possessing the channel capability can also send public-channel messages. Such messages can only trigger a refetch in a correctly implemented client; they must never change scores or state directly. If private-channel sender authorization becomes a requirement, add scoped viewer JWTs or another verified authorization bridge.

Revocation/rotation changes the channel capability, sends an invalidation to the old channel, and immediately blocks the old share token's database reads. Fetch on reconnect and window focus; use a modest periodic refetch fallback while the page is open to recover from dropped events. Previously viewed data cannot be remotely erased from a person's browser.

## Integration checklist

- Use a publishable Supabase key in Vite; never service_role.
- Use generated Database types with createClient.
- Set up the one host profile and Auth redirects.
- Read host data via SELECT; write via courthost_command.
- Translate database errors into English/Indonesian UI copy.
- Implement confirmation dialogs and stale/disconnected indicators.
- Build the public page from get_public_session.
- Refetch authoritative data after realtime signals and every mutation.
- Read frozen final results after session completion.
- Keep applied migration files unchanged; record future changes as new migrations.
- Do not db push these files into an unrelated empty project.
