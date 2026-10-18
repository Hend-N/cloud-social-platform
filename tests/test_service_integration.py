"""Real FastAPI + SQLite contract tests. Install service requirements to enable.

Uses isolated temporary database files and never changes the user's data.
"""
import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ('jose', 'passlib', 'fastapi', 'sqlalchemy', 'httpx', 'boto3', 'redis')
AVAILABLE = all(importlib.util.find_spec(item) is not None for item in REQUIRED)

@unittest.skipUnless(AVAILABLE, 'Install Python requirements for service integration tests')
class ServiceContracts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='social-tests-')
        self.addCleanup(self.temp.cleanup)
        self.env = patch.dict(os.environ, {
            'SECRET_KEY': 'test-only-secret-with-sufficient-length-for-hs256',
            'INTERNAL_SERVICE_SECRET': 'test-only-internal-secret-not-for-production',
            **{
                f'{prefix.upper()}_DATABASE_URL':
                    f'sqlite:///{Path(self.temp.name)/database}.db'
                for prefix, database in [('auth', 'users'), ('user', 'profiles'),
                                         ('post', 'posts'), ('comment', 'comments'),
                                         ('follow','follows'), ('like','likes')]
            },
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    def load(self, service):
        path = ROOT/'services'/service/'main.py'
        name = service.replace('-', '_')+'_'+str(id(self))
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        self.addCleanup(sys.modules.pop, name, None)
        return module

    def test_registration_login_and_protected_me(self):
        from fastapi.testclient import TestClient
        auth = self.load('auth-service')
        client = TestClient(auth.app)
        r = client.post('/register', json={
            'username':'alice','email':'alice@example.com','password':'long-test-password'
        })
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(client.post('/register', json={
            'username':'alice','email':'alice@example.com','password':'long-test-password'
        }).status_code, 409)
        self.assertEqual(client.get('/me').status_code, 401)
        r = client.post('/login', json={'identifier':'alice','password':'long-test-password'})
        self.assertEqual(r.status_code, 200, r.text)
        token = r.json()['access_token']
        self.assertEqual(client.get('/me',headers={'Authorization':f'Bearer {token}'}).json()['username'],'alice')
        invalid = auth.jwt.encode({'sub':'not-an-int'},os.environ['SECRET_KEY'],algorithm='HS256')
        self.assertEqual(client.get('/me',headers={'Authorization':f'Bearer {invalid}'}).status_code,401)

    def test_profile_post_and_follow_endpoints(self):
        from fastapi.testclient import TestClient
        from jose import jwt
        token = jwt.encode({'sub':'7','username':'alice'},os.environ['SECRET_KEY'],algorithm='HS256')
        headers={'Authorization':'Bearer '+token}
        user = TestClient(self.load('user-service').app)
        self.assertEqual(user.post('/profiles/me', headers=headers, json={'display_name':'A','bio':'hey'}).status_code, 422)
        r = user.post('/profiles/me', headers=headers, json={'display_name':'Alice Example','bio':'hey'})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(user.get('/profiles/alice').status_code,200)
        self.assertEqual(len(user.get('/profiles/search',params={'q':'Example'}).json()),1)
        self.assertEqual(user.get('/profiles/search',params={'q':'%'}).json(),[])
        self.assertEqual(user.get('/profiles/me',headers=headers).status_code,200)
        post = TestClient(self.load('post-service').app)
        self.assertEqual(post.post('/posts/me',json={'content':'hello'}).status_code,401)
        r = post.post('/posts/me', headers=headers,json={'content':'hello'})
        self.assertEqual(r.status_code,200,r.text)
        post_id = r.json()['post_id']
        self.assertEqual(len(post.get('/posts/user/7').json()),1)
        self.assertEqual(post.put(f'/posts/{post_id}',headers=headers,json={'content':'edited'}).json()['content'],'edited')
        self.assertEqual(post.delete(f'/posts/{post_id}',headers=headers).status_code,200)
        follow = TestClient(self.load('follow-service').app)
        self.assertEqual(follow.post('/follows',headers=headers,json={'target_user_id':7}).status_code,400)
        self.assertTrue(follow.post('/follows',headers=headers,json={'target_user_id':8}).json()['following'])
        self.assertEqual(follow.get('/follows/users/8/stats').json()['followers_count'],1)

    def test_comment_reply_deletion_and_internal_auth(self):
        from fastapi.testclient import TestClient
        from jose import jwt
        token=jwt.encode({'sub':'7'},os.environ['SECRET_KEY'],algorithm='HS256')
        headers={'Authorization':'Bearer '+token}
        comment=TestClient(self.load('comment-service').app)
        parent=comment.post('/comments',headers=headers,json={'post_id':10,'comment':'First'}).json()
        reply=comment.post('/comments',headers=headers,json={'post_id':10,'parent_comment_id':parent['id'],'comment':'Reply'})
        self.assertEqual(reply.status_code,200,reply.text)
        self.assertEqual(comment.delete('/comments/post/10').status_code,403)
        # No Redis server is required to persist deletion: event publication is best-effort.
        r=comment.delete(f'/comments/{parent["id"]}',headers=headers)
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(len(r.json()['deleted_ids']),2)
        self.assertEqual(comment.get('/comments/post/10').json()['comments'],[])

if __name__ == '__main__':
    unittest.main()
