// Swimming Standings Widget - Remote Code
// This file is hosted on GitHub Pages and updates automatically
// Loaded by standings.loader.js

const GITHUB_BASE = "https://aruslan.io/swim-stats/";

// Parse widget parameters
const params = (args.widgetParameter || "FR,50,SCY,12").split(",");
const STROKE = params[0] || "FR";
const DISTANCE = params[1] || "50";
const COURSE = params[2] || "SCY";
const AGE = params[3] || "12";

// Determine age group for standards
const AGE_GROUP = parseInt(AGE) <= 12 ? "11-12" : "13-14";

const EVENT = `${DISTANCE} ${STROKE} ${COURSE}`;

// Swimmer display info
const SWIMMERS = {
  "Anna Abdikeeva": { short: "Anna", color: "#3498db" },  // Blue
  "Valerie Dronova": { short: "Val", color: "#2ecc71" },  // Green
  "Kexin Liu": { short: "Kexin", color: "#9b59b6" },      // Purple
  "Evelyn Mieszkowski": { short: "Evie", color: "#e67e22" }  // Orange
};

const STROKE_NAMES = {
  "FR": "Free",
  "BK": "Back",
  "BR": "Breast",
  "FL": "Fly",
  "IM": "IM"
};

// Convert time string to seconds
function timeToSeconds(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    // MM:SS.SS format
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    // SS.SS format
    return parseFloat(timeStr);
  }
}

// Format seconds back to time string
function formatTime(seconds) {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  if (mins > 0) {
    return `${mins}:${secs.padStart(5, '0')}`;
  }
  return secs;
}

// Fetch times data
async function fetchTimes() {
  try {
    const req = new Request(GITHUB_BASE + "times.json");
    const data = await req.loadJSON();
    return data;
  } catch (error) {
    console.error("Error fetching times:", error);
    return null;
  }
}

// Fetch motivational standards
async function fetchStandards() {
  try {
    const filename = `motivational_24_girls_${AGE_GROUP}.json`;
    const req = new Request(GITHUB_BASE + filename);
    const data = await req.loadJSON();
    return data;
  } catch (error) {
    console.error("Error fetching standards:", error);
    return null;
  }
}

// Get best time for a swimmer/event
function getBestTime(timesData, swimmerName, event) {
  const swimmerTimes = timesData.filter(t => 
    t.name === swimmerName && t.event === event
  );
  
  if (swimmerTimes.length === 0) return null;
  
  // Convert all times to seconds and find minimum
  const times = swimmerTimes.map(t => timeToSeconds(t.time)).filter(t => t !== null);
  if (times.length === 0) return null;
  
  return Math.min(...times);
}

// Get standards for an event
function getEventStandards(standardsData, event) {
  if (!standardsData || !standardsData[event]) return null;
  return standardsData[event];
}

// Calculate position on scale (0 = slowest, 1 = fastest)
function calculatePosition(time, standards) {
  if (!time || !standards) return null;
  
  // Get the boundary times for each standard
  const levels = ["AAAA", "AAA", "AA", "A", "BB", "B"];
  const times = levels.map(level => timeToSeconds(standards[level])).filter(t => t !== null);
  
  if (times.length === 0) return null;
  
  const fastest = Math.min(...times);  // AAAA time
  const slowest = Math.max(...times);  // B time
  
  // Add some padding below B
  const paddedSlowest = slowest * 1.15;
  
  // Clamp to range
  if (time >= paddedSlowest) return 0;
  if (time <= fastest) return 1;
  
  // Linear interpolation
  return (paddedSlowest - time) / (paddedSlowest - fastest);
}

// Get current standard level for a time
function getStandardLevel(time, standards) {
  if (!time || !standards) return null;
  
  const levels = ["AAAA", "AAA", "AA", "A", "BB", "B"];
  for (const level of levels) {
    const standardTime = timeToSeconds(standards[level]);
    if (standardTime && time <= standardTime) {
      return level;
    }
  }
  return "B+";  // Slower than B
}

