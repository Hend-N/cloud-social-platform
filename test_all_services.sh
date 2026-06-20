#!/bin/bash

set -e

GATEWAY_URL="http://127.0.0.1:8080"

AUTH_URL="$GATEWAY_URL/api/auth"
USER_URL="$GATEWAY_URL/api/users"
POST_URL="$GATEWAY_URL/api/posts"
LIKE_URL="$GATEWAY_URL/api/likes"
FOLLOW_URL="$GATEWAY_URL/api/follows"
COMMENT_URL="$GATEWAY_URL/api/comments"

PASS="password123"
RUN_ID=$(date +%s)

USER1="user1_$RUN_ID@test.com"
USER2="user2_$RUN_ID@test.com"
USER3="user3_$RUN_ID@test.com"

echo "=== Health checks ==="
curl -s "$GATEWAY_URL/health"; echo

echo "=== Register users ==="
curl -s -X POST "$AUTH_URL/register" -H "Content-Type: application/json" -d "{\"email\":\"$USER1\",\"password\":\"$PASS\"}"; echo
curl -s -X POST "$AUTH_URL/register" -H "Content-Type: application/json" -d "{\"email\":\"$USER2\",\"password\":\"$PASS\"}"; echo
curl -s -X POST "$AUTH_URL/register" -H "Content-Type: application/json" -d "{\"email\":\"$USER3\",\"password\":\"$PASS\"}"; echo

echo "=== Login users ==="
TOKEN1=$(curl -s -X POST "$AUTH_URL/login" -H "Content-Type: application/json" -d "{\"email\":\"$USER1\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
TOKEN2=$(curl -s -X POST "$AUTH_URL/login" -H "Content-Type: application/json" -d "{\"email\":\"$USER2\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
TOKEN3=$(curl -s -X POST "$AUTH_URL/login" -H "Content-Type: application/json" -d "{\"email\":\"$USER3\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "Tokens created."

echo "=== Test /me ==="
curl -s "$AUTH_URL/me" -H "Authorization: Bearer $TOKEN1"; echo
curl -s "$AUTH_URL/me" -H "Authorization: Bearer $TOKEN2"; echo
curl -s "$AUTH_URL/me" -H "Authorization: Bearer $TOKEN3"; echo

echo "=== Create profiles ==="
curl -s -X POST "$USER_URL/me" -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" -d "{\"username\":\"user1_$RUN_ID\",\"display_name\":\"User One\",\"bio\":\"Bio one\"}"; echo
curl -s -X POST "$USER_URL/me" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d "{\"username\":\"user2_$RUN_ID\",\"display_name\":\"User Two\",\"bio\":\"Bio two\"}"; echo
curl -s -X POST "$USER_URL/me" -H "Authorization: Bearer $TOKEN3" -H "Content-Type: application/json" -d "{\"username\":\"user3_$RUN_ID\",\"display_name\":\"User Three\",\"bio\":\"Bio three\"}"; echo

echo "=== Get profile ==="
curl -s "$USER_URL/user1_$RUN_ID"; echo

echo "=== Update profile ==="
curl -s -X PUT "$USER_URL/me" -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" -d "{\"username\":\"user1updated_$RUN_ID\",\"display_name\":\"User One Updated\",\"bio\":\"Updated bio\"}"; echo

echo "=== Create posts ==="
curl -s -X POST "$POST_URL/me" -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" -d '{"content":"Post from user 1"}'; echo
curl -s -X POST "$POST_URL/me" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d '{"content":"Post from user 2"}'; echo

echo "=== Get posts ==="
curl -s "$POST_URL"; echo
curl -s "$POST_URL/me" -H "Authorization: Bearer $TOKEN1"; echo

echo "=== Update post 1 ==="
curl -s -X PUT "$POST_URL/1" -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" -d '{"content":"Updated post from user 1"}'; echo

echo "=== Likes ==="
curl -s -X POST "$LIKE_URL/posts/1" -H "Authorization: Bearer $TOKEN2"; echo
curl -s -X POST "$LIKE_URL/posts/1" -H "Authorization: Bearer $TOKEN3"; echo
curl -s "$LIKE_URL/posts/1/count"; echo
curl -s "$LIKE_URL/me" -H "Authorization: Bearer $TOKEN2"; echo
curl -s -X DELETE "$LIKE_URL/posts/1" -H "Authorization: Bearer $TOKEN2"; echo
curl -s "$LIKE_URL/posts/1/count"; echo

echo "=== Comments ==="
curl -s -X POST "$COMMENT_URL" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d '{"post_id":1,"comment":"User 2 comment"}'; echo
curl -s -X POST "$COMMENT_URL" -H "Authorization: Bearer $TOKEN3" -H "Content-Type: application/json" -d '{"post_id":1,"comment":"User 3 comment"}'; echo
curl -s "$COMMENT_URL/post/1"; echo
curl -s "$COMMENT_URL/user/me" -H "Authorization: Bearer $TOKEN2"; echo
curl -s -X PUT "$COMMENT_URL/1" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d '{"post_id":1,"comment":"Updated user 2 comment"}'; echo

echo "=== Follows ==="
curl -s -X POST "$FOLLOW_URL" -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" -d '{"target_user_id":2}'; echo
curl -s -X POST "$FOLLOW_URL" -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" -d '{"target_user_id":3}'; echo
curl -s "$FOLLOW_URL/me" -H "Authorization: Bearer $TOKEN1"; echo
curl -s "$FOLLOW_URL/me/followers" -H "Authorization: Bearer $TOKEN2"; echo
curl -s "$FOLLOW_URL/users/1/following"; echo
curl -s "$FOLLOW_URL/users/2/followers"; echo
curl -s -X DELETE "$FOLLOW_URL/2" -H "Authorization: Bearer $TOKEN1"; echo
curl -s "$FOLLOW_URL/me" -H "Authorization: Bearer $TOKEN1"; echo

echo "=== Delete tests ==="
curl -s -X DELETE "$COMMENT_URL/1" -H "Authorization: Bearer $TOKEN2"; echo
curl -s -X DELETE "$POST_URL/1" -H "Authorization: Bearer $TOKEN1"; echo
curl -s -X DELETE "$USER_URL/profiles/me" -H "Authorization: Bearer $TOKEN3"; echo

echo "=== DONE ==="
