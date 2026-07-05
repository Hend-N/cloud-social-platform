#!/bin/bash

set -euo pipefail

clear_redis_rate_limits() {
  docker compose exec -T redis redis-cli --scan --pattern "gateway:rate_limit:*" \
    | xargs -r docker compose exec -T redis redis-cli DEL > /dev/null
}

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8080}"

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

json_get() {
    python3 -c '
import sys, json

data = json.load(sys.stdin)
path = sys.argv[1].split(".")

for key in path:
    if key.isdigit():
        data = data[int(key)]
    else:
        data = data[key]

print(data)
' "$1"
}

section() {
    echo
    echo "========================================"
    echo "$1"
    echo "========================================"
}

request() {
    curl -sS -f "$@"
}

section "Health checks"
request "$GATEWAY_URL/health"
echo

section "Register users"
request -X POST "$AUTH_URL/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER1\",\"password\":\"$PASS\"}"
echo

request -X POST "$AUTH_URL/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER2\",\"password\":\"$PASS\"}"
echo

request -X POST "$AUTH_URL/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER3\",\"password\":\"$PASS\"}"
echo

section "Login users"
TOKEN1=$(request -X POST "$AUTH_URL/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER1\",\"password\":\"$PASS\"}" | json_get "access_token")

TOKEN2=$(request -X POST "$AUTH_URL/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER2\",\"password\":\"$PASS\"}" | json_get "access_token")

TOKEN3=$(request -X POST "$AUTH_URL/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER3\",\"password\":\"$PASS\"}" | json_get "access_token")

echo "Tokens created."

section "Test /me and extract user IDs"
ME1=$(request "$AUTH_URL/me" -H "Authorization: Bearer $TOKEN1")
ME2=$(request "$AUTH_URL/me" -H "Authorization: Bearer $TOKEN2")
ME3=$(request "$AUTH_URL/me" -H "Authorization: Bearer $TOKEN3")

echo "$ME1"
echo "$ME2"
echo "$ME3"

USER1_ID=$(echo "$ME1" | json_get "id")
USER2_ID=$(echo "$ME2" | json_get "id")
USER3_ID=$(echo "$ME3" | json_get "id")

echo "USER1_ID=$USER1_ID"
echo "USER2_ID=$USER2_ID"
echo "USER3_ID=$USER3_ID"

section "Create profiles"
request -X POST "$USER_URL/me" \
    -H "Authorization: Bearer $TOKEN1" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"user1_$RUN_ID\",\"display_name\":\"User One\",\"bio\":\"Bio one\"}"
echo

request -X POST "$USER_URL/me" \
    -H "Authorization: Bearer $TOKEN2" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"user2_$RUN_ID\",\"display_name\":\"User Two\",\"bio\":\"Bio two\"}"
echo

request -X POST "$USER_URL/me" \
    -H "Authorization: Bearer $TOKEN3" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"user3_$RUN_ID\",\"display_name\":\"User Three\",\"bio\":\"Bio three\"}"
echo

section "Get public profile"
request "$USER_URL/user1_$RUN_ID"
echo

section "Update profile"
request -X PUT "$USER_URL/me" \
    -H "Authorization: Bearer $TOKEN1" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"user1updated_$RUN_ID\",\"display_name\":\"User One Updated\",\"bio\":\"Updated bio\"}"
echo

section "Create posts and extract post IDs"
POST1_RESPONSE=$(request -X POST "$POST_URL/me" \
    -H "Authorization: Bearer $TOKEN1" \
    -H "Content-Type: application/json" \
    -d '{"content":"Post from user 1"}')

POST2_RESPONSE=$(request -X POST "$POST_URL/me" \
    -H "Authorization: Bearer $TOKEN2" \
    -H "Content-Type: application/json" \
    -d '{"content":"Post from user 2"}')

echo "$POST1_RESPONSE"
echo "$POST2_RESPONSE"

POST1_ID=$(echo "$POST1_RESPONSE" | json_get "post_id")
POST2_ID=$(echo "$POST2_RESPONSE" | json_get "post_id")

echo "POST1_ID=$POST1_ID"
echo "POST2_ID=$POST2_ID"

section "Get posts"
request "$POST_URL"
echo

request "$POST_URL/me" \
    -H "Authorization: Bearer $TOKEN1"
echo

section "Update post"
request -X PUT "$POST_URL/$POST1_ID" \
    -H "Authorization: Bearer $TOKEN1" \
    -H "Content-Type: application/json" \
    -d '{"content":"Updated post from user 1"}'
echo

section "Likes"
request -X POST "$LIKE_URL/posts/$POST1_ID" \
    -H "Authorization: Bearer $TOKEN2"
echo

