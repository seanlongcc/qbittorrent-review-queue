# Product

## Register

product

## Users

Local qBittorrent Review Queue is for one person reviewing completed qBittorrent downloads on a Windows machine from a WSL-hosted local web app. They are likely moving quickly through a backlog, using a keyboard, previewing videos, and making irreversible Keep or Reject decisions.

The core job is to turn completed torrents into a safe, keyboard-first review flow that separates candidate videos from junk files and prevents accidental destructive deletes.

## Product Purpose

Local qBittorrent Review Queue is a FastAPI plus Vite React app for manual review of completed qBittorrent torrents. It connects to qBittorrent WebUI/API, lists completed torrents, identifies video candidates, previews or opens videos, and then moves marked candidates into a session folder or deletes rejected torrents.

Success means a user can process a queue quickly without losing kept media, exceeding the current session folder limit, or accidentally deleting torrent content without confirmation.

## Brand Personality

Focused, exact, local, and guarded.

The app should feel like a file-review instrument: dense enough for repeated work, calm enough for destructive decisions, and honest about what will move or delete. Tone should be terse and operational. The app is local tooling, not a cloud product.

## Anti-References

Avoid marketing pages, generic SaaS dashboards, decorative card grids, pastel productivity-tool blandness, neon hacker spectacle, glassmorphism as decoration, AI-gradient visuals, and playful delete flows.

Avoid interfaces that obscure destructive actions, hide file paths when they matter, or imply remote persistence. Avoid multi-step ceremony for ordinary navigation.

## Design Principles

1. The selected video is the stage. Queue, candidates, and actions should support review without burying preview.
2. Destructive actions must be legible. Reject and cleanup behavior should be obvious before it happens.
3. Keyboard-first does not mean keyboard-only. Pointer controls, focus states, and accessible names must match the keyboard model.
4. File reality matters. Sizes, paths, and candidate ordering should help the user decide quickly.
5. Local constraints should surface at the moment of action. Folder capacity and path mapping failures should block risky work with clear recovery.

## Accessibility & Inclusion

Target WCAG 2.2 AA for contrast, focus states, controls, dialogs or inline confirmations, keyboard interaction, media controls, and reduced-motion preferences.

The review workflow must remain usable without hover, with keyboard only, with zoomed text, and with media preview unavailable. Embedded preview failure should not block external open.
