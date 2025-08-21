#!/usr/bin/env python3

import os
import sys
from dotenv import load_dotenv

load_dotenv()

def test_supabase_connection():
    """Test basic Supabase connection"""
    print("Testing Supabase connection...")
    
    # Read and normalize credentials from environment
    url = (
        os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        or os.getenv('SUPABASE_URL')
        or ""
    ).strip().strip('"').strip("'")
    key = (
        os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
        or os.getenv('SUPABASE_ANON_KEY')
        or ""
    ).strip().strip('"').strip("'")

    print(f"Supabase URL: {url[:50]}..." if url else "❌ No URL found")
    print(f"Supabase key length: {len(key) if key else 0}")

    if not url or not key:
        print("❌ Missing Supabase credentials (URL and/or KEY)")
        return False

    try:
        # Import and show version
        print("Importing supabase...")
        import supabase
        from supabase import create_client
        print("✅ Import successful")
        print(f"Supabase version: {supabase.__version__}")

        # Canonical client creation
        print("Creating Supabase client...")
        supabase_client = create_client(url, key)
        print("✅ Client created successfully")

        # Basic query
        print("Testing basic query...")
        try:
            result = (
                supabase_client
                .table('schematic_part')
                .select('part_id')
                .limit(1)
                .execute()
            )
            print(f"✅ Query successful: {len(result.data)} rows")
        except Exception as query_error:
            print(f"⚠️ Query failed: {query_error}")
            print("If this is a permissions error, ensure RLS allows anon read or use a service role key in a secure context.")

        return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Connection error: {e}")
        print(f"Error type: {type(e)}")
        print(f"Error args: {e.args}")
        return False

if __name__ == "__main__":
    success = test_supabase_connection()
    sys.exit(0 if success else 1)