request -X POST "$LIKE_URL/posts/$POST1_ID" \
    -H "Authorization: Bearer $TOKEN3"
echo

request "$LIKE_URL/posts/$POST1_ID/count"
echo

request "$LIKE_URL/me" \
    -H "Authorization: Bearer $TOKEN2"
echo

request -X DELETE "$LIKE_URL/posts/$POST1_ID" \
    -H "Authorization: Bearer $TOKEN2"
echo

request "$LIKE_URL/posts/$POST1_ID/count"
echo

section "Like idempotency test"
request -X POST "$LIKE_URL/posts/$POST1_ID" \
    -H "Authorization: Bearer $TOKEN3"
echo

request -X POST "$LIKE_URL/posts/$POST1_ID" \
    -H "Authorization: Bearer $TOKEN3"
echo

request -X DELETE "$LIKE_URL/posts/$POST1_ID" \
    -H "Authorization: Bearer $TOKEN3"
echo

request -X DELETE "$LIKE_URL/posts/$POST1_ID" \
    -H "Authorization: Bearer $TOKEN3"
echo

section "Comments and extract comment IDs"
COMMENT1_RESPONSE=$(request -X POST "$COMMENT_URL" \
    -H "Authorization: Bearer $TOKEN2" \
    -H "Content-Type: application/json" \
    -d "{\"post_id\":$POST1_ID,\"comment\":\"User 2 comment\"}")

COMMENT2_RESPONSE=$(request -X POST "$COMMENT_URL" \
    -H "Authorization: Bearer $TOKEN3" \
    -H "Content-Type: application/json" \
    -d "{\"post_id\":$POST1_ID,\"comment\":\"User 3 comment\"}")

echo "$COMMENT1_RESPONSE"
echo "$COMMENT2_RESPONSE"

COMMENT1_ID=$(echo "$COMMENT1_RESPONSE" | json_get "id")
COMMENT2_ID=$(echo "$COMMENT2_RESPONSE" | json_get "id")

echo "COMMENT1_ID=$COMMENT1_ID"
echo "COMMENT2_ID=$COMMENT2_ID"

request "$COMMENT_URL/post/$POST1_ID"
echo

request "$COMMENT_URL/user/me" \
    -H "Authorization: Bearer $TOKEN2"
echo

section "Update comment"
request -X PUT "$COMMENT_URL/$COMMENT1_ID" \
    -H "Authorization: Bearer $TOKEN2" \
    -H "Content-Type: application/json" \
    -d '{"comment":"Updated user 2 comment"}'
echo

section "Follows"
request -X POST "$FOLLOW_URL" \
    -H "Authorization: Bearer $TOKEN1" \
    -H "Content-Type: application/json" \
    -d "{\"target_user_id\":$USER2_ID}"
echo

request -X POST "$FOLLOW_URL" \
    -H "Authorization: Bearer $TOKEN1" \
    -H "Content-Type: application/json" \
    -d "{\"target_user_id\":$USER3_ID}"
echo

request "$FOLLOW_URL/me" \
    -H "Authorization: Bearer $TOKEN1"
echo

request "$FOLLOW_URL/me/followers" \
    -H "Authorization: Bearer $TOKEN2"
echo

request "$FOLLOW_URL/users/$USER1_ID/following"
echo

request "$FOLLOW_URL/users/$USER2_ID/followers"
echo

section "Follow idempotency test"
request -X POST "$FOLLOW_URL" \
    -H "Authorization: Bearer $TOKEN1" \
    -H "Content-Type: application/json" \
    -d "{\"target_user_id\":$USER3_ID}"
echo

request -X POST "$FOLLOW_URL" \
    -H "Authorization: Bearer $TOKEN1" \
    -H "Content-Type: application/json" \
    -d "{\"target_user_id\":$USER3_ID}"
echo

request -X DELETE "$FOLLOW_URL/$USER3_ID" \
    -H "Authorization: Bearer $TOKEN1"
echo

request -X DELETE "$FOLLOW_URL/$USER3_ID" \
    -H "Authorization: Bearer $TOKEN1"
echo

section "Unfollow user 2"
request -X DELETE "$FOLLOW_URL/$USER2_ID" \
    -H "Authorization: Bearer $TOKEN1"
echo

request "$FOLLOW_URL/me" \
    -H "Authorization: Bearer $TOKEN1"
echo

section "Delete tests"
request -X DELETE "$COMMENT_URL/$COMMENT1_ID" \
    -H "Authorization: Bearer $TOKEN2"
echo

request -X DELETE "$POST_URL/$POST1_ID" \
    -H "Authorization: Bearer $TOKEN1"
echo

request -X DELETE "$USER_URL/me" \
    -H "Authorization: Bearer $TOKEN3"
echo

section "DONE"
echo "All gateway integration tests passed."