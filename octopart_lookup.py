import pandas as pd
import json
import time
import os
import argparse
from scrapingbee import ScrapingBeeClient

url = "https://octopart.com/api/v4/internal"

# Initialize ScrapingBee client
client = ScrapingBeeClient(api_key=os.getenv('SCRAPINGBEE_API_KEY'))

headers = {
    "Host": "octopart.com",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin": "https://octopart.com",
    "Referer": "https://octopart.com/",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Sec-Ch-Ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
}

# Simplified GraphQL query for part lookup
query = """
query UseSearchQuery($country: String!, $currency: String!, $filters: Map, $in_stock_only: Boolean, $has_datasheet_only: Boolean, $limit: Int!, $q: String, $sort: String, $sort_dir: SortDirection, $start: Int) {
  search(
    country: $country
    currency: $currency
    filters: $filters
    in_stock_only: $in_stock_only
    has_datasheet_only: $has_datasheet_only
    limit: $limit
    q: $q
    sort: $sort
    sort_dir: $sort_dir
    start: $start
  ) {
    hits
    results {
      part {
        id
        mpn
        slug
        descriptions {
          text
        }
        manufacturer {
          name
          is_verified
        }
        specs {
          display_value
          attribute {
            id
            name
            shortname
            group
            short_displayname
          }
        }
        median_price_1000 {
          converted_price
          converted_currency
        }
        cad_models {
          has_symbol
          has_footprint
          has_3d_model
        }
        best_datasheet {
          url
        }
        best_image {
          url
        }
      }
    }
  }
}
"""

def fetch_part_data(mpn):
    """Fetch data for a specific MPN"""
    variables = {
        "filters": {},
        "in_stock_only": False,
        "has_datasheet_only": False,
        "currency": "USD",
        "q": mpn,
        "start": 0,
        "country": "CH",
        "limit": 20  # Reduced to meet API requirements
    }

    payload = {
        "query": query,
        "variables": variables,
        "operationName": "UseSearchQuery"
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"🔗 Making request to Octopart API via ScrapingBee (attempt {attempt + 1}/{max_retries})...")
            
            # Use ScrapingBee for proxy rotation and headless browser
            response = client.post(
                url,
                data=json.dumps(payload),
                headers=headers,
                params={
                    'render_js': 'true',  # Enable JavaScript rendering
                    'premium_proxy': 'true',  # Use premium proxy for better success rate
                    'country_code': 'us',  # Use US proxy
                    'wait': 2000,  # Wait 2 seconds for JS to load
                    'block_ads': 'true',  # Block ads for faster loading
                    'block_resources': 'false'  # Allow all resources for GraphQL
                }
            )
            print(f"📡 Response status: {response.status_code}")
            
            if response.ok:
                return response
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                print(f"📄 Response text: {response.text[:500]}...")
                if attempt < max_retries - 1:
                    print(f"🔄 Retrying in 2 seconds...")
                    time.sleep(2)
                    continue
                else:
                    return None
                    
        except Exception as e:
            print(f"❌ ScrapingBee request failed: {e}")
            if attempt < max_retries - 1:
                print(f"🔄 Retrying in 2 seconds...")
                time.sleep(2)
                continue
            else:
                return None
    
    return None

def find_exact_mpn_match(mpn, results):
    """Find the exact MPN match from search results"""
    target_mpn = mpn.upper().strip()
    
    for result in results:
        part = result.get("part", {})
        part_mpn = part.get("mpn", "").upper().strip()
        
        if part_mpn == target_mpn:
            return part
    
    return None

def format_specifications_table(specs):
    """Format specifications into a nice table"""
    if not specs:
        return "No specifications available"
    
    # Create DataFrame for better formatting
    spec_data = []
    for spec in specs:
        if spec and spec.get('attribute') and spec.get('display_value'):
            spec_data.append({
                'Parameter': spec['attribute'].get('name', 'Unknown'),
                'Value': spec['display_value'],
                'Short Name': spec['attribute'].get('shortname', ''),
                'Group': spec['attribute'].get('group', '')
            })
    
    if not spec_data:
        return "No specifications available"
    
    df = pd.DataFrame(spec_data)
    return df.to_markdown(index=False)

