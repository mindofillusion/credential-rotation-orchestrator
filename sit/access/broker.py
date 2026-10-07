"""Fixed-capability SIT broker. No shell, supplied paths, URLs or Docker arguments."""
import base64
import hashlib
import http.client
import json
import os
import re
import socket
import socketserver
import struct
import subprocess
import sys
import threading
import time

ROOT = '/volume1/docker/cro-sit-access'
SOCKET = ROOT + '/run/broker.sock'
LIMIT = 1024 * 1024
LOCK = threading.Lock()
VERBS = {'status', 'start', 'stop', 'restart', 'registrations-open', 'registrations-close', 'http'}
ROUTES = {
    ('GET', '/alive'), ('GET', '/api/config'), ('GET', '/api/sync'),
    ('POST', '/identity/accounts/prelogin'), ('POST', '/identity/accounts/prelogin/password'),
    ('POST', '/identity/connect/token'),
    ('POST', '/identity/accounts/register/send-verification-email'),
    ('POST', '/identity/accounts/register/finish'),
    ('POST', '/api/accounts/register'), ('POST', '/api/accounts/register/finish'),
    ('POST', '/api/accounts/register/send-verification-email'),
    ('POST', '/api/accounts/register/verify-email'),
    ('GET', '/api/accounts/profile'), ('GET', '/api/ciphers'), ('POST', '/api/ciphers'),
}


def validate(request):
    if not isinstance(request, dict) or not isinstance(request.get('action'), str) or request.get('action') not in VERBS:
        raise ValueError('Unsupported action')
    if request['action'] != 'http':
        if set(request) != {'action'}:
            raise ValueError('Unexpected control arguments')
        return request
    if set(request) - {'action', 'method', 'path', 'headers', 'body'}:
        raise ValueError('Unexpected HTTP arguments')
    method, path = request.get('method'), request.get('path')
    if not isinstance(path, str) or not isinstance(method, str):
        raise ValueError('Invalid route')
    cipher = re.fullmatch(r'/api/ciphers/[0-9a-fA-F-]{36}', path)
    if (method, path) not in ROUTES and not (cipher and method in {'GET', 'PUT', 'DELETE'}):
        raise ValueError('Route is outside SIT API scope')
    headers = request.get('headers', {})
    if not isinstance(headers, dict) or set(headers) - {'Authorization', 'Content-Type'}:
        raise ValueError('Unsupported headers')
    for value in headers.values():
        if not isinstance(value, str) or len(value) > 16384 or '\r' in value or '\n' in value:
            raise ValueError('Invalid header')
    body = request.get('body', '')
    if not isinstance(body, str) or len(body.encode('utf-8')) > LIMIT // 2:
        raise ValueError('Invalid body')
    return request


def http_request(request):
    # http.client neither follows redirects nor consults HTTP proxy environment variables.
    connection = http.client.HTTPConnection('127.0.0.1', 8223, timeout=20)
    try:
        connection.request(request['method'], request['path'],
                           body=request.get('body', '').encode('utf-8'),
                           headers=request.get('headers', {}))
        response = connection.getresponse()
        body = response.read(LIMIT + 1)
        if len(body) > LIMIT:
            raise ValueError('Response exceeds SIT size limit')
        return {'ok': True, 'status': response.status,
                'bodyBase64': base64.b64encode(body).decode('ascii')}
    finally:
        connection.close()


def verify_files(config):
    for name, expected in config['files'].items():
        path = ROOT + '/frozen/' + name
        with open(path, 'rb') as handle:
            actual = hashlib.sha256(handle.read()).hexdigest()
        if actual != expected:
            raise ValueError('Frozen deployment configuration changed')


