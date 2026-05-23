# Local qBittorrent Review Queue

Local qBittorrent Review Queue is a desktop review context for deciding what to keep from completed qBittorrent torrents. It exists to make file review fast while keeping destructive torrent deletion explicit.

## Language

**Review Queue**:
The ordered set of completed torrents waiting for manual review.
_Avoid_: Download queue, qBittorrent queue

**Queue Auto-Poll**:
Automatic qBittorrent refresh that keeps the review queue current while the app is open.
_Avoid_: Manual-only refresh, background sync

**Empty Queue State**:
The review shell state shown when no completed torrents remain in the review queue.
_Avoid_: Finished screen, done page

**Completed Torrent**:
A torrent returned by qBittorrent's completed filter with `progress == 1` and no missing-content or error state.
_Avoid_: Finished job, done item

**Attention Torrent**:
A torrent excluded from normal review because it needs manual attention before review or cleanup can finish.
_Avoid_: Broken torrent, failed download

**Vanished Torrent**:
A previously selected torrent that no longer appears in qBittorrent during queue auto-poll.
_Avoid_: Deleted torrent, missing row

**Needs Attention Section**:
The collapsed queue-adjacent section that lists attention torrents and their reasons.
_Avoid_: Error queue, failed queue

**Attention Action**:
The contextual action offered for an attention torrent based on its reason.
_Avoid_: Review action, queue action

**Torrent Detail**:
The per-torrent view of files, candidate videos, junk files, paths, and review actions.
_Avoid_: File browser, torrent page

**Torrent Detail Cache**:
A short-lived cached torrent detail used only for UI display responsiveness.
_Avoid_: Source of truth, action cache

**Video Candidate**:
A torrent file whose extension is in the app's video allowlist.
_Avoid_: Clip, media asset, keeper

**Junk File**:
A torrent file whose extension is not in the app's video allowlist.
_Avoid_: Trash, leftover

**Video Allowlist**:
The extension set used to identify video candidates: `.mp4`, `.mkv`, `.avi`, `.mov`, `.webm`, `.m4v`, `.wmv`, `.ts`, and `.m2ts`.
_Avoid_: qBittorrent filter, MIME sniffing rule

**Selected Video**:
A video candidate currently focused for preview or external open.
_Avoid_: Current clip, active file

**Marked Candidate**:
A video candidate chosen to be moved by Keep.
_Avoid_: Selected video, checked file, keeper

**Default Mark**:
The initial marked candidate chosen automatically when torrent detail opens.
_Avoid_: Auto-keep, selected by default

**Candidate Marking**:
The interaction for adding or removing a video candidate from the Keep set.
_Avoid_: Preview selection, file selection

**Left-Hand Keyboard Model**:
The primary shortcut layout designed around left-side keys for one-handed review.
_Avoid_: Arrow-only navigation, mouse-first controls

**Typing Context**:
The UI state where focus is inside a text input, path field, or editable settings control.
_Avoid_: Keyboard review mode, global shortcuts

**Active Candidate**:
The video candidate currently targeted by keyboard navigation.
_Avoid_: Marked candidate, selected for keep

**Session Folder**:
The current destination folder for kept videos in this review session.
_Avoid_: Output folder, save folder, library

**Kept Video**:
A marked candidate moved into the session folder by Keep.
_Avoid_: Saved copy, accepted file

**Destination Filename**:
The filename assigned to a kept video inside the flat session folder.
_Avoid_: Archive path, torrent-relative path

**Folder Capacity**:
The maximum number of kept videos allowed in one session folder.
_Avoid_: Quota, batch size

**Folder Count**:
The number of video files already in a session folder plus marked candidates pending Keep.
_Avoid_: Session counter, moved count

**Session Folder Rollover**:
The required user action of choosing a different existing session folder after the current one reaches capacity.
_Avoid_: Auto-create next folder, batch rollover

**Bootstrap Settings**:
Local default settings loaded from `.env` when the app starts.
_Avoid_: Saved settings, runtime config

**Local Settings**:
User-editable app settings persisted in `config.local.json`.
_Avoid_: Env settings, database settings

**Local Credentials**:
qBittorrent connection credentials stored in local-only settings.
_Avoid_: User account, login session

**Password Presence**:
The boolean signal that a qBittorrent password is configured without exposing the password value.
_Avoid_: Password echo, masked password

**Review Shell**:
The main app frame that contains queue, preview, actions, and settings surfaces.
_Avoid_: Setup screen, landing page

**Local Production Run**:
The normal single-server mode where FastAPI serves the built Vite React UI and API.
_Avoid_: Two-server run, hosted deploy

