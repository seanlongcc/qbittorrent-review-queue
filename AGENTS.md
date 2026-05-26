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

Build a local qBittorrent review queue for completed torrents. The app lets one person inspect video candidates, preview or open the selected video, then Keep marked candidates or Reject the torrent with confirmation.

See `docs/agent/product.md` for the full current product brief.

## Data And Destructive Action Rules

These rules are core product constraints. Violations can delete user data.

- qBittorrent credentials stay local in `.env`; never commit real credentials.
- Treat `Reject`/`Delete` as destructive. It must require explicit confirmation before calling qBittorrent delete with `deleteFiles=true`.
- Treat `Keep` as a confirmed, move-only local operation: after confirmation, move marked candidate files into the session folder and return the expected folder count. Do not block or fail Keep solely because `/mnt/c` visibility lags after a successful move.
- Never delete a kept file after a successful move.
- Never call qBittorrent delete-with-files from a Keep action.
- After Keep, leave the torrent in the queue until the user explicitly presses Delete.
- After Keep, keep moved candidates visibly marked as moved and preserve the returned folder count until refresh catches up.
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

## Brooks-Lint Development Guardrails

Use these rules to prevent large-file refactors and mixed-responsibility decay in the review workbench. They are based on Brooks-Lint decay risks: cognitive overload, change propagation, knowledge duplication, accidental complexity, dependency disorder, and domain model distortion.

The 800-line number is not a Brooks-Lint or book rule. It is a local repo guardrail derived from Brooks-Lint's cognitive-overload risk. Brooks-Lint's concrete signals are smaller: mixed-abstraction functions over 20 lines, parameter lists over 4 parameters, boolean expressions with 3 or more combined conditions, nesting deeper than 3, fan-out over 5 imports, and changes that ripple across more than 3 unrelated files.

Before adding behavior:

1. Name the Brooks-Lint risk most likely to grow if the behavior is added inline.
2. Choose the smallest existing module that owns the behavior, or create a focused module before adding feature logic.
3. Keep React components responsible for view state ownership, effects, side-effect boundaries, handler wiring, and UI composition. Move validation, keyboard command mapping, API payload building, candidate sorting, path display formatting, review state transitions, media selection calculations, and workflow orchestration into focused helpers.
4. Keep FastAPI route handlers thin. Move qBittorrent calls, filesystem mutation, path mapping, and review workflow orchestration into service modules.
5. If a change would add more than 50 lines to a file already over 500 lines, create or extend a helper module in the same branch.
6. If a file is over 800 lines, add no new feature/business logic there unless the change is only wiring existing helpers. Extract first.
7. If a function grows past 20 lines while mixing UI, state transitions, persistence, network calls, filesystem work, or runtime work, split it before continuing.
8. If a helper needs more than 4 parameters, prefer a typed input object with domain names.
9. If one change touches more than 3 unrelated modules, stop and write/update the implementation plan so boundaries are explicit.
10. Avoid speculative abstractions. Extract around current repeated decisions or current complexity, not imagined future providers.
11. Treat large test files like large production files: if a test file is over 800 lines, add new scenarios to a focused sibling test file or colocated helper test unless broad integration coverage is required.
12. Before completion, state whether any large file grew, why, and what remains to extract.

Ownership rules:

- `backend/app/api`: FastAPI routers, request/response validation, dependency wiring, and HTTP errors.
- `backend/app/config`: environment loading and settings validation only.
- `backend/app/qbt`: qBittorrent API client, auth/session handling, and API response normalization.
- `backend/app/paths`: path mapping, drive/root validation, and Windows/WSL path conversion.
- `backend/app/torrents`: review queue assembly, torrent detail assembly, candidate filtering, junk grouping, and sorting.
- `backend/app/media`: media file lookup, range streaming, content type detection, and external open.
- `backend/app/review`: Keep/Reject orchestration, folder capacity checks, move/delete sequencing, and rollback-safe error reporting.
- `frontend/src/api`: typed API client and API DTOs.
- `frontend/src/review`: review queue state, active torrent/video state, marked candidate state, keyboard command handling, and workflow orchestration.
- `frontend/src/settings`: local settings form and qBittorrent/session folder configuration UI.
- `frontend/src/ui`: reusable presentational components and design tokens only.

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

Common local commands:

- `npm run dev` - Start FastAPI backend on `127.0.0.1:8000` and Vite frontend on `0.0.0.0:5500`; installs backend dev dependencies into `.venv` when missing.
- `npm run dev:backend` - Start only the FastAPI backend.
- `npm run dev:frontend` - Start only the Vite frontend.

Before implementation:

1. Write or update a short product/design spec for new major features.
2. Confirm the data and destructive action rules above.
3. Resolve domain terms in `CONTEXT.md` when new concepts are introduced.
4. Create an implementation plan before touching app code.

During implementation:

1. Prefer existing repo patterns over new abstractions.
2. Use typed boundaries between FastAPI responses and React state.
3. Use TypeScript types for persisted local settings, API DTOs, and runtime media items.
4. Use structured path APIs (`pathlib`, `PureWindowsPath`, `Path`) and structured API clients/parsers instead of ad hoc string parsing.
5. Keep destructive workflows explicit and test-covered.
6. Keep UI state transitions testable outside component rendering when practical.
7. Build responsive and keyboard-first. Verify mobile viewports when layout, responsiveness, or interaction changed.
8. Use `docs/agent/tools.md` and `docs/agent/skills.md` for task-specific tool/skill choices.
9. Use `docs/agent/testing.md` for detailed test decisions and verification expectations.

