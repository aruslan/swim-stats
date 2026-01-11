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
const SPACER_CHAR = USE_DOTS ? "." : "\u00a0";

if (!SWIMMERS[swimmerKey]) swimmerKey = "AA";
if (!STROKES.includes(strokeCode)) strokeCode = "BR";
let swimmerName = SWIMMERS[swimmerKey].name;

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
      achieved = lvl;
    }
  }
  return achieved;
}

function getDelta(time, levels) {
  if (typeof time !== "number" || isNaN(time)) return { text: "", color: Color.white() };
  const order = ["B", "BB", "A", "AA", "AAA", "AAAA"];
  for (let i = 0; i < order.length; i++) {
    let lvl = order[i];
    if (!levels[lvl]) continue;
    if (time > parseTime(levels[lvl])) {
      let diff = time - parseTime(levels[lvl]);
      // Format: "AA+1.23" (7 chars) -> Padded to 8
      return { text: `${lvl}+${diff.toFixed(2)}`, color: Color.white() };
    }
  }
  for (let i = order.length - 1; i >= 0; i--) {
    let lvl = order[i];
    if (levels[lvl] && time <= parseTime(levels[lvl])) {
      let nextLvl = order[i + 1];
      if (nextLvl && levels[nextLvl]) {
        let diff = parseTime(levels[nextLvl]) - time;
        // Format: "AA-1.23" (7 chars) -> Padded to 8
        return { text: `${nextLvl}-${diff.toFixed(2)}`, color: Color.white() };
      }
      break;
    }
  }
  return { text: "", color: Color.white() };
}

function getRegionalQualifications(timeSec, courseCode, strokeCode, dist, agcData, fwData, age) {
  if (timeSec === null) return "";

  // Check FW (Far Westerns) - uses 11-12, 13-14
  let fwAgeGroup = age >= 13 ? "13-14" : "11-12";
  let fwCut = fwData?.Girls?.[fwAgeGroup]?.[courseCode]?.[strokeCode]?.[String(dist)]?.CUT;
  if (fwCut && timeSec <= parseTime(fwCut)) {
    return "FW"; // FW dominates AGC
  }

  // Check AGC (Age Group Champs) - uses single ages 11, 12, 13, 14
  let agcAgeKey = String(age);
  let agcCut = agcData?.Girls?.[agcAgeKey]?.[courseCode]?.[strokeCode]?.[String(dist)]?.CUT;
  if (agcCut && timeSec <= parseTime(agcCut)) {
    return "AGC";
  }

  return "";
}