**Packaged App**:
A future installer or executable distribution of the local review app.
_Avoid_: v1 run mode, local production run

**Development Run**:
The developer mode where Vite serves the frontend and proxies API/media requests to FastAPI.
_Avoid_: Production run, packaged app

**Connection Setup State**:
The queue-panel state shown when qBittorrent is not yet connected or authenticated.
_Avoid_: Full-screen setup gate, blocking wizard

**Settings Panel**:
The inline review-shell surface for editing local settings.
_Avoid_: Settings page, setup route

**Keep**:
The action that moves marked candidates into the session folder and then removes the torrent and remaining content after the move succeeds.
_Avoid_: Save, accept, archive

**Armed Keep**:
The temporary confirmation state for keeping marked candidates when unmarked video candidates would be deleted.
_Avoid_: Save confirmation, accept mode

**Reject**:
The destructive action that removes a torrent from qBittorrent with `deleteFiles=true` after confirmation.
_Avoid_: Delete, remove, skip

**Armed Reject**:
The temporary confirmation state for rejecting the current completed torrent.
_Avoid_: Confirm dialog, delete mode

**Torrent Leftovers**:
Torrent content still managed by qBittorrent after marked candidates have been moved during Keep, including junk files and unmarked video candidates.
_Avoid_: Junk files, trash, residue

**Cleanup Failed Torrent**:
An attention torrent whose marked candidates were kept but qBittorrent failed to delete torrent leftovers.
_Avoid_: Failed Keep, lost torrent

**Cleanup Retry**:
An explicit user action that retries qBittorrent deletion of torrent leftovers after cleanup failure.
_Avoid_: Silent retry, automatic retry

**Auto-Advance**:
The selection of the next review-queue torrent after the current torrent leaves normal review.
_Avoid_: Auto-review, skip

**Review Undo**:
Reversing a completed Keep or Reject action.
_Avoid_: Restore, undelete

**Path Mapping**:
The conversion between qBittorrent Windows paths and WSL filesystem paths used by the local app.
_Avoid_: Path rewrite, mount conversion

**Torrent File Path**:
The concrete file path built from qBittorrent torrent metadata and file-list entries before path mapping.
_Avoid_: Media URL, stream path

**Single-File Torrent**:
A completed torrent whose reviewed content is represented by one torrent file.
_Avoid_: Solo download, one-off file

**Multi-File Torrent**:
A completed torrent whose reviewed content is represented by multiple torrent files under the save path.
_Avoid_: Folder torrent, pack

**Embedded Preview**:
Browser playback of a selected video through the local `/media` route.
_Avoid_: Stream, player

**Preview Unavailable**:
The non-error state shown when the selected video cannot be played by the browser but can still be opened externally.
_Avoid_: Playback error, broken file

**External Open**:
Opening a selected video in the Windows default app from its Windows path.
_Avoid_: Custom player command, launch, play outside

**Windows Default App**:
The application Windows chooses for a video file extension.
_Avoid_: Configured player, bundled player

**Media Handle**:
The pair of torrent hash and qBittorrent file index used by browser requests to identify a file.
_Avoid_: Raw path, file URL

## Relationships

