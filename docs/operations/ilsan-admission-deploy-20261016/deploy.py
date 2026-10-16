"""PACA backend release: default read-only checks; --apply replaces only manifest files.

Frontend 4.0.59 is a separate Vercel release. This script never restores the DB,
calls an authenticated student action, or restarts PEAK/MCP services.
"""
import argparse
import datetime
import gzip
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request

STAGE = pathlib.Path('/tmp/paca-ilsan-release-20261016')
ROOT = pathlib.Path('/root/pacapro')
NODE = '/usr/bin/node'
SERVICE = 'paca-failover.service'
PROTECTED_UNITS = ('peak-failover.service', 'paca-mcp.service', 'peak-mcp.service')
ENV_PATH = ROOT / 'backend/.env'
APPLY_FLAGS = ('native_mysql_verified', 'git_release_verified', 'production_source_refreshed')
HEX40 = re.compile(r'^[0-9a-f]{40}$')
HEX64 = re.compile(r'^[0-9a-f]{64}$')


def require(condition, message):
    if not condition:
        raise RuntimeError('STOP ' + message)


def sha(path):
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


def systemd_value(unit, property_name):
    return subprocess.check_output(
        ['systemctl', 'show', unit, '--property=' + property_name, '--value'], text=True).strip()


def validate_manifest(rows, meta):
    require(isinstance(rows, list) and rows, 'empty or invalid manifest')
    require(type(meta.get('runtime_files')) is int and len(rows) == meta['runtime_files'],
            'manifest count does not match runtime_files')
    require(meta.get('version') == '4.0.24' and meta.get('previous_version') == '4.0.23',
            'unexpected backend release versions')
    require(meta.get('frontend_version') == '4.0.59', 'unexpected frontend target version')
    names = []
    for row in rows:
        require(isinstance(row, dict) and {'path', 'before', 'after'} <= row.keys()
                and isinstance(row.get('path'), str), 'invalid manifest row')
        name = row['path']
        path = pathlib.PurePosixPath(name)
        require(len(path.parts) >= 2 and path.parts[0] == 'backend' and str(path) == name
                and '..' not in path.parts, 'unsafe manifest path')
        require(not any(part in ('.env', 'node_modules', '__tests__', 'migrations', 'uploads')
                        for part in path.parts), 'non-runtime or protected manifest path')
        require(path.suffix == '.js' or name in ('backend/package.json', 'backend/package-lock.json'),
                'unexpected runtime file type')
        require(row.get('before') is None or isinstance(row['before'], str) and HEX64.fullmatch(row['before']),
                'invalid before hash: ' + name)
        require(isinstance(row.get('after'), str) and HEX64.fullmatch(row['after']),
                'invalid after hash: ' + name)
        names.append(name)
    require(len(set(names)) == len(names), 'duplicate manifest path')
    require({'backend/package.json', 'backend/package-lock.json'} <= set(names), 'version files missing')


def load_release():
    paths = {name: STAGE / name for name in ('manifest.json', 'release.json', 'candidate.tgz', 'migration.sql')}
    require(all(path.is_file() and not path.is_symlink() for path in paths.values()),
            'release stage files missing or symlinked')
    snapshot = {name: sha(path) for name, path in paths.items()}
    rows = json.loads(paths['manifest.json'].read_text())
    meta = json.loads(paths['release.json'].read_text())
    require(isinstance(meta, dict), 'invalid release metadata')
    validate_manifest(rows, meta)
    if meta.get('candidate_sha256') is not None:
        require(meta['candidate_sha256'] == snapshot['candidate.tgz'], 'candidate archive hash mismatch')
    return rows, meta, snapshot


def stage_guard(snapshot):
    for name, expected in snapshot.items():
        require(sha(STAGE / name) == expected, 'release stage drift: ' + name)


def path_guard(destination):
    require(not destination.is_symlink() and all(not parent.is_symlink()
            for parent in destination.parents if parent != ROOT and ROOT in parent.parents),
            'symlinked production path: ' + str(destination.relative_to(ROOT)))


