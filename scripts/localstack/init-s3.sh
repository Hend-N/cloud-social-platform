#!/bin/bash

set -e

BUCKET_NAME="cloud-social-platform-media"

echo "Starting LocalStack..."
docker compose --profile localstack up -d localstack

echo "Waiting for LocalStack health endpoint..."

for i in {1..30}; do
  if curl -fsS http://127.0.0.1:4566/_localstack/health >/dev/null; then
    echo "LocalStack is healthy."
    break
  fi

  echo "Still waiting..."
  sleep 3
done

echo "Creating S3 bucket: $BUCKET_NAME"

docker compose exec -T localstack awslocal s3 mb "s3://$BUCKET_NAME" || true

echo "Current S3 buckets:"

docker compose exec -T localstack awslocal s3 ls
