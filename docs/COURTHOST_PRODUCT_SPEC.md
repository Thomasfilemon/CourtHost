# CourtHost MVP Product Specification

**Status:** Approved baseline for implementation  
**Version:** 1.0  
**Product:** CourtHost  
**Platform:** Mobile-first responsive web application  
**Primary backend:** Supabase

## 1. Product summary

CourtHost helps one tennis venue run informal tennis sessions on one court. A host creates a session, selects permanent players, generates fair matches, records live scores, and shares a read-only link so players can follow the current match, upcoming matches, results, and leaderboard in real time.

The MVP is intentionally not a booking system, tournament platform, membership product, or multi-venue SaaS.

## 2. Problem

Venue staff currently record scores and calculate leaderboards manually. This is slow, error-prone, and difficult to share during an active session. CourtHost replaces that workflow with a simple host interface and a live player-facing page.

## 3. MVP success criteria

The release succeeds when one host can:

1. Open and navigate the application smoothly on a smartphone.
2. Create, view, update, archive, and delete player profiles.
3. Create a tennis session and generate valid matches.
4. Start matches, enter live scores, finish matches, and end a session.
5. See a correct per-session leaderboard.
6. Share an unguessable link that gives players a read-only live view.
7. View and search completed-session history.
8. Use the core interface in English or Indonesian.

## 4. Users and permissions

### Host

There is one host account for the MVP. The host can manage players and sessions, control match state, enter scores, and delete data.

Host authentication is required before production use. Use Supabase Auth with passwordless email OTP or Magic Link. A hidden URL is not authentication.

### Player/viewer

Players have no accounts. Anyone with a valid session link can see the public view for that session. Public access is read-only.

The public page may display every participant's name, match assignments, scores, and leaderboard result for that session. The host must understand that possession of the link grants access.

## 5. Scope

### Included in the MVP

- One venue and one court
- One host account
- Permanent player roster
- Player name and integer skill rating from 1 to 10
- Player archiving
- Singles or doubles sessions
- Preset or custom session duration
- Estimated match duration
- Random and skill-balanced generators
- Sequential matches on one court
- Live score entry
- Four-point scoring model
- Per-session leaderboard
- Real-time public session page
- Session history, text search, and date filtering
- English and Indonesian
- Responsive smartphone and desktop layouts

### Explicitly excluded

- Multiple venues or courts
- Concurrent matches
- Player accounts
- Court booking and payment
- Memberships
- Mixed singles and doubles in one session
- Native mobile applications
- Full offline support
- Automatic skill-rating changes
- Historical results influencing matchmaking
- Drag-and-drop schedule editing
- Background push notifications
- CSV/PDF export
- Public social-result image generation

## 6. Player rules

- A player requires a `name` and `skill_rating`.
- `skill_rating` is a host-assigned integer from 1 through 10.
- Duplicate names are allowed.
- The number of stored players is not limited by a business rule.
- A player referenced by historical data must be archived instead of physically deleted.
- A never-used player may be permanently deleted after confirmation.
- Editing a player's current skill does not change skill snapshots stored in existing sessions or matches.

## 7. Session creation

Required input:

- Session name
- Scheduled date
- Format: `singles` or `doubles`
- Generator mode: `random` or `skill`
- Session duration in minutes
- Estimated match duration in minutes
- Selected players

Validation:

- Duration values must be positive integers.
- Singles requires at least 2 selected players.
- Doubles requires at least 4 selected players.
- The total selected-player count does not need to be divisible by 2 or 4. Players not selected for a particular match wait for that match.
- Selected players are locked after the session starts.

The estimated number of available match slots is:

```text
floor(session_duration_minutes / estimated_match_duration_minutes)
```

This estimate helps scheduling but does not automatically end a live match or session.

## 8. Session state machine

| State | Meaning | Allowed next states |
|---|---|---|
| `draft` | Setup can be edited; schedule may not exist | `scheduled`, `cancelled` |
| `scheduled` | Schedule exists; session has not started | `draft`, `live`, `cancelled` |
| `live` | Session is running | `completed`, `cancelled` |
| `completed` | Host ended the session normally; data is frozen | None |
| `cancelled` | Session was abandoned before meaningful completion | None |

Rules:

- Draft saving is included but may be implemented after the primary happy path.
- A scheduled session may be edited or regenerated before it starts.
- Starting the first match moves the session to `live`.
- `completed` and `cancelled` sessions are read-only.
- The MVP does not reopen completed sessions.
- **End Session** is available while live and requires confirmation.
- Ending a live session preserves completed matches, cancels remaining upcoming matches, freezes the leaderboard, and sets the session to `completed`.
- Cancelling a session is reserved for a session that will not produce a final result. If at least one completed match should count, use **End Session**, not cancel.

## 9. Match generation

### Shared fairness rules

Both generators follow this priority order:

1. Prefer players with the fewest appearances in the current session.
2. Form a valid match: 2 players for singles or 4 for doubles.
3. Keep appearance counts as equal as practical.
4. In doubles, prefer a new partner when otherwise equivalent.
5. Repeated partners and opponents are allowed.

Players not selected for a match are waiting; this is normal and does not require a special round entity in the MVP.

### Random mode

Choose among the players with the fewest appearances, then shuffle assignments. Randomness must not override appearance fairness.

### Skill-balanced mode

- Singles: minimize the absolute difference between the two players' skill snapshots.
- Doubles: minimize the absolute difference between the sum of Team A's skill snapshots and Team B's skill snapshots.
- If multiple candidates have equal balance, prefer partner rotation, then choose randomly.

### Batch behavior

