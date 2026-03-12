// === CONFIG ===
const SWIMMERS = {
  "AA": { name: "Anna Abdikeeva" },
  "VD": { name: "Valerie Dronova" },
  "KL": { name: "Kexin Liu" },
  "EM": { name: "Evelyn Mieszkowski" }
};
const STROKES = ["BR", "FR", "FL", "BK", "IM"];
const STROKE_LABELS = {
  "FR": "Freestyle",
  "BK": "Backstroke",
  "BR": "Breaststroke",
  "FL": "Butterfly",
  "IM": "IM"
};
const STROKE_SHORT = {
  "FR": "Free", "BK": "Back", "BR": "Breast", "FL": "Fly", "IM": "IM"
};

const FONT_SIZE = 14;
const FONT_NAME = "Menlo";

// Column width constants (in characters)
const W_DIST = 3;  // "500" (Right)
const W_COURSE = 3;  // "SCY" (Left)
const W_TIME = 7;  // " 1:21.62" (Right)
const W_DAYS = 5;  // " (165)" (Left)
const W_MOTIV = 2;  // "AA" (Right)
const W_REG = 3;  // " AGC" (Left)
const W_DELTA = 8; // "BB+0.20" -> " BB+0.20" / "BB+10.00" (Right)
const W_REG_DELTA = 9;  // " AGC +5.00" (Left)

const MAX_DISTANCE = 500;  // Maximum distance to display
const TIMES_URL = "https://aruslan.io/swim-stats/times.json";
const UNOFFICIAL_URL = "https://aruslan.io/swim-stats/unofficial_times.json";
const MOTIVATIONAL_11_12_URL = "https://aruslan.io/swim-stats/motivational_24_girls_11-12.json";
const MOTIVATIONAL_13_14_URL = "https://aruslan.io/swim-stats/motivational_24_girls_13-14.json";
const AGC_URL = "https://aruslan.io/swim-stats/agc_25_girls.json";
const FW_URL = "https://aruslan.io/swim-stats/farwestern_25_girls.json";

// === PARAMETER PARSING ===
let param = (typeof __widgetParameter !== "undefined" && __widgetParameter !== null
  ? __widgetParameter
  : (args.widgetParameter || "AA,BR,12"))
  .toUpperCase().replace(/\s+/g, "");

let paramArr = param.split(",");
let swimmerKey = paramArr[0] || "AA";
let strokeCode = (paramArr.length >= 2) ? paramArr[1] : "BR";
let swimmerAge = (paramArr.length >= 3 && /^\d+$/.test(paramArr[2])) ? parseInt(paramArr[2], 10) : 12;
// Extract flags (4th parameter, index 3). Supports sparse arrays e.g. "VD,,,d"
const flags = paramArr[3] || "";
const USE_DOTS = flags.includes("D");
const USE_NCAA = !flags.includes("F"); // Enabled by default, 'F' (Factual) overrides
const SPACER_CHAR = USE_DOTS ? "." : "\u00a0";

if (!SWIMMERS[swimmerKey]) swimmerKey = "AA";

if (!STROKES.includes(strokeCode)) strokeCode = "BR";
let swimmerName = SWIMMERS[swimmerKey].name;

// === NCAA CONVERSION ===
// Based on 2023-24 NCAA Women's Division I Conversion Factors (LCM to SCY).
// LCM * Factor = SCY  =>  SCY / Factor = LCM.
const NCAA_WOMEN_FACTORS = {
  "50": 0.881,
  "100": 0.884,
  "200": 0.884,
  "400": 1.122,  // 500y to 400m
  "500": 1.122,  // mapped for convenience
  "800": 1.13,   // 1000y to 800m
  "1000": 1.13,  // mapped for convenience
  "1500": 0.985, // 1650y to 1500m
  "1650": 0.985, // mapped for convenience
  "BK_100": 0.863, "BK_200": 0.867,
  "BR_100": 0.88,  "BR_200": 0.888,
  "FL_100": 0.887, "FL_200": 0.891,
  "IM_200": 0.877, "IM_400": 0.886
};

function getNCAAConversionFactor(distanceSCY, strokeCode) {
  const d = String(distanceSCY);
  if (strokeCode === "FR") return NCAA_WOMEN_FACTORS[d] || 0.906;
  const key = `${strokeCode}_${d}`;
  return NCAA_WOMEN_FACTORS[key] || NCAA_WOMEN_FACTORS[d] || 0.906;
}

