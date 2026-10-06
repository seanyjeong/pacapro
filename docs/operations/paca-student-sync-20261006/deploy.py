"""One approved backend-only release. Run on vultr; never configure sync secrets."""
import datetime
import gzip
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import tarfile
import time
import urllib.error
import urllib.request

os.umask(0o077)
stage = pathlib.Path('/tmp/paca-student-sync-20261006')
root = pathlib.Path('/root/pacapro')
rows = json.loads((stage / 'manifest.json').read_text())
expected = {
    'backend/config/maxEngineSync.js', 'backend/models/maxEngineSyncPage.js',
    'backend/repositories/maxEngineSyncRepository.js', 'backend/services/maxEngineSyncService.js',
    'backend/routes/integrations/sync.js', 'backend/routes/integrations/index.js',
}
assert {r['path'] for r in rows} == expected and len(rows) == 6
assert subprocess.check_output(['systemctl', 'show', 'paca-failover.service',
                                '--property=WorkingDirectory', '--value'], text=True).strip() == str(root / 'backend')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def guard():
    for row in rows:
        assert sha(root / row['path']) == row['before'], 'STOP source drift: ' + row['path']


def sql(statement):
    return subprocess.check_output(['mysql', '-N', '-B', '-e', statement], text=True).rstrip('\r\n')


def http(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


guard()
column_names = sql("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='paca' AND TABLE_NAME='students' ORDER BY ORDINAL_POSITION").splitlines()
assert all(re.fullmatch(r'[a-zA-Z0-9_]+', name) for name in column_names)
projection = ','.join("'" + name + "',`" + name + "`" for name in column_names)


def students_digest():
    content = sql('SELECT SHA2(CAST(JSON_OBJECT(' + projection + ') AS CHAR),256) FROM paca.students ORDER BY id')
    return {'rows': int(sql('SELECT COUNT(*) FROM paca.students')),
            'sha256': hashlib.sha256(content.encode()).hexdigest()}


env_path = root / 'backend/.env'
env_before = sha(env_path)
before = students_digest()
assert subprocess.check_output(['/usr/bin/node', '--version'], text=True).strip() == 'v18.19.1'
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = pathlib.Path('/root/backups/paca-student-sync-' + stamp)
backup.mkdir(mode=0o700)
(backup / 'manifest.json').write_text(json.dumps(rows, indent=2))
(backup / 'students-before.json').write_text(json.dumps(before))
subprocess.run(['tar', '-czf', str(backup / 'backend.tgz'), '-C', str(root), 'backend'], check=True)
with open(backup / 'students.sql.gz', 'wb') as destination:
    dump = subprocess.Popen(['mysqldump', '--single-transaction', '--quick', '--triggers',
                             '--no-tablespaces', 'paca', 'students'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    with gzip.GzipFile(fileobj=destination, mode='wb') as compressed:
        shutil.copyfileobj(dump.stdout, compressed)
    dump.communicate()
    assert dump.returncode == 0, 'STOP dump failed'
subprocess.run(['gzip', '-t', str(backup / 'students.sql.gz')], check=True)
subprocess.run(['tar', '-tzf', str(backup / 'backend.tgz')], stdout=subprocess.DEVNULL, check=True)
(backup / 'checksums.json').write_text(json.dumps({p.name: sha(p) for p in backup.iterdir() if p.is_file()}, indent=2))
candidate = backup / 'candidate'
candidate.mkdir(mode=0o700)
with tarfile.open(stage / 'candidate.tgz') as archive:
    assert set(archive.getnames()) == expected and all(member.isfile() for member in archive.getmembers())
    archive.extractall(candidate)
for row in rows:
    path = candidate / row['path']
    assert sha(path) == row['after'], 'STOP candidate mismatch'
    subprocess.run(['/usr/bin/node', '--check', str(path)], check=True)
guard()
assert sha(env_path) == env_before, 'STOP operator changed env during preparation'
assert students_digest() == before, 'STOP concurrent student update: refresh verification before deployment'
changed = []
try:
    for row in rows:
        target = root / row['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        changed.append(row)
        shutil.copy2(candidate / row['path'], target)
    subprocess.run(['systemctl', 'restart', 'paca-failover.service'], check=True)
    for attempt in range(20):
        try:
            assert http('http://127.0.0.1:8320/health')[0] == 200
            break
        except Exception:
            time.sleep(1)
    else:
        raise RuntimeError('health failed')
    assert subprocess.check_output(['systemctl', 'is-active', 'paca-failover.service'], text=True).strip() == 'active'
    private_status, private_body = http('http://127.0.0.1:8320/paca/integrations/max-engine/sync/students?academy_id=1')
    public_status, public_body = http('https://supermax.kr/paca/integrations/max-engine/sync/students?academy_id=1')
    assert private_status == public_status == 503, 'disabled sync status differs; inspect operator configuration'
    assert json.loads(private_body)['error']['code'] == json.loads(public_body)['error']['code'] == 'SYNC_DISABLED'
    assert http('https://supermax.kr/paca-health')[0] == 200
    for row in rows:
        assert sha(root / row['path']) == row['after']
    assert sha(env_path) == env_before, 'environment file changed'
    after = students_digest()
    assert after == before, 'student snapshot differs; inspect concurrent writes'
    result = {'status': 'deployed_verified', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'backup': str(backup), 'candidate_files': len(rows), 'source_guard_passed': True,
              'backup_integrity_verified': True, 'migration_applied': False, 'before': before, 'after': after,
              'student_values_preserved': True, 'env_unchanged': True, 'env_written': False,
              'sync_key_created': False, 'internal_no_key_http': private_status, 'public_no_key_http': public_status,
              'public_health_http': 200, 'frontend_version': '4.0.57',
              'candidate_commit': (stage / 'commit.txt').read_text().strip()}
    (backup / 'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
except Exception:
    extraction = backup / 'rollback'
    extraction.mkdir(exist_ok=True)
    subprocess.run(['tar', '-xzf', str(backup / 'backend.tgz'), '-C', str(extraction)], check=True)
    for row in changed:
        original, target = extraction / row['path'], root / row['path']
        if original.exists():
            shutil.copy2(original, target)
        else:
            target.unlink(missing_ok=True)
    subprocess.run(['systemctl', 'restart', 'paca-failover.service'], check=True)
    (backup / 'result.json').write_text(json.dumps({'status': 'deploy_failed_runtime_rolled_back', 'backup': str(backup)}))
    raise