function getRegionalDelta(timeSec, courseCode, strokeCode, dist, agcData, fwData, age) {
  if (timeSec === null) return { text: "", color: Color.white() };

  // Calculate targets
  let agcAgeKey = String(age);
  let agcCut = agcData?.Girls?.[agcAgeKey]?.[courseCode]?.[strokeCode]?.[String(dist)]?.CUT;
  let agcSec = agcCut ? parseTime(agcCut) : null;

  let fwAgeGroup = age >= 13 ? "13-14" : "11-12";
  let fwCut = fwData?.Girls?.[fwAgeGroup]?.[courseCode]?.[strokeCode]?.[String(dist)]?.CUT;
  let fwSec = fwCut ? parseTime(fwCut) : null;

  // Logic: 
  // If slower than AGC -> Show AGC delta
  // If faster/equal AGC but slower than FW -> Show FW delta
  // If faster/equal FW -> Show nothing (or could show Next Level?)
  // Filter: Only show if within 7 seconds

  if (agcSec && timeSec > agcSec) {
    let diff = timeSec - agcSec;
    if (diff <= 10.0) {
      return { text: `AGC+${diff.toFixed(2)}`, color: Color.white() };
    }
  }

  if (fwSec && timeSec > fwSec) {
    let diff = timeSec - fwSec;
    if (diff <= 10.0) {
      return { text: `FW+${diff.toFixed(2)}`, color: Color.white() };
    }
  }

  return { text: "", color: Color.white() };
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
        const candidate = candidates[0];
        const timeStr = candidate ? candidate.time : "";
        const timeSec = candidate ? parseTime(candidate.time) : null;
        const isUnofficial = candidate ? !!candidate.unofficial : false;

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
        tTime.textColor = isUnofficial ? new Color("#aaa") : Color.white();

        // SPACER 3 (Small) - NEW
        const tSp3 = row.addText(SPACER_CHAR);
        tSp3.font = new Font(FONT_NAME, 8); // Small
        tSp3.textColor = new Color("#666");

        // 5. MOTIVATIONAL (LEFT)
        let level = (timeSec !== null) ? getMotivationalLevel(timeSec, levels) : "";
        const tMotiv = row.addText(pad(level, W_MOTIV, "left"));
        tMotiv.font = new Font(FONT_NAME + "-Bold", FONT_SIZE);
        tMotiv.textColor = isUnofficial ? new Color("#66A786") : new Color("#39C570");



        // 7. MOTIV DELTA (RIGHT now)
        const { text: deltaText, color: deltaColor } = (timeSec !== null)
          ? getDelta(timeSec, levels)
          : { text: "", color: Color.white() };

        const tDelta = row.addText(pad(deltaText, W_DELTA, "right"));
        tDelta.font = new Font(FONT_NAME, FONT_SIZE);
        tDelta.textColor = isUnofficial ? new Color("#bbb") : deltaColor;

        // SPACER 5 (Small)
        const tSp5 = row.addText(SPACER_CHAR);
        tSp5.font = new Font(FONT_NAME, 8); // Small
        tSp5.textColor = new Color("#666");

        // 6. COMBINED REGIONAL + DAYS (Complex Formatting)
        let regionalStr = getRegionalQualifications(timeSec, fmtType, strokeCode, ev, agcData, fwData, swimmerAge) || "";
        let daysStr = "";
        if (candidate && candidate.date) {
          const d = daysSince(candidate.date);
          if (d !== null) daysStr = `${d}`;
        }

        let part1 = regionalStr; // Green part
        let part2 = "";          // Grey part

        // Logic Implementation based on examples:
        // 1. Base needed: len(Reg) + len(Days) + 1 (for 'd')
        // 2. If fits <= 5, pad with dots.
        //    - If Reg is empty: "9d" -> "9d..." (Pad Right)
        //    - If Reg is present: "FW"+"9d" -> "FW.9d" (Pad Middle)
        // 3. If > 5, drop 'd'.
        //    - "FW"+"999"+"d" (6) -> "FW999"
        // 4. If still > 5, truncate Days constraints allowed = 5 - len(Reg).
        //    - "AGC"+"999" (6) -> "AGC99"

        const lenReg = regionalStr.length;
        const lenDays = daysStr.length;

        if (lenReg === 0) {
          // Case 1: No Regional
          // "9d..."
          // "999d."
          let base = daysStr + "d";
          if (base.length <= 5) {
            part2 = base.padEnd(5, ".");
          } else {
            // Should practically not happen for days < 10000, but if so:
            part2 = base.substring(0, 5); // Truncate
          }
        } else {
          // Case 2: Regional Present
          const neededWithD = lenReg + lenDays + 1;

          if (neededWithD <= 5) {
            // Fits with 'd'
            const gap = 5 - neededWithD;
            // "FW.9d" (Gap=1)
            part2 = ".".repeat(gap) + daysStr + "d";
          } else {
            // Try dropping 'd'
            const neededWithoutD = lenReg + lenDays;
            if (neededWithoutD <= 5) {
              // Fits without 'd'
              const gap = 5 - neededWithoutD;
              part2 = ".".repeat(gap) + daysStr;
            } else {
              // Still too long. Truncate Days.
              // "AGC"+"999" -> "AGC99"
              const allowedDays = 5 - lenReg;
              if (allowedDays > 0) {
                part2 = daysStr.substring(0, allowedDays);
              } else {
                // Regional takes all space? (e.g. 5 char regional?)
                // Usually regional is 2 or 3 chars.
                part2 = "";
              }
            }
          }
        }

        // Render Part 1 (Green)
        if (part1) {
          const t1 = row.addText(part1);
          t1.font = new Font(FONT_NAME, 8);
          t1.textColor = new Color("#39C570");
        }

        // Render Part 2 (Grey)
        if (part2) {
          const t2 = row.addText(part2);
          t2.font = new Font(FONT_NAME, 8);
          t2.textColor = new Color("#666");
        }

        // SPACER 6 (Small)
        const tSp6 = row.addText(SPACER_CHAR); // Debug dot
        tSp6.font = new Font(FONT_NAME, 8); // Small
        tSp6.textColor = new Color("#666");

        // 8. REGIONAL DELTA (RIGHT now, Small) - HIDDEN
        /*
        const { text: regDeltaText, color: regDeltaColor } = (timeSec !== null)
          ? getRegionalDelta(timeSec, fmtType, strokeCode, ev, agcData, fwData, swimmerAge)
          : { text: "", color: Color.white() };
        const tRegDelta = row.addText(pad(regDeltaText, W_REG_DELTA, "right"));
        tRegDelta.font = new Font(FONT_NAME, 8); // Small
        tRegDelta.textColor = regDeltaColor;
        */


      }
    }

    // === RIGHT SIDE (stroke selection) ===
    const sidebarStack = root.addStack();
    sidebarStack.layoutVertically();
    // Sidebar styling - mimicking manual padding without spacers
    sidebarStack.setPadding(0, 6, 0, 0);

    const nameContainer = sidebarStack.addStack();
    const nameText = nameContainer.addText(swimmerName.split(" ")[0]);
    nameText.font = new Font(FONT_NAME + "-Bold", 16);
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