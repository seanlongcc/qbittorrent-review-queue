# Repo-Local Skills

This directory vendors the Codex skills referenced by this repository so other developers can inspect or install the same guidance without relying on one machine's global Codex or plugin cache.

`docs/agent/skills.md` remains the task-to-skill index. This directory is the repo-local source copy for those entries.

## Layout

- `standalone/` - standalone skills used by this repo.
- `plugins/browser-use/` - Browser Use plugin skills.
- `plugins/superpowers/` - Superpowers plugin skills.

## Name Mapping

Namespaced skills map to source folders like this:

- `browser-use:browser` -> `skills/plugins/browser-use/browser/SKILL.md`
- `superpowers:<name>` -> `skills/plugins/superpowers/<name>/SKILL.md`

Standalone skill names map directly to `skills/standalone/<name>/SKILL.md`.

## Included

- `brooks-lint`
- `caveman`
- `frontend-design`
- `grill-me`
- `impeccable`
- `web-design-guidelines`
- `webapp-testing`
- Browser Use `browser`
- Superpowers process skills

## Excluded

Supabase and Vercel skills are intentionally excluded. This project is local FastAPI plus Vite React.

## Updating

When `docs/agent/skills.md` adds or removes a skill, update this directory in the same change. Copy the full skill folder, not only `SKILL.md`, because skills may depend on bundled `references/`, `scripts/`, or `assets/`.

