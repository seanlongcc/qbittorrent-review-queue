# Style And Conventions
- User-facing replies should use the caveman skill unless the user asks for normal mode.
- Prefer existing module ownership: backend API routes thin; qBittorrent client in `backend/app/qbt`; path conversion in `backend/app/paths`; queue/candidate logic in `backend/app/torrents`; media in `backend/app/media`; Keep/Delete orchestration in `backend/app/review`; frontend API DTOs in `frontend/src/api`; review state/UI in `frontend/src/review` or current app code.
- Use structured path APIs (`pathlib`, `PureWindowsPath`, `Path`) for filesystem/path work.
- Use TypeScript types for frontend state and API boundaries.
- Keep React components focused; move reusable validation, sorting, keyboard mapping, state transitions, and API payload building into helpers when complexity grows.
- Avoid adding feature/business logic to files over 800 lines unless extracting first; avoid adding more than 50 lines to a file already over 500 lines without considering a helper.
- UI should remain dense, keyboard-first, accessible, and restrained. Use existing dark iron design tokens and lucide icons.