- A **Review Queue** contains zero or more **Completed Torrents**.
- **Queue Auto-Poll** refreshes the **Review Queue** every 15 seconds while qBittorrent connection is healthy.
- **Queue Auto-Poll** polls the qBittorrent torrent list only, not every torrent's file list.
- **Queue Auto-Poll** pauses while the browser tab is hidden.
- **Queue Auto-Poll** runs immediately after **Keep**, **Reject**, or settings save.
- **Queue Auto-Poll** must not replace the current selected torrent while the user is actively reviewing it.
- An **Empty Queue State** appears when the **Review Queue** contains zero **Completed Torrents**.
- An **Attention Torrent** is excluded from the normal **Review Queue**.
- A **Vanished Torrent** is shown as attention state for the current selection instead of disappearing abruptly.
- A **Vanished Torrent** disables **Keep** and **Reject**.
- A **Vanished Torrent** offers Refresh and Next actions.
- A **Vanished Torrent** does not trigger **Auto-Advance** until the user chooses Next or a current action completes.
- **Attention Torrents** appear in **Needs Attention Section** in the initial product version.
- **Needs Attention Section** is collapsed by default and sits below the normal **Review Queue**.
- **Needs Attention Section** shows each attention torrent's name and reason.
- **Attention Torrents** are not included in normal next/previous **Review Queue** navigation.
- **Needs Attention Section** exposes **Cleanup Retry** only for a **Cleanup Failed Torrent**.
- Other **Attention Torrents** expose informational **Attention Actions** such as Open Settings or Refresh.
- A **Completed Torrent** has one **Torrent Detail**.
- A **Torrent Detail Cache** may serve **Torrent Detail** for UI display for up to 30 seconds.
- **Torrent Detail Cache** is not used as the source of truth for **Keep**, **Reject**, **Embedded Preview**, or **External Open**.
- A **Torrent Detail** has zero or more **Video Candidates** and zero or more **Junk Files**.
- A **Video Candidate** is identified by **Video Allowlist** membership only; file size is not part of candidacy.
- **Video Candidates** are sorted largest first for review.
- A **Junk File** remains visible through collapsed junk disclosure.
- A **Selected Video** is one **Video Candidate** from one **Torrent Detail**.
- A **Marked Candidate** is one **Video Candidate** from one **Torrent Detail**.
- An **Active Candidate** is one **Video Candidate** from one **Torrent Detail**.
- **Candidate Marking** is independent from active preview focus.
- Candidate rows expose checkbox-style **Candidate Marking**.
- **Left-Hand Keyboard Model** is the primary keyboard model.
- `W` and `S` move the **Active Candidate** up and down.
- `A` and `D` move to previous and next torrent in the **Review Queue**.
- `Space` toggles **Candidate Marking** for the **Active Candidate**.
- `Q` triggers **Keep** or **Armed Keep** confirmation.
- `E` enters or confirms **Armed Reject**.
- `Enter` opens **External Open** for the **Active Candidate**.
- `Esc` cancels **Armed Keep** and **Armed Reject**.
- Arrow keys may mirror navigation as secondary shortcuts.
- **Left-Hand Keyboard Model** shortcuts are disabled during **Typing Context**.
- `Esc` may still cancel armed states or leave **Typing Context**.
- **Default Mark** marks only the largest **Video Candidate** when a **Torrent Detail** opens.
- Users must mark additional **Video Candidates** before **Keep** if they want to preserve them.
- A **Keep** action moves one or more **Marked Candidates** into one **Session Folder**.
- A **Keep** action produces one **Kept Video** per moved **Marked Candidate**.
- A **Kept Video** keeps the original filename as its **Destination Filename** unless a collision exists.
- A colliding **Destination Filename** appends a numeric suffix such as `-2` or `-3` before the extension.
- A **Session Folder** is flat; **Keep** does not preserve torrent folder structure.
- **Folder Count** includes all existing video files in the **Session Folder**, even if they were not moved by this app.
- **Folder Count** includes current **Marked Candidates** before **Keep** moves them.
- A **Keep** action verifies each **Kept Video** exists in the **Session Folder** before deleting **Torrent Leftovers**.
- A **Keep** action deletes **Torrent Leftovers** by removing the torrent from qBittorrent with `deleteFiles=true`.
- If qBittorrent deletion fails after **Kept Videos** are verified, the torrent becomes a **Cleanup Failed Torrent**.
- A **Cleanup Failed Torrent** preserves its **Kept Videos**; the app does not move or delete them during cleanup recovery.
- A **Cleanup Failed Torrent** allows **Cleanup Retry** or manual qBittorrent resolution.
- **Cleanup Retry** is never automatic or silent.
- Successful **Keep** removes the current torrent from the **Review Queue** and triggers **Auto-Advance**.
- Successful **Reject** removes the current torrent from the **Review Queue** and triggers **Auto-Advance**.
- **Review Undo** is not supported in the initial product version.
- Keep and Reject safety relies on visible consequences, confirmation rules, and post-action status rather than **Review Undo**.
- A **Cleanup Failed Torrent** leaves normal review, moves to attention work, and triggers **Auto-Advance**.
- **Auto-Advance** selects the next torrent in **Review Queue**, or shows **Empty Queue State** if none remain.
- **Keep** does not require confirmation when all video candidates are marked.
- **Armed Keep** is required when a torrent has multiple **Video Candidates** and at least one is unmarked.
- **Armed Keep** is entered by pressing `Q` once or clicking Keep once in that guarded case.
- **Keep** is confirmed by pressing `Q` again or clicking the armed Keep control again.
- **Armed Keep** is canceled by `Esc`, changing the current torrent, changing marked candidates, or an 8-second timeout.
- A **Session Folder** is constrained by one **Folder Capacity**.
- **Keep** is blocked when **Folder Count** would exceed **Folder Capacity**.
- **Session Folder Rollover** is required when **Keep** is blocked by **Folder Capacity**.
- **Session Folder Rollover** uses an inline folder field, not a modal by default.
- **Session Folder Rollover** accepts only an existing folder whose **Folder Count** is below **Folder Capacity**.
- The app does not auto-create a **Session Folder** during **Session Folder Rollover**.
- **Bootstrap Settings** provide defaults for **Local Settings**.
- **Local Settings** override **Bootstrap Settings** when both define the same configurable value.
- The app updates **Local Settings**, not `.env`, when settings change in the UI.
- **Local Credentials** may be stored in **Bootstrap Settings** or **Local Settings**.
- Settings API responses expose **Password Presence**, never the qBittorrent password value.
- The **Review Shell** is visible even when qBittorrent is disconnected.
- **Local Production Run** serves the built Vite React **Review Shell** from FastAPI.
- **Development Run** may use a Vite dev server plus FastAPI API server.
- `GET /` returns the **Review Shell** from FastAPI during **Local Production Run**.
- **Packaged App** is out of scope for the initial product version.
- **Connection Setup State** appears inside the queue panel until qBittorrent connection succeeds.
- Settings remain accessible from the **Review Shell** during **Connection Setup State**.
- **Settings Panel** lives inside the **Review Shell** in the initial product version.
- **Settings Panel** is an inline panel or drawer, not a separate route.
- A **Review Queue** is shown only after qBittorrent connection succeeds.
- A **Reject** action applies to one **Completed Torrent**.
- **Armed Reject** is entered by pressing `E` once or clicking Reject once.
- **Reject** is confirmed by pressing `E` again or clicking the armed Reject control again.
- **Armed Reject** is canceled by `Esc`, changing the current torrent, or an 8-second timeout.
- **Path Mapping** is required before **Embedded Preview**, **External Open**, or **Keep** can access a file.
- A **Torrent File Path** for a **Single-File Torrent** uses qBittorrent `content_path` when available.
- A **Torrent File Path** for a **Multi-File Torrent** uses qBittorrent `save_path` plus the file-list `name`.
- A **Torrent File Path** must map to an existing WSL path before **Embedded Preview**, **External Open**, or **Keep**.
- A **Completed Torrent** becomes an **Attention Torrent** when its **Torrent File Path** cannot be mapped to an existing WSL path.
- **Embedded Preview** and **External Open** use a **Media Handle** supplied by the browser.
- The server resolves a **Media Handle** to a **Torrent File Path** from qBittorrent metadata.
- Browser requests never supply raw local file paths.
- **Keep**, **Reject**, **Embedded Preview**, and **External Open** re-fetch or re-resolve qBittorrent metadata before acting.
- **External Open** uses the **Windows Default App** in the initial product version.
- **External Open** may use `explorer.exe` or `cmd.exe /c start ""` as Windows open mechanisms.
- Configurable player commands are deferred until the **Windows Default App** flow proves insufficient.
- **Preview Unavailable** makes **External Open** the primary action for the selected video.
- **Preview Unavailable** is not an error unless the file is missing, unreadable, or cannot be resolved.
- **Torrent Leftovers** may be deleted only after **Keep** moves marked candidates successfully.