def source_guard(rows, previous_version, env_hash=None):
    require(ROOT.is_dir() and ROOT.resolve() == ROOT, 'unexpected production root')
    require((ROOT / 'backend').resolve() == ROOT / 'backend', 'backend directory is symlinked')
    for row in rows:
        destination = ROOT / row['path']
        path_guard(destination)
        if row['before'] is None:
            require(not destination.exists(), 'new production path already exists: ' + row['path'])
        else:
            require(sha(destination) == row['before'], 'source drift: ' + row['path'])
    require(json.loads((ROOT / 'backend/package.json').read_text())['version'] == previous_version,
            'production backend version drift')
    require(systemd_value(SERVICE, 'WorkingDirectory') == str(ROOT / 'backend'),
            'unexpected service WorkingDirectory')
    require(ENV_PATH.is_file() and not ENV_PATH.is_symlink(), 'production environment missing or symlinked')
    if env_hash is not None:
        require(sha(ENV_PATH) == env_hash, 'environment drift before replacement')


def archive_contents(path, expected, syntax=False):
    with tarfile.open(path, 'r:gz') as archive:
        members = archive.getmembers()
        names = [member.name for member in members]
        require(len(names) == len(set(names)) and set(names) == set(expected), 'archive scope mismatch')
        require(all(member.isfile() for member in members), 'archive contains non-regular files')
        contents = {}
        for member in members:
            with archive.extractfile(member) as source:
                data = source.read()
            require(hashlib.sha256(data).hexdigest() == expected[member.name],
                    'archive content hash mismatch: ' + member.name)
            if syntax and member.name.endswith('.js'):
                subprocess.run([NODE, '--check'], input=data, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, check=True)
            contents[member.name] = (data, member.mode & 0o777)
        return contents


def candidate_guard(rows, meta):
    version = subprocess.check_output([NODE, '--version'], text=True).strip()
    require(version.startswith('v18.'), 'Node 18 is required for production syntax checks')
    contents = archive_contents(STAGE / 'candidate.tgz', {row['path']: row['after'] for row in rows}, True)
    package = json.loads(contents['backend/package.json'][0])
    lock = json.loads(contents['backend/package-lock.json'][0])
    require(package['version'] == meta['version'] and lock['version'] == meta['version']
            and lock['packages']['']['version'] == meta['version'], 'candidate version files differ')
    return contents, version


def schema_guard():
    result = subprocess.check_output(['mysql', '--batch', '--skip-column-names', '-e',
        "SELECT name FROM paca.academies WHERE id=2; SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='paca' AND TABLE_NAME='ilsan_admission_applications'; SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='paca' AND TABLE_NAME='students' AND COLUMN_NAME IN ('father_phone','mother_phone','father_name','mother_name');"], text=True).splitlines()
    require(result == ['일산 맥스체대입시', '0', '4'], 'academy, new-table absence or parent schema mismatch')
    probe = "require('dotenv').config(); const {encrypt}=require('./utils/encryption'); if (!encrypt('admission-readiness').startsWith('ENC:')) process.exit(1);"
    subprocess.run([NODE, '-e', probe], cwd=ROOT / 'backend', check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


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


def health(url):
    status, body = request(url)
    require(status == 200 and body.get('status') == 'OK', 'health failed: ' + url)
    return body


def running():
    require(subprocess.check_output(['systemctl', 'is-active', SERVICE], text=True).strip() == 'active',
            'PACA service is not active')


def wait_healthy():
    for attempt in range(20):
        try:
            running()
            return health('http://127.0.0.1:8320/health')
        except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError):
            if attempt < 19:
                time.sleep(1)
    raise RuntimeError('PACA internal health verification failed')


