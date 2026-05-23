# Agent Product Reference

Detailed product intent for AI coding agents.

## Product Intent

Build a local Python web app with FastAPI backend and Vite React frontend. It connects to qBittorrent WebUI/API, shows completed torrents in a review queue, lists video candidates, lets the user preview or open videos, then Keep marked candidates or Reject the torrent.

## Core Capabilities

- Read qBittorrent connection settings from local `.env` bootstrap defaults.
- Persist settings changed in the UI to `config.local.json`.
- Do not rewrite `.env` from the app.
- Persist qBittorrent credentials changed in the UI to `config.local.json`.
- Never return qBittorrent password values through API responses; return `passwordConfigured` only.
- Authenticate with qBittorrent WebUI/API.
- Show the main review shell even before qBittorrent connection succeeds.
- Show connection/setup state in the queue panel until qBittorrent connection succeeds.
- Keep settings accessible while disconnected.
- Use an inline settings panel or drawer inside the review shell; no separate settings route in v1.
- Fetch completed torrents from qBittorrent.
- Auto-poll qBittorrent for review queue updates while the app is open.
- Auto-poll queue list every 15 seconds while connected, pause while the browser tab is hidden, and refresh immediately after Keep, Reject, or settings save.
- Do not auto-poll every torrent's file list; fetch file lists for selected torrent detail only.
- Queue auto-poll must preserve the current selected torrent while the user is reviewing it.
- If selected torrent disappears during auto-poll, show a "torrent no longer in qBittorrent" attention state, disable Keep/Reject, and offer Refresh/Next.
- Do not auto-advance a vanished selected torrent until the user chooses Next or a current action completes.
- Show attention torrents in a collapsed Needs attention section below the normal queue.
- Show attention torrent name and reason.
- Exclude attention torrents from normal next/previous queue navigation.
- Show Cleanup Retry in Needs attention only for cleanup-failed torrents.
- For other attention reasons, show informational actions such as Open Settings or Refresh.
- Fetch per-torrent file lists.
- Use a short-lived torrent detail cache for UI display only.
- Re-fetch or re-resolve qBittorrent metadata before Keep, Reject, Open, or Media actions.
- Filter video candidates by extension allowlist only.
- Sort video candidates largest first.
- Show non-video and junk files collapsed.
- Stream selected files through `/media/{hash}/{file_index}` when browser playback is possible.
- Show Preview Unavailable with Open External as primary action when browser playback is unsupported.
- Open selected files in the Windows default player using the Windows path.
- External Open uses the Windows default app in v1, with `explorer.exe` or `cmd.exe /c start ""` as open mechanisms.
- Do not add configurable player commands unless default-app behavior proves insufficient.
- Resolve media file access server-side from torrent hash and qBittorrent file index.
- Never accept raw local file paths from browser requests.
- Mark one or more video candidates for Keep.
- Candidate rows use checkbox-style marking and separate active preview focus.
- Use a left-hand keyboard model as primary: `W`/`S` move active candidate, `A`/`D` move previous/next torrent, `Space` toggles marking, `Q` keeps, `E` rejects/arms reject, and `Enter` opens External Open for the active candidate.
- Arrow keys may mirror navigation as secondary shortcuts.
- Disable review shortcuts while focus is inside text inputs, path fields, or editable settings controls; allow `Esc` to cancel armed states or leave typing context.
- Default-mark only the largest video candidate when a torrent opens.
- Users must manually mark additional video candidates they want to keep.
- Move marked candidates into the current session folder on Keep.
- Keep the session folder flat: preserve original filenames and add numeric suffixes for collisions.
- Enforce a 40-video session folder capacity.
- Folder capacity counts all existing video files in the session folder plus marked candidates pending Keep.
- Block Keep and show an inline session-folder field when capacity is reached.
- Validate rollover folder exists and has Folder Count below capacity before enabling Keep.
- Do not auto-create rollover folders.
- Remove kept torrents from qBittorrent and delete leftover content only after selected moves succeed.
- After Keep moves marked candidates, verify destination files exist, then remove the torrent from qBittorrent with `deleteFiles=true`.
- If qBittorrent cleanup fails after kept files are verified, keep the moved files, mark the torrent cleanup failed, and do not retry silently.
- Allow explicit cleanup retry or manual qBittorrent resolution for cleanup-failed torrents.
- After successful Keep or Reject, remove the torrent from Review Queue and select the next torrent.
- Do not provide v1 undo for Keep or Reject.
- Use clear confirmation and post-action status instead of undo.
- If Keep cleanup fails, move the torrent to attention work and select the next torrent.
- Show Empty Queue State when no completed torrents remain.
- Unmarked video candidates are Torrent Leftovers and are deleted during Keep cleanup.
- Keep does not require confirmation when all video candidates are marked.
- Keep confirmation is required when multiple video candidates exist and at least one is unmarked: `Q` arms, second `Q` confirms, `Esc` cancels, and clicking Keep mirrors the same two-click behavior.
- Armed Keep times out after 8 seconds and cancels when the current torrent or marked candidates change.
- Reject a torrent only after confirmation, using qBittorrent delete with `deleteFiles=true`.
- Reject confirmation is a two-step armed flow: `E` arms, second `E` confirms, `Esc` cancels, and clicking Reject mirrors the same two-click behavior.
- Armed Reject times out after 8 seconds and cancels when the current torrent changes.

