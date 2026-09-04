import os
from pathlib import Path
from typing import Optional
import boto3
from botocore.exceptions import ClientError
from backend.app.core.config import settings

class StorageService:
    def __init__(self):
        self.backend = settings.STORAGE_BACKEND
        self.local_dir = Path(settings.LOCAL_STORAGE_DIR)
        self.local_dir.mkdir(parents=True, exist_ok=True)
        
        self.s3_client = None
        if self.backend == "s3":
            try:
                self.s3_client = boto3.client(
                    "s3",
                    endpoint_url=settings.S3_ENDPOINT_URL,
                    aws_access_key_id=settings.S3_ACCESS_KEY,
                    aws_secret_access_key=settings.S3_SECRET_KEY,
                    region_name=settings.S3_REGION_NAME
                )
                # Check / create bucket
                try:
                    self.s3_client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
                except ClientError:
                    self.s3_client.create_bucket(Bucket=settings.S3_BUCKET_NAME)
            except Exception as e:
                print(f"[StorageService] Warning: Could not connect to S3 ({e}). Falling back to local storage.")
                self.backend = "local"

    def put_file(self, file_bytes: bytes, key: str, content_type: str = "image/jpeg") -> str:
        """Stores bytes under key and returns key or URI."""
        if self.backend == "s3" and self.s3_client:
            self.s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=content_type
            )
            return key
        else:
            dest_path = self.local_dir / key
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(file_bytes)
            return key

    def get_file(self, key: str) -> bytes:
        """Reads file bytes from storage."""
        if self.backend == "s3" and self.s3_client:
            resp = self.s3_client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            return resp["Body"].read()
        else:
            dest_path = self.local_dir / key
            if not dest_path.exists():
                raise FileNotFoundError(f"Storage key not found: {key}")
            return dest_path.read_bytes()

    def file_exists(self, key: str) -> bool:
        """Checks if file exists in storage."""
        if self.backend == "s3" and self.s3_client:
            try:
                self.s3_client.head_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
                return True
            except ClientError:
                return False
        else:
            return (self.local_dir / key).exists()

    def get_local_path(self, key: str) -> str:
        """Returns local absolute path. If S3, writes temp file if needed."""
        dest_path = self.local_dir / key
        if not dest_path.exists() and self.backend == "s3" and self.s3_client:
            data = self.get_file(key)
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(data)
        return str(dest_path)

storage_service = StorageService()
