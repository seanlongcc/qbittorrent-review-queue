# Agent Testing Reference

Detailed testing decision policy for AI coding agents.

## Testing Decision Policy

Use tests intentionally. Do not add tests only to satisfy process.

## TDD Required

Use test-driven development for changes that affect:

- Windows-to-WSL or WSL-to-Windows path mapping.
- qBittorrent API client behavior.
- Completed torrent filtering.
- Video candidate filtering and largest-first sorting.
- Session folder capacity and rollover behavior.
- Keep workflow.
- Reject workflow.
- FastAPI routes.
- Frontend state transitions.
- Keyboard commands.
- Error handling.
- Accessibility-relevant interaction.
- Bug fixes where a regression test can reproduce the issue.

For these changes, write or update a failing test first when practical, then implement the smallest change needed to pass.

## Tests Usually Not Required

Do not add new automated tests for documentation-only or purely presentational changes, including:

- Spacing.
- Colors.
- Typography.
- Copy-only edits.
- Icon swaps.
- Static layout adjustments.
- CSS-only polish.

For these changes, implement directly and verify with the cheapest appropriate checks.

## Backend Test Priorities

- Mock qBittorrent auth, completed list, file list, and delete responses.
- Unit-test path mapping with Windows drive paths, nested paths, spaces, and unmapped drives.
- Unit-test media/open routes reject raw path inputs and resolve files from torrent hash plus qBittorrent file index.
- Unit-test external open converts to a Windows path and invokes the Windows default-app open mechanism.
- Do not add configurable-player tests until that feature exists.
- Unit-test unsupported embedded preview shows Preview Unavailable with Open External primary action.
- Unit-test missing, unreadable, or unresolved media files show errors rather than Preview Unavailable.
- Unit-test torrent detail cache is used only for UI detail and expires after 30 seconds.
- Unit-test Keep, Reject, Open, and Media actions re-fetch or re-resolve metadata instead of trusting cached detail.
- Unit-test settings precedence: `config.local.json` overrides `.env` defaults.
- Unit-test settings writes update `config.local.json` without rewriting `.env`.
- Unit-test credential updates persist to `config.local.json`.
- Unit-test settings API returns `passwordConfigured` and never returns password values.
- Unit-test candidate filtering by extension allowlist, with no minimum size cutoff.
- Unit-test largest-first sorting.
- Unit-test folder capacity with empty, partially full, exactly full, over-capacity, and manually pre-populated destinations.
- Unit-test folder capacity counts existing video files plus marked candidates before moving.
- Unit-test session folder rollover blocks Keep until an existing folder with count below capacity is provided.
- Unit-test session folder rollover rejects missing paths and full folders.
- Unit-test Keep destination filename collisions with `-2`, `-3`, and original extension preservation.
- Integration-test Keep with successful moves and no qBittorrent delete cleanup.
- Integration-test Keep partial failure, no torrent deletion.
- Integration-test Keep treats successful moves as success when destination visibility lags and returns the expected folder count.
- Integration-test Keep leaves unmarked candidates and junk qBittorrent-managed.
- Unit-test successful Keep keeps the torrent in Review Queue and leaves it selected.
- Unit-test successful Keep marks moved candidate rows and prevents stale refreshes from lowering the visible folder count.
- Unit-test successful Reject removes torrent from Review Queue and selects next torrent.
- Verify Keep/Reject UI does not present undo affordances in v1.
- Unit-test Empty Queue State when no torrents remain after Reject.
- Unit-test Keep requires confirmation before moving marked candidates.
- Integration-test Reject confirmation required and `deleteFiles=true`.
- Unit-test Reject keyboard flow: first `D` arms, second `D` confirms, `Esc` cancels.
- Unit-test Armed Reject timeout and torrent-change cancellation.

## Frontend Test Priorities

- Queue loads and displays completed torrents.
- Queue auto-poll refreshes qBittorrent torrent list every 15 seconds while preserving the current selected torrent.
- Queue auto-poll pauses while tab is hidden and refreshes immediately after Keep, Reject, or settings save.
- Queue auto-poll does not fetch every torrent's file list.
- If selected torrent vanishes during auto-poll, UI shows attention state, disables Keep/Reject, and offers Refresh/Next.
- Vanished selected torrent does not auto-advance until user chooses Next or a current action completes.
- Disconnected qBittorrent state shows the main shell with queue-panel setup state.
- Settings stays reachable while qBittorrent is disconnected.
- Settings opens as an inline panel or drawer inside the review shell, not a separate route.
- FastAPI `GET /` serves the built Vite React shell in local production mode.
- Attention torrents appear in a collapsed Needs attention section with name and reason.
- Attention torrents are excluded from next/previous normal queue navigation.
- Cleanup-failed attention torrents show Cleanup Retry.
- Non-cleanup attention torrents show informational actions and do not show Cleanup Retry.
- Torrent detail loads candidate videos and junk disclosure.
- Candidate selection updates preview route.
- Marked candidates control which files Keep moves.
- Candidate checkbox toggles marked state independently from active preview focus.
- Visible left-hand keys are `Q W E T` and `A S D F`: `Q`/`A` move previous/next torrent, `W`/`S` move previous/next candidate, `F` toggles marking, `E` keeps marked candidates, `D` deletes/arms Delete, and `T` opens externally.
- Arrow keys mirror navigation as secondary shortcuts.
- Review shortcuts do not fire while typing in text inputs, path fields, or editable settings controls; `Esc` still cancels armed states or leaves typing context.
- Only the largest video candidate is marked by default when a torrent opens.
- Additional video candidates remain unmarked until user marks them.
- Keyboard shortcuts trigger next/previous torrent and next/previous video.
- Keep action sends marked candidate file indexes.
- Keep action arms confirmation, then sends marked candidate file indexes without calling Delete.
- Reject requires confirmation.
- Reject button mirrors keyboard confirmation: first click arms, second click confirms.
- Folder capacity state blocks Keep and prompts for next folder.

## Browser Verification

When UI layout or interaction changes:

1. Run the app locally.
2. Verify desktop and narrow viewport.
3. Check for console errors.
4. Confirm preview surface is not blank when a playable file is available.
5. Confirm keyboard focus is visible.
6. Confirm long file names do not break rows, buttons, or rails.

In completion summaries, state one of:

- `No new tests added because this was documentation-only or presentational-only.`
- `Updated tests because behavior changed.`
- `Skipped browser verification because <specific blocker>.`
