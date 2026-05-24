from __future__ import annotations

import base64
import os
import subprocess
from pathlib import Path


class FolderPickerUnavailable(RuntimeError):
    pass


class FolderSelectionCancelled(RuntimeError):
    pass


WINDOWS_POWERSHELL = Path("/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe")


def pick_windows_folder(*, title: str, initial_path: str | None = None, timeout: int = 300) -> str:
    if not WINDOWS_POWERSHELL.exists():
        raise FolderPickerUnavailable("Windows PowerShell folder picker is unavailable from this runtime")

    script = """
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = if ($env:QBRQ_PICK_FOLDER_TITLE) { $env:QBRQ_PICK_FOLDER_TITLE } else { 'Select folder' }
$dialog.ShowNewFolderButton = $true
if ($env:QBRQ_PICK_FOLDER_INITIAL -and [System.IO.Directory]::Exists($env:QBRQ_PICK_FOLDER_INITIAL)) {
    $dialog.SelectedPath = $env:QBRQ_PICK_FOLDER_INITIAL
}
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.SelectedPath
    exit 0
}
exit 2
""".strip()
    encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
    env = {
        **os.environ,
        "QBRQ_PICK_FOLDER_TITLE": title,
        "QBRQ_PICK_FOLDER_INITIAL": initial_path or "",
    }
    try:
        result = subprocess.run(
            [
                str(WINDOWS_POWERSHELL),
                "-NoProfile",
                "-STA",
                "-ExecutionPolicy",
                "Bypass",
                "-EncodedCommand",
                encoded,
            ],
            capture_output=True,
            env=env,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise FolderPickerUnavailable("Windows folder picker timed out") from exc

    if result.returncode == 2:
        raise FolderSelectionCancelled("Folder selection cancelled")
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "Windows folder picker failed").strip()
        raise FolderPickerUnavailable(detail)
    selected = result.stdout.strip()
    if not selected:
        raise FolderPickerUnavailable("Windows folder picker returned an empty path")
    return selected
