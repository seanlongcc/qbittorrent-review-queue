# Destructive Review Workflow

Keep and Reject intentionally use different destructive contracts. Keep first moves marked video candidates into the flat session folder, verifies those kept videos exist, then deletes torrent leftovers through qBittorrent with `deleteFiles=true`; Reject deletes the whole torrent with files after explicit confirmation.

This favors fast queue processing while keeping irreversible loss visible. The trade-off is that unmarked video candidates are deleted during Keep cleanup, so Keep has a conditional armed confirmation when multiple candidates exist and some are unmarked. If qBittorrent cleanup fails after files were kept, kept videos remain kept and the torrent becomes cleanup-failed attention work requiring explicit retry or manual qBittorrent resolution.