def preflight(rows, meta, snapshot):
    source_guard(rows, meta['previous_version'])
    env_hash = sha(ENV_PATH)
    running()
    internal = health('http://127.0.0.1:8320/health')
    schema_guard()
    contents, node = candidate_guard(rows, meta)
    stage_guard(snapshot)
    return contents, env_hash, {'status': 'preflight_verified', 'readonly': True,
        'version': meta['version'], 'frontend_target_version': meta['frontend_version'],
        'runtime_files': len(rows), 'node': node, 'source_hashes_matched': True, 'schema_ready': True,
        'candidate_archive_sha256': snapshot['candidate.tgz'], 'internal_health': internal,
        'apply_gates': {**{key: meta.get(key) is True for key in APPLY_FLAGS},
            'commit_format_valid': isinstance(meta.get('commit'), str) and bool(HEX40.fullmatch(meta['commit'])),
            'rollback_tag_present': isinstance(meta.get('rollback_tag'), str) and meta['rollback_tag'].startswith('rollback/')}}


def backup_release(rows, meta, env_hash, snapshot):
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = pathlib.Path('/root/backups/paca-ilsan-admission-' + stamp)
    backup.mkdir(mode=0o700)
    write_json(backup / 'manifest.json', rows)
    write_json(backup / 'release.json', meta)
    write_json(backup / 'stage-checksums.json', snapshot)
    shutil.copy2(ENV_PATH, backup / 'backend.env')
    os.chmod(backup / 'backend.env', 0o600)
    require(sha(backup / 'backend.env') == env_hash, 'environment backup hash mismatch')
    with tarfile.open(backup / 'code.tgz', 'w:gz') as archive:
        for row in rows:
            if row['before'] is not None:
                archive.add(ROOT / row['path'], arcname=row['path'], recursive=False)
    archive_contents(backup / 'code.tgz', {row['path']: row['before'] for row in rows if row['before'] is not None})
    with (backup / 'paca.sql.gz').open('wb') as destination, (backup / 'dump.stderr').open('wb') as errors:
        dump = subprocess.Popen(['mysqldump', '--single-transaction', '--quick', '--triggers',
            '--no-tablespaces', '--databases', 'paca'], stdout=subprocess.PIPE, stderr=errors)
        try:
            with gzip.GzipFile(fileobj=destination, mode='wb') as compressed:
                shutil.copyfileobj(dump.stdout, compressed)
        except BaseException:
            dump.kill()
            dump.wait()
            raise
        finally:
            dump.stdout.close()
        require(dump.wait() == 0, 'database backup failed')
    subprocess.run(['gzip', '-t', str(backup / 'paca.sql.gz')], check=True)
    checksums = {path.name: sha(path) for path in backup.iterdir() if path.is_file()}
    write_json(backup / 'checksums.json', checksums)
    return backup, checksums


def atomic_write(destination, data, mode, suffix):
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(prefix=destination.name + suffix + '.', dir=destination.parent)
    temporary = pathlib.Path(name)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
        os.chmod(temporary, mode)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def rollback(backup, checksums, changed, rows, meta, env_hash):
    require(sha(backup / 'code.tgz') == checksums['code.tgz'], 'code backup changed before rollback')
    originals = archive_contents(backup / 'code.tgz',
        {row['path']: row['before'] for row in rows if row['before'] is not None})
    for row in changed:
        destination = ROOT / row['path']
        path_guard(destination)
        require(sha(destination) in (row['before'], row['after']),
                'external source drift prevents automatic rollback: ' + row['path'])
        if row['before'] is None:
            destination.unlink(missing_ok=True)
        else:
            data, mode = originals[row['path']]
            atomic_write(destination, data, mode, '.lifecycle-billing-rollback')
    source_guard(rows, meta['previous_version'], env_hash)
    subprocess.run(['systemctl', 'restart', SERVICE], check=True)
    internal = wait_healthy()
    public = health('https://supermax.kr/paca-health')
    return {'source_hashes_restored': True, 'env_unchanged': True,
            'internal_health': internal, 'public_health': public}