## Subagents

Use subagents for code review, testing, and continuous refactoring when those activities are requested or when a substantial implementation is in progress or nearing completion. If the active agent runtime requires explicit permission before spawning subagents, ask for that permission first.

Recommended subagent usage:

- Code review subagent: inspect changed files for bugs, regressions, data persistence violations, auth/RLS gaps, mobile UI regressions, and missing tests.
- Testing subagent: run or design focused verification for unit tests, integration tests, browser flows, and mobile layouts.
- Continuous refactoring subagent: while substantial feature work is underway, keep a parallel pass focused on small, behavior-preserving cleanup such as removing duplication, tightening types, improving names, simplifying component boundaries, and aligning code with existing project patterns.
- Serena memory refresh subagent: while another substantial task is running, keep a background pass focused on refreshing relevant Serena memories so durable project context stays current.
- AGENTS.md maintenance subagent: review and update this file when project rules, architecture, commands, MCP servers, skills, deployment setup, auth/data constraints, or testing workflow change.
- Keep subagent tasks bounded and non-overlapping.
- Keep Serena memory refresh work read-focused and non-overlapping with implementation work. Do not ask it to edit files already owned by another subagent or active task.
- Serena memories must stay high-level and durable. Do not store secrets, local paths, third-party media URLs, raw provider payloads, raw Reddit IDs, transient runtime state, or other privacy-sensitive data.
- Do not ask subagents to modify the same files in parallel unless ownership boundaries are explicit.

Use the AGENTS.md maintenance subagent after substantial setup or workflow changes, including:

- New package scripts, test commands, ESLint/Prettier commands, lint/typecheck/build commands, or dev server commands.
- New MCP servers, tools, plugins, or required skills.
- Changes to Supabase schema, RLS policy strategy, auth providers, or stored data rules.
- Changes to Vercel deployment, environment variables, or runtime architecture.
- New product constraints that future agents must preserve.

## Testing Summary

Use tests intentionally. Do not add tests just to satisfy a process rule.

- TDD is required for path mapping, candidate filtering, sorting, folder capacity, Keep/Reject workflows, qBittorrent API behavior, API routes, state transitions, keyboard commands, validation, persistence of local settings, error handling, accessibility-relevant interaction, and bug fixes where a regression test can reproduce the issue.
- New automated tests are usually not required for documentation-only changes or purely visual changes.
- UI-only changes still need typecheck/lint/format checks where relevant, plus browser/mobile viewport verification when layout, responsiveness, or interaction changed.
- Browser smoke coverage should include queue loading, preview route rendering, keyboard navigation, Keep disabled at folder capacity, and Reject confirmation.

See `docs/agent/testing.md` for detailed rules.

Test ownership rules:

- Use the narrowest test owner that proves the behavior. Pure helper tests belong next to helper modules as `*.test.ts` or `*.test.tsx`.
- Backend workflow tests belong near the owning backend module, such as `backend/app/paths`, `backend/app/torrents`, `backend/app/review`, or `backend/app/qbt`.
- Frontend review workflow tests should prefer focused helper or workflow test files under `frontend/src/review` before adding broad component integration coverage.
- Do not add new scenarios to a test file over 800 lines by default. Choose or create a focused sibling test file unless broad integration coverage is required.
- Keep shared render/setup helpers in one test utility module. Do not copy setup helpers across split test files.
- Before adding to a large integration test file, state why a narrower helper test or focused workflow test would not catch the regression.

## Issue Tracking

This project uses **bd (beads)** for issue tracking. Run `bd prime` for current workflow context. Beads is initialized with issue prefix `qbrq`.

Bead creation expectations:

- Default to creating or claiming a bead before changing code, docs, configuration, tests, workflows, or project rules unless the user explicitly asks not to track the task.
- Create beads for bug fixes, feature work, refactors, investigation tasks, verification tasks, docs/process changes, and follow-up work that future agents should remember.
- If a request is more than a tiny one-shot answer or command, make a bead. When unsure, create the bead.
- For large or multi-part work, create a parent `epic` or `feature` bead plus child task/bug beads with dependencies instead of one oversized issue.
- When substantial follow-up work is discovered but not handled immediately, create a new bead. If it belongs to current work, add a note or dependency instead of leaving it only in chat.
- Do not create duplicate beads. Search existing open, in-progress, and recently closed issues first when the task sounds similar.
- At completion, close completed beads with a reason and leave remaining follow-up as open beads.

Quick reference:

- `bd prime` - Load workflow context.
- `bd ready` - Find unblocked work.
- `bd create --title="Title" --description="Why this exists and what needs doing" --type=task --priority=2` - Create an issue.
- `bd show <id>` - Show issue details.
- `bd update <id> --claim` - Claim work.
- `bd close <id> --reason="Completed"` - Complete work.
- `bd dolt push` - Push beads to the configured remote.

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
