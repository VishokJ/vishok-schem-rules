#!/usr/bin/env python3

import json
import argparse
from pathlib import Path
from typing import Dict, Any
from dotenv import load_dotenv

# Import our existing modules
from supabase_integration import SupabaseIntegration

# Load .env from the script's directory
script_dir = Path(__file__).parent
env_path = script_dir / '.env'
load_dotenv(env_path)

def validate_json_structure(data: Dict[str, Any]) -> bool:
    """Validate that the JSON has the expected structure for rules processing"""
    if not isinstance(data, dict):
        return False
    
    # Should have at least one device entry
    if len(data) == 0:
        return False
    
    # Check the first (and typically only) device entry
    device_key = next(iter(data.keys()))
    device_data = data[device_key]
    
    # Must have checklist array (can be empty)
    if 'checklist' not in device_data:
        return False
    
    if not isinstance(device_data['checklist'], list):
        return False
    
    return True

def process_json_file(file_path: Path, supabase_integration: SupabaseIntegration) -> Dict[str, Any]:
    """Process a single JSON file and create checklist/rules in Supabase"""
    try:
        print(f"Processing: {file_path.name}")
        
        # Read and parse JSON
        with open(file_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        # Validate structure
        if not validate_json_structure(json_data):
            return {
                'success': False,
                'error': 'Invalid JSON structure - missing checklist',
                'file': file_path.name
            }
        
        # Extract part name from filename (remove .json extension)
        part_name = file_path.stem
        
        # Get device data (first key in the JSON)
        device_key = next(iter(json_data.keys()))
        device_data = json_data[device_key]
        
        # Extract data
        checklist_rules = device_data.get('checklist', [])
        
        # Skip if no rules to process
        if len(checklist_rules) == 0:
            return {
                'success': True,
                'skipped': True,
                'reason': 'No checklist rules found',
                'file': file_path.name
            }
        
        print(f"  Found {len(checklist_rules)} rules for {part_name}")
        
        # Use the existing process_datasheet_rules method
        # We'll use the file path as a mock S3 key since this is for local processing
        mock_s3_key = f"local/{file_path.name}"
        
        result = supabase_integration.process_datasheet_rules(
            part_name, 
            json_data, 
            mock_s3_key
        )
        
        if result.get('success'):
            if result.get('skipped'):
                print(f"  ↻ Skipped: {result.get('reason', 'Already exists')}")
            else:
                print(f"  ✓ Created checklist with {result.get('rules_created', 0)} rules")
        else:
            print(f"  ✗ Failed: {result.get('error', 'Unknown error')}")
        
        result['file'] = file_path.name
        return result
        
    except json.JSONDecodeError as e:
        return {
            'success': False,
            'error': f'Invalid JSON format: {str(e)}',
            'file': file_path.name
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Processing error: {str(e)}',
            'file': file_path.name
        }

def process_folder(folder_path: Path, dry_run: bool = False) -> None:
    """Process all JSON files in the specified folder"""
    
    if not folder_path.exists():
        print(f"Error: Folder '{folder_path}' does not exist")
        return
    
    if not folder_path.is_dir():
        print(f"Error: '{folder_path}' is not a directory")
        return
    
    # Find all JSON files
    json_files = list(folder_path.glob('*.json'))
    
    if len(json_files) == 0:
        print(f"No JSON files found in '{folder_path}'")
        return
    
    print(f"Found {len(json_files)} JSON files in '{folder_path}'")
    
    if dry_run:
        print("DRY RUN MODE - No changes will be made to the database")
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if validate_json_structure(data):
                    device_key = next(iter(data.keys()))
                    checklist_count = len(data[device_key].get('checklist', []))
                    print(f"  {json_file.name}: {checklist_count} rules")
                else:
                    print(f"  {json_file.name}: Invalid structure")
            except Exception as e:
                print(f"  {json_file.name}: Error reading file - {str(e)}")
        return
    
    # Initialize Supabase integration
    try:
        supabase_integration = SupabaseIntegration()
        print("✓ Connected to Supabase")
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")
        return
    
    # Process each file
    successful = 0
    skipped_no_rules = 0
    skipped_exists = 0
    failed = 0
    
    for json_file in json_files:
        result = process_json_file(json_file, supabase_integration)
        
        if result.get('success'):
            if result.get('skipped'):
                if 'No checklist rules found' in result.get('reason', ''):
                    skipped_no_rules += 1
                else:
                    skipped_exists += 1
            else:
                successful += 1
        else:
            failed += 1
            print(f"  Failed to process {result['file']}: {result.get('error', 'Unknown error')}")
    
    print(f"\nSummary:")
    print(f"  Successfully processed: {successful}")
    print(f"  Skipped (already exists): {skipped_exists}")
    print(f"  Skipped (no rules): {skipped_no_rules}")
    print(f"  Failed: {failed}")
    print(f"  Total files: {len(json_files)}")

def main():
    parser = argparse.ArgumentParser(description='Process JSON rules files and create checklists in Supabase')
    parser.add_argument('folder', help='Folder containing JSON rules files')
    parser.add_argument('--dry-run', action='store_true', help='Preview files without making changes')
    
    args = parser.parse_args()
    
    # Convert to absolute path
    folder_path = Path(args.folder).resolve()
    
    print(f"Processing folder: {folder_path}")
    process_folder(folder_path, dry_run=args.dry_run)

if __name__ == "__main__":
    main()