# Destructive Review Workflow

Keep and Reject intentionally use different destructive contracts. Keep requires confirmation, then moves marked video candidates into the flat session folder and returns the expected folder count. It does not block or fail solely because `/mnt/c` visibility lags after a successful move, and it does not call qBittorrent delete. Reject/Delete deletes the whole torrent with files after explicit confirmation.

This favors explicit destructive control over one-click queue cleanup. After Keep, the torrent remains selected in the Review Queue so the user can inspect what remains and press Delete separately. The trade-off is one extra action, but unmarked video candidates and junk are never removed as a hidden Keep side effect.
