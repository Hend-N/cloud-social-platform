#!/bin/sh
echo "=== Creating LocalStack S3 Bucket ==="
awslocal s3 mb s3://cloud-social-platform-media
echo "=== S3 Bucket Created Successfully ==="
