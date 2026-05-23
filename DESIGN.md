---
name: Local qBittorrent Review Queue
description: Local keyboard-first review workbench for completed torrent videos.
colors:
  background: "oklch(15.5% 0.008 165)"
  foreground: "oklch(93% 0.012 78)"
  surface: "oklch(20% 0.011 165)"
  surface-elevated: "oklch(25% 0.014 165)"
  popover: "oklch(24% 0.014 165)"
  primary: "oklch(67% 0.14 150)"
  primary-hover: "oklch(73% 0.145 150)"
  primary-foreground: "oklch(14% 0.01 165)"
  secondary: "oklch(78% 0.115 82)"
  secondary-soft: "oklch(24% 0.03 82)"
  info: "oklch(70% 0.095 225)"
  destructive: "oklch(62% 0.17 28)"
  destructive-hover: "oklch(68% 0.175 28)"
  muted: "oklch(23% 0.012 165)"
  muted-foreground: "oklch(70% 0.025 82)"
  border: "oklch(34% 0.018 165)"
  input: "oklch(28% 0.016 165)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "normal"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: "34px"
    padding: "0 12px"
  button-danger:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "34px"
    padding: "0 12px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "34px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "12px"
---

# Design System: Local qBittorrent Review Queue

## 1. Overview

**Creative North Star: "The Sorting Bay"**

The UI is a dark, local workbench for fast media decisions. It should feel like a practical review bay: selected video in the center, queue and files close at hand, destructive decisions contained, and enough path/file metadata to keep trust high.

Physical scene: one person sits at a desktop in a dim room, one hand on the keyboard, clearing completed downloads while avoiding accidental file loss.

Register: product. Color strategy: restrained, with green for Keep, red for Reject, amber for capacity/focus, and blue only for informational file/system status.

## 2. Colors

The palette is graphite green-black with warm text and functional signal colors.

### Primary

- **Keep Green** (`oklch(67% 0.14 150)`): Keep action, marked candidates, successful move.
- **Keep Green Hover** (`oklch(73% 0.145 150)`): Hover and active feedback for Keep.

### Secondary

- **Capacity Amber** (`oklch(78% 0.115 82)`): Focus rings, folder capacity warnings, keyboard focus, active selection edge.
- **System Blue** (`oklch(70% 0.095 225)`): qBittorrent connection state and non-destructive system information. Use rarely.
- **Reject Red** (`oklch(62% 0.17 28)`): Reject, delete-with-files, failed destructive operation.

### Neutral

- **Graphite Bay** (`oklch(15.5% 0.008 165)`): App background and preview stage.
- **Panel Deck** (`oklch(20% 0.011 165)`): Queue rail, candidate list, settings surfaces.
- **Lifted Deck** (`oklch(25% 0.014 165)`): Inline confirmations, popovers, active rows.
- **Warm File Text** (`oklch(93% 0.012 78)`): Primary text and icons.
- **Muted File Text** (`oklch(70% 0.025 82)`): Secondary metadata, sizes, paths, helper copy.
- **Bay Border** (`oklch(34% 0.018 165)`): Dividers, focus-independent separation, preview frame.

### Named Rules

**The Action Color Rule.** Green means keep or success. Red means reject, delete, or failed destructive operation. Amber means focus, capacity, or attention before action.

**The Stage First Rule.** Preview and candidate files dominate. Decorative color does not.

## 3. Typography

**UI Font:** Inter with system sans fallback.
**Mono Font:** IBM Plex Mono with ui-monospace fallback.

The interface is operational. Avoid display-font personality. File names, sizes, hashes, paths, and counts benefit from mono only when alignment or scannability improves.

### Hierarchy

- **Display** (650, 1.75rem, 1.1): App title and empty-state title only.
- **Headline** (650, 1.125rem, 1.2): Main panel titles and settings headings.
- **Title** (650, 0.875rem, 1.3): Torrent names, selected file names, candidate row titles.
- **Body** (400, 0.875rem, 1.5): Normal UI copy and errors.
- **Label** (650, 0.75rem, 1.2): Control labels, badges, status labels.
- **Mono** (500, 0.75rem, 1.4): Hashes, paths, file indexes, sizes, and counts.

## 4. Layout

Desktop layout uses three working zones:

- Left queue rail for completed torrents.
- Center media stage for embedded preview and unsupported-preview states.
- Right candidate/details rail for video candidates, junk disclosure, paths, and settings.

Mobile layout keeps the media stage first, with queue and candidate lists as tabs or sheets. The main action bar remains thumb-reachable and keyboard focus remains visible.

Avoid nested cards. Use rails, panels, dividers, rows, and a single framed media stage. Cards are only for repeated torrent rows or candidate rows when the row itself is the item.

## 5. Components

### Media Stage

The media stage is a stable black-green preview surface with a thin border, aspect-ratio constraints, and no layout shift when preview changes. Unsupported files show filename, size, and external-open action without pretending the browser can play them.

### Queue Row

Queue rows show torrent name, completion status, candidate count when known, and size. Selected row uses outline, contrast, and position, not color alone.

### Candidate Row

Candidate rows show filename, size, extension, file index, active preview state, and marked state. Sort largest first. Marked count and destination impact must be obvious.

### Junk Disclosure

Junk/non-video files stay collapsed by default. The disclosure shows count and total size. Expanded state is dense and metadata-heavy.

### Action Bar

Primary actions are Keep, Reject, Open External, previous/next torrent, and previous/next video. Use lucide icons where available. Text labels are allowed for Keep and Reject because consequences matter. Other repeated navigation controls can be icon buttons with accessible names and tooltips.

### Reject Confirmation

Reject confirmation should be inline near the action, not a modal by default. It must clearly state that qBittorrent will delete torrent files. Use red only for the destructive confirmation path.

### Settings

Settings surfaces are compact forms for qBittorrent connection, credentials presence, completed queue filters, path mapping, and session folder. Do not expose passwords after save.

## 6. Motion

Motion communicates state only:

- Row selection: 120 to 180 ms background/outline transition.
- Panel or sheet reveal: 180 to 220 ms ease-out.
- Successful Keep: brief row removal and count update.
- Reject confirmation: immediate inline reveal, no theatrical delay.

Honor reduced motion. Do not animate layout properties.

## 7. Do's And Don'ts

### Do

- Do keep preview, selected file, destination, and destructive state visible.
- Do use green and red only for their domain actions.
- Do make keyboard focus obvious with amber.
- Do show precise errors for path mapping, media unavailable, qBittorrent auth failure, move failure, and delete failure.
- Do keep controls compact but reachable.

### Don't

- Don't build a landing page.
- Don't hide destructive delete semantics behind generic "remove" copy.
- Don't create decorative gradients, glass panels, or repeated marketing cards.
- Don't use hover-only controls.
- Don't let long file names resize fixed-format rows or action bars.
