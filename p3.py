from playwright.sync_api import sync_playwright
import json
import time

SWIMMERS = [
    {"name": "Anna Abdikeeva", "first": "Anna", "last": "Abdikeeva"},
    {"name": "Valerie Dronova", "first": "Valerie", "last": "Dronova"},
    {"name": "Imari Racine", "first": "Imari", "last": "Racine"},
    {"name": "Kexin Liu", "first": "Kexin", "last": "Liu"}
]

def fetch_swimmer(page, swimmer):
    print(f"Fetching times for {swimmer['name']}...")
    page.goto("https://data.usaswimming.org/datahub/usas/individualsearch/times")
    page.wait_for_selector('button:has-text("Individual Times Search")', timeout=10000)
    page.click('button:has-text("Individual Times Search")')
    page.wait_for_selector('input#firstOrPreferredName', timeout=10000)
    page.fill('input#firstOrPreferredName', swimmer["first"])
    page.wait_for_selector('input#lastName', timeout=10000)
    page.fill('input#lastName', swimmer["last"])
    page.press('input#lastName', 'Enter')
    page.wait_for_selector('table tbody tr', timeout=10000)
    time.sleep(1)
    see_results_button = page.query_selector('table tbody tr button:has-text("See results")')
    if not see_results_button:
        print(f'No "See results" button found for {swimmer["name"]}. Skipping.')
        return []
    see_results_button.click()
    page.wait_for_selector('table', timeout=15000)
    time.sleep(2)
    tables = page.query_selector_all('table')
    if not tables:
        print(f"No results table found for {swimmer['name']}!")
        return []
    table = tables[0]
    rows = table.query_selector_all('tbody tr')
    results = []
    for row in rows:
        cols = row.query_selector_all('td')
        if len(cols) < 9:
            continue
        event         = cols[0].inner_text().strip()
        swim_time     = cols[1].inner_text().strip()
        time_standard = cols[4].inner_text().strip()
        meet          = cols[5].inner_text().strip()
        swim_date     = cols[8].inner_text().strip()
        results.append({
            'name': swimmer["name"],
            'event': event,
            'time': swim_time,
            'date': swim_date,
            'meet': meet,
            'time_standard': time_standard
        })
    print(f"Found {len(results)} results for {swimmer['name']}")
    return results

def main():
    all_results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        for swimmer in SWIMMERS:
            all_results += fetch_swimmer(page, swimmer)
        browser.close()
    # Simple, order-preserving sort
    all_results.sort(key=lambda r: tuple(r.values()))
    with open('times.json', 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f"Saved {len(all_results)} results to times.json")

if __name__ == "__main__":
    main()