// Formats a raw numerical time in seconds back to M:SS.SS or SS.SS
function formatTime(seconds) {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    let secs = (seconds % 60).toFixed(2);
    if (seconds % 60 < 10) secs = "0" + secs;
    return `${mins}:${secs}`;
  }
  return seconds.toFixed(2);
}

function shortenStandard(label) {
  if (label === "AAAA") return "4A";
  return label;
}


// === DATA LOADING ===
const CACHE_DIR = FileManager.local().joinPath(FileManager.local().documentsDirectory(), "swim_stats_cache");

async function fetchWithCache(url, cacheKey) {
  const fm = FileManager.local();
  if (!fm.fileExists(CACHE_DIR)) fm.createDirectory(CACHE_DIR, true);
  const cachePath = fm.joinPath(CACHE_DIR, cacheKey + ".json");

  // Try network with timeout
  try {
    let req = new Request(url);
    req.timeoutInterval = 5; // 5 seconds timeout
    let json = await req.loadJSON();
    // Save to cache
    fm.writeString(cachePath, JSON.stringify(json));
    return json;
  } catch (e) {
    console.error(`Fetch failed for ${url}: ${e}`);
    // Fallback to cache
    if (fm.fileExists(cachePath)) {
      console.log(`Using cache for ${cacheKey}`);
      try {
        return JSON.parse(fm.readString(cachePath));
      } catch (parseErr) {
        console.error(`Cache parse failed: ${parseErr}`);
        return null;
      }
    }
    return null;
  }
}

async function loadMotivational() {
  let [m11_12, m13_14] = await Promise.all([
    fetchWithCache(MOTIVATIONAL_11_12_URL, "motiv_11_12"),
    fetchWithCache(MOTIVATIONAL_13_14_URL, "motiv_13_14")
  ]);
  let MOTIV = {};
  if (m11_12?.Girls?.["11-12"]) MOTIV["11-12"] = m11_12.Girls["11-12"];
  if (m13_14?.Girls?.["13-14"]) MOTIV["13-14"] = m13_14.Girls["13-14"];
  return MOTIV;
}

function parseTime(s) {
  if (!s) return null;
  s = String(s);
  if (s.includes(':')) {
    let [m, sec] = s.split(':');
    return parseInt(m) * 60 + parseFloat(sec);
  }
  return parseFloat(s);
}

function parseDate(dateStr) {
  // Parse MM/DD/YYYY format
  if (!dateStr) return null;
  try {
    const [month, day, year] = dateStr.split('/').map(n => parseInt(n, 10));
    return new Date(year, month - 1, day);
  } catch (e) {
    return null;
  }
}

function daysSince(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return null;
  const now = new Date();
  const diff = now - date;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}


function pad(str, len, align = "right") {
  str = String(str);
  const diff = len - str.length;
  if (diff <= 0) return str;
  const spaces = SPACER_CHAR.repeat(diff);
  return align === "left" ? str + spaces : spaces + str;
}

function fmt(s) { return String(s || "—").trim(); }

// Get events from motivational standards, filtered by MAX_DISTANCE
function getEventList(strokeFull, fmtType) {
  if (strokeFull === "Freestyle") {
    if (fmtType === "SCY") return [50, 100, 200, 500, 1000, 1650].filter(d => d <= MAX_DISTANCE);
    if (fmtType === "LCM") return [50, 100, 200, 400, 800, 1500].filter(d => d <= MAX_DISTANCE);
  }
  if (strokeFull === "Backstroke" || strokeFull === "Breaststroke" || strokeFull === "Butterfly") {
    return [50, 100, 200].filter(d => d <= MAX_DISTANCE);
  }
  if (strokeFull === "IM") {
    if (fmtType === "SCY") return [100, 200, 400].filter(d => d <= MAX_DISTANCE);
    if (fmtType === "LCM") return [200, 400].filter(d => d <= MAX_DISTANCE);
  }
  return [];
}

function getMotivationalLevel(time, levels) {
  const order = ["B", "BB", "A", "AA", "AAA", "AAAA"];
  let achieved = "";
  for (let i = 0; i < order.length; i++) {
    const lvl = order[i];
    if (!levels[lvl]) continue;
    if (time <= parseTime(levels[lvl])) {
      achieved = shortenStandard(lvl);
    }
  }
  return achieved;
}

