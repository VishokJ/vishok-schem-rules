#!/usr/bin/env python3

import os
import sys
import json
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env from the script's directory
script_dir = Path(__file__).parent
env_path = script_dir / '.env'
load_dotenv(env_path)

class SupabaseIntegration:
    def __init__(self):
        # Read and normalize credentials from environment (same pattern as test_supabase.py)
        self.supabase_url = (
            os.getenv('NEXT_PUBLIC_SUPABASE_URL')
            or os.getenv('SUPABASE_URL')
            or ""
        ).strip().strip('"').strip("'")
        
        self.supabase_key = (
            os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
            or os.getenv('SUPABASE_ANON_KEY')
            or ""
        ).strip().strip('"').strip("'")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Missing Supabase credentials in environment variables")
        
        try:
            # Canonical client creation (same pattern as test_supabase.py)
            print(f"Debug: Creating Supabase client with URL: {self.supabase_url[:50]}...", file=sys.stderr)
            print(f"Debug: Key length: {len(self.supabase_key)}", file=sys.stderr)
            
            self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
            print("Debug: Supabase client created successfully", file=sys.stderr)
        except Exception as e:
            print(f"Error creating Supabase client: {e}")
            print(f"Error type: {type(e)}")
            print(f"Error args: {e.args}")
            raise
    
    def create_checklist(self, part_name: str, part_id: str) -> str:
        """Create a new checklist in the schematic_checklist table"""
        try:
            checklist_uuid = str(uuid.uuid4())
            checklist_data = {
                'uuid': checklist_uuid,
                'name': part_name,
                'part_id': part_id,
                'is_generated': True,
                'is_deleted': False,
                'is_public': True,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table('schematic_checklist').insert(checklist_data).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]['uuid']
            else:
                raise Exception("Failed to create checklist - no data returned")
                
        except Exception as e:
            print(f"Error creating checklist: {e}")
            raise
    
    def create_rules(self, checklist_id: str, rules: List[Dict[str, Any]]) -> List[str]:
        """Create rules in the schematic_rule table"""
        try:
            rule_ids = []
            
            for rule in rules:
                rule_uuid = str(uuid.uuid4())
                rule_data = {
                    'uuid': rule_uuid,
                    'content': rule.get('rule', ''),
                    'is_deleted': False,
                    'checklist_id': checklist_id,
                    'category': rule.get('category', 'Uncategorized'),
                    'level': 'ESSENTIAL' if rule.get('essential', False) else 'RECOMMENDED',
                    'pins': rule.get('pins', []),
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                
                result = self.supabase.table('schematic_rule').insert(rule_data).execute()
                
                if result.data and len(result.data) > 0:
                    rule_ids.append(result.data[0]['uuid'])
                else:
                    print(f"Warning: Failed to create rule: {rule.get('rule', 'Unknown')[:50]}...")
            
            return rule_ids
            
        except Exception as e:
            print(f"Error creating rules: {e}")
            raise
    
    def create_part(self, part_id: str, datasheet_url: str, pin_table: Optional[List] = None) -> bool:
        """Create or update a part in the schematic_part table"""
        try:
            part_data = {
                'part_id': part_id,
                'part_datasheet_url': datasheet_url,
                'pin_table': pin_table,
                'updated_at': datetime.now().isoformat()
            }
            
            # Check if part already exists
            existing = self.supabase.table('schematic_part').select('part_id').eq('part_id', part_id).execute()
            
            if existing.data and len(existing.data) > 0:
                # Update existing part
                result = self.supabase.table('schematic_part').update(part_data).eq('part_id', part_id).execute()
            else:
                # Create new part
                part_data['created_at'] = datetime.now().isoformat()
                result = self.supabase.table('schematic_part').insert(part_data).execute()
            
            return result.data is not None and len(result.data) > 0
            
        except Exception as e:
            print(f"Error creating/updating part: {e}")
            raise
    
    def process_datasheet_rules(self, part_name: str, rules_data: Dict[str, Any], s3_key: str) -> Dict[str, Any]:
        """Process complete datasheet rules and save to database"""
        try:
            # Extract device info
            device_info = next(iter(rules_data.values())) if rules_data else {}
            rules = device_info.get('checklist', [])
            pin_table = device_info.get('pin', [])
            
            # Create part entry (use S3 key as datasheet URL)
            part_created = self.create_part(part_name, s3_key, pin_table)
            if not part_created:
                raise Exception(f"Failed to create part entry for {part_name}")
            
            # Create checklist
            checklist_id = self.create_checklist(part_name, part_name)
            
            # Create rules
            rule_ids = self.create_rules(checklist_id, rules)
            
            return {
                'success': True,
                'part_name': part_name,
                'checklist_id': checklist_id,
                'rules_created': len(rule_ids),
                'rules_total': len(rules),
                'pin_table_entries': len(pin_table) if pin_table else 0
            }
            
        except Exception as e:
            print(f"Error processing datasheet rules for {part_name}: {e}")
            return {
                'success': False,
                'part_name': part_name,
                'error': str(e)
            }
    
    def update_upload_job(self, job_id: str, status: str, progress: int = None, **kwargs) -> bool:
        """Update upload job status"""
        try:
            update_data = {
                'status': status,
                'updated_at': datetime.now().isoformat()
            }
            
            if progress is not None:
                update_data['progress'] = progress
            
            # Add any additional fields
            update_data.update(kwargs)
            
            result = self.supabase.table('upload_jobs').update(update_data).eq('id', job_id).execute()
            return result.data is not None
            
        except Exception as e:
            print(f"Error updating upload job: {e}")
            return False

def main():
    """Test the integration"""
    integration = SupabaseIntegration()
    
    # Test data
    test_rules = [
        {
            "rule": "Supply voltage VDD must be 3.3V ±10% (2.97V to 3.63V)",
            "category": "Power Supply Voltage",
            "essential": True,
            "pins": ["VDD"]
        },
        {
            "rule": "Connect 100nF decoupling capacitor within 5mm of VDD pin",
            "category": "Decoupling Capacitors", 
            "essential": False,
            "pins": ["VDD"]
        }
    ]
    
    test_data = {
        "test_device": {
            "filename": "test.pdf",
            "pin": [
                ["Pin", "Name", "Type", "Description"],
                ["1", "VDD", "Power", "Positive supply voltage"],
                ["2", "GND", "Power", "Ground"],
                ["3", "IN", "Input", "Analog input"]
            ],
            "checklist": test_rules,
            "footnote": ""
        }
    }
    
    result = integration.process_datasheet_rules(
        "test_device", 
        test_data, 
        "test-org/test.pdf"
    )
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()