# Agent Skill Reference

When a skill is available and its trigger matches the task, read its `SKILL.md` and follow it. Use the minimal set of skills that covers the task.

Repo-local copies of the skills referenced here live in `skills/`. Prefer those copies for inspection and developer onboarding when a global Codex skill or plugin cache is unavailable.

## Core Project And Process Skills

| Skill | Use |
| --- | --- |
| `superpowers:using-superpowers` | Start-of-conversation skill discovery and workflow discipline. |
| `superpowers:brainstorming` | Product/design exploration before creative feature work. |
| `superpowers:writing-plans` | Create implementation plans after a design/spec is approved. |
| `superpowers:executing-plans` | Execute an existing implementation plan with checkpoints. |
| `superpowers:test-driven-development` | Behavior changes and bug fixes where tests should drive the change. |
| `superpowers:systematic-debugging` | Bug investigation, test failures, or unexpected behavior. |
| `superpowers:verification-before-completion` | Final verification before claiming work is done. |
| `superpowers:requesting-code-review` | Request a review after substantial implementation. |
| `superpowers:receiving-code-review` | Process review feedback before making changes. |
| `superpowers:finishing-a-development-branch` | Decide how to finish, integrate, or hand off a completed branch. |
| `superpowers:using-git-worktrees` | Isolate larger feature work in a worktree when appropriate. |
| `superpowers:dispatching-parallel-agents` | Coordinate independent parallel agent tasks. |
| `superpowers:subagent-driven-development` | Use subagents to implement independent parts of an approved plan. |
| `superpowers:writing-skills` | Create or update skills. |
| `grill-me` | Stress-test plans, sharpen domain language, and update `CONTEXT.md` as terms resolve. |

## Frontend, React, And Design Skills

| Skill | Use |
| --- | --- |
| `impeccable` | Design, critique, polish, audit, and improve frontend interfaces. |
| `frontend-design` | Build high-quality frontend surfaces when the task asks for app UI. |
| `web-design-guidelines` | Audit UI accessibility, layout, responsiveness, and design quality. |
| `webapp-testing` | Interact with and test local web apps using Playwright-style workflows. |
| `browser-use:browser` | Inspect or operate local browser targets when requested. |

## Quality And Utility Skills

| Skill | Use |
| --- | --- |
| `brooks-lint` | Code quality review using classic engineering-book heuristics. |
| `caveman` | Required for user-facing replies in this repo unless the user says `stop caveman` or `normal mode`. |

## Excluded Skills

Supabase and Vercel skills are intentionally not part of this repo's default skill set. This app is local FastAPI plus Vite React.

