# Agent Tool Reference

Use MCP/tool servers according to the task. Prefer official or local project sources for current facts.

| Server or tool family | Use in this repo |
| --- | --- |
| `serena` | Repository-aware code navigation, onboarding memories, semantic symbol discovery, and symbol-aware edits once code exists. |
| `tool_search` | Discover deferred MCP tools for GitHub, Playwright/browser, context7, shadcn, and other available servers. Use this before assuming a server is unavailable. |
| `context7` | Current library documentation for FastAPI, Vite, React, testing libraries, and related SDKs when available. |
| `github` | Issues, pull requests, repository metadata, and collaboration tasks when GitHub work is requested. |
| Browser or Playwright tools | Browser smoke tests, UI interaction checks, screenshots, console logs, keyboard flows, and responsive verification. |
| `bd` / Beads | Repo-local issue tracking, dependency tracking, workflow context, and durable follow-up capture. Run `bd prime` at task start when tracking work. |
| Web search | Current qBittorrent WebUI/API docs or other time-sensitive facts when local docs are insufficient. Prefer official sources. |
| Local shell/tools | Use `rg`, `rg --files`, package scripts, pytest, npm scripts, git commands, and project CLIs for ordinary repo work. |

Do not use Supabase or Vercel tools for this repo unless the user explicitly changes the project direction.
