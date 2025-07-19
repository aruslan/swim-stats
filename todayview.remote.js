// === CONFIG ===
const SWIMMERS = {
  "AA": { name: "Anna Abdikeeva" },
  "VD": { name: "Valerie Dronova" },
  "IR": { name: "Imari Racine" },
  "KL": { name: "Kexin Liu" }
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

const FONT_SIZE = 13;
const ROW_HEIGHT = 22;
const ROW_WIDTH = 280;
const COL_EVENT = 70;   // Event column width
const COL_TIME = 70;    // Time column width
const COL_LEVEL = 18;   // B/BB column width
const COL_DELTA = 70;   // Delta column width
const TIMES_URL = "https://aruslan.io/swim-stats/times.json";
const UNOFFICIAL_URL = "https://aruslan.io/swim-stats/unofficial_times.json";
const MOTIVATIONAL_11_12_URL = "https://aruslan.io/swim-stats/motivational_24_girls_11-12.json";
const MOTIVATIONAL_13_14_URL = "https://aruslan.io/swim-stats/motivational_24_girls_13-14.json";

// === PARAMETER PARSING ===
let param = (typeof __widgetParameter !== "undefined" && __widgetParameter !== null
  ? __widgetParameter
  : (args.widgetParameter || "AA,FR"))
  .toUpperCase().replace(/\s+/g, "");
let [swimmerKey, ageStr, strokeCode] = param.split(",");
if (!SWIMMERS[swimmerKey]) swimmerKey = "AA";
if (!STROKES.includes(strokeCode)) strokeCode = STROKES[0];
let swimmerName = SWIMMERS[swimmerKey].name;
let swimmerAge = parseInt(ageStr, 10);
if (isNaN(swimmerAge)) swimmerAge = 12;

// === DATA LOADING ===
async function fetchJson(url) {
  try { return await new Request(url).loadJSON(); }
  catch (e) { return null; }
}

// === MOTIVATIONAL LOADING ===
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
function fmt(s) { return s || "—"; }
function getEventList(strokeFull, fmtType) {
  if (strokeFull === "Freestyle") {
    if (fmtType === "SCY") return [50, 100, 200, 400];
    if (fmtType === "LCM") return [50, 100, 200, 400];
  }
  if (strokeFull === "Backstroke" || strokeFull === "Breaststroke" || strokeFull === "Butterfly") {
    return [50, 100, 200];
  }
  if (strokeFull === "IM") {
    if (fmtType === "SCY") return [200, 400];
    if (fmtType === "LCM") return [200, 400];
  }
  return [];
}

// === ФУНКЦИЯ ОПРЕДЕЛЕНИЯ ДОСТИГНУТОГО УРОВНЯ ===
function getMotivationalLevel(time, levels) {
  // Возвращает наивысший достигнутый уровень
  const order = ["B", "BB", "A", "AA", "AAA", "AAAA"];
  let achieved = "";
  for (let lvl of order) {
    if (levels[lvl] && time <= parseTime(levels[lvl])) {
      achieved = lvl;
    }
  }
  return achieved;
}

// === ФУНКЦИЯ ДЕЛЬТЫ ДО СЛЕДУЮЩЕГО УРОВНЯ ===
function getDelta(time, levels) {
  if (typeof time !== "number" || isNaN(time)) return { text: "", color: Color.white() };
  const order = ["B", "BB", "A", "AA", "AAA", "AAAA"];
  // Найти следующий уровень, который НЕ достигнут (первый, где время > норматива)
  for (let i = 0; i < order.length; i++) {
    let lvl = order[i];
    if (!levels[lvl]) continue;
    if (time > parseTime(levels[lvl])) {
      // Разница положительная до этого уровня (например, B +2.13)
      let diff = time - parseTime(levels[lvl]);
      return { text: `${lvl} +${diff.toFixed(2)}`, color: Color.white() };
    }
  }
  // Если уже достигнут B, BB, ... AAAA, покажем дельту до следующего (лучшего) уровня, если есть
  let lastAchievedIdx = -1;
  for (let i = 0; i < order.length; i++) {
    let lvl = order[i];
    if (levels[lvl] && time <= parseTime(levels[lvl])) {
      lastAchievedIdx = i;
    }
  }
  let nextIdx = lastAchievedIdx + 1;
  if (lastAchievedIdx >= 0 && nextIdx < order.length && levels[order[nextIdx]]) {
    let lvl = order[nextIdx];
    let diff = parseTime(levels[lvl]) - time;
    return { text: `${lvl} -${diff.toFixed(2)}`, color: Color.white() };
  }
  // Если уже выше всех (лучше AAAA), пусто
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

  const swimmerTimes = timesData.filter(r => r.name === swimmerName);
  const unofficialTimes = Array.isArray(unofficialData) ?
    unofficialData.filter(r => r.name === swimmerName) : [];
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#000");
  widget.setPadding(10, 10, 10, 10);

  const root = widget.addStack();
  root.layoutHorizontally();

  // === LEFT SIDE (table) ===
  const left = root.addStack();
  left.layoutVertically();

  const strokeFull = STROKE_LABELS[strokeCode];
  const FORMATS_ORDERED = ["LCM", "SCY"];
  let motivAgeGroup = swimmerAge >= 13 ? "13-14" : "11-12";
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
      const isUnofficial = candidate && candidate.unofficial;

      // ROW: All columns right-aligned, fixed widths, no margin
      const row = left.addStack();
      row.size = new Size(ROW_WIDTH, ROW_HEIGHT);
      row.layoutHorizontally();
      row.centerAlignContent();

      // Event column (right-aligned, fixed width, no padding)
      const c1 = row.addStack();
      c1.size = new Size(COL_EVENT, ROW_HEIGHT);
      c1.layoutHorizontally();
      c1.centerAlignContent();
      c1.addSpacer();
      const l1 = c1.addText(`${ev} ${fmtType}`);
      l1.font = Font.mediumMonospacedSystemFont(FONT_SIZE);
      l1.textColor = Color.white();

      // Time column (right-aligned)
      const c2 = row.addStack();
      c2.size = new Size(COL_TIME, ROW_HEIGHT);
      c2.layoutHorizontally();
      c2.centerAlignContent();
      c2.addSpacer();
      const l2 = c2.addText(fmt(timeStr));
      l2.font = Font.boldMonospacedSystemFont(FONT_SIZE);
      l2.textColor = isUnofficial ? new Color("#aaa") : Color.white();

      // Level column (right-aligned, vertically centered)
      const c3 = row.addStack();
      c3.size = new Size(COL_LEVEL, ROW_HEIGHT);
      c3.layoutHorizontally();
      c3.centerAlignContent();
      c3.addSpacer();
      let level = (timeSec !== null) ? getMotivationalLevel(timeSec, levels) : "";
      if (level) {
        const l3 = c3.addText(level);
        l3.font = Font.boldSystemFont(FONT_SIZE);
        l3.textColor = new Color("#39C570");
      }

      // Delta column (right-aligned)
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
      l4.textColor = deltaColor;
    }
  }

  // === RIGHT SIDE (stroke selection) ===
  const right = root.addStack();
  right.size = new Size(60, 0);
  right.layoutVertically();
  right.centerAlignContent();

  // Swimmer's first name (centered)
  const nameContainer = right.addStack();
  nameContainer.size = new Size(60, 22);
  nameContainer.centerAlignContent();
  const nameText = nameContainer.addText(swimmerName.split(" ")[0]);
  nameText.font = Font.boldSystemFont(FONT_SIZE + 4);
  nameText.textColor = Color.white();
  nameText.centerAlignText();
  right.addSpacer(6);

  // Stroke "buttons"
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