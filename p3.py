from playwright.sync_api import sync_playwright
import json
import time
from datetime import datetime
import os

SWIMMERS = [
    {"name": "Anna Abdikeeva", "first": "Anna", "last": "Abdikeeva"},
    {"name": "Valerie Dronova", "first": "Valerie", "last": "Dronova"},
    {"name": "Kexin Liu", "first": "Kexin", "last": "Liu"},
    {"name": "Evelyn Mieszkowski", "first": "Evelyn", "last": "Mieszkowski"}
]

def fetch_swimmer(page, swimmer, swimmer_index):
    start_time = time.time()
    print(f"Fetching times for {swimmer['name']}...")
    
    # Add delay between swimmers to avoid rate limiting (except for first)
    if swimmer_index > 0:
        print(f"  Waiting 3 seconds before next search...")
        time.sleep(3)
    
    # Navigate to the search page fresh each time
    page.goto("https://data.usaswimming.org/datahub/usas/individualsearch")
    
    # Wait for and fill in the first name
    page.get_by_role("textbox", name="First or Preferred Name*").wait_for(timeout=15000)
    page.get_by_role("textbox", name="First or Preferred Name*").fill(swimmer["first"])
    
    # Fill in the last name
    page.get_by_role("textbox", name="Last Name*").fill(swimmer["last"])
    
    # Click search button
    page.get_by_role("button", name="Search", exact=True).click()
    
    # Wait for search results to load
    time.sleep(3)
    
    # Debug: Check what's on the page
    print(f"  Page URL after search: {page.url}")
    
    # Wait for and click "See Results" button
    try:
        # First, let's see how many results came back
        # Look for the results table or any indication of results
        result_buttons = page.get_by_role("button", name="See Results").all()
        print(f"  Found {len(result_buttons)} 'See Results' button(s)")
        
        if len(result_buttons) == 0:
            # Debug: Take screenshot and print page content
            screenshot_name = f"debug_{swimmer['last'].lower()}_{int(time.time())}.png"
            page.screenshot(path=screenshot_name)
            print(f"  Screenshot saved to {screenshot_name}")
            
            # Print some page content for debugging
            body_text = page.locator("body").inner_text()[:1000]
            print(f"  Page content preview: {body_text[:500]}...")
            
            # Check if there's a "no results" message
            if "no results" in body_text.lower() or "not found" in body_text.lower():
                print(f"  Page indicates no results found for {swimmer['name']}")
            
            print(f'No "See Results" button found for {swimmer["name"]}. Skipping.')
            return []
        
        # If multiple results, try to find the right one
        if len(result_buttons) > 1:
            print(f"  Multiple results found, clicking first one")
        
        page.get_by_role("button", name="See Results").first.wait_for(timeout=10000)
        page.get_by_role("button", name="See Results").first.click()
        
    except Exception as e:
        print(f'Error finding "See Results" button for {swimmer["name"]}: {e}')
        # Take debug screenshot
        screenshot_name = f"debug_{swimmer['last'].lower()}_{int(time.time())}.png"
        page.screenshot(path=screenshot_name)
        print(f"  Screenshot saved to {screenshot_name}")
        return []
    
    # Select "All" competition years to get all results
    try:
        # Wait for the dropdown to be fully loaded and interactive
        dropdown = page.get_by_label("Competition Year")
        dropdown.wait_for(state="visible", timeout=5000)
        time.sleep(2)  # Extra wait for dropdown to be fully ready
        
        # Select "All" (-1 value)
        dropdown.select_option("-1")
        print(f"  Selected 'All' competition years for {swimmer['name']}")
        
        # Verify the selection took effect by checking the selected value
        time.sleep(1)
        selected_value = dropdown.input_value()
        print(f"  Dropdown value after selection: {selected_value}")
        
        # If selection didn't work, try again
        if selected_value != "-1":
            print(f"  Selection didn't work, retrying...")
            time.sleep(2)
            dropdown.select_option("-1")
            time.sleep(1)
            selected_value = dropdown.input_value()
            print(f"  Dropdown value after retry: {selected_value}")
        
        # Wait for table to reload with all data
        time.sleep(5)
        
    except Exception as e:
        print(f"Could not select competition year for {swimmer['name']}: {e}")
    
    # Wait for the table to load
    page.wait_for_selector('table', timeout=15000)
    page.wait_for_selector('tbody tr', timeout=10000)
    time.sleep(2)  # Final wait for content to stabilize
    
    # Find the results table
    tables = page.query_selector_all('table')
    if not tables:
        print(f"No results table found for {swimmer['name']}!")
        return []
    
    # Use the first table (results table)
    table = tables[0]
    rows = table.query_selector_all('tbody tr')
    print(f"  Found {len(rows)} rows for {swimmer['name']}")
    
    results = []
    for row in rows:
        cols = row.query_selector_all('td')
        if len(cols) < 9:
            continue
        
        event = cols[0].inner_text().strip()
        swim_time = cols[1].inner_text().strip()
        age = cols[2].inner_text().strip()
        time_standard = cols[4].inner_text().strip()
        meet = cols[5].inner_text().strip()
        lsc = cols[6].inner_text().strip()
        team = cols[7].inner_text().strip()
        swim_date = cols[8].inner_text().strip()
        
        results.append({
            'name': swimmer["name"],
            'event': event,
            'time': swim_time,
            'age': age,
            'date': swim_date,
            'meet': meet,
            'time_standard': time_standard,
            'lsc': lsc,
            'team': team
        })
    
    elapsed = time.time() - start_time
    print(f"Found {len(results)} results for {swimmer['name']} in {elapsed:.1f}s")
    return results

def main():
    overall_start = time.time()
    all_results = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a more realistic browser context
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        for i, swimmer in enumerate(SWIMMERS):
            try:
                all_results += fetch_swimmer(page, swimmer, i)
            except Exception as e:
                print(f"Error fetching data for {swimmer['name']}: {e}")
                continue
        
        context.close()
        browser.close()
    
    # Sort by last name, then by date (descending)
    def parse_date(date_str):
        """Parse date string MM/DD/YYYY to comparable format"""
        try:
            return datetime.strptime(date_str, '%m/%d/%Y')
        except:
            return datetime.min
    
    all_results.sort(key=lambda r: (r['name'].split()[-1], -parse_date(r['date']).timestamp()))
    
    # Save to JSON (keeping original format for backward compatibility)
    with open('times.json', 'w') as f:
        json.dump(all_results, f, indent=2)
    
    # Also save metadata to a separate file
    metadata = {
        "scraped_at": datetime.now().isoformat(),
        "scraped_at_readable": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "total_results": len(all_results),
        "swimmers": [s["name"] for s in SWIMMERS]
    }
    
    with open('times_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    
    total_elapsed = time.time() - overall_start
    print(f"\nSaved {len(all_results)} results to times.json")
    print(f"Scraped at: {metadata['scraped_at_readable']}")
    print(f"Total duration: {total_elapsed:.1f}s ({total_elapsed/60:.1f} minutes)")

if __name__ == "__main__":
    main()