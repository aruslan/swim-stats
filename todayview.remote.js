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

const FONT_SIZE = 12;
const ROW_HEIGHT = 19;
const ROW_WIDTH = 280;
const COL_EVENT = 70;
const COL_TIME = 70;
const COL_LEVEL = 32;
const COL_DELTA = 70;
const MAX_DISTANCE = 500;  // Maximum distance to display
const TIMES_URL = "https://aruslan.io/swim-stats/times.json";
const UNOFFICIAL_URL = "https://aruslan.io/swim-stats/unofficial_times.json";
const MOTIVATIONAL_11_12_URL = "https://aruslan.io/swim-stats/motivational_24_girls_11-12.json";
const MOTIVATIONAL_13_14_URL = "https://aruslan.io/swim-stats/motivational_24_girls_13-14.json";

// === PARAMETER PARSING ===
let param = (typeof __widgetParameter !== "undefined" && __widgetParameter !== null
  ? __widgetParameter
  : (args.widgetParameter || "AA,BR,12"))
  .toUpperCase().replace(/\s+/g, "");

let paramArr = param.split(",");
let swimmerKey = paramArr[0] || "AA";
let strokeCode = (paramArr.length >= 2) ? paramArr[1] : "BR";
let swimmerAge = (paramArr.length >= 3 && /^\d+$/.test(paramArr[2])) ? parseInt(paramArr[2], 10) : 12;

if (!SWIMMERS[swimmerKey]) swimmerKey = "AA";
if (!STROKES.includes(strokeCode)) strokeCode = "BR";
let swimmerName = SWIMMERS[swimmerKey].name;

// === DATA LOADING ===
async function fetchJson(url) {
  try { return await new Request(url).loadJSON(); }
  catch (e) { return null; }
}

async function loadMotivational() {
  let [m11_12, m13_14] = await Promise.all([
    fetchJson(MOTIVATIONAL_11_12_URL),
    fetchJson(MOTIVATIONAL_13_14_URL)
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

function fmt(s) { return s || "—"; }

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
      return { text: `${lvl} +${diff.toFixed(2)}`, color: Color.white() };
    }
  }
  for (let i = order.length - 1; i >= 0; i--) {
    let lvl = order[i];
    if (levels[lvl] && time <= parseTime(levels[lvl])) {
      let nextLvl = order[i + 1];
      if (nextLvl && levels[nextLvl]) {
        let diff = parseTime(levels[nextLvl]) - time;
        return { text: `${nextLvl} -${diff.toFixed(2)}`, color: Color.white() };
      }
      break;
    }
  }
  return { text: "", color: Color.white() };
}

