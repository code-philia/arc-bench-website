"""Run inside a published runner image before promoting it to evaluation traffic."""

from __future__ import annotations

import shutil
import subprocess
import sys


def main() -> int:
    required = ("node", "npm", "python3", "git")
    missing = [command for command in required if shutil.which(command) is None]
    if missing:
        raise RuntimeError(f"Missing required runner commands: {', '.join(missing)}")

    browser_check = subprocess.run(
        [
            "python3",
            "-c",
            "from playwright.sync_api import sync_playwright; "
            "p=sync_playwright().start(); b=p.chromium.launch(); b.close(); p.stop()",
        ],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if browser_check.returncode != 0:
        raise RuntimeError(f"Chromium launch smoke test failed:\n{browser_check.stdout}")
    print("Runner smoke test passed: Python, Node.js, Git, Playwright, and Chromium are available.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
