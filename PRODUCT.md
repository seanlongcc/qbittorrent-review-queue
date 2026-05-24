# Product

## Register

product

## Users

Local qBittorrent Review Queue is for one person reviewing completed qBittorrent downloads on a Windows machine from a WSL-hosted local web app. They are moving through a backlog of completed torrents, usually with one hand on the keyboard, switching between embedded preview and an external player when browser playback is not enough.

The user is making file-system decisions, not browsing content for entertainment. They need to identify real video candidates, ignore junk files, mark what should be kept, and reject whole torrents only when the delete outcome is clear.

## Product Purpose

Local qBittorrent Review Queue is a FastAPI plus Vite React app for manual review of completed qBittorrent torrents. It connects to the local qBittorrent WebUI/API, lists completed torrents, identifies video candidates, previews or opens videos, and then either moves marked candidates into a session folder or deletes rejected torrents.

Success means the user can clear a completed queue quickly without losing kept media, exceeding the current session folder limit, hiding path-mapping failures, or accidentally deleting torrent content without explicit confirmation.

## Brand Personality

Focused, exact, local, guarded.

The app should feel like a file-review instrument: dense enough for repeated work, calm enough for irreversible decisions, and honest about what will move, stay, fail, or delete. Tone is terse and operational. The product is local tooling, not a cloud platform, media brand, or productivity lifestyle app.

## Anti-References

Avoid marketing pages, generic SaaS dashboards, decorative card grids, pastel productivity-tool blandness, neon hacker spectacle, glassmorphism as decoration, AI-gradient visuals, playful delete flows, and anything that makes qBittorrent cleanup feel casual.

Avoid interfaces that obscure destructive actions, hide file paths when they matter, imply remote persistence, make "remove" ambiguous, or require multi-step ceremony for ordinary navigation. Do not turn queue review into a media gallery, streaming service, or file-manager clone.

## Design Principles

1. The selected video is the stage. Queue, candidates, paths, and actions support review without burying preview.
2. Destructive actions must be legible. Reject and cleanup behavior should be obvious before it happens, with inline confirmation near the action.
3. Keyboard-first does not mean keyboard-only. Pointer controls, focus states, accessible names, and visible command state must match the keyboard model.
4. File reality matters. Sizes, paths, indexes, candidate sorting, junk grouping, and destination capacity should help the user decide quickly.
5. Local constraints surface at the moment of action. Folder capacity, path mapping, auth, move failure, and delete failure should block risky workflows with clear recovery.
6. Familiar product UI beats novelty. Use predictable rails, rows, action bars, disclosures, and settings forms so attention stays on the review decision.

## Accessibility & Inclusion

Target WCAG 2.2 AA for contrast, focus states, controls, inline confirmations, keyboard interaction, media controls, and reduced-motion preferences.

The review workflow must remain usable without hover, with keyboard only, with zoomed text, with color-vision differences, and with media preview unavailable. Embedded preview failure should not block external open. Text labels stay on Keep and Reject because the consequences matter.