// Create the widget
async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#0f1419");
  widget.setPadding(12, 12, 12, 12);
  
  // Fetch data
  const timesData = await fetchTimes();
  const standardsData = await fetchStandards();
  
  // Title
  const titleStack = widget.addStack();
  titleStack.layoutHorizontally();
  const title = titleStack.addText(`${STROKE_NAMES[STROKE]} ${DISTANCE} ${COURSE}`);
  title.font = Font.boldSystemFont(14);
  title.textColor = Color.white();
  titleStack.addSpacer();
  const ageText = titleStack.addText(`${AGE_GROUP}`);
  ageText.font = Font.systemFont(10);
  ageText.textColor = new Color("#888888");
  
  widget.addSpacer(8);
  
  if (!timesData || !standardsData) {
    const errorText = widget.addText("Data unavailable");
    errorText.font = Font.systemFont(12);
    errorText.textColor = Color.red();
    return widget;
  }
  
  const standards = getEventStandards(standardsData, EVENT);
  if (!standards) {
    const errorText = widget.addText(`No standards for ${EVENT}`);
    errorText.font = Font.systemFont(10);
    errorText.textColor = Color.orange();
    return widget;
  }
  
  // Create visual scale
  const scaleWidth = 300;
  const scaleHeight = 140;
  
  const ctx = new DrawContext();
  ctx.size = new Size(scaleWidth, scaleHeight);
  ctx.opaque = false;
  
  // Scale configuration
  const barX = 60;
  const barWidth = 10;
  const barTop = 15;
  const barBottom = scaleHeight - 25;
  const barHeight = barBottom - barTop;
  
  // Draw the vertical bar
  ctx.setFillColor(new Color("#1a1f26"));
  const barRect = new Rect(barX, barTop, barWidth, barHeight);
  const barPath = new Path();
  barPath.addRoundedRect(barRect, 5, 5);
  ctx.addPath(barPath);
  ctx.fillPath();
  
  // Draw standard level markers
  const levels = ["AAAA", "AAA", "AA", "A", "BB", "B"];
  const levelTimes = levels.map(level => {
    const time = timeToSeconds(standards[level]);
    return { level, time };
  }).filter(l => l.time !== null);
  
  if (levelTimes.length === 0) {
    const errorText = widget.addText("No valid standards");
    errorText.font = Font.systemFont(10);
    errorText.textColor = Color.orange();
    return widget;
  }
  
  const fastest = Math.min(...levelTimes.map(l => l.time));
  const slowest = Math.max(...levelTimes.map(l => l.time));
  const paddedSlowest = slowest * 1.15;
  
  ctx.setFont(Font.boldSystemFont(9));
  ctx.setTextColor(new Color("#aaaaaa"));
  
  levelTimes.forEach(({ level, time }) => {
    const position = (paddedSlowest - time) / (paddedSlowest - fastest);
    const y = barBottom - (position * barHeight);
    
    // Draw tick mark
    ctx.setStrokeColor(new Color("#333333"));
    ctx.setLineWidth(1);
    const tick = new Path();
    tick.move(new Point(barX - 4, y));
    tick.addLine(new Point(barX + barWidth + 4, y));
    ctx.addPath(tick);
    ctx.strokePath();
    
    // Draw level label (left side)
    ctx.drawTextInRect(level, new Rect(5, y - 7, 50, 14));
    
    // Draw time (right side of bar)
    ctx.drawTextInRect(formatTime(time), new Rect(barX + barWidth + 10, y - 7, 60, 14));
  });
  
  // Plot swimmers
  const swimmerNames = Object.keys(SWIMMERS);
  const swimmerData = [];
  
  swimmerNames.forEach((name, index) => {
    const time = getBestTime(timesData, name, EVENT);
    const position = calculatePosition(time, standards);
    const level = getStandardLevel(time, standards);
    
    if (position !== null && time !== null) {
      swimmerData.push({ name, time, position, level, index });
    }
  });
  
  // Sort by position for spacing
  swimmerData.sort((a, b) => b.position - a.position);
  
  // Draw swimmer dots
  swimmerData.forEach((swimmer, displayIndex) => {
    const y = barBottom - (swimmer.position * barHeight);
    const dotX = barX + barWidth + 80 + (displayIndex * 50);
    
    const info = SWIMMERS[swimmer.name];
    const color = new Color(info.color);
    
    // Draw connecting line from bar to dot
    ctx.setStrokeColor(new Color(info.color, 0.3));
    ctx.setLineWidth(1);
    const line = new Path();
    line.move(new Point(barX + barWidth, y));
    line.addLine(new Point(dotX, y));
    ctx.addPath(line);
    ctx.strokePath();
    
    // Draw dot
    ctx.setFillColor(color);
    const dotPath = new Path();
    dotPath.addEllipse(new Rect(dotX - 6, y - 6, 12, 12));
    ctx.addPath(dotPath);
    ctx.fillPath();
    
    // Draw initial in dot
    ctx.setFont(Font.boldSystemFont(8));
    ctx.setTextColor(Color.white());
    const initial = info.short[0];
    ctx.drawTextInRect(initial, new Rect(dotX - 4, y - 5, 10, 10));
  });
  
  // Add the image to widget
  const image = ctx.getImage();
  const imageElement = widget.addImage(image);
  imageElement.centerAlignImage();
  
  widget.addSpacer(4);
  
  // Add legend with swimmer details
  const legendStack = widget.addStack();
  legendStack.layoutHorizontally();
  legendStack.spacing = 8;
  
  swimmerNames.forEach(name => {
    const time = getBestTime(timesData, name, EVENT);
    const level = getStandardLevel(time, standards);
    const info = SWIMMERS[name];
    
    const swimmerStack = legendStack.addStack();
    swimmerStack.layoutVertically();
    swimmerStack.spacing = 1;
    
    // Dot
    const dot = swimmerStack.addText("●");
    dot.font = Font.systemFont(10);
    dot.textColor = new Color(info.color);
    
    // Name
    const nameText = swimmerStack.addText(info.short);
    nameText.font = Font.boldSystemFont(8);
    nameText.textColor = Color.white();
    
    // Time
    if (time) {
      const timeText = swimmerStack.addText(formatTime(time));
      timeText.font = Font.systemFont(7);
      timeText.textColor = new Color("#cccccc");
      
      // Level
      if (level) {
        const levelText = swimmerStack.addText(level);
        levelText.font = Font.boldSystemFont(7);
        levelText.textColor = new Color(info.color);
      }
    } else {
      const noTime = swimmerStack.addText("--");
      noTime.font = Font.systemFont(7);
      noTime.textColor = new Color("#666666");
    }
    
    if (name !== swimmerNames[swimmerNames.length - 1]) {
      legendStack.addSpacer(4);
    }
  });
  
  return widget;
}

// Run the widget
const widget = await createWidget();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}

Script.complete();