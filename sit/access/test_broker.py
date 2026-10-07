import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('broker', Path(__file__).with_name('broker.py'))
broker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker)


class ScopeTests(unittest.TestCase):
    def test_rejects_escape_attempts(self):
        cases = [None, [], {}, {'action': []}, {'action': 'exec'},
                 {'action': 'start', 'service': 'maison2-vaultwarden'},
                 {'action': 'status', 'args': ['--all']},
                 {'action': 'http', 'method': 'GET', 'path': '/admin'},
                 {'action': 'http', 'method': 'GET', 'path': 'http://127.0.0.1:18082/alive'},
                 {'action': 'http', 'method': 'GET', 'path': '/api/../admin'},
                 {'action': 'http', 'method': 'GET', 'path': '/alive?target=production'},
                 {'action': 'http', 'method': 'CONNECT', 'path': '/alive'},
                 {'action': 'http', 'method': 'GET', 'path': '/alive', 'headers': {'Host': 'production'}},
                 {'action': 'http', 'method': 'GET', 'path': '/alive', 'headers': {'Authorization': 'x\r\ny'}},
                 {'action': 'http', 'method': 'GET', 'path': '/alive', 'body': 'x' * broker.LIMIT}]
        for request in cases:
            with self.subTest(request=str(request)[:120]), self.assertRaises(ValueError):
                broker.validate(request)

    def test_fixed_controls_and_environment(self):
        with tempfile.TemporaryDirectory() as root:
            Path(root, 'frozen').mkdir()
            Path(root, 'frozen', 'compose.yaml').write_bytes(b'fixed')
            config = {'files': {'compose.yaml': hashlib.sha256(b'fixed').hexdigest()}}
            with patch.object(broker, 'ROOT', root), patch.object(broker.subprocess, 'run') as run:
                run.return_value.returncode = 0
                run.return_value.stdout = b'status'
                for action in broker.VERBS - {'http'}:
                    broker.control(action, config)
                    args, kwargs = run.call_args
                    command = args[0]
                    self.assertEqual(command[:4], ['/usr/local/bin/docker', 'compose', '--project-name', 'cro-sit'])
                    self.assertNotIn('shell', kwargs)
                    self.assertEqual(kwargs['env']['DOCKER_HOST'], 'unix:///var/run/docker.sock')
                    self.assertNotIn('COMPOSE_FILE', kwargs['env'])
                    self.assertIn('vaultwarden', command)
                Path(root, 'frozen', 'compose.yaml').write_bytes(b'tampered')
                run.reset_mock()
                with self.assertRaises(ValueError):
                    broker.control('start', config)
                run.assert_not_called()

    def test_http_destination_cannot_be_selected(self):
        with patch.object(broker.http.client, 'HTTPConnection') as connection:
            connection.return_value.getresponse.return_value.read.return_value = b'healthy'
            connection.return_value.getresponse.return_value.status = 200
            result = broker.http_request(broker.validate({'action': 'http', 'method': 'GET', 'path': '/alive'}))
            connection.assert_called_once_with('127.0.0.1', 8223, timeout=20)
            self.assertEqual(result['status'], 200)

    def test_ssh_shell_and_tunnel_commands_rejected(self):
        for command in ['', 'sh', 'docker ps', 'cro-sit; id']:
            with patch.dict(broker.os.environ, {'SSH_ORIGINAL_COMMAND': command}), self.assertRaises(ValueError):
                broker.client()


if __name__ == '__main__':
    unittest.main()
