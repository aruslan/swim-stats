// === Swim Widget Loader with Error Handling ===
// Use as Today View widget in Scriptable

const REMOTE_URL = "https://aruslan.io/swim-stats/todayview.remote.js";
const param = args.widgetParameter;

async function main() {
  let code;
  try {
    code = await new Request(REMOTE_URL).loadString();
  } catch (e) {
    await showErrorWidget(`Failed to download remote script.\n${e}`);
    return;
  }
  try {
    let injected = `let __widgetParameter = ${param ? JSON.stringify(param) : "null"};\n`;
    eval(injected + code);
  } catch (e) {
    await showErrorWidget(`Remote script error:\n${e}`);
  }
}

async function showErrorWidget(msg) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#300");
  widget.setPadding(14, 10, 14, 10);
  const t = widget.addText("⚠️ Swim Widget Error");
  t.font = Font.boldSystemFont(16);
  t.textColor = Color.red();
  widget.addSpacer(6);
  const m = widget.addText(String(msg));
  m.font = Font.systemFont(12);
  m.textColor = Color.white();
  m.lineLimit = 6;
  m.minimumScaleFactor = 0.7;
  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    await widget.presentMedium();
  }
  Script.complete();
}

await main();