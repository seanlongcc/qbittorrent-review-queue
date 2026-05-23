# Vite React With FastAPI Local Run

The UI is a Vite React app backed by FastAPI, superseding the earlier vanilla-browser-UI wording. During development, Vite may run separately and proxy API/media requests to FastAPI; during normal local use, FastAPI serves the built Vite assets and API from one server.

This keeps implementation ergonomic for frontend work without forcing users to run two servers for a local desktop review tool. A permanent two-server architecture would add operational friction without adding product value.
