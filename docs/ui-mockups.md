# UI Mockups

Design register: product. The review queue is a local workbench for one person clearing completed torrents with a keyboard. The interface should feel dense, exact, and guarded. It should not feel like a marketing dashboard.

Physical scene: one person sits at a desktop in a dim room, one hand on the keyboard, clearing completed downloads while avoiding accidental file loss.

Brooks-Lint risk: cognitive overload. The mockups keep the same three-zone ownership model so color and layout polish do not distort the domain model or hide destructive actions.

## Selected Direction: Iron Ledger

Iron Ledger is the chosen direction for the current implementation. It keeps the existing workbench structure, but changes the palette from green-black bay to iron-black neutral surfaces with functional action colors.

Color strategy: restrained.

Rendered previews:

- Desktop: `docs/mockups/iron-ledger-desktop.png`
- Mobile: `docs/mockups/iron-ledger-mobile.png`
- Static HTML: `docs/mockups/review-workbench.html`

- Background: `oklch(15.8% 0.01 248)`
- Surface: `oklch(21.2% 0.013 246)`
- Elevated surface: `oklch(26.5% 0.016 246)`
- Text: `oklch(94% 0.011 86)`
- Muted text: `oklch(72% 0.026 82)`
- Keep: `oklch(69% 0.13 154)`
- Focus/capacity: `oklch(75% 0.12 68)`
- Info: `oklch(72% 0.09 218)`
- Reject: `oklch(62% 0.18 31)`

Desktop mockup:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Local qBittorrent  Review Queue       Connected   8 ready   24 folder slots      ↻   ⚙      │
├──────────────────────┬──────────────────────────────────────────────┬────────────────────────┤
│ Completed Queue       │ Selected Video                               │ Video Candidates        │
│ 8                     │ ┌──────────────────────────────────────────┐ │ 4 files                 │
│ ┌──────────────────┐  │ │ file title, extension, preview controls │ │ Folder 16 / 40          │
│ │ selected torrent │  │ ├──────────────────────────────────────────┤ │ ███████░░░              │
│ │ 4 videos 9.4 GB  │  │ │                                          │ │ ┌────────────────────┐ │
│ └──────────────────┘  │ │              preview stage               │ │ │ active video 5.7GB  │ │
│ ┌──────────────────┐  │ │                                          │ │ │ ○ mark control     │ │
│ │ next torrent     │  │ ├──────────────────────────────────────────┤ │ └────────────────────┘ │
│ └──────────────────┘  │ │ hash + full mapped file path             │ │ ┌────────────────────┐ │
│ Needs attention 2     │ └──────────────────────────────────────────┘ │ │ marked video 2.8GB  │ │
│ auth/path/capacity    │ Prev  Prev video  Next video  Next           │ │ ● marked            │ │
│                       │ Notice + marked count   Open  Keep  Reject   │ Junk files collapsed    │
└──────────────────────┴──────────────────────────────────────────────┴────────────────────────┘
```

Mobile mockup:

```text
┌──────────────────────────────┐
│ Review Queue        ↻   ⚙    │
│ Connected  8 ready  24 slots │
├──────────────────────────────┤
│ Selected file title          │
│ ┌──────────────────────────┐ │
│ │      preview stage       │ │
│ └──────────────────────────┘ │
│ hash + truncated file path   │
├──────────────────────────────┤
│ Prev  Video -  Video +  Next │
│ Open        Keep     Reject  │
│ 1 marked, confirm state here │
├──────────────────────────────┤
│ Queue                        │
│ selected torrent row         │
│ next torrent row             │
├──────────────────────────────┤
│ Candidates                   │
│ active row                   │
│ marked row                   │
│ Junk files collapsed         │
└──────────────────────────────┘
```

Interaction notes:

- Keep and Reject keep visible text labels because they alter files.
- Reject confirmation stays inline in the action bar, not a modal.
- Candidate marked state uses border, background, and icon, not green alone.
- Active row uses copper outline and shape contrast.
- File paths stay visible in the stage footer, truncated only after hash and leading context remain visible.

## Alternate Mockup A: Paper Ledger

Paper Ledger is a light workstation direction for daytime file cleanup. It is intentionally not selected because the product scene is dim-room review and video preview benefits from a dark stage.

```text
Light warm-gray background, white-tinted panels, black-olive text.
Keep green and reject red stay semantic.
Copper focus remains, but panel edges become more visible.
Best if review happens in bright ambient light or if the app grows into settings-heavy admin work.
```

## Alternate Mockup B: Terminal Bay

Terminal Bay pushes the original green-black concept harder. It is intentionally not selected because it risks category-reflex "dark hacker tool" styling and makes Keep green feel decorative.

```text
Deep green-black background, green status vocabulary, amber focus.
Preview stage feels strong, but every rail starts to inherit Keep semantics.
Best only if the app becomes a pure keyboard command surface with less visual metadata.
```

## Implementation Notes

Current app CSS uses Iron Ledger tokens in `frontend/src/styles.css`. Canonical design values live in `DESIGN.md` and machine-readable summary values live in `docs/design.json`.

The standalone HTML mockup is at `docs/mockups/review-workbench.html`.