def apply_release(rows, meta, snapshot, contents, env_hash):
    require(all(meta.get(key) is True for key in APPLY_FLAGS), 'native MySQL, Git or refreshed production source gate pending')
    require(isinstance(meta.get('commit'), str) and HEX40.fullmatch(meta['commit']), 'verified 40-hex commit missing')
    require(isinstance(meta.get('rollback_tag'), str) and meta['rollback_tag'].startswith('rollback/'),
            'verified rollback tag missing')
    stage_guard(snapshot)
    source_guard(rows, meta['previous_version'], env_hash)
    protected_pids = {unit: systemd_value(unit, 'MainPID') for unit in PROTECTED_UNITS}
    backup, checksums = backup_release(rows, meta, env_hash, snapshot)
    stage_guard(snapshot)
    source_guard(rows, meta['previous_version'], env_hash)
    changed = []
    base = {'version': meta['version'], 'frontend_target_version': meta['frontend_version'],
        'frontend_deployed': False, 'commit': meta['commit'], 'rollback_tag': meta['rollback_tag'],
        'backup': str(backup), 'runtime_files': len(rows), 'services': [SERVICE],
        'schema_migrations': 1, 'new_table_preserved_on_rollback': True, 'authenticated_student_actions': 0, 'database_restore_executed': False}
    try:
        schema_guard()
        subprocess.run(['mysql', 'paca'], input=(STAGE / 'migration.sql').read_bytes(), check=True)
        for row in rows:
            changed.append(row)
            data, mode = contents[row['path']]
            path_guard(ROOT / row['path'])
            atomic_write(ROOT / row['path'], data, mode, '.lifecycle-billing-new')
        subprocess.run(['systemctl', 'restart', SERVICE], check=True)
        internal = wait_healthy()
        require(all(sha(ROOT / row['path']) == row['after'] for row in rows), 'installed source hash mismatch')
        require(sha(ENV_PATH) == env_hash, 'environment changed during release')
        require(all(systemd_value(unit, 'MainPID') == pid for unit, pid in protected_pids.items()),
                'unrelated service PID changed')
        public = health('https://supermax.kr/paca-health')
        smoke = {}
        routes = [('GET', '/paca/ilsan-admissions')]
        for method, route in routes:
            status, _ = request('https://supermax.kr' + route, method)
            require(status == 401, 'unauthenticated route smoke failed: ' + route)
            smoke[method + ' ' + route] = status
        status, availability = request('https://supermax.kr/paca/ilsan-admissions/availability')
        require(status == 200 and availability.get('available') is True, 'admission availability failed')
        smoke['GET availability'] = status
        status, _ = request('https://supermax.kr/paca/ilsan-admissions/submit', 'POST')
        require(status == 422, 'invalid submission did not fail closed')
        smoke['POST empty submission'] = status
        result = {**base, 'status': 'deployed_verified', 'source_hashes_matched': True,
            'env_unchanged': True, 'unrelated_services_unchanged': True, 'backup_integrity_verified': True,
            'internal_health': internal, 'public_health': public, 'route_smoke': smoke}
    except BaseException as error:
        result = {**base, 'error_type': type(error).__name__, 'error': str(error)}
        try:
            result.update(rollback(backup, checksums, changed, rows, meta, env_hash))
            result['status'] = 'deploy_failed_runtime_rolled_back_verified'
        except BaseException as rollback_error:
            result.update(status='deploy_failed_rollback_unverified',
                rollback_error_type=type(rollback_error).__name__, rollback_error=str(rollback_error))
    result['at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    write_json(backup / 'result.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='read-only preflight (default)')
    mode.add_argument('--apply', action='store_true', help='apply the verified backend manifest')
    args = parser.parse_args()
    os.umask(0o077)
    try:
        rows, meta, snapshot = load_release()
        contents, env_hash, result = preflight(rows, meta, snapshot)
        if args.apply:
            result = apply_release(rows, meta, snapshot, contents, env_hash)
        print(json.dumps(result, indent=2))
        return 0 if result['status'] in ('preflight_verified', 'deployed_verified') else 1
    except Exception as error:
        print(json.dumps({'status': 'stopped', 'error_type': type(error).__name__, 'error': str(error)}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
