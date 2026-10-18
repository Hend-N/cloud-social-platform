"""Seed development-only S3 resources at LocalStack's READY stage.

Use a Python init hook because Windows ZIP extraction does not reliably retain
Unix executable bits required for shell init hooks.
"""
import json
import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

bucket = os.getenv("S3_BUCKET_NAME", "cloud-social-platform-media")
client = boto3.client(
    "s3",
    endpoint_url="http://localhost:4566",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    aws_access_key_id="test",
    aws_secret_access_key="test",
    config=Config(s3={"addressing_style": "path"}),
)
try:
    client.head_bucket(Bucket=bucket)
except ClientError as exc:
    error = exc.response.get("Error", {})
    if str(error.get("Code")) not in ("404", "NoSuchBucket", "NotFound"):
        raise
    client.create_bucket(Bucket=bucket)

# Development ONLY: enables direct browser GETs for avatar URLs.
# Never use public-read bucket permissions in a production deployment.
policy = {"Version": "2012-10-17", "Statement": [{
    "Sid": "DevAvatarRead",
    "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
    "Resource": f"arn:aws:s3:::{bucket}/avatars/*",
}]}
client.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
print(f"LocalStack development avatar bucket ready: {bucket}", flush=True)