## Assumptions

- qBittorrent runs as a Windows app.
- qBittorrent WebUI/API is enabled.
- Downloads live on a local Windows drive reachable from WSL as `/mnt/c/...`.
- The app is for manual review only. No AI video classification.
- Local `.env` is acceptable for bootstrap credentials.
- Local `config.local.json` is acceptable for UI-changed settings and credentials and must not be committed with real values.

## API Surface

- `GET /` serves the React review UI in local production.
- FastAPI serves built Vite React assets for normal local production run.
- Use separate Vite dev server only for development.
- Do not package as `.exe` or installer in v1; run from repo scripts first.
- `GET /api/queue` returns completed torrents.
- `GET /api/torrents/{hash}` returns torrent details and candidate video files.
- `GET /media/{hash}/{file_index}` streams the selected file for embedded preview.
- `POST /api/torrents/{hash}/open` opens a selected file in the Windows default player.
- `POST /api/torrents/{hash}/keep` moves marked candidate files, updates folder count, and deletes torrent leftovers.
- `POST /api/torrents/{hash}/reject` deletes a torrent and files after confirmation.
- `GET /api/settings` reads local settings.
- `POST /api/settings` updates qBittorrent connection and session folder settings.

## Safety Notes

- Keep and Reject are not equivalent. Keep preserves marked candidates first; Reject deletes torrent content.
- `.env` is bootstrap/defaults only; UI settings and credential writes go to `config.local.json`.
- Settings reads must redact secrets and return password presence only.
- qBittorrent connection failure should not replace the app with a full-screen setup gate.
- Settings should be reachable without leaving the review shell.
- Normal local use should not require two long-running servers.
- Packaging can be considered after app behavior stabilizes.
- Reject must be confirmed.
- Keep must not clean up torrent content after partial move failure.
- Keep should move marked candidates only, not every video candidate in the torrent.
- Keep should delete unmarked candidates and junk as torrent leftovers only after kept videos are verified in the session folder.
- Keep cleanup failure should not roll back or delete kept videos.
- Cleanup retry must be user-initiated, not automatic.
- Cleanup retry should be available only for cleanup-failed torrents, not every attention reason.
- Path mapping failures should block file access and explain the expected Windows/WSL mapping.
- Media/open routes should accept torrent hash plus file index only; no raw path parameters.
- Do not trust cached torrent detail for file access or destructive actions.
- External Open should convert to a Windows path and use Windows default app behavior, not a custom player setting.
- Unsupported browser playback should not be treated as an error unless the file is missing, unreadable, or unresolved.
- Post-action auto-advance should never leave the UI focused on a torrent that left normal review.
- Do not imply rejected or cleaned-up torrent files can be restored by the app.
- Folder capacity should block Keep before moving files, not after.
- Folder capacity should survive restart and manual folder changes by reading the session folder contents.
- Session folder rollover should be inline and validation-driven, not modal-first or auto-create.
