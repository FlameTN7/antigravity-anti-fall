import { readFile } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLatestModel } from './model-reader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDERER_SRC_PATH = join(__dirname, 'renderer.js');
const BINDING_NAME = '__modelRouterBadgeBinding';
const CONV_DIR = join(homedir(), '.gemini', 'antigravity', 'conversations');

function getProfileDir() {
  if (process.env.ANTIGRAVITY_CONFIG_DIR) return process.env.ANTIGRAVITY_CONFIG_DIR;
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Antigravity');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Antigravity');
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'Antigravity');
}

class CDPSession {
  constructor(url, onClose) {
    this.url = url;
    this.onClose = onClose;
    this.nextId = 0;
    this.pending = new Map();
    this.activeConvId = null;
    this.closed = false;
  }

  async connect(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const t = setTimeout(() => { ws.close(); reject(new Error('CDP connect timeout')); }, timeout);

      ws.addEventListener('open', () => {
        clearTimeout(t);
        resolve();
      }, { once: true });

      ws.addEventListener('error', (err) => {
        clearTimeout(t);
        reject(err);
      }, { once: true });

      ws.addEventListener('close', () => {
        this.dispose();
      });

      ws.addEventListener('message', (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch { return; }

        if (msg.id) {
          const item = this.pending.get(msg.id);
          if (item) {
            this.pending.delete(msg.id);
            clearTimeout(item.timer);
            if (msg.error) item.reject(new Error(msg.error.message));
            else item.resolve(msg.result || {});
          }
        } else if (msg.method === 'Runtime.bindingCalled' && msg.params?.name === BINDING_NAME) {
          try {
            const payload = JSON.parse(msg.params.payload);
            if (payload.type === 'route_change' && payload.convId) {
              this.activeConvId = payload.convId;
              this.pushLatestModel();
            }
          } catch {}
        }
      });
    });
  }

  send(method, params = {}, timeout = 6000) {
    if (this.closed || !this.ws || this.ws.readyState !== 1) {
      return Promise.reject(new Error('WS not connected'));
    }
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timeout`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async init(rendererScript) {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Runtime.addBinding', { name: BINDING_NAME });
    
    // Inject renderer script
    await this.send('Runtime.evaluate', {
      expression: rendererScript,
      awaitPromise: false
    });

    // Check current window location
    const res = await this.send('Runtime.evaluate', {
      expression: 'window.location.pathname',
      returnByValue: true
    });
    const path = res?.result?.value;
    if (typeof path === 'string') {
      const match = path.match(/\/c\/([a-zA-Z0-9_-]+)/);
      if (match) {
        this.activeConvId = match[1];
        this.pushLatestModel();
      }
    }
  }

  pushLatestModel() {
    if (!this.activeConvId || this.closed) return;
    const modelData = getLatestModel(this.activeConvId);
    if (!modelData) return;

    this.send('Runtime.evaluate', {
      expression: `window.__updateRoutedModelBadge && window.__updateRoutedModelBadge(${JSON.stringify(modelData)})`
    }).catch(() => {});
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('Session closed'));
    }
    this.pending.clear();
    this.onClose?.(this);
  }
}

class ModelRouterBadgeDaemon {
  constructor() {
    this.sessions = new Map(); // wsUrl -> CDPSession
    this.rendererScript = '';
    this.pollTimer = null;
    this.fsWatcher = null;
  }

  async start() {
    try {
      this.rendererScript = await readFile(RENDERER_SRC_PATH, 'utf8');
    } catch (err) {
      console.error('[badge-daemon] Failed to read renderer script:', err.message);
      return;
    }

    console.log('[badge-daemon] Starting Model Router Badge daemon...');
    
    // Initial connection loop
    this.tick();
    this.pollTimer = setInterval(() => this.tick(), 2500);

    // Watch conversations directory
    this.startDbWatcher();
  }

  startDbWatcher() {
    if (!existsSync(CONV_DIR)) return;

    let debounceTimer = null;
    try {
      this.fsWatcher = watch(CONV_DIR, (eventType, filename) => {
        if (!filename || (!filename.endsWith('.db') && !filename.endsWith('.db-wal'))) return;
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.broadcastUpdate();
        }, 300);
      });
    } catch (err) {
      console.warn('[badge-daemon] fs.watch not supported on conv dir, falling back to interval:', err.message);
    }

    // Interval broadcast fallback every 1500ms
    setInterval(() => {
      this.broadcastUpdate();
    }, 1500);
  }

  broadcastUpdate() {
    for (const session of this.sessions.values()) {
      session.pushLatestModel();
    }
  }

  async tick() {
    try {
      const portFile = join(getProfileDir(), 'DevToolsActivePort');
      if (!existsSync(portFile)) return;

      const content = await readFile(portFile, 'utf8');
      const port = parseInt(content.split(/\r?\n/)[0], 10);
      if (!port || port < 1 || port > 65535) return;

      const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(2000)
      });
      const list = await res.json();

      const appWindows = list.filter(t => 
        t.type === 'page' && 
        typeof t.url === 'string' && 
        t.url.includes('/c/') &&
        t.webSocketDebuggerUrl
      );

      const activeUrls = new Set(appWindows.map(w => w.webSocketDebuggerUrl));

      // Clean up stale sessions
      for (const [url, session] of this.sessions) {
        if (!activeUrls.has(url)) {
          session.dispose();
          this.sessions.delete(url);
        }
      }

      // Attach new sessions
      for (const win of appWindows) {
        if (this.sessions.has(win.webSocketDebuggerUrl)) continue;

        const session = new CDPSession(win.webSocketDebuggerUrl, () => {
          this.sessions.delete(win.webSocketDebuggerUrl);
        });

        try {
          await session.connect();
          await session.init(this.rendererScript);
          this.sessions.set(win.webSocketDebuggerUrl, session);
          console.log(`[badge-daemon] Attached and injected badge into window: ${win.title}`);
        } catch (err) {
          session.dispose();
        }
      }
    } catch (err) {
      // Silently retry on next tick
    }
  }
}

const daemon = new ModelRouterBadgeDaemon();
daemon.start();
