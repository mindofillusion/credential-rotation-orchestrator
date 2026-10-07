#!/usr/bin/env python3
"""Rootless lifecycle for an already qualified CMS fixture; no downloads or install."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import time
import urllib.request


def private_file(path):
    st = path.lstat()
    if path.is_symlink() or not path.is_file() or st.st_uid != os.getuid() or st.st_mode & 0o077:
        raise RuntimeError('Private configuration has unsafe ownership or permissions')
    return json.loads(path.read_text())


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False


def process_matches(pid, argv):
    try:
        actual = Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')[:-1]
        expected = [os.fsencode(a) for a in argv]
        # The PHP wrapper execs its interpreter; remaining arguments are exact.
        return actual == expected or (len(actual)>3 and actual[3:]==expected[1:] and actual[1]==b'-c' and actual[2]==os.fsencode(Path(argv[0]).parent/'php.ini') and Path(os.fsdecode(actual[0])).name=='php8.4')
    except FileNotFoundError:
        return False


def spec(root, source):
    php = root / 'php'
    return [
        ('wordpress', 8230, root/'wordpress/server.pid', [str(php), '-S', '127.0.0.1:8230', '-t', str(root/'wordpress/wordpress')]),
        ('joomla', 8231, root/'joomla/server.pid', [str(php), '-S', '127.0.0.1:8231', '-t', str(root/'joomla/web')]),
        ('drupal', 8232, root/'drupal/server.pid', [str(php), '-S', '127.0.0.1:8232', '-t', str(root/'drupal/drupal-11.4.8')]),
        ('ui', 18788, root/'ui-server.pid', [shutil.which('node') or 'node', str(source/'src/server/main.js')]),
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('action', choices=['start', 'status', 'stop'])
    ap.add_argument('--root', type=Path, required=True)
    args = ap.parse_args()
    if os.geteuid() == 0:
        raise RuntimeError('Run as the unprivileged fixture owner, never root')
    os.umask(0o077)
    root = args.root.resolve(strict=True)
    if root.stat().st_uid != os.getuid() or root.stat().st_mode & 0o077:
        raise RuntimeError('Fixture root must be private and owned by the current user')
    source = Path(__file__).resolve().parents[2]
    specs = spec(root, source)
    if args.action == 'status':
        result = []
        for name, port, pidfile, argv in specs:
            pid = int(pidfile.read_text()) if pidfile.exists() else 0
            result.append({'service': name, 'running': bool(pid and alive(pid) and process_matches(pid, argv))})
        print(json.dumps(result))
        return
    for engine in ('wordpress', 'joomla', 'drupal'):
        if (root/engine/'rotation.lock').exists() or (root/engine/'rotation-pending.json').exists():
            raise RuntimeError('Rotation or reconciliation pending; lifecycle action refused')
    if args.action == 'stop':
        for name, port, pidfile, argv in reversed(specs):
            if not pidfile.exists():
                continue
            pid = int(pidfile.read_text())
            if alive(pid):
                if not process_matches(pid, argv) or os.getpgid(pid) != pid:
                    raise RuntimeError('Process identity mismatch; no signal sent')
                os.killpg(pid, signal.SIGTERM)
            pidfile.unlink()
        print('CMS processes stopped; shared database and forums unchanged')
        return
    cfg = private_file(root/'cro-runtime.json')
    required = {'browserRuntime', 'forumsRoot', 'vaultAccess', 'sshHost'}
    if set(cfg) != required or not all(isinstance(cfg[k], str) and cfg[k] for k in required):
        raise RuntimeError('Incomplete runtime configuration')
    for key in ('browserRuntime', 'forumsRoot', 'vaultAccess'):
        if not Path(cfg[key]).is_absolute() or not Path(cfg[key]).is_dir():
            raise RuntimeError('A prepared dependency is missing')
    for engine in ('wordpress', 'joomla', 'drupal'):
        private_file(root/engine/'forum-secrets.json')
    # Preflight all ports before starting any process. No takeover/restart of a listener.
    for name, port, pidfile, argv in specs:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', port))
    env = {**os.environ, 'PHP_CLI_SERVER_WORKERS': '2',
           'CRO_ENABLE_CMS_SIT': '1', 'CRO_ENABLE_FORUMS_SIT': '1',
           'CRO_CMS_SIT_DIR': str(root), 'CRO_PHPBB_SIT_DIR': cfg['browserRuntime'],
           'CRO_FORUMS_SIT_DIR': cfg['forumsRoot'], 'CRO_SIT_ACCESS_DIR': cfg['vaultAccess'],
           'CRO_SIT_SSH_HOST': cfg['sshHost'], 'CRO_HOST': '127.0.0.1',
           'CRO_PORT': '18788', 'CRO_DATA_DIR': str(root/'ui-data')}
    started = []
    try:
        for name, port, pidfile, argv in specs:
            with (root/(name+'-managed.log')).open('ab') as log:
                p = subprocess.Popen(argv, cwd=source, env=env, stdout=log, stderr=log, start_new_session=True)
            pidfile.write_text(str(p.pid))
            started.append((p, pidfile))
        for _ in range(30):
            if any(p.poll() is not None for p, _ in started):
                raise RuntimeError('A fixture process exited; inspect its private log')
            try:
                for port in (8230, 8231, 8232, 18788):
                    path = '/api/overview' if port == 18788 else '/'
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}', timeout=2) as response:
                        if response.status != 200:
                            raise RuntimeError('Health check rejected')
                print('CMS fixture and standalone UI healthy on loopback')
                return
            except (OSError, RuntimeError):
                time.sleep(0.25)
        raise RuntimeError('Fixture health timeout; startup rolled back')
    except Exception:
        for p, pidfile in reversed(started):
            if p.poll() is None:
                os.killpg(p.pid, signal.SIGTERM)
            pidfile.unlink(missing_ok=True)
        raise


if __name__ == '__main__':
    main()
