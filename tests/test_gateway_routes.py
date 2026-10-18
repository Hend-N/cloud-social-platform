"""Execute gateway routing helpers in isolation without importing network packages."""
import ast
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / 'gateway/main.py'


def routing_namespace():
    parsed = ast.parse(PATH.read_text())
    target_constants = {'PUBLIC_EXACT_ROUTES', 'PUBLIC_PATTERN_ROUTES',
                        'PROTECTED_EXACT_ROUTES', 'PROTECTED_PATTERN_ROUTES'}
    target_functions = {'is_positive_integer', 'path_matches_pattern',
                        'pattern_route_matches', 'classify_route', 'build_target_url'}
    ns = {}
    for node in parsed.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            if node.targets[0].id in target_constants:
                ns[node.targets[0].id] = ast.literal_eval(node.value)
        if isinstance(node, ast.FunctionDef) and node.name in target_functions:
            isolated = ast.Module(body=[node], type_ignores=[])
            exec(compile(ast.fix_missing_locations(isolated), str(PATH), 'exec'), ns)
    ns['SERVICE_MAP'] = {
        'auth': {'base_url': 'http://auth-service:8000', 'prefix': ''},
        'posts': {'base_url': 'http://post-service:8000', 'prefix': '/posts'},
        'users': {'base_url': 'http://user-service:8000', 'prefix': '/profiles'},
        'profiles': {'base_url': 'http://user-service:8000', 'prefix': '/profiles'},
    }
    return ns


class GatewayRoutingTests(unittest.TestCase):
    def test_protected_routes_not_captured_by_public_username_rule(self):
        ns = routing_namespace()
        classify = ns['classify_route']
        cases = {
            ('GET','/api/profiles/me'): 'protected',
            ('GET','/api/users/me'): 'protected',
            ('GET','/api/profiles/search'): 'public',
            ('GET','/api/profiles/alice'): 'public',
            ('GET','/api/posts'): 'public',
            ('POST','/api/posts'): 'protected',
            ('POST','/api/comments'): 'protected',
            ('DELETE','/api/comments/42'): 'protected',
            ('DELETE','/api/comments/post/42'): 'unknown',
            ('DELETE','/api/likes/posts/42/all'): 'unknown',
            ('GET','/api/follows/users/7/stats'): 'public',
            ('POST','/api/unknown/route'): 'unknown',
        }
        for (method, path), expected in cases.items():
            with self.subTest(method=method, path=path):
                self.assertEqual(classify(method,path), expected)

    def test_gateway_translates_public_paths_to_private_service_paths(self):
        ns = routing_namespace()
        target = ns['build_target_url']
        self.assertEqual(target('auth','login','POST'), 'http://auth-service:8000/login')
        self.assertEqual(target('posts','','POST'), 'http://post-service:8000/posts/me')
        self.assertEqual(target('posts','me','GET'), 'http://post-service:8000/posts/me')
        self.assertEqual(target('users','me/avatar','POST'), 'http://user-service:8000/profiles/me/avatar')
        self.assertEqual(target('profiles','user/12','GET'), 'http://user-service:8000/profiles/user/12')

if __name__ == '__main__':
    unittest.main()
