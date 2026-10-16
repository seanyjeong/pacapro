#!/usr/bin/env python3
"""Run admission HTTP/SQL integration tests on a fresh temporary, loopback-only MySQL."""
import os
import pathlib
import shutil
import socket
import subprocess
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
MYSQLD = os.environ.get('TEST_MYSQLD') or shutil.which('mysqld') or '/opt/homebrew/opt/mysql@8.4/bin/mysqld'
with tempfile.TemporaryDirectory(prefix='paca-ilsan-test-') as temporary:
    directory = pathlib.Path(temporary)
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    common = [MYSQLD, '--no-defaults', f'--datadir={directory}/data']
    with (directory / 'mysql.log').open('w+') as output:
        subprocess.run(common + ['--initialize-insecure'], stdout=output, stderr=output, check=True)
        server = subprocess.Popen(common + [f'--port={port}', '--bind-address=127.0.0.1',
            f'--socket={directory}/mysql.sock', f'--pid-file={directory}/mysql.pid', '--mysqlx=OFF'], stdout=output, stderr=output)
        try:
            for attempt in range(100):
                if server.poll() is not None:
                    raise RuntimeError('Disposable MySQL exited before ready')
                try:
                    with socket.create_connection(('127.0.0.1', port), timeout=0.2):
                        break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError('Disposable MySQL startup timeout')
            env = dict(os.environ, RUN_ILSAN_MYSQL='1', TEST_ILSAN_MYSQL_PORT=str(port))
            result = subprocess.run(['node', 'node_modules/jest/bin/jest.js', '--runInBand',
                '__tests__/integration/ilsan-admission.native.test.js'], cwd=ROOT / 'backend', env=env)
        finally:
            server.terminate()
            try:
                server.wait(timeout=15)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
    raise SystemExit(result.returncode)
