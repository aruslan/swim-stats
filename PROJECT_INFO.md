# Swim Stats Tracker - Project Documentation

## Project Overview

This project automatically scrapes swimming times for youth swimmers from the USA Swimming website and displays them in an iPhone home screen widget via Scriptable. The system:

- Scrapes swim times daily from USA Swimming's DataHub
- Stores data as JSON on GitHub Pages
- Displays times with motivational time standards (B, BB, A, AA, AAA, AAAA)
- Updates automatically via GitHub Actions at 9pm PST daily
- Shows both official and unofficial times

**Primary Use Case**: Track competitive swimming progress for age-group swimmers (11-14 years old) with instant access to current times via iPhone widget and Apple TV Top Shelf.

---

## GitHub Repository & Deployment

- **Repository**: https://github.com/aruslan/swim-stats
- **GitHub Pages URL**: https://aruslan.io/swim-stats/
- **Main Branch**: `main`

### GitHub Pages Hosted Files

All files are accessible at `https://aruslan.io/swim-stats/[filename]`:

- `times.json` - Current swim times for all swimmers
- `times_metadata.json` - Scraping metadata (timestamp, swimmer count)
- `todayview.remote.js` - Widget code (loaded remotely by Scriptable)
- `motivational_24_girls_11-12.json` - Time standards for 11-12 age group
- `motivational_24_girls_13-14.json` - Time standards for 13-14 age group
- `agc_25_girls.json` - Age Group Champs 2025 time standards for Girls
- `farwestern_25_girls.json` - Far Westerns 2025 time standards for Girls

---

## Data Structure

### times.json Schema

**Format**: Array of swim result objects, sorted by swimmer last name, then date (descending)

**Example**:
```json
[
  {
    "name": "Anna Abdikeeva",
    "event": "50 FR SCY",
    "time": "33.80",
    "age": "12",
    "date": "10/25/2025",
    "meet": "2025 PC BAC Short Course Meet 1",
    "time_standard": "B",
    "lsc": "PC",
    "team": "Burlingame Aquatic Club"
  },
  {
    "name": "Anna Abdikeeva",
    "event": "100 FR SCY",
    "time": "1:14.46",
    "age": "12",
    "date": "10/26/2025",
    "meet": "2025 PC BAC Short Course Meet 1",
    "time_standard": "B",
    "lsc": "PC",
    "team": "Burlingame Aquatic Club"
  }
]
```

**Field Descriptions**:
- `name` (string): Swimmer's full name
- `event` (string): Distance, stroke code, pool type (e.g., "50 FR SCY", "200 IM LCM")
  - Distance: 50, 100, 200, 400, 500, 800, 1000, 1500, 1650
  - Stroke: FR (Freestyle), BK (Backstroke), BR (Breaststroke), FL (Butterfly), IM (Individual Medley)
  - Pool: SCY (Short Course Yards), LCM (Long Course Meters)
- `time` (string): Swim time in MM:SS.SS or SS.SS format
- `age` (string): Swimmer's age at time of swim
- `date` (string): Date of swim in MM/DD/YYYY format
- `meet` (string): Meet name
- `time_standard` (string): USA Swimming motivational time standard achieved (e.g., "B", "BB", "A", "AA", "Slower than B")
- `lsc` (string): Local Swimming Committee code (e.g., "PC" for Pacific Swimming)
- `team` (string): Club/team name

### times_metadata.json Schema

```json
{
  "scraped_at": "2025-11-16T02:20:00.123456",
  "scraped_at_readable": "2025-11-16 02:20:00",
  "total_results": 307,
  "swimmers": [
    "Anna Abdikeeva",
    "Valerie Dronova", 
    "Kexin Liu",
    "Evelyn Mieszkowski"
  ]
}
```

### unofficial_times.json (Optional)

Same schema as `times.json` but for manually-entered unofficial times (if file exists).

---

## Events & Time Standards

### Tracked Events by Stroke

**Freestyle**:
- SCY: 50, 100, 200, 500, 1000, 1650
- LCM: 50, 100, 200, 400, 800, 1500

**Backstroke, Breaststroke, Butterfly**:
- Both SCY and LCM: 50, 100, 200

**Individual Medley**:
- SCY: 100, 200, 400
- LCM: 200, 400

### Widget Display Events

The widget shows a focused subset for better readability:

**Freestyle**: 50, 100, 200, 500 (SCY) | 50, 100, 200, 400 (LCM)
**Back/Breast/Fly**: 50, 100, 200
**IM**: 200, 400

### Age Groups

- **11-12 years old** (uses `motivational_24_girls_11-12.json`)
- **13-14 years old** (uses `motivational_24_girls_13-14.json`)

