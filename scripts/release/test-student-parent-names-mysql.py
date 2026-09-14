#!/usr/bin/env python3
"""Run real MySQL contracts in a private socket-only disposable instance."""

import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "backend"
BIN = Path(os.environ.get("PACA_TEST_MYSQL_BIN", "/opt/homebrew/opt/mysql@8.4/bin"))


def main() -> int:
    if not (BIN / "mysqld").is_file():
        raise SystemExit("Native MySQL test binary is required; no container fallback is used.")
    root = Path(tempfile.mkdtemp(prefix="paca-parent-mysql-", dir="/tmp"))
    process = None
    try:
        data = root / "data"
        log_path = root / "mysql.log"
        initialized = subprocess.run(
            [str(BIN / "mysqld"), "--no-defaults", "--initialize-insecure", f"--datadir={data}"],
            capture_output=True,
            text=True,
        )
        if initialized.returncode:
            raise RuntimeError("Private test database initialization failed.")
        socket = root / "mysql.sock"
        with log_path.open("w") as log:
            process = subprocess.Popen(
                [
                    str(BIN / "mysqld"),
                    "--no-defaults",
                    f"--datadir={data}",
                    f"--socket={socket}",
                    f"--pid-file={root / 'mysql.pid'}",
                    "--skip-networking",
                    "--mysqlx=OFF",
                ],
                stdout=log,
                stderr=log,
            )
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError("Private MySQL process exited before readiness.")
                if socket.exists():
                    ready = subprocess.run(
                        [
                            str(BIN / "mysqladmin"),
                            "--no-defaults",
                            "-uroot",
                            f"--socket={socket}",
                            "ping",
                        ],
                        capture_output=True,
                    )
                    if ready.returncode == 0:
                        break
                time.sleep(0.1)
            else:
                raise RuntimeError("Private MySQL readiness timed out.")
            subprocess.run(
                [
                    str(BIN / "mysql"),
                    "--no-defaults",
                    "-uroot",
                    f"--socket={socket}",
                    "-e",
                    "CREATE DATABASE paca_parent_names_fixture CHARACTER SET utf8mb4",
                ],
                check=True,
            )
            command = ["./node_modules/.bin/jest", "--runInBand", "--coverage=false",
                       "__tests__/integration/student-parent-names-mysql.test.js"]
            result = subprocess.run(
                command,
                cwd=ROOT,
                env={**os.environ, "PACA_PARENT_NAMES_MYSQL_SOCKET": str(socket)},
                check=False,
            )
            print(
                json.dumps(
                    {
                        "native_mysql": True,
                        "network_listener": False,
                        "production_data_used": False,
                        "exit_code": result.returncode,
                    }
                )
            )
            return result.returncode
    finally:
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        # This exact mkdtemp tree contains only this process's fixture database.
        shutil.rmtree(root)


if __name__ == "__main__":
    raise SystemExit(main())
