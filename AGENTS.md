# AGENTS.md

Guidance for AI coding agents working in this repository.

This file is the hard-rules and orientation index. Longer reference material lives in:

- `PRODUCT.md` - Impeccable product context, users, tone, anti-references, and product principles.
- `DESIGN.md` / `docs/design.json` - visual system for the Vite React UI.
- `CONTEXT.md` - domain language for the review queue.
- `docs/agent/product.md` - detailed product intent and local qBittorrent review flow.
- `docs/agent/testing.md` - testing decision policy and high-value test areas.
- `docs/agent/tools.md` - tool and MCP usage map.
- `docs/agent/skills.md` - skill usage map.
- `skills/` - repo-local copies of skills referenced by `docs/agent/skills.md`.

## User-Facing Replies

Always use the `caveman` skill for user-facing replies unless the user explicitly says `stop caveman` or `normal mode`.

When using caveman, keep technical accuracy, commands, code, commit messages, and review findings normal where precision matters. Use terse caveman style for ordinary conversation.

## Project State

Planned local stack:

- FastAPI backend for qBittorrent API access, filesystem operations, media streaming, and local settings.
- Vite React frontend for the review queue UI.
- TypeScript for frontend code.
- Python tests with pytest for backend behavior.
- Vitest and Playwright for frontend behavior and browser smoke coverage.
- Local `.env` for qBittorrent WebUI URL, username, password, completed queue settings, Windows/WSL path mapping, and current session folder.

This is a local desktop workflow. Do not add Supabase, Vercel, cloud persistence, remote auth, hosted storage, telemetry, or deployment setup unless the user explicitly changes direction.

## Product Intent

Build a local qBittorrent review queue for completed torrents. The app lets one person inspect video candidates, preview or open selected files, then Keep selected videos or Reject the torrent with confirmation.

See `docs/agent/product.md` for the full current product brief.

## Data And Destructive Action Rules

These rules are core product constraints. Violations can delete user data.

- qBittorrent credentials stay local in `.env`; never commit real credentials.
- Treat `Reject` as destructive. It must require explicit confirmation before calling qBittorrent delete with `deleteFiles=true`.
- Treat `Keep` as a two-phase local operation: move selected video files first, then remove the torrent and leftovers only after moves succeed.
- Never delete a kept file after a successful move.
- Never call qBittorrent delete-with-files for a Keep action until selected files are safely moved.
- If a Keep move partially fails, report the failure and do not delete torrent leftovers automatically.
- Session folders have a 40-video capacity. When the folder is full, block further Keep actions until a new session folder is chosen.
- Store only local settings needed for this app. Do not persist media metadata beyond what is needed for current review state unless the user approves a persistence design.
- Windows paths returned by qBittorrent and WSL filesystem paths must be mapped deliberately and tested.

## Architecture Direction

Prefer these boundaries when implementation starts:

- `backend/app/config`: `.env` loading, settings validation, and local app configuration.
- `backend/app/qbt`: qBittorrent WebUI API client and auth/session behavior.
- `backend/app/paths`: Windows-to-WSL and WSL-to-Windows path mapping.
- `backend/app/torrents`: completed torrent queue, torrent detail assembly, candidate filtering, and sorting.
- `backend/app/media`: streaming, content-type detection, external open, and filesystem access.
- `backend/app/review`: Keep and Reject workflows, folder capacity checks, and qBittorrent deletion orchestration.
- `frontend/src/api`: typed API client and response types.
- `frontend/src/review`: queue state, selected torrent/video state, keyboard commands, and review workflow.
- `frontend/src/settings`: qBittorrent connection and session folder settings.
- `frontend/src/ui`: reusable components, layout primitives, icons, and design tokens.

Keep qBittorrent API access, path mapping, filesystem mutation, and UI rendering separate enough that each can be tested independently.

## UI Direction

Use Vite React as the canonical UI architecture. The original "vanilla browser UI" wording is superseded.

Use `impeccable` for frontend design, critique, polish, and UI quality work. This is a product UI, not a marketing surface. The first screen should be the usable review workbench, not a landing page.

Primary UX shape:

- Queue rail for completed torrents.
- Media stage for selected candidate preview.
- Candidate list sorted largest first.
- Collapsed junk/non-video disclosure.
- Compact action bar for Keep, Reject, Open External, next/previous torrent, and next/previous video.
- Inline destructive confirmation for Reject.
- Keyboard-first interaction with visible focus, tooltips, and accessible command names.

## Development Workflow

Before implementation:

1. Resolve domain terms in `CONTEXT.md` when new concepts are introduced.
2. Use `docs/agent/skills.md` and `docs/agent/tools.md` for task-specific workflow choices.
3. For substantial features, write or update a short implementation plan before touching app code.

During implementation:

1. Prefer local patterns once they exist.
2. Use typed boundaries between FastAPI responses and React state.
3. Use structured path APIs (`pathlib`, `PureWindowsPath`, `Path`) instead of ad hoc path slicing where possible.
4. Keep destructive workflows explicit and test-covered.
5. Keep UI state transitions testable outside component rendering when practical.

## Testing Summary

Use tests intentionally. Do not add tests only to satisfy process.

- TDD is required for path mapping, candidate filtering, sorting, folder capacity, Keep/Reject workflows, qBittorrent API behavior, API routes, state transitions, keyboard commands, and bug fixes where a regression test can reproduce the issue.
- New automated tests are usually not required for documentation-only changes or purely visual changes.
- UI changes still need typecheck/lint/format checks where relevant, plus browser verification when layout or interaction changed.
- Browser smoke coverage should include queue loading, preview route rendering, keyboard navigation, Keep disabled at folder capacity, and Reject confirmation.

See `docs/agent/testing.md` for detailed rules.

## Git And Completion Workflow

1. Use Conventional Commits for commit messages, for example `feat: add review queue` or `fix: block keep when folder full`.
2. Before completion, run the narrowest relevant verification commands and state exactly what passed.
3. If browser verification cannot run, report the blocker and do not claim browser behavior passed.
4. Check `git status --short --branch`.
5. Summarize changed files and any checks that could not be run.

## Tools And Skills

- Use MCP/tool servers according to the task. Prefer official docs or local project sources for current facts. See `docs/agent/tools.md`.
- Use Serena MCP for repository-aware code work when available. Prefer semantic tools for code navigation once code exists.
- Use `impeccable` for frontend interface design, redesign, critique, audit, polish, and UI quality work.
- Use `grill-me` when the user wants to stress-test a plan or resolve domain language.
- Use `brooks-lint` for code quality review and architecture pressure checks.
- When a skill is available and its trigger matches the task, read its `SKILL.md` and follow it. Use the minimal set of skills that covers the task. Prefer repo-local copies in `skills/` for inspection and onboarding. See `docs/agent/skills.md`.

