"""Dependency-free source/Compose regression checks (no running Docker needed)."""
import ast
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICES = {
    'auth': ('auth-service', 'users'),
    'user': ('user-service', 'profiles'),
    'post': ('post-service', 'posts'),
    'like': ('like-service', 'likes'),
    'follow': ('follow-service', 'follows'),
    'comment': ('comment-service', 'comments'),
}

class StaticContracts(unittest.TestCase):
    def test_all_python_sources_parse(self):
        sources = [ROOT / 'gateway/main.py', *ROOT.glob('services/*/main.py')]
        self.assertEqual(len(sources), 7)
        for path in sources:
            with self.subTest(path=path):
                ast.parse(path.read_text(encoding='utf-8'), filename=str(path))

    def test_compose_owns_a_persistent_database_per_service(self):
        try:
            import yaml
        except ImportError:
            self.skipTest('PyYAML not available')
        compose = yaml.safe_load((ROOT/'docker-compose.yml').read_text())
        for prefix, (service, database) in SERVICES.items():
            config = compose['services'][service]
            env_name = prefix.upper()+'_DATABASE_URL'
            self.assertEqual(config['environment'][env_name],
                             f'sqlite:////app/data/{database}.db')
            volume = f'{prefix}-data:/app/data'
            self.assertIn(volume, config['volumes'])
            self.assertIn(f'{prefix}-data', compose['volumes'])
            source = (ROOT/'services'/service/'main.py').read_text()
            self.assertIn(f'os.getenv("{env_name}"', source)
            dockerfile = (ROOT/'services'/service/'Dockerfile').read_text()
            self.assertIn('mkdir -p /app/data', dockerfile)

    def test_redis_readiness_and_port_isolation(self):
        try:
            import yaml
        except ImportError:
            self.skipTest('PyYAML not available')
        compose = yaml.safe_load((ROOT/'docker-compose.yml').read_text())
        self.assertNotIn('ports', compose['services']['redis'])
        for svc in ('comment-service', 'like-service'):
            self.assertEqual(compose['services'][svc]['depends_on']['redis']['condition'], 'service_healthy')

    def test_production_frontend_uses_same_origin_gateway_proxy(self):
        try:
            import yaml
        except ImportError:
            self.skipTest('PyYAML not available')
        compose = yaml.safe_load((ROOT/'docker-compose.yml').read_text())
        self.assertEqual(compose['services']['frontend']['build']['args']['VITE_API_BASE_URL'], '/api')
        self.assertIn('ARG VITE_API_BASE_URL=/api', (ROOT/'frontend/Dockerfile').read_text())
        self.assertIn('proxy_pass http://gateway:8000;', (ROOT/'frontend/nginx.conf').read_text())

    def test_auth_service_and_internal_routes_have_secrets(self):
        gateway = (ROOT/'gateway/main.py').read_text()
        self.assertIn('INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET")', gateway)
        self.assertNotIn('"super-secret"', gateway)
        for service in ('like-service', 'comment-service'):
            source = (ROOT/'services'/service/'main.py').read_text()
            self.assertIn('verify_internal_service', source)

    def test_vite_proxy_port_and_backend_bio_limit_align(self):
        self.assertIn('http://localhost:8080', (ROOT/'frontend/vite.config.ts').read_text())
        self.assertIn('maxLength={200}', (ROOT/'frontend/src/components/profile/EditProfile.tsx').read_text())
        self.assertIn('max_length=200', (ROOT/'services/user-service/main.py').read_text())

    def test_unused_profile_page_renders_posts(self):
        source = (ROOT/'frontend/src/pages/UserProfilePage.tsx').read_text()
        self.assertRegex(source, re.compile(r'posts\.map\(\(post\)\s*=>\s*\{[^}]*return\s+<PostCard',re.S))

    def test_secrets_not_committed_by_gitignore(self):
        ignore = (ROOT/'.gitignore').read_text()
        self.assertIn('**/.env', ignore)
        self.assertIn('.env', ignore)

if __name__ == '__main__':
    unittest.main()
