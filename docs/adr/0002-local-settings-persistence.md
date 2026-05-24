# Local Settings Persistence

The app treats `.env` as bootstrap defaults and writes UI-changed settings to `config.local.json` instead of rewriting `.env`. This preserves human-edited environment files, avoids mangling comments or deployment-style defaults, and gives the app one structured local file to validate and update.

qBittorrent credentials changed in the UI may be stored in `config.local.json`, but settings responses never return password values. The UI receives password presence only, so credentials remain local and write-only through the app surface.
