// Decide for Windows: a small window around the live Decide site.
// Updates to the site show up here automatically, so this rarely needs a new installer.
const { app, BrowserWindow, shell, nativeTheme, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const SITE = "https://decide-app-531e1.web.app/";
const SITE_ORIGIN = new URL(SITE).origin;
// Firebase pages that may open inside the app (sign-in helpers).
const ALLOWED = [SITE_ORIGIN, "https://decide-app-531e1.firebaseapp.com"];

app.setAppUserModelId("com.decide.app");

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
const stateFile = () => path.join(app.getPath("userData"), "window.json");
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch { return {}; }
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {}
}

const isAllowed = url => { try { return ALLOWED.includes(new URL(url).origin); } catch { return false; } };

function offlinePage() {
  const dark = nativeTheme.shouldUseDarkColors;
  const bg = dark ? "#161616" : "#ffffff", ink = dark ? "#f2f2f2" : "#111111", ink2 = dark ? "#9a9a9a" : "#5a5a5a";
  const html = `<!doctype html><meta charset="utf-8"><title>Decide</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:${bg};color:${ink};font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
h1{font-size:20px;margin:16px 0 6px}p{color:${ink2};margin:0 0 20px}
button{font:inherit;font-weight:600;padding:10px 18px;border-radius:8px;border:0;background:${ink};color:${bg};cursor:pointer}
svg{width:44px;height:44px;stroke:${ink};stroke-width:2.2;stroke-linecap:round;fill:none}</style>
<div><svg viewBox="0 0 24 24"><path d="M6 4v16M10 4v16M14 4v16M18 4v16M3 15l18-7"/></svg>
<h1>You're offline</h1><p>Decide needs the internet. Check your connection.</p>
<button onclick="location.href='${SITE}'">Try again</button></div>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

function createWindow() {
  const s = loadState();
  win = new BrowserWindow({
    width: s.width || 1280, height: s.height || 820, x: s.x, y: s.y,
    minWidth: 380, minHeight: 560,
    title: "Decide",
    icon: path.join(__dirname, "build", "icon.ico"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#161616" : "#ffffff",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  win.setMenuBarVisibility(false);
  if (s.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());

  const ua = win.webContents.getUserAgent() + " DecideDesktop/" + app.getVersion();
  win.webContents.setUserAgent(ua);
  win.loadURL(SITE);

  // Links to other sites open in the normal browser, like Discord does.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) return { action: "allow" };
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("data:")) return;
    if (!isAllowed(url)) { e.preventDefault(); if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); }
  });
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMain) => {
    if (isMain && code !== -3 && !String(url).startsWith("data:")) win.loadURL(offlinePage());
  });
  // Ctrl+R / F5 reload, Ctrl+Shift+I dev tools, Ctrl +/- zoom.
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    if (input.key === "F5" || (ctrl && input.key.toLowerCase() === "r")) { e.preventDefault(); win.loadURL(SITE); }
    else if (ctrl && input.shift && input.key.toLowerCase() === "i") { e.preventDefault(); win.webContents.toggleDevTools(); }
    else if (ctrl && (input.key === "=" || input.key === "+")) { e.preventDefault(); win.webContents.setZoomLevel(Math.min(win.webContents.getZoomLevel() + 0.5, 3)); }
    else if (ctrl && input.key === "-") { e.preventDefault(); win.webContents.setZoomLevel(Math.max(win.webContents.getZoomLevel() - 0.5, -3)); }
    else if (ctrl && input.key === "0") { e.preventDefault(); win.webContents.setZoomLevel(0); }
  });
  // Right-click menu for copy and paste in text boxes.
  win.webContents.on("context-menu", (_e, p) => {
    const items = [];
    if (p.misspelledWord && p.dictionarySuggestions.length) {
      p.dictionarySuggestions.slice(0, 4).forEach(w => items.push({ label: w, click: () => win.webContents.replaceMisspelling(w) }));
      items.push({ type: "separator" });
    }
    if (p.isEditable) items.push({ role: "cut" }, { role: "copy" }, { role: "paste" }, { type: "separator" }, { role: "selectAll" });
    else if (p.selectionText) items.push({ role: "copy" });
    if (p.linkURL) items.push({ label: "Copy link", click: () => require("electron").clipboard.writeText(p.linkURL) });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  win.on("close", saveState);
  win.on("closed", () => { win = null; });
}

app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on("window-all-closed", () => app.quit());
