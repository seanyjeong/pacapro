"""Guarded PACA-only release; production business actions are never invoked."""
import datetime
import gzip
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request

os.umask(0o077)
stage = pathlib.Path('/tmp/paca-lifecycle-billing-20261007')
root = pathlib.Path('/root/pacapro')
rows = json.loads((stage / 'manifest.json').read_text())
meta = json.loads((stage / 'release.json').read_text())
service = 'paca-failover.service'
env_path = root / 'backend/.env'
protected_units = ['peak-failover.service', 'paca-mcp.service', 'peak-mcp.service']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def guard():
    assert root.resolve() == root, 'STOP unexpected production root'
    for row in rows:
        path = pathlib.PurePosixPath(row['path'])
        assert path.parts[0] == 'backend' and '..' not in path.parts
        assert sha(root / row['path']) == row['before'], 'STOP source drift: ' + row['path']
    assert json.loads((root / 'backend/package.json').read_text())['version'] == meta['previous_version']
    assert subprocess.check_output(['systemctl', 'show', service, '--property=WorkingDirectory', '--value'], text=True).strip() == str(root / 'backend')


def request(url, method='GET'):
    req = urllib.request.Request(url, method=method)
    if method != 'GET':
        req.add_header('Content-Type', 'application/json')
        req.data = b'{}'
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())


def healthy():
    status, body = request('http://127.0.0.1:8320/health')
    assert status == 200 and body['status'] == 'OK'
    return body


guard()
assert len(rows) == 11, 'STOP unexpected release scope'
assert subprocess.check_output(['systemctl', 'is-active', service], text=True).strip() == 'active'
healthy()
schema = subprocess.check_output(['mysql', '--batch', '--skip-column-names', '-e',
    "SELECT CONCAT(TABLE_NAME,'.',COLUMN_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='paca' "
    "AND TABLE_NAME IN ('max_engine_payment_settlements','student_seasons','student_payments')"], text=True).splitlines()
required = {'max_engine_payment_settlements.recorded_by', 'max_engine_payment_settlements.waived_amount',
            'student_payments.proration_details', 'student_seasons.is_cancelled', 'student_seasons.after_season_action'}
assert required <= set(schema), 'STOP missing financial schema'
assert 'student_seasons.status' not in schema, 'STOP unexpected season schema'
if '--check' in sys.argv:
    print(json.dumps({'status': 'preflight_verified', 'target': str(root / 'backend'),
                      'files': len(rows), 'source_hashes_matched': True, 'schema_ready': True}))
    sys.exit(0)

stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = pathlib.Path('/root/backups/paca-lifecycle-billing-' + stamp)
backup.mkdir(mode=0o700)
(backup / 'manifest.json').write_text(json.dumps(rows, indent=2))
(backup / 'release.json').write_text(json.dumps(meta, indent=2))
env_before = sha(env_path)
assert env_before, 'STOP production environment missing'
shutil.copy2(env_path, backup / 'backend.env')
protected_pids = {unit: subprocess.check_output(['systemctl', 'show', unit, '--property=MainPID', '--value'], text=True).strip() for unit in protected_units}
with tarfile.open(backup / 'code.tgz', 'w:gz') as archive:
    for row in rows:
        if row['before'] is not None:
            archive.add(root / row['path'], arcname=row['path'])
subprocess.run(['tar', '-tzf', str(backup / 'code.tgz')], stdout=subprocess.DEVNULL, check=True)
with open(backup / 'paca.sql.gz', 'wb') as destination, open(backup / 'dump.stderr', 'wb') as errors:
    dump = subprocess.Popen(['mysqldump', '--single-transaction', '--quick', '--triggers', '--no-tablespaces', '--databases', 'paca'], stdout=subprocess.PIPE, stderr=errors)
    with gzip.GzipFile(fileobj=destination, mode='wb') as compressed:
        shutil.copyfileobj(dump.stdout, compressed)
    dump.stdout.close()
    assert dump.wait() == 0, 'STOP database backup failed'
subprocess.run(['gzip', '-t', str(backup / 'paca.sql.gz')], check=True)
(backup / 'checksums.json').write_text(json.dumps({path.name: sha(path) for path in backup.iterdir() if path.is_file()}, indent=2))
candidate = backup / 'candidate'
candidate.mkdir()
with tarfile.open(stage / 'candidate.tgz') as archive:
    assert set(archive.getnames()) == {row['path'] for row in rows}
    assert all(member.isfile() for member in archive.getmembers())
    archive.extractall(candidate)
for row in rows:
    path = candidate / row['path']
    assert sha(path) == row['after'], 'STOP candidate hash mismatch'
    if path.suffix == '.js':
        subprocess.run(['/usr/bin/node', '--check', str(path)], check=True)
assert json.loads((candidate / 'backend/package.json').read_text())['version'] == meta['version']
guard()
assert sha(env_path) == env_before, 'STOP environment drift before replacement'
changed = []
try:
    for row in rows:
        destination = root / row['path']
        destination.parent.mkdir(parents=True, exist_ok=True)
        changed.append(row)
        temporary = destination.with_name(destination.name + '.lifecycle-new')
        shutil.copy2(candidate / row['path'], temporary)
        os.replace(temporary, destination)
    subprocess.run(['systemctl', 'restart', service], check=True)
    for attempt in range(20):
        try:
            internal = healthy()
            break
        except (OSError, AssertionError):
            time.sleep(1)
    else:
        raise RuntimeError('PACA health verification failed')
    assert subprocess.check_output(['systemctl', 'is-active', service], text=True).strip() == 'active'
    for row in rows:
        assert sha(root / row['path']) == row['after'], 'installed source hash mismatch'
    assert sha(env_path) == env_before, 'environment changed'
    for unit, pid in protected_pids.items():
        assert subprocess.check_output(['systemctl', 'show', unit, '--property=MainPID', '--value'], text=True).strip() == pid, 'unrelated service restarted'
    status, public = request('https://supermax.kr/paca-health')
    assert status == 200 and public['status'] == 'OK'
    smoke = {}
    for method, path in [('POST', '/paca/students/0/withdraw'), ('PUT', '/paca/students/0'), ('POST', '/paca/students/0/process-rest')]:
        status, body = request('https://supermax.kr' + path, method)
        assert status == 401, 'unauthenticated route smoke failed'
        smoke[method + ' ' + path] = status
    result = {'status': 'deployed_verified', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'version': meta['version'], 'commit': meta['commit'], 'backup': str(backup),
              'rollback_tag': meta['rollback_tag'], 'candidate_files': len(rows), 'services': [service],
              'env_unchanged': True, 'unrelated_services_unchanged': True, 'schema_migrations': 0,
              'production_business_actions': 0, 'source_hashes_matched': True, 'backup_integrity_verified': True,
              'internal_health': internal, 'public_health': public, 'route_smoke': smoke}
    (backup / 'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
except Exception as error:
    restored = backup / 'restore'
    restored.mkdir()
    with tarfile.open(backup / 'code.tgz') as archive:
        archive.extractall(restored)
    for row in changed:
        destination, original = root / row['path'], restored / row['path']
        if original.exists():
            shutil.copy2(original, destination)
        else:
            destination.unlink(missing_ok=True)
    subprocess.run(['systemctl', 'restart', service], check=True)
    result = {'status': 'deploy_failed_runtime_rolled_back', 'backup': str(backup), 'error_type': type(error).__name__}
    (backup / 'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    raise
