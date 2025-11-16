// Standings Widget Loader
// This file stays on your iPhone in Scriptable and never needs updating
// It loads the actual widget code from GitHub Pages

const REMOTE_URL = "https://aruslan.io/swim-stats/standings.remote.js";

async function loadRemoteWidget() {
  try {
    // Fetch the remote widget code
    const req = new Request(REMOTE_URL);
    const remoteCode = await req.loadString();
    
    // Inject the widget parameters into the remote code context
    const widgetParams = args.widgetParameter;
    
    // Create a function from the remote code and execute it
    const remoteFunction = new Function('args', 'config', 'Script', remoteCode);
    await remoteFunction(args, config, Script);
    
  } catch (error) {
    // If loading fails, show error widget
    const widget = new ListWidget();
    widget.backgroundColor = new Color("#ff0000", 0.3);
    
    const title = widget.addText("⚠️ Connection Error");
    title.font = Font.boldSystemFont(14);
    title.textColor = Color.white();
    
    widget.addSpacer(4);
    
    const message = widget.addText("Cannot load standings widget");
    message.font = Font.systemFont(11);
    message.textColor = Color.white();
    
    widget.addSpacer(4);
    
    const detail = widget.addText(error.message);
    detail.font = Font.systemFont(9);
    detail.textColor = new Color("#ffcccc");
    detail.minimumScaleFactor = 0.5;
    
    if (config.runsInWidget) {
      Script.setWidget(widget);
    } else {
      await widget.presentMedium();
    }
    
    Script.complete();
  }
}

await loadRemoteWidget();