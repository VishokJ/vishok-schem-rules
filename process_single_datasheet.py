#!/usr/bin/env python3

import sys
import json
import os
import tempfile
import boto3
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Import our existing modules
from rules_runner import run_one
from supabase_integration import SupabaseIntegration

# Load .env from the script's directory
script_dir = Path(__file__).parent
env_path = script_dir / '.env'
load_dotenv(env_path)

def download_from_s3(s3_key, temp_dir):
    """Download file from S3 to temporary directory"""
    try:
        s3_client = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        temp_file = temp_dir / Path(s3_key).name
        print(f"Debug: Downloading {s3_key} to {temp_file}", file=sys.stderr)
        
        s3_client.download_file(
            os.getenv('S3_BUCKET_NAME'),
            s3_key,
            str(temp_file)
        )
        
        print(f"Debug: Successfully downloaded file", file=sys.stderr)
        return temp_file
        
    except Exception as e:
        print(f"Error downloading from S3: {e}", file=sys.stderr)
        return None

def upload_output_to_s3(output_data, s3_key, organization):
    """Upload the generated rules JSON to S3"""
    try:
        s3_client = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        # Generate output key in organization/output/ folder
        org_folder = s3_key.split('/')[0]  # Get organization folder
        part_name = Path(s3_key).stem  # Get filename without extension
        
        # Save to organization/output/partname.json
        output_key = f"{org_folder}/output/{part_name}.json"
        
        # Upload the output
        s3_client.put_object(
            Bucket=os.getenv('S3_BUCKET_NAME'),
            Key=output_key,
            Body=json.dumps(output_data, indent=2),
            ContentType='application/json',
            Metadata={
                'organization': organization,
                'part-name': part_name,
                'generated-timestamp': str(datetime.now().isoformat())
            }
        )
        
        print(f"Debug: Uploaded output to {output_key}", file=sys.stderr)
        return output_key
        
    except Exception as e:
        print(f"Error uploading output to S3: {e}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Usage: python process_single_datasheet.py <processing_data_file>"}))
        sys.exit(1)
    
    processing_file = sys.argv[1]
    print(f"Debug: Processing file: {processing_file}", file=sys.stderr)
    
    try:
        # Read processing data
        print(f"Debug: Reading processing data from {processing_file}", file=sys.stderr)
        with open(processing_file, 'r') as f:
            processing_data = json.load(f)
        
        s3_key = processing_data['s3Key']
        part_id = processing_data['partId']
        organization = processing_data['organization']
        print(f"Debug: s3_key={s3_key}, part_id={part_id}, organization={organization}", file=sys.stderr)
        
        # Create temporary directory
        temp_dir = Path(tempfile.mkdtemp(prefix="datasheet_processing_"))
        
        try:
            # Download file from S3
            datasheet_file = download_from_s3(s3_key, temp_dir)
            if not datasheet_file:
                print(json.dumps({"success": False, "error": "Failed to download datasheet from S3"}))
                sys.exit(1)
            
            # Create output directory for rules_runner
            output_dir = temp_dir / "output"
            output_dir.mkdir(parents=True, exist_ok=True)
            print(f"Debug: Created output directory at {output_dir}", file=sys.stderr)
            
            # Process with rules_runner (passing output_dir directly)
            print(f"Debug: Processing with rules_runner", file=sys.stderr)
            result = run_one(datasheet_file, output_dir)
            print(f"Debug: rules_runner result: {result}", file=sys.stderr)
            
            if result.get("status") != "ok":
                error_msg = result.get("reason", "Failed to extract rules from datasheet")
                print(json.dumps({"success": False, "error": error_msg}))
                return
            
            # Load the generated JSON output
            output_file = Path(result.get("out"))
            if not output_file.exists():
                print(json.dumps({"success": False, "error": "Rules output file not found"}))
                return
            
            rules_data = json.loads(output_file.read_text())
            print(f"Debug: Loaded rules data with {len(rules_data)} entries", file=sys.stderr)
            
            # Upload output to S3
            output_s3_key = upload_output_to_s3(rules_data, s3_key, organization)
            
            # Save to Supabase
            print(f"Debug: Saving to Supabase", file=sys.stderr)
            supabase_integration = SupabaseIntegration()
            db_result = supabase_integration.process_datasheet_rules(
                part_id, rules_data, s3_key
            )
            print(f"Debug: Supabase result: {db_result}", file=sys.stderr)
            
            # Clean up output file
            output_file.unlink()
            
            if db_result.get('success'):
                print(json.dumps({
                    "success": True,
                    "partId": part_id,
                    "checklistId": db_result.get('checklist_id'),
                    "rulesGenerated": db_result.get('rules_created', 0),
                    "s3Key": s3_key,
                    "outputS3Key": output_s3_key
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
        print(json.dumps({"success": False, "error": str(e)}))
        return

if __name__ == "__main__":
    main()