## Example Dialogue

> **Dev:** "If a torrent has one large movie and several text files, are the text files Junk Files or Torrent Leftovers?"
> **Domain expert:** "Before Keep, they are Junk Files in Torrent Detail. After Keep moves and verifies the Marked Candidate, any remaining torrent content is Torrent Leftovers and qBittorrent deletes it."

## Flagged Ambiguities

- "vanilla browser UI" conflicted with the requested Vite React UI. Resolved: the canonical UI is a Vite React SPA backed by FastAPI.
- "delete" could mean Reject or cleanup after Keep. Resolved: **Reject** means confirmed qBittorrent delete-with-files for the whole torrent; **Keep** deletes leftovers only after marked candidates move successfully.
- "queue" could mean qBittorrent's global transfer queue or this app's review list. Resolved: **Review Queue** means completed torrents waiting for manual review.
- "queue refresh" could mean manual refresh only. Resolved: the app uses 15-second **Queue Auto-Poll** in v1 while preserving the user's current review focus and avoiding broad file-list polling.
- "torrent disappeared during polling" could mean immediately changing selection. Resolved: show **Vanished Torrent** state for the current selection and let the user choose Next or Refresh.
- "undo" could imply restoring qBittorrent-deleted files. Resolved: **Review Undo** is out of v1 because delete-with-files is destructive; confirmation and status carry safety instead.
- "attention torrents" could mean hidden backend errors. Resolved: **Attention Torrents** are visible in collapsed **Needs Attention Section**, but excluded from normal review navigation.
- "cleanup retry" could mean every attention torrent can retry deletion. Resolved: **Cleanup Retry** is available only for **Cleanup Failed Torrent**; other attention reasons use informational actions.
- "selected video" could mean preview focus or Keep intent. Resolved: **Selected Video** means current preview/open focus; **Marked Candidate** means a video candidate chosen for Keep.
- "default selected" could mean all likely videos are kept automatically. Resolved: **Default Mark** marks only the largest video candidate.
- "candidate selection" could mean preview focus or Keep marking. Resolved: **Active Candidate** is keyboard focus/preview target; **Marked Candidate** is Keep intent; rows expose checkbox-style **Candidate Marking**.
- "keyboard-first" could imply arrow-key navigation. Resolved: **Left-Hand Keyboard Model** is primary, with WASD and Space for one-handed review; arrows are secondary.
- "global shortcuts" could mean firing while typing in settings. Resolved: review shortcuts are disabled during **Typing Context**, with `Esc` reserved for cancel/blur behavior.
- "completed" could mean qBittorrent's completed filter or app-safe review readiness. Resolved: **Completed Torrent** requires qBittorrent completed filter, `progress == 1`, and no error or missing-content state; otherwise it is an **Attention Torrent**.
- "path" could mean qBittorrent metadata, WSL filesystem access, or browser media route. Resolved: **Torrent File Path** is built from `content_path` for **Single-File Torrent** or `save_path` plus file `name` for **Multi-File Torrent**, then **Path Mapping** converts it for local access.
- "candidate filtering" could mean qBittorrent torrent filtering or app file filtering. Resolved: qBittorrent filters completed torrents; the app uses **Video Allowlist** to classify files inside a torrent, with no default minimum size cutoff.
- "preserve filename" could mean preserving torrent-relative folders too. Resolved: **Keep** writes a flat **Session Folder**, preserving only the original filename and adding numeric suffixes for collisions.
- "leftovers" could imply only junk files. Resolved: **Torrent Leftovers** includes junk files and unmarked video candidates; users must mark every video they want preserved before Keep.
- "confirm reject" could mean a modal, typed phrase, or second action. Resolved: **Armed Reject** uses `E` then second `E` or second Reject click, with `Esc`, torrent change, and timeout cancellation.
- "confirm keep" could mean every Keep action needs confirmation. Resolved: **Armed Keep** is required only when multiple video candidates exist and at least one is unmarked, using `Q` then second `Q` or second Keep click.
- "folder count" could mean only files moved during the current app run. Resolved: **Folder Count** reads existing video files in the flat **Session Folder** and adds marked candidates pending Keep.
- "next folder" could mean auto-creating a numbered folder. Resolved: **Session Folder Rollover** blocks Keep and requires the user to choose an existing folder with room.
- "settings" could mean `.env` edits or app-managed settings. Resolved: **Bootstrap Settings** come from `.env`; UI changes write **Local Settings** to `config.local.json`.
- "show saved password" could mean returning a masked or raw secret. Resolved: settings responses expose **Password Presence** only; password values are write-only through the UI.
- "require connection" could mean blocking the whole UI until qBittorrent works. Resolved: show the **Review Shell**, use **Connection Setup State** in the queue panel, and keep settings accessible.
- "settings page" could mean a separate route. Resolved: v1 uses an inline **Settings Panel** inside the **Review Shell**.
- "local run" could mean always running FastAPI and Vite separately. Resolved: **Local Production Run** is one FastAPI server serving built Vite assets; **Development Run** can use two servers.
- "local app" could imply installer or executable packaging. Resolved: **Packaged App** is out of v1; run from repo scripts first.
- "media path" could mean a browser-supplied filesystem path. Resolved: browser requests use **Media Handle** only; the server resolves paths from qBittorrent metadata.
- "cached torrent detail" could mean cached data is safe for actions. Resolved: **Torrent Detail Cache** is UI-only and short-lived; file/destructive actions re-fetch or re-resolve metadata before acting.
- "cleanup failed" could imply Keep failed and kept files should roll back. Resolved: **Cleanup Failed Torrent** means kept videos remain kept, torrent cleanup needs explicit retry or manual qBittorrent resolution.
- "external player" could mean user-configured player commands. Resolved: **External Open** uses the **Windows Default App** for v1; configurable player commands are deferred.
- "unsupported preview" could imply the file is broken. Resolved: **Preview Unavailable** means browser playback is unavailable; missing/unreadable/unresolved files are errors.
- "after action" could mean staying on a removed torrent. Resolved: successful **Keep**, successful **Reject**, and cleanup failure all trigger **Auto-Advance**.