- Initial generation creates the smallest batch in which every selected player is scheduled at least once, subject to the format and fairness rules.
- If the duration estimate allows fewer matches than that minimum, warn the host and require confirmation before generating the minimum fair batch.
- **Generate More Matches** appends another fair batch using all existing session appearance counts.
- The host can regenerate the full schedule only before the session starts.
- Regeneration replaces all unplayed matches and must require confirmation.
- Past sessions never influence generation.

## 10. Match state and control

| State | Meaning | Allowed next states |
|---|---|---|
| `upcoming` | Scheduled but not started | `playing`, `cancelled` |
| `playing` | Active match on the court | `completed`, `cancelled` |
| `completed` | Valid final score recorded | None while session is frozen |
| `cancelled` | Match will not be played | None |

Rules:

- At most one match can be `playing` in a session.
- Only the earliest non-cancelled upcoming match may start in the normal flow.
- Finishing a match does not automatically start the next match.
- The host explicitly presses **Start Match**.
- Scores may be entered and changed while a match is playing.
- A completed match may be corrected only while its session remains `live`.
- Correcting a result requires confirmation and immediately recalculates the leaderboard.
- Completed or cancelled sessions do not allow score edits.

## 11. Scoring rules

CourtHost uses **match points**, not standard tennis games or sets.

- Every completed match distributes exactly 4 match points.
- Each side's score is an integer from 0 through 4.
- A final score is valid only when `side_a_score + side_b_score = 4`.
- Valid final results are `4-0`, `3-1`, `2-2`, `1-3`, and `0-4`.
- `4-0`, `3-1`, `1-3`, and `0-4` produce a winner and loser.
- `2-2` is a draw.
- **Finish Match** remains disabled until the score is valid.
- In doubles, every player receives their side's full match-point score; points are not divided between partners.

Examples:

- Singles result `3-1`: the winning player earns 3 leaderboard points and the losing player earns 1.
- Doubles result `4-0`: both Team A players earn 4 leaderboard points; both Team B players earn 0.

## 12. Leaderboard

The leaderboard belongs to one session and includes selected players who have played at least one completed match.

Calculated fields:

- Played (`P`)
- Wins (`W`)
- Draws (`D`)
- Losses (`L`)
- Total match points (`PTS`)
- Points against (`PA`)
- Point difference (`PD = PTS - PA`)

Ranking order:

1. Total match points, descending
2. Wins, descending
3. Point difference, descending
4. Head-to-head total match points, only when exactly two players remain tied and they directly opposed each other
5. Shared rank

For doubles, results count toward each individual player. A player win, draw, or loss is determined by their team's result.

The live leaderboard is calculated from completed, non-cancelled matches. When a session ends, a snapshot is stored so historical results remain stable.

## 13. Withdrawal, injury, and replacement

Completed results are never deleted or recalculated because of a later withdrawal.

When a player becomes unavailable during a live session:

1. Mark the session-player record as `withdrawn`.
2. Cancel every upcoming match containing that player.
3. If the host selects a replacement, add or activate the replacement for the remaining schedule.
4. Regenerate only future matches using existing appearance counts.
5. Preserve all completed matches and leaderboard contributions.

Replacing a player is a post-core enhancement. The safe MVP fallback is to withdraw the player and regenerate remaining matches without them.

## 14. Public link and real-time behavior

- Each session has one cryptographically random public token.
- Public route: `/s/:token`.
- Tokens must never be sequential database IDs.
- The link remains valid after completion so final results can be revisited.
- The host can revoke the token; revocation immediately blocks public access.
- Public viewers can never write data.
- The page updates live when session state, matches, scores, or leaderboard results change.
- When the page is open, show an in-page alert when a player's match is next. Sound or vibration requires explicit user opt-in.

## 15. History and deletion

History includes completed and cancelled sessions. Each card shows:

- Session name
- Scheduled date
- Duration
- Format
- Player count
- Completed and cancelled match counts
- Final session status

History supports text search by session name and filtering by date range and status.

Completed sessions are read-only. Deletion requires confirmation and should use soft deletion so accidental removal can be recovered operationally. Player-facing links stop working for deleted sessions.

Data is retained indefinitely until the host deletes it.

## 16. Localization and responsive UI

- All visible strings must use translation keys from the beginning.
- Supported locales: `en` and `id`.
- English is the fallback locale.
- Database values use stable English enum keys and are translated only in the UI.
- Smartphone portrait is the primary layout.
- Desktop is a responsive enhancement, not a separate product.

## 17. Reliability requirements

- No full offline mode is required.
- Show connection state when real-time updates disconnect.
- Keep in-progress score inputs in local component state during short disconnects.
- Prevent duplicate mutations by disabling repeated submit actions.
- Database constraints and transactional functions must enforce critical scoring and state rules; client validation alone is insufficient.

## 18. Deferred product decisions

These items are deliberately outside the implementation baseline:

- Multiple courts and concurrent matches
- Personalized per-player tokens
- Background web push notifications
- Downloadable social-result cards
- Session duplication
- Detailed audit log
- Automated player-rating system
- Manual schedule reordering

## 19. Acceptance scenarios

1. The host creates a 120-minute doubles session with seven players and 20-minute estimated matches. The system produces valid four-player matches and rotates waiting players fairly.
2. The host records `3-1`; finishing succeeds and all participants receive the correct statistics.
3. The host enters `3-2`; finishing is rejected because five points were distributed.
4. The host finishes one match. The next match remains upcoming until **Start Match** is pressed.
5. A public viewer sees score and leaderboard changes without refreshing.
6. A player withdraws. Completed results remain unchanged and only future matches are cancelled/regenerated.
7. The host ends a session early. Completed results remain, upcoming matches become cancelled, and the final history record is read-only.
8. An anonymous visitor with no valid token cannot read a session; a visitor with a valid token cannot write anything.