def control(action, config):
    verify_files(config)
    args = {
        'status': ['ps', '--all', 'vaultwarden', 'gateway'],
        'start': ['start', 'vaultwarden', 'gateway'],
        'stop': ['stop', '--timeout', '15', 'vaultwarden', 'gateway'],
        'restart': ['restart', '--timeout', '15', 'vaultwarden', 'gateway'],
        'registrations-open': ['up', '-d', '--no-deps', '--pull', 'never', 'vaultwarden'],
        'registrations-close': ['up', '-d', '--no-deps', '--pull', 'never', 'vaultwarden'],
    }[action]
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': ROOT,
           'CRO_SIT_SIGNUPS': 'true' if action == 'registrations-open' else 'false',
           'DOCKER_HOST': 'unix:///var/run/docker.sock'}
    command = ['/usr/local/bin/docker', 'compose', '--project-name', 'cro-sit',
               '--project-directory', ROOT + '/frozen', '--env-file', '/dev/null',
               '-f', ROOT + '/frozen/compose.yaml', '-f', ROOT + '/frozen/compose.nas.yaml'] + args
    result = subprocess.run(command, env=env, cwd=ROOT + '/frozen',
                            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=90)
    # Only status output is returned. No container logs, environment or secrets.
    return {'ok': result.returncode == 0, 'returncode': result.returncode,
            'status': result.stdout.decode('utf-8', 'replace')[:16000] if action == 'status' else None}


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        self.connection.settimeout(25)
        peer = struct.unpack('3i', self.connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        if peer[1] != self.server.config['uid']:
            return
        try:
            raw = self.rfile.readline(LIMIT + 1)
            if len(raw) > LIMIT or not raw.endswith(b'\n'):
                raise ValueError('Invalid envelope')
            request = validate(json.loads(raw))
            with LOCK:
                if request['action'] == 'http':
                    result = http_request(request)
                elif request['action'] == 'registrations-open':
                    # Set deadline before enabling signup; startup always closes registrations.
                    self.server.expiry = time.time() + 600
                    result = control(request['action'], self.server.config)
                else:
                    result = control(request['action'], self.server.config)
                    if request['action'] == 'registrations-close' and result['ok']:
                        self.server.expiry = 0
            self.wfile.write((json.dumps(result) + '\n').encode())
        except Exception:
            # Do not echo source, token, HTTP body, Docker stderr or exception details.
            self.wfile.write(b'{"ok":false,"error":"SIT request failed or denied"}\n')


class Server(socketserver.UnixStreamServer):
    request_queue_size = 8


def serve():
    import fcntl
    with open(ROOT + '/run/broker.lock', 'a') as singleton:
        fcntl.flock(singleton, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with open(ROOT + '/config.json') as handle:
            config = json.load(handle)
        if os.path.lexists(SOCKET):
            os.unlink(SOCKET)
        # Always close registrations at broker startup, even after an interrupted session.
        if not control('registrations-close', config)['ok']:
            raise RuntimeError('Cannot establish closed-registration state')
        server = Server(SOCKET, Handler)
        server.config, server.expiry = config, 0
        os.chown(SOCKET, config['uid'], config['gid'])
        os.chmod(SOCKET, 0o600)
        server.timeout = 2
        while True:
            server.handle_request()
            if server.expiry and time.time() >= server.expiry:
                try:
                    if control('registrations-close', config)['ok']:
                        server.expiry = 0
                except Exception:
                    pass  # Retry closure on the next loop; never echo secrets.


def client():
    if os.environ.get('SSH_ORIGINAL_COMMAND') != 'cro-sit':
        raise ValueError('Only cro-sit is supported')
    raw = sys.stdin.buffer.readline(LIMIT + 1)
    if len(raw) > LIMIT or not raw.endswith(b'\n'):
        raise ValueError('Invalid envelope')
    validate(json.loads(raw))
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
        connection.settimeout(100)
        connection.connect(SOCKET)
        connection.sendall(raw)
        with connection.makefile('rb') as reader:
            response = reader.readline(2 * LIMIT)
        sys.stdout.buffer.write(response)


if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['serve']:
            serve()
        elif sys.argv[1:] == ['client']:
            client()
        else:
            raise ValueError('Unsupported mode')
    except Exception:
        print('{"ok":false,"error":"SIT broker unavailable or request denied"}')
        sys.exit(1)
