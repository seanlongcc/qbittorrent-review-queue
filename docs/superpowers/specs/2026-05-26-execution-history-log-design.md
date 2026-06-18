# Execution History Log Design

## Context

The review queue currently shows short-lived toasts for Keep, Delete, and Open External. Keep returns moved destination paths from the backend, and Delete returns only `{ "ok": true }` after qBittorrent `deleteFiles=true` succeeds. Once a toast disappears or the app restarts, there is no durable app-local record of what the review workflow moved or deleted.

The user wants a history of execution activity, especially moved files and deleted files. The log should not mirror qBittorrent's execution log because that contains noisy connection and API details.

## Goals

- Persist an app-specific review history across browser refreshes and app restarts.
- Record successful Keep moves with destination file paths.
- Record successful Delete actions with torrent identity and `deleteFiles=true` semantics.
- Record failed Keep/Delete/Open External actions when useful for recovery, without logging qBittorrent connection chatter.
- Keep qBittorrent credentials and secrets out of history.
- Keep destructive action rules unchanged: Keep moves only, Delete requires confirmation and calls qBittorrent delete with files.

## Non-Goals

- No import or display of qBittorrent's raw execution log.
- No cloud persistence, telemetry, remote auth, or hosted storage.
- No undo or restore flow for deleted torrent files.
- No long-term media metadata database beyond local review action history.

## Recommended Approach

Add a focused backend history module that stores local app events in JSON beside `config.local.json`, using `execution-log.json` by default. The backend appends events after action outcomes are known. The frontend fetches and renders the current history as a compact workbench section.

This keeps API/connectivity noise out of the user-facing record while giving the app exact Keep destination paths that qBittorrent cannot know.

## Data Model

Each history item has:

- `id`: stable generated identifier.
- `timestamp`: ISO 8601 UTC timestamp.
- `action`: one of `keep`, `delete`, `open_external`, or `failure`.
- `status`: `success` or `failed`.
- `torrentHash`: qBittorrent torrent hash when available.
- `torrentName`: qBittorrent torrent name when available.
- `summary`: short user-facing summary.
- `files`: zero or more file entries with `sourcePath`, `destinationPath`, `fileIndex`, and `name` where available.
- `detail`: optional failure or destructive-action detail.

The first implementation should cap stored history to the newest 500 entries to prevent unbounded local file growth.

## Backend Flow

- `backend/app/history.py` owns loading, validation, appending, trimming, and public serialization.
- `GET /api/history` returns newest-first history items.
- Keep route appends one success item after `keep_torrent` returns moved paths. It records torrent hash/name and one file entry per moved candidate.
- Delete route captures torrent hash/name before calling qBittorrent, then appends one success item after `reject_torrent` succeeds.
- Keep/Delete route failures append failure items only for user-initiated workflow failures. Queue polling, qBittorrent auth/connect checks, and detail loading do not write history.
- If history writing fails, the review action should still report the primary action result. History write failure should not turn a successful move/delete into a failed action.

## Frontend Flow

- `frontend/src/api/client.ts` adds `getHistory()`.
- `frontend/src/domain/types.ts` defines `ExecutionHistoryItem`.
- App state owns loaded history and refreshes it on startup plus after Keep/Delete/Open External outcomes.
- Workbench renders a compact History section below the candidate list or as a small collapsible section in the workbench center. It shows timestamp, action, status, torrent name, summary, and moved/deleted paths when expanded.
- The UI uses existing dark workbench styling and semantic color: green for successful Keep, red for successful Delete or destructive failure, neutral/amber for non-destructive failures.

## Error Handling

- Corrupt or missing history file returns an empty list and starts fresh after the next append.
- Append uses atomic write through a temporary file and replace.
- Failure details must be terse and must not include secrets.
- History fetch failure should show a non-blocking toast and keep the review workbench usable.

## Testing

- Backend unit tests cover append/load ordering, trim limit, and corrupt-file recovery.
- API tests cover Keep logging moved paths and Delete logging confirmed torrent deletion.
- API tests confirm unconfirmed Keep/Delete do not write success entries.
- Frontend tests cover rendering history loaded from `/api/history` and refreshing history after Keep/Delete.

## Large-File Guardrail

Brooks-Lint risk: cognitive overload. `frontend/src/review/Workbench.tsx` is already over 500 lines and `backend/app/main.py` contains all routes. Add only thin route/client wiring there. Put history persistence in `backend/app/history.py`, typed DTOs in `frontend/src/domain/types.ts`, and history rendering in a focused component rather than adding business logic inline.
