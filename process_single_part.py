#!/usr/bin/env python3

import sys
import json
import os
import tempfile
import requests
import boto3
import re
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Import our existing modules
from octopart_lookup import lookup_part
from rules_runner import run_one
from supabase_integration import SupabaseIntegration

load_dotenv()

def download_datasheet(datasheet_url, filename, temp_dir):
    """Download datasheet from URL to temporary file"""
    try:
        response = requests.get(datasheet_url, timeout=30)
        response.raise_for_status()
        
        temp_file = temp_dir / filename
        temp_file.write_bytes(response.content)
        
        return temp_file
        
    except Exception as e:
        print(f"Error downloading datasheet from {datasheet_url}: {e}", file=sys.stderr)
        return None

def upload_to_s3(file_path, part_name, organization):
    """Upload file to S3 and return the S3 key"""
    try:
        # Clean organization name for S3 folder
        clean_org = re.sub(r'[^a-zA-Z0-9-_]', '-', organization).lower()
        s3_key = f"{clean_org}/{part_name}.pdf"
        
        s3_client = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        s3_client.upload_file(
            str(file_path),
            os.getenv('S3_BUCKET_NAME'),
            s3_key,
            ExtraArgs={
                'ContentType': 'application/pdf',
                'Metadata': {
                    'organization': clean_org,
                    'part-name': part_name,
                    'upload-timestamp': datetime.now().isoformat()
                }
            }
        )
        
        return s3_key
        
    except Exception as e:
        print(f"Error uploading to S3: {e}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Usage: python process_single_part.py <processing_data_file>"}))
        sys.exit(1)
    
    processing_file = sys.argv[1]
    
    try:
        # Read processing data
        with open(processing_file, 'r') as f:
            processing_data = json.load(f)
        
        part_number = processing_data['partNumber']
        organization = processing_data['organization']
        force_refresh = processing_data.get('forceRefresh', False)
        
        # Look up part on Octopart
        part_info = lookup_part(part_number)
        
        if not part_info:
            print(json.dumps({
                "success": False,
                "error": "Part not found on Octopart"
            }))
            sys.exit(1)
        
        datasheet_url = part_info.get('datasheet_url')
        if not datasheet_url:
            print(json.dumps({
                "success": False,
                "error": "No datasheet URL found for part"
            }))
            sys.exit(1)
        
        # Create temporary directory
        temp_dir = Path(tempfile.mkdtemp(prefix="part_processing_"))
        
        try:
            # Download datasheet
            temp_file = download_datasheet(datasheet_url, f"{part_number}.pdf", temp_dir)
            if not temp_file:
                print(json.dumps({
                    "success": False,
                    "error": "Failed to download datasheet"
                }))
                sys.exit(1)
            
            # Upload to S3
            s3_key = upload_to_s3(temp_file, part_number, organization)
            if not s3_key:
                print(json.dumps({
                    "success": False,
                    "error": "Failed to upload datasheet to S3"
                }))
                sys.exit(1)
            
            # Process with rules_runner
            result = run_one(temp_file)
            
            if result.get("status") != "ok":
                print(json.dumps({
                    "success": False,
                    "error": result.get("reason", "Failed to extract rules from datasheet")
                }))
                sys.exit(1)
            
            # Load the generated JSON output
            output_file = Path(result.get("out"))
            if not output_file.exists():
                print(json.dumps({"success": False, "error": "Rules output file not found"}))
                sys.exit(1)
            
            rules_data = json.loads(output_file.read_text())
            
            # Save to Supabase
            supabase_integration = SupabaseIntegration()
            db_result = supabase_integration.process_datasheet_rules(
                part_number, rules_data, s3_key, organization
            )
            
            # Clean up output file
            output_file.unlink()
            
            if db_result.get('success'):
                print(json.dumps({
                    "success": True,
                    "partId": part_number,
                    "checklistId": db_result.get('checklist_id'),
                    "rulesGenerated": db_result.get('rules_created', 0),
                    "s3Key": s3_key,
                    "datasheetUrl": datasheet_url
                }))
            else:
                print(json.dumps({
                    "success": False,
                    "error": db_result.get('error', 'Failed to save to database')
                }))
            
        finally:
            # Clean up temp directory
            import shutil
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
    
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()