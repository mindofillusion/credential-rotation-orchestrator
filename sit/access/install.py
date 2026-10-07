"""One-time DSM installation, run locally by the administrator as root."""
import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import pwd
import shlex
import stat
import subprocess
import sys
import time

ROOT = Path('/volume1/docker/cro-sit-access')
SIT = Path('/volume1/docker/cro-sit')
HASHES = {
    'compose.yaml': '9a70e3f8a3542db595c3559c57f3f6d9dd1fa74d2f75e76a3941c54f0847a20c',
    'proxy.mjs': '98eb6f934e004901e5bc23419145bd4febb42cefef3f46d04ccb4806c5467f5b',
}


def trusted(path):
    for part in [path] + list(path.parents):
        info = part.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise RuntimeError('Untrusted root-owned path: ' + str(part))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--account', required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--public-key', required=True)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError('Run with sudo python3 -I install.py')
    ipaddress.IPv4Address(args.source)
    key = args.public_key.split()
    if len(key) != 3 or key[0] != 'ssh-ed25519' or any(c in args.public_key for c in '\r\n"'):
        raise RuntimeError('Expected one Ed25519 public key with comment')
    account = pwd.getpwnam(args.account)
    if account.pw_uid == 0:
        raise RuntimeError('Root SSH account is forbidden')
    trusted(SIT)
    if ROOT.exists() or ROOT.is_symlink():
        raise RuntimeError('Access directory already exists; installation stopped')
    auth = Path(account.pw_dir) / '.ssh/authorized_keys'
    if auth.is_symlink() or auth.parent.is_symlink() or not auth.is_file():
        raise RuntimeError('Expected existing regular authorized_keys')
    original = auth.read_bytes()
    lines = original.decode().splitlines(keepends=True)
    matches = [i for i, line in enumerate(lines) if key[1] in line.split()]
    if len(matches) != 1:
        raise RuntimeError('Exactly one existing diagnostic key is required')
    expected_options = ('from="' + args.source + '",command="/bin/sh -c '
                        "'echo cro-sit-access=ok; id; hostname'\","
                        'no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc')
    if lines[matches[0]].strip() != expected_options + ' ' + args.public_key:
        raise RuntimeError('Existing diagnostic key restrictions differ; stopped')
    contents = {}
    for name, digest in HASHES.items():
        trusted(SIT / name)
        contents[name] = (SIT / name).read_bytes()
        if hashlib.sha256(contents[name]).hexdigest() != digest:
            raise RuntimeError('Unexpected installed SIT file: ' + name)
    trusted(SIT / 'compose.nas.yaml')
    override = 'services:\n  vaultwarden:\n    volumes:\n      - /volume1/docker/cro-sit/data:/data\n'
    if (SIT / 'compose.nas.yaml').read_text() != override:
        raise RuntimeError('Unexpected NAS override')
    trusted(SIT / 'data')
    trusted(Path('/usr/local/bin/docker').resolve())
    broker = Path(__file__).with_name('broker.py').read_bytes()
    os.umask(0o077)
    ROOT.mkdir(mode=0o755)
    os.chmod(ROOT, 0o755)
    for name, mode in [('bin', 0o755), ('run', 0o755), ('frozen', 0o700)]:
        (ROOT / name).mkdir(mode=mode)
        os.chmod(ROOT / name, mode)
    contents['compose.nas.yaml'] = override.encode()
    for name, data in contents.items():
        (ROOT / 'frozen' / name).write_bytes(data)
    (ROOT / 'bin/broker.py').write_bytes(broker)
    os.chmod(ROOT / 'bin/broker.py', 0o644)
    config = {'uid': account.pw_uid, 'gid': account.pw_gid,
              'files': {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()}}
    (ROOT / 'config.json').write_text(json.dumps(config))
    (ROOT / 'authorized_keys.before').write_bytes(original)
    python = str(Path(sys.executable).resolve())
    trusted(Path(python))
    launcher = '#!/bin/sh\nexec ' + shlex.quote(python) + ' -I ' + str(ROOT / 'bin/broker.py')
    (ROOT / 'bin/client').write_text(launcher + ' client\n')
    (ROOT / 'bin/start').write_text('#!/bin/sh\n' + shlex.quote(python) + ' -I ' +
        str(ROOT / 'bin/broker.py') + ' serve </dev/null >>' + str(ROOT / 'broker.log') + ' 2>&1 &\n')
    for name in ['client', 'start']:
        os.chmod(ROOT / 'bin' / name, 0o755)
    with open(ROOT / 'broker.log', 'ab') as log:
        proc = subprocess.Popen([python, '-I', str(ROOT / 'bin/broker.py'), 'serve'],
            stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True,
            cwd=str(ROOT), env={'PATH': '/usr/local/bin:/usr/bin:/bin'})
    for _ in range(100):
        if proc.poll() is not None:
            raise RuntimeError('Broker startup failed; SSH key unchanged')
        if (ROOT / 'run/broker.sock').exists():
            break
        time.sleep(1)
    else:
        proc.terminate()
        raise RuntimeError('Broker startup timeout; SSH key unchanged')
    options = ('from="' + args.source + '",command="' + str(ROOT / 'bin/client') + '",'
               'no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc')
    lines[matches[0]] = options + ' ' + args.public_key + '\n'
    # Detect ordinary concurrent edits before replacing only our diagnostic key line.
    if auth.read_bytes() != original:
        proc.terminate()
        raise RuntimeError('authorized_keys changed concurrently; stopped')
    import tempfile
    fd, temporary = tempfile.mkstemp(prefix='cro-sit-', dir=str(auth.parent))
    with os.fdopen(fd, 'wb') as handle:
        handle.write(''.join(lines).encode())
        os.fchown(handle.fileno(), account.pw_uid, account.pw_gid)
        os.fchmod(handle.fileno(), 0o600)
    os.replace(temporary, auth)
    print('Installed: scoped SIT access. Registrations closed. No sudoers changes.')
    print('DSM root boot task command: /volume1/docker/cro-sit-access/bin/start')


if __name__ == '__main__':
    main()