def lookup_part(mpn):
    """Look up a specific part by MPN and return detailed information"""
    print(f"🔍 Looking up part: {mpn}")
    
    response = fetch_part_data(mpn)
    if not response or not response.ok:
        print(f"❌ Failed to fetch data for {mpn}")
        return None
    
    try:
        print(f"📄 Parsing JSON response...")
        data = response.json()
        
        if data is None:
            print(f"❌ JSON parsing returned None")
            print(f"📄 Response text: {response.text[:1000]}...")
            return None
            
        print(f"✅ JSON parsed successfully")
        print(f"📊 Response structure: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        
        # Check for GraphQL errors
        if "errors" in data and data["errors"]:
            print(f"❌ GraphQL errors found:")
            for error in data["errors"]:
                print(f"   - {error.get('message', 'Unknown error')}")
            return None
        
        # Check if data is null
        if data.get("data") is None:
            print(f"❌ GraphQL data is null")
            return None
        
        results = data.get("data", {}).get("search", {}).get("results", [])
        
        if not results:
            print(f"❌ No results found for {mpn}")
            print(f"📊 Total hits: {data.get('data', {}).get('search', {}).get('hits', 0)}")
            return None
        
        print(f"📋 Found {len(results)} results")
        
        # Find exact MPN match
        exact_part = find_exact_mpn_match(mpn, results)
        
        if not exact_part:
            print(f"❌ Exact MPN match not found for {mpn}")
            print(f"📋 Available MPNs in results:")
            for i, result in enumerate(results[:5]):  # Show first 5 results
                part = result.get("part", {})
                print(f"   {i+1}. {part.get('mpn', 'N/A')} - {part.get('manufacturer', {}).get('name', 'N/A')}")
            return None
        
        # Extract part information
        part_info = {
            'mpn': exact_part.get('mpn'),
            'id': exact_part.get('id'),
            'slug': exact_part.get('slug'),
            'manufacturer': (exact_part.get('manufacturer', {}) or {}).get('name'),
            'description': '\n'.join([desc.get('text', '') for desc in exact_part.get('descriptions', [])]),
            'price': (exact_part.get('median_price_1000', {}) or {}).get('converted_price'),
            'currency': (exact_part.get('median_price_1000', {}) or {}).get('converted_currency'),
            'datasheet_url': (exact_part.get('best_datasheet', {}) or {}).get('url'),
            'image_url': (exact_part.get('best_image', {'url': None}) or {}).get('url'),
            'cad_models': exact_part.get('cad_models', {}),
            'specifications': exact_part.get('specs', [])
        }
        
        return part_info
        
    except (json.JSONDecodeError, KeyError) as e:
        print(f"❌ Error parsing response: {e}")
        print(f"📄 Response text: {response.text[:1000]}...")
        return None

def display_part_info(part_info):
    """Display formatted part information"""
    if not part_info:
        return
    
    print(f"\n{'='*60}")
    print(f"📦 PART INFORMATION")
    print(f"{'='*60}")
    print(f"MPN: {part_info['mpn']}")
    print(f"ID: {part_info['id']}")
    print(f"Manufacturer: {part_info['manufacturer']}")
    print(f"Price: {part_info['price']} {part_info['currency']}" if part_info['price'] else "Price: Not available")
    print(f"Datasheet: {part_info['datasheet_url']}" if part_info['datasheet_url'] else "Datasheet: Not available")
    print(f"Image: {part_info['image_url']}" if part_info['image_url'] else "Image: Not available")
    
    if part_info['description']:
        print(f"\n📝 Description:")
        print(f"{part_info['description']}")
    
    if part_info['cad_models']:
        cad = part_info['cad_models']
        print(f"\n🎨 CAD Models:")
        print(f"   Symbol: {'✓' if cad.get('has_symbol') else '✗'}")
        print(f"   Footprint: {'✓' if cad.get('has_footprint') else '✗'}")
        print(f"   3D Model: {'✓' if cad.get('has_3d_model') else '✗'}")
    
    if part_info['specifications']:
        print(f"\n📊 Specifications:")
        print(format_specifications_table(part_info['specifications']))
    
    print(f"{'='*60}")

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Look up a specific part by MPN')
    parser.add_argument('--mpn', type=str, required=True, help='Manufacturer Part Number to look up')
    parser.add_argument('--save', action='store_true', help='Save results to MongoDB')
    
    args = parser.parse_args()
    
    # Look up the part
    part_info = lookup_part(args.mpn)
    print(part_info['specifications'])
    # part_info['part_type'] = part_info['specifications']
    # print(part_info)
    
    if part_info:
        # Display the information
        display_part_info(part_info)
    else:
        print(f"❌ Part {args.mpn} not found")

if __name__ == "__main__":
    main()