function getUnifiedTarget(time, levels, agcData, fwData, age, courseCode, strokeCode, dist) {
  if (typeof time !== "number" || isNaN(time)) return { text: "", color: Color.white() };

  // 1. Collect Standards
  let standards = [];

  // Motivational
  const motivOrder = ["B", "BB", "A", "AA", "AAA", "AAAA"];
  for (let lvl of motivOrder) {
    if (levels[lvl]) standards.push({ label: lvl, time: parseTime(levels[lvl]) });
  }

  // Regional
  let agcAge = String(age);
  let agcCut = agcData?.Girls?.[agcAge]?.[courseCode]?.[strokeCode]?.[String(dist)]?.CUT;
  if (agcCut) standards.push({ label: "AGC", time: parseTime(agcCut) });

  let fwAge = age >= 13 ? "13-14" : "11-12";
  let fwCut = fwData?.Girls?.[fwAge]?.[courseCode]?.[strokeCode]?.[String(dist)]?.CUT;
  if (fwCut) standards.push({ label: "FW", time: parseTime(fwCut) });

  // 2. Sort Descending by Time (Slower -> Faster)
  standards.sort((a, b) => b.time - a.time);

  // 3. Find Next Target
  for (let std of standards) {
    if (time > std.time) {
      let diff = time - std.time;
      // "FW+1.23", "4A+6.3"
      return { text: `${shortenStandard(std.label)}+${diff.toFixed(2)}`, color: Color.white() };
    }

  }

  return { text: "", color: Color.white() };
}

function getRegionalStatus(time, agcData, fwData, age, courseCode, strokeCode, dist) {
  if (time === null) return "";

  // 1. Check Far Westerns (Higher Standard)
  let fwAge = age >= 13 ? "13-14" : "11-12";
  let fwCut = fwData?.Girls?.[fwAge]?.[courseCode]?.[strokeCode]?.[String(dist)]?.CUT;
  if (fwCut && time <= parseTime(fwCut)) return "FW";

  // 2. Check Age Group Champs
  let agcAge = String(age);
  let agcCut = agcData?.Girls?.[agcAge]?.[courseCode]?.[strokeCode]?.[String(dist)]?.CUT;
  if (agcCut && time <= parseTime(agcCut)) return "AGC";

  return "";
}