Age group is determined by swimmer's age parameter (default: 12).

### Motivational Time Standards

Standards follow USA Swimming's 2024 Motivational Times for Girls:

- **AAAA**: Top tier (fastest)
- **AAA**: Advanced
- **AA**: Strong
- **A**: Competitive
- **BB**: Developing
- **B**: Entry level

### Regional Standards
- **AGC**: Age Group Champs (Pacific Swimming)
- **FW**: Far Westerns (Western Zone)

Each event has specific time cutoffs for each standard. Times slower than B standard show as "Slower than B" or no standard.

---

## Swimmers

Currently tracking 4 swimmers:

| Swimmer | Widget Code | Age Group |
|---------|-------------|-----------|
| Anna Abdikeeva | AA | 12 |
| Valerie Dronova | VD | 12-13 |
| Kexin Liu | KL | 12-13 |
| Evelyn Mieszkowski | EM | 11-12 |

**Widget Code Usage**: Used as first parameter in Scriptable widget (e.g., "AA,FR,12" shows Anna's freestyle times for age 12).

---

## File Structure

### Root Directory

```
swim-stats/
├── p3.py                           # Python scraper using Playwright
├── requirements.txt                # Python dependencies
├── todayview.loader.js            # Scriptable widget bootstrap (stored locally on iPhone)
├── todayview.remote.js            # Scriptable widget main code (loaded remotely)
├── times.json                      # Current swim times data
├── times_metadata.json            # Scraping metadata
├── unofficial_times.json          # Optional unofficial times
├── motivational_24_girls_11-12.json  # Time standards for 11-12 age group
├── motivational_24_girls_13-14.json  # Time standards for 13-14 age group
├── agc_25_girls.json               # Regional standards (Age Group Champs)
├── farwestern_25_girls.json        # Regional standards (Far Westerns)
├── standings.loader.js             # Standings widget bootstrap
├── standings.remote.js             # Standings widget remote code
├── standings.standalone.js         # Standings widget (standalone/dev version)
└── .github/
    └── workflows/
        └── update-times.yml       # GitHub Actions workflow
```

### File Descriptions

**p3.py**:
- Playwright-based web scraper
- Searches USA Swimming DataHub for each swimmer
- Selects "All" competition years to get complete history
- Verifies dropdown selection with retry logic
- Exports to `times.json` and `times_metadata.json`
- Run time: ~50-80 seconds for 4 swimmers

**todayview.loader.js**:
- Bootstrap script stored in Scriptable app on iPhone
- Fetches `todayview.remote.js` from GitHub Pages
- Injects widget parameters
- Provides error handling for network issues
- Never needs updating (remote code updates automatically)

**todayview.remote.js**:
- Main widget rendering logic
- Fetches times.json and motivational standards
- Displays 7 rows of swim data with times, standards, and delta to next level
- Shows swimmer name and stroke selector on right side
- Updates automatically when pushed to GitHub

**standings.remote.js / standings.standalone.js**:
- Visualizes comprehensive standings for a specific event
- Shows swimmer rankings against motivational standards (B to AAAA)
- Visual bar chart representation of relative speed
- Supports different strokes, distances, and age groups via parameters

**.github/workflows/update-times.yml**:
- GitHub Actions workflow
- Runs daily at 9pm PST (5am UTC)
- Installs Python, Playwright, and Chromium browser
- Executes p3.py scraper
- Commits updated times.json and times_metadata.json
- Pushes to main branch (triggers GitHub Pages deployment)

**requirements.txt**:
```
playwright
```

---

## Technologies Used

### Backend (Scraping)
- **Python 3.11**
- **Playwright**: Headless browser automation for scraping
  - Uses Chromium browser
  - Handles dynamic content loading
  - Implements retry logic for reliability
- **GitHub Actions**: Automated daily execution
  - Ubuntu latest runner
  - Cron schedule: `0 5 * * *` (9pm PST daily)

### Frontend (Widget)
- **JavaScript (ES6+)**
- **Scriptable iOS App**: Widget framework for iPhone
  - Supports medium-sized home screen widgets
  - Remote code loading capability
  - Native iOS widget rendering

### Hosting & Deployment
- **GitHub Pages**: Static file hosting
- **GitHub Secrets**: Stores `GH_PAT` for automated commits

### Data Source
- **USA Swimming DataHub**: https://data.usaswimming.org/datahub/usas/individualsearch
  - Official USA Swimming times database
  - Public access, no API key required
  - Updates with official meet results

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Daily at 9pm PST                         │
│                   GitHub Actions Workflow                    │
│  1. Install Python + Playwright                             │
│  2. Run p3.py scraper                                       │
│  3. Generate times.json + times_metadata.json               │
│  4. Commit and push to main branch                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Pages                              │
│  Hosts: times.json, todayview.remote.js, standards          │
│  URL: https://aruslan.io/swim-stats/                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              iPhone Scriptable Widget                        │
│  1. todayview.loader.js (local) runs                        │
│  2. Fetches todayview.remote.js from GitHub Pages          │
│  3. Remote code fetches times.json + standards              │
│  4. Renders widget with 7 rows of swim data                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Usage Instructions

### Adding a New Swimmer

1. **Update p3.py** - Add to SWIMMERS list:
   ```python
   {"name": "First Last", "first": "First", "last": "Last"}
   ```

2. **Update todayview.remote.js** - Add to SWIMMERS object:
   ```javascript
   "FL": { name: "First Last" }  // FL = two-letter code
   ```

3. **Commit and push**:
   ```bash
   git add p3.py todayview.remote.js
   git commit -m "Add [Swimmer Name] to tracker"
   git push origin main
   ```

4. **Widget will auto-update** when GitHub Pages refreshes (1-2 minutes)

### Manual Data Update

```bash
# Local testing
python3 p3.py

# Check output
cat times.json | head -20

# If good, commit and push
git add times.json times_metadata.json
git commit -m "Manual data update"
git push origin main
```

### Triggering GitHub Action Manually

1. Go to https://github.com/aruslan/swim-stats/actions
2. Click "Update Swim Times" workflow
3. Click "Run workflow" → Select "main" branch → "Run workflow"

### Updating Widget Code

1. **Edit todayview.remote.js** locally
2. **Test in Scriptable** (optional - widget will auto-update from GitHub)
3. **Commit and push**:
   ```bash
   git add todayview.remote.js
   git commit -m "Update widget display logic"
   git push origin main
   ```
4. **Widget updates automatically** on next refresh (no iPhone changes needed)

### Updating Scraper Logic

1. **Edit p3.py** locally
2. **Test locally**:
   ```bash
   python3 p3.py
   # Should show consistent row counts across multiple runs
   ```
3. **Commit and push**:
   ```bash
   git add p3.py
   git commit -m "Fix scraper issue"
   git push origin main
   ```
4. **Next scheduled run** (9pm PST) uses updated scraper

### iPhone Widget Setup

1. **Install Scriptable** app from App Store
2. **Create new script** named "Swim Widget"
3. **Copy content** from `todayview.loader.js`
4. **Add widget to home screen**:
   - Long press home screen → "+" → Scriptable → Medium widget
   - Edit widget → Script: "Swim Widget"
   - Parameter: `AA,FR,12` (SwimmerCode,StrokeCode,Age)
     - Swimmer: AA, VD, KL, EM
     - Stroke: FR, BK, BR, FL, IM
     - Age: 12, 13, etc.

---

## Troubleshooting

### Scraper Returns Inconsistent Results

**Symptom**: Sometimes gets 9 rows for Anna instead of 35
**Cause**: "All" competition years dropdown selection not taking effect
**Solution**: p3.py now includes dropdown verification and retry logic

### Widget Shows Old Data

**Cause**: iOS caching or GitHub Pages hasn't updated yet
**Solution**: 
- Remove widget and re-add it
- Wait 2-3 minutes for GitHub Pages to update
- Check https://aruslan.io/swim-stats/times.json directly

### GitHub Action Fails

**Check**: 
1. GH_PAT secret is valid (Settings → Secrets → Actions)
2. Action logs at https://github.com/aruslan/swim-stats/actions
3. Playwright browser installation succeeded
4. USA Swimming website structure hasn't changed

### Widget Shows Error

**Check**:
1. GitHub Pages is serving files correctly
2. times.json is valid JSON
3. Network connection on iPhone
4. Scriptable app has network permissions

---

## Development Notes

### Known Limitations

- USA Swimming website can be slow to load (5-10 seconds per swimmer)
- Dropdown selection occasionally fails (now has retry logic)
- Widget displays maximum 7 events (space constraint)
- Only supports Girls age groups 11-12 and 13-14 (can be extended)

### Future Enhancements

- Support for additional age groups (8-10, 15-18, etc.)
- Boys time standards
- Graph/visualization of progress over time
- Meet schedule integration
- Push notifications for new PRs

### Performance Metrics

- **Scraper runtime**: ~50-80 seconds for 4 swimmers
- **GitHub Action total time**: ~1-2 minutes
- **Widget load time**: ~2-3 seconds
- **Data freshness**: Updated daily at 9pm PST

---

## Contact & Maintenance

**Repository Owner**: aruslan
**Last Updated**: December 2025
**Project Status**: Active, daily automated updates

For issues or questions, open an issue on the GitHub repository.