// === MAIN ===
async function createWidget() {
  let [timesData, unofficialData, MOTIV] = await Promise.all([
    fetchJson(TIMES_URL),
    fetchJson(UNOFFICIAL_URL),
    loadMotivational()
  ]);
  if (!Array.isArray(timesData) || !MOTIV) {
    let w = new ListWidget();
    w.backgroundColor = new Color("#000");
    let t = w.addText("⚠️ Failed to load data");
    t.font = Font.boldSystemFont(FONT_SIZE);
    t.textColor = Color.red();
    return w;
  }

  const unofficialTimes = Array.isArray(unofficialData)
    ? unofficialData.filter(r => r.name === swimmerName).map(r => ({ ...r, unofficial: true }))
    : [];
  const swimmerTimes = timesData.filter(r => r.name === swimmerName);

  const widget = new ListWidget();
  widget.backgroundColor = new Color("#000");
  widget.setPadding(8, 10, 8, 10);

  const root = widget.addStack();
  root.layoutHorizontally();

  // === LEFT SIDE (table) ===
  const left = root.addStack();
  left.layoutVertically();

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
  
  for (let fmtType of FORMATS_ORDERED) {
    const evList = getEventList(strokeFull, fmtType);
    for (let ev of evList) {
      const levels = MOTIV?.[motivAgeGroup]?.[fmtType]?.[strokeCode]?.[String(ev)];
      if (!levels) continue;
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
      row.size = new Size(ROW_WIDTH, ROW_HEIGHT);
      row.layoutHorizontally();
      row.centerAlignContent();

      // Event column
      const c1 = row.addStack();
      c1.size = new Size(COL_EVENT, ROW_HEIGHT);
      c1.layoutHorizontally();
      c1.centerAlignContent();
      c1.addSpacer();
      const l1 = c1.addText(`${ev} ${fmtType}`);
      l1.font = Font.mediumMonospacedSystemFont(FONT_SIZE);
      l1.textColor = Color.white();

      // Time column with subscript age
      const c2 = row.addStack();
      c2.size = new Size(COL_TIME, ROW_HEIGHT);
      c2.layoutHorizontally();
      c2.centerAlignContent();
      c2.addSpacer();
      
      const l2 = c2.addText(fmt(timeStr));
      l2.font = Font.boldMonospacedSystemFont(FONT_SIZE);
      l2.textColor = isUnofficial ? new Color("#aaa") : Color.white();
      
      // Add subscript (small, visible, slightly raised)
      if (candidate && candidate.date) {
        const daysAgo = daysSince(candidate.date);
        if (daysAgo !== null) {
          const ageText = c2.addText(`₍${daysAgo}₎`);
          ageText.font = Font.systemFont(8);
          ageText.textColor = new Color("#999");
        }
      }

      // Level column
      const c3 = row.addStack();
      c3.size = new Size(COL_LEVEL, ROW_HEIGHT);
      c3.layoutHorizontally();
      c3.centerAlignContent();
      c3.addSpacer();
      let level = (timeSec !== null) ? getMotivationalLevel(timeSec, levels) : "";
      if (level) {
        const l3 = c3.addText(level);
        l3.font = Font.boldSystemFont(FONT_SIZE);
        l3.textColor = isUnofficial ? new Color("#66A786") : new Color("#39C570");
      }

      // Delta column
      const c4 = row.addStack();
      c4.size = new Size(COL_DELTA, ROW_HEIGHT);
      c4.layoutHorizontally();
      c4.centerAlignContent();
      c4.addSpacer();
      const { text: deltaText, color: deltaColor } = (timeSec !== null)
        ? getDelta(timeSec, levels)
        : { text: "", color: Color.white() };
      const l4 = c4.addText(deltaText);
      l4.font = Font.mediumMonospacedSystemFont(FONT_SIZE);
      l4.textColor = isUnofficial ? new Color("#bbb") : deltaColor;
    }
  }

  // === RIGHT SIDE (stroke selection) ===
  const right = root.addStack();
  right.size = new Size(60, 0);
  right.layoutVertically();
  right.centerAlignContent();

  const nameContainer = right.addStack();
  nameContainer.size = new Size(60, 22);
  nameContainer.centerAlignContent();
  const nameText = nameContainer.addText(swimmerName.split(" ")[0]);
  nameText.font = Font.boldSystemFont(FONT_SIZE + 4);
  nameText.textColor = Color.white();
  nameText.centerAlignText();
  right.addSpacer(6);

  for (let sc of STROKES) {
    const srow = right.addStack();
    srow.size = new Size(60, 20);
    srow.centerAlignContent();
    const lab = srow.addText(STROKE_SHORT[sc]);
    lab.font = Font.mediumSystemFont(FONT_SIZE);
    lab.centerAlignText();
    if (sc === strokeCode) {
      srow.backgroundColor = new Color("#39C570");
      lab.textColor = Color.white();
      srow.cornerRadius = 7;
    } else {
      lab.textColor = new Color("#888");
    }
    srow.setPadding(1, 8, 1, 8);
    right.addSpacer(3);
    
    // Add freshness indicator under selected stroke
    if (sc === strokeCode && freshnessDays !== null) {
      const freshnessContainer = right.addStack();
      freshnessContainer.size = new Size(60, 10);
      freshnessContainer.centerAlignContent();
      const freshnessText = freshnessContainer.addText(`${freshnessDays} days ago`);
      freshnessText.font = Font.systemFont(7);
      freshnessText.textColor = new Color("#666");
      freshnessText.centerAlignText();
      right.addSpacer(3);
    }
  }
  return widget;
}

// === RUN ===
(async () => {
  const widget = await createWidget();
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentMedium();
  Script.complete();
})();