// === MAIN ===
async function createWidget() {
  try {
    let [timesData, unofficialData, MOTIV, agcData, fwData] = await Promise.all([
      fetchWithCache(TIMES_URL, "times"),
      fetchWithCache(UNOFFICIAL_URL, "unofficial"),
      loadMotivational(),
      fetchWithCache(AGC_URL, "agc"),
      fetchWithCache(FW_URL, "fw")
    ]);

    const widget = new ListWidget();
    widget.backgroundColor = new Color("#000");

    if (!Array.isArray(timesData)) {
      let t = widget.addText("⚠️ Times data missing");
      t.font = new Font(FONT_NAME + "-Bold", FONT_SIZE);
      t.textColor = Color.red();
      return widget;
    }
    if (!MOTIV || Object.keys(MOTIV).length === 0) {
      let t = widget.addText("⚠️ Motivational data missing");
      t.font = new Font(FONT_NAME + "-Bold", FONT_SIZE);
      t.textColor = Color.red();
      return widget;
    }

    const unofficialTimes = Array.isArray(unofficialData)
      ? unofficialData.filter(r => r.name === swimmerName).map(r => ({ ...r, unofficial: true }))
      : [];
    const swimmerTimes = timesData.filter(r => r.name === swimmerName);

    // Debug: If no times found
    if (swimmerTimes.length === 0 && unofficialTimes.length === 0) {
      // Not an error, but good to know
      // Proceeding... will result in empty table but sidebar should show
    }

    const root = widget.addStack();
    root.layoutHorizontally();

    // === LEFT SIDE (table) ===
    const left = root.addStack();
    left.layoutVertically();
    // left.size = new Size(0, 0); // No size constraint

    const strokeFull = STROKE_LABELS[strokeCode];
    const FORMATS_ORDERED = ["SCY", "LCM"];  // SCY first, then LCM
    let motivAgeGroup = swimmerAge >= 13 ? "13-14" : "11-12";

    // Calculate freshness: most recent result for this swimmer and stroke
    const strokeResults = swimmerTimes.filter(r => r.event.includes(strokeCode));
    let freshnessDays = null;
    if (strokeResults.length > 0) {
      const mostRecentDate = strokeResults
        .map(r => parseDate(r.date))
        .filter(d => d !== null)
        .sort((a, b) => b - a)[0];
      if (mostRecentDate) {
        const now = new Date();
        freshnessDays = Math.floor((now - mostRecentDate) / (1000 * 60 * 60 * 24));
      }
    }

    let rowCount = 0;
    for (let fmtType of FORMATS_ORDERED) {
      const evList = getEventList(strokeFull, fmtType);
      for (let ev of evList) {
        const levels = MOTIV?.[motivAgeGroup]?.[fmtType]?.[strokeCode]?.[String(ev)];
        // Even if no motiv standards for this distance, we might want to show it? 
        // Current logic skips if no levels. Keep as is.
        if (!levels) continue;
        rowCount++;

        const wanted = `${ev} ${strokeCode} ${fmtType}`;
        const candidates = swimmerTimes.concat(unofficialTimes)
          .filter(r => r.event === wanted)
          .sort((a, b2) => parseTime(a.time) - parseTime(b2.time));
        
        let candidate = candidates[0];
        let timeStr = candidate ? candidate.time : "";
        let timeSec = candidate ? parseTime(candidate.time) : null;
        let isUnofficial = candidate ? !!candidate.unofficial : false;
        let isNCAAConverted = false;

        // Apply NCAA conversion logic if LCM is requested and it's either missing or older than 180 days
        if (fmtType === "LCM" && USE_NCAA) {
          const daysOldLCM = candidate ? daysSince(candidate.date) : 999;
          if (daysOldLCM === null || daysOldLCM > 180) {
            // Find absolute best SCY event (candidates are already sorted fastest-to-slowest)
            let distanceSCY = ev;
            if (strokeCode === "FR") {
              if (ev === 400) distanceSCY = 500;
              if (ev === 800) distanceSCY = 1000;
              if (ev === 1500) distanceSCY = 1650;
            }

            const wantedSCY = `${distanceSCY} ${strokeCode} SCY`;
            const candidatesSCY = swimmerTimes.concat(unofficialTimes)
              .filter(r => r.event === wantedSCY)
              .sort((a, b) => parseTime(a.time) - parseTime(b.time));

            if (candidatesSCY.length > 0) {
              const candidateSCY = candidatesSCY[0];
              
              const scyTimeSec = parseTime(candidateSCY.time);
              const factor = getNCAAConversionFactor(distanceSCY, strokeCode);
              
              // Formula: SCY / Factor = LCM
              timeSec = scyTimeSec / factor;
              timeStr = formatTime(timeSec);
              
              candidate = candidateSCY;
              isUnofficial = !!candidateSCY.unofficial;
              isNCAAConverted = true;
            }
          }
        }
        
        // ROW
        const row = left.addStack();
        row.layoutHorizontally();
        row.centerAlignContent();
        row.spacing = 0; // Remove default spacing between columns to fit content


        // 1. DISTANCE (Right)
        const tDist = row.addText(pad(ev, W_DIST, "right"));
        tDist.font = new Font(FONT_NAME, FONT_SIZE);
        tDist.textColor = Color.white();

        // 2. COURSE (Left)
        // Removed spacer, strict width
        const tCourse = row.addText(pad(fmtType, W_COURSE, "left"));
        tCourse.font = new Font(FONT_NAME, 12);

        // SPACER 2 (Regular) - KEEPER
        const tSp2 = row.addText(SPACER_CHAR);
        tSp2.font = new Font(FONT_NAME, FONT_SIZE); // Regular (FONT_SIZE)
        tSp2.textColor = new Color("#666");

        // 3. TIME (Right)
        const tTime = row.addText(pad(fmt(timeStr), W_TIME, "right"));
        tTime.font = new Font(FONT_NAME + "-Bold", FONT_SIZE);
        tTime.textColor = (isUnofficial || isNCAAConverted) ? new Color("#aaa") : Color.white();

        // SPACER 3 (Small) - NEW
        const tSp3 = row.addText(SPACER_CHAR);
        tSp3.font = new Font(FONT_NAME, 8); // Small
        tSp3.textColor = new Color("#666");

        // 5. MOTIVATIONAL (LEFT)
        let level = (timeSec !== null) ? getMotivationalLevel(timeSec, levels) : "";
        const tMotiv = row.addText(pad(level, W_MOTIV, "left"));
        tMotiv.font = new Font(FONT_NAME + "-Bold", FONT_SIZE);
        tMotiv.textColor = (isUnofficial || isNCAAConverted) ? new Color("#66A786") : new Color("#39C570");



        // 7. UNIFIED TARGET DELTA (RIGHT)
        const { text: deltaText, color: deltaColor } = (timeSec !== null)
          ? getUnifiedTarget(timeSec, levels, agcData, fwData, swimmerAge, fmtType, strokeCode, ev)
          : { text: "", color: Color.white() };

        const tDelta = row.addText(pad(deltaText, W_DELTA, "right"));
        tDelta.font = new Font(FONT_NAME, FONT_SIZE);
        tDelta.textColor = (isUnofficial || isNCAAConverted) ? new Color("#bbb") : deltaColor;

        // SPACER 5 (Small)
        const tSp5 = row.addText(SPACER_CHAR);
        tSp5.font = new Font(FONT_NAME, 8); // Small
        tSp5.textColor = new Color("#666");

        // 6. COMBINED REGIONAL STATUS + DAYS
        let regionalStr = getRegionalStatus(timeSec, agcData, fwData, swimmerAge, fmtType, strokeCode, ev) || "";
        let daysStr = "";
        if (candidate && candidate.date) {
          const d = daysSince(candidate.date);
          if (d !== null) daysStr = `${d}`;
        }

        // Status Row (Left part Green, Right part Grey)
        // "FWAGC" (Green) + "123d" (Grey) or "NCAA"

        let part1 = regionalStr;
        let part2 = "";
        
        if (isNCAAConverted) {
          part2 = "NCAA";
        } else if (daysStr) {
          part2 = daysStr + "d";
        }

        // Check fit? 
        // User said: "left side ... shows ... FWAGC or nothing"
        // "right side ... shows whatever fits from 123d"
        // We will display them as two texts in a stack for tight layout?
        // Or just assume column matches.

        if (part1) {
          const t1 = row.addText(part1);
          t1.font = new Font(FONT_NAME, 8);
          t1.textColor = new Color("#39C570");
        }

        if (part2) {
          const t2 = row.addText(part2);
          t2.font = new Font(FONT_NAME, 8);
          t2.textColor = isNCAAConverted ? new Color("#cc0000") : new Color("#666");
        }



      }
    }

    // === RIGHT SIDE (stroke selection) ===
    const sidebarStack = root.addStack();
    sidebarStack.layoutVertically();
    // Sidebar styling - mimicking manual padding without spacers
    sidebarStack.setPadding(0, 6, 0, 0);

    const nameContainer = sidebarStack.addStack();
    const nameText = nameContainer.addText(swimmerName.split(" ")[0].slice(0, 4) + "." + swimmerAge);
    nameText.font = new Font(FONT_NAME + "-Bold", FONT_SIZE);
    nameText.textColor = Color.white();

    for (let sc of STROKES) {
      const srow = sidebarStack.addStack();
      // Removed fixed pixel size, using content padding
      const lab = srow.addText(STROKE_SHORT[sc]);
      lab.font = new Font(FONT_NAME, FONT_SIZE);

      if (sc === strokeCode) {
        srow.backgroundColor = new Color("#39C570");
        lab.textColor = Color.white();
        srow.cornerRadius = 4;
        srow.setPadding(2, 4, 2, 4);
      } else {
        lab.textColor = new Color("#888");
        srow.setPadding(2, 4, 2, 4);
      }

      // Add freshness indicator under selected stroke
      if (sc === strokeCode && freshnessDays !== null) {
        const freshnessContainer = sidebarStack.addStack();
        const freshnessText = freshnessContainer.addText(`${freshnessDays}d v3`);
        freshnessText.font = new Font(FONT_NAME, 8);
        freshnessText.textColor = new Color("#aaa");


      }
    }
    return widget;

  } catch (e) {
    const w = new ListWidget();
    w.addText(`Error: ${e}`);
    return w;
  }
}

// === RUN ===
(async () => {
  try {
    const widget = await createWidget();
    if (config.runsInWidget) Script.setWidget(widget);
    else await widget.presentMedium();
  } catch (e) {
    console.error(e);
  }
  Script.complete();
})();