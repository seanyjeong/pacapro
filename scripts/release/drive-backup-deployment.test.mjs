import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const SCRIPT_PATH = 'deploy/backup/et-db-drive-backup';
const SERVICE_PATH = 'deploy/backup/et-db-drive-backup.service';
const TIMER_PATH = 'deploy/backup/et-db-drive-backup.timer';
const RUNBOOK_PATH = 'DEPLOYMENT.md';

function writeExecutable(path, body) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function createHarness() {
  const root = mkdtempSync(join(tmpdir(), 'et-drive-backup-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);

  writeExecutable(
    join(bin, 'mysqldump'),
    '#!/usr/bin/env bash\nprintf "dump for %s\\n" "${@: -1}"\n',
  );
  writeExecutable(
    join(bin, 'rclone'),
    '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$RCLONE_LOG"\n',
  );
  writeExecutable(
    join(bin, 'sha256sum'),
    '#!/usr/bin/env bash\nprintf "%064d  %s\\n" 0 "$1"\n',
  );
  writeExecutable(join(bin, 'flock'), '#!/usr/bin/env bash\nexit 0\n');

  return {
    env: {
      ...process.env,
      BACKUP_ROOT: join(root, 'backups'),
      BACKUP_LOCK_FILE: join(root, 'backup.lock'),
      MYSQLDUMP_BIN: join(bin, 'mysqldump'),
      RCLONE_BIN: join(bin, 'rclone'),
      SHA256SUM_BIN: join(bin, 'sha256sum'),
      FLOCK_BIN: join(bin, 'flock'),
      RCLONE_LOG: join(root, 'rclone.log'),
      BACKUP_RUN_ID: '20260719_190000',
    },
    root,
  };
}

test('backup deployment has atomic dump, checksum, retention, and Seoul timer contracts', () => {
  const script = readFileSync(SCRIPT_PATH, 'utf8');
  const service = readFileSync(SERVICE_PATH, 'utf8');
  const timer = readFileSync(TIMER_PATH, 'utf8');

  assert.match(script, /set -Eeuo pipefail/);
  assert.match(script, /BACKUP_TIMEZONE=.*Asia\/Seoul/);
  assert.match(script, /--single-transaction/);
  assert.match(script, /\.partial/);
  assert.match(script, /GZIP_BIN.*-t/);
  assert.match(script, /sha256sum/);
  assert.match(script, /copyto/);
  assert.match(script, /--min-age/);
  assert.match(service, /ExecStart=\/usr\/local\/sbin\/et-db-drive-backup/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /ReadWritePaths=.*\/root\/\.config\/rclone/);
  assert.match(service, /TimeoutStartSec=1h/);
  assert.match(timer, /OnCalendar=.*03:00:00 Asia\/Seoul/);
  assert.match(timer, /Persistent=true/);
});

test('deployment runbook identifies Vultr as backup authority with an isolated restore check', () => {
  const runbook = readFileSync(RUNBOOK_PATH, 'utf8');

  assert.match(runbook, /## Production Database Backups/);
  assert.match(runbook, /backups run on Vultr/);
  assert.match(runbook, /legacy n100 dump job must stay disabled/);
  assert.match(runbook, /uniquely named isolated database/);
  assert.match(runbook, /Rollback:/);
});

test('backup script creates and uploads validated PACA and Peak artifacts', () => {
  const harness = createHarness();
  const result = spawnSync('bash', [SCRIPT_PATH], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: harness.env,
  });

  assert.equal(result.status, 0, result.stderr);
  for (const database of ['paca', 'peak']) {
    const name = `${database}_20260719_190000.sql.gz`;
    assert.equal(
      spawnSync('gzip', ['-t', join(harness.root, 'backups', database, name)])
        .status,
      0,
    );
    assert.match(
      readFileSync(join(harness.root, 'backups', database, `${name}.sha256`), 'utf8'),
      new RegExp(`${name}$`, 'm'),
    );
  }

  const rcloneLog = readFileSync(harness.env.RCLONE_LOG, 'utf8');
  assert.match(rcloneLog, /copyto .*paca_20260719_190000\.sql\.gz/);
  assert.match(rcloneLog, /copyto .*peak_20260719_190000\.sql\.gz/);
  assert.match(rcloneLog, /delete gdrive:server-backups\/paca.*--min-age 30d/);
  assert.match(rcloneLog, /delete gdrive:server-backups\/peak.*--min-age 30d/);
});

test('backup script does not upload a database when its dump fails', () => {
  const harness = createHarness();
  writeExecutable(
    harness.env.MYSQLDUMP_BIN,
    '#!/usr/bin/env bash\n[[ "${@: -1}" == "peak" ]] && exit 9\nprintf "ok\\n"\n',
  );

  const result = spawnSync('bash', [SCRIPT_PATH], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: harness.env,
  });

  assert.notEqual(result.status, 0);
  const rcloneLog = readFileSync(harness.env.RCLONE_LOG, 'utf8');
  assert.doesNotMatch(rcloneLog, /copyto .*peak_/);
});
