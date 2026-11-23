// RetroFolio: builder, viewer, and standalone export in one file.
// user text only ever goes through textContent. there is no innerHTML anywhere.

const LIMITS = {
  configBytes: 100000, items: 30, commands: 50, socials: 10, tags: 8, tagLen: 24,
  title: 60, text: 300, body: 5000, bio: 500, handle: 30, osName: 40, bootText: 1200,
  url: 300, cmdName: 24, cmdResponse: 1000, shareChars: 120000,
};
const RESERVED = ['admin', 'api', 'studio', 'edit', 'login', 'www', 'support', 'app', 'static', 'assets', 'null', 'undefined', 'retrofolio'];
const THEMES = ['win95', 'ubuntu', 'amber', 'mac'];
const WALLPAPERS = ['color', 'grid', 'image'];
const FOLDERS = ['Projects', 'About', 'Secrets'];
const KINDS = ['project', 'text', 'secret'];
const SLUG_RE = /^[a-z0-9-]{3,30}$/;
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAIN_HOSTS = ['retrofolio.app', 'www.retrofolio.app', 'retrofolio.duckdns.org', 'localhost', '127.0.0.1'];
const DRAFT_KEY = 'retrofolio:draft';
const CNAME_TARGET = 'cname.retrofolio.app';
const FB_VERSION = '10.12.2';
const GRID_BG = 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)';
// paste your firebase web config here. these values are public, security comes from the rules.
const FIREBASE_CONFIG = { apiKey: 'AIzaSyC6kKX4V5MgeDsDzH9lQjGUZtQXh1wMqHQ', authDomain: 'retrofolio-46409.firebaseapp.com', projectId: 'retrofolio-46409', appId: '1:448603644178:web:ced27a6e348b12092c53cb' };

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const listOf = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const clone = (v) => JSON.parse(JSON.stringify(v));
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  node.append(...children.flat());
  return node;
}
const makePrint = (out) => (text, cls = '') => {
  out.append(el('div', { class: 'line ' + cls, text }));
  out.scrollTop = out.scrollHeight;
};

// strips control chars and caps length. does not trim, so typing still feels normal.
function clampText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
}

function safeUrl(value, max = LIMITS.url) {
  const raw = clampText(value, max).trim();
  if (raw === '') return '';
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch (err) { /* not a url */ }
  return '';
}

const cmdName = (v) => clampText(v, LIMITS.cmdName).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

// ---------- validation (every config goes through this before it renders or saves) ----------
function sanitizeConfig(input) {
  const src = obj(input);
  const cfg = {
    version: 1,
    osName: clampText(src.osName, LIMITS.osName).trim() || 'RETRO-OS v1.0',
    handle: clampText(src.handle, LIMITS.handle).trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    bio: clampText(src.bio, LIMITS.bio),
    bootText: clampText(src.bootText, LIMITS.bootText),
    theme: THEMES.includes(src.theme) ? src.theme : 'ubuntu',
    crt: src.crt === true,
    wallpaper: sanitizeWallpaper(src.wallpaper),
    socials: listOf(src.socials, LIMITS.socials).map(sanitizeSocial).filter(Boolean),
    items: listOf(src.items, LIMITS.items).map(sanitizeItem).filter(Boolean),
    commands: listOf(src.commands, LIMITS.commands).map(sanitizeCommand).filter(Boolean),
  };
  if (JSON.stringify(cfg).length > LIMITS.configBytes) throw new Error('config is too big (100 KB cap)');
  return cfg;
}

function sanitizeWallpaper(raw) {
  const o = obj(raw);
  const type = WALLPAPERS.includes(o.type) ? o.type : 'color';
  if (type === 'image') return { type, value: safeUrl(o.value) };
  const value = HEX_RE.test(o.value) ? o.value : '#008080';
  return { type, value };
}

function sanitizeSocial(raw) {
  const o = obj(raw);
  const label = clampText(o.label, 30).trim();
  const url = safeUrl(o.url);
  return label && url ? { label, url } : null;
}

function sanitizeCommand(raw) {
  const o = obj(raw);
  const name = cmdName(o.name);
  return name ? { name, response: clampText(o.response, LIMITS.cmdResponse) } : null;
}

function sanitizeItem(raw) {
  const o = obj(raw);
  if (KINDS.includes(o.kind) === false) return null;
  let folder = 'Secrets';
  if (o.kind === 'project') folder = 'Projects';
  if (o.kind === 'text') folder = o.folder === 'Projects' ? 'Projects' : 'About';
  return {
    id: clampText(o.id, 40) || uid(),
    kind: o.kind,
    folder,
    title: clampText(o.title, LIMITS.title).trim() || 'untitled',
    description: clampText(o.description, LIMITS.text),
    tags: listOf(o.tags, LIMITS.tags).map((t) => clampText(t, LIMITS.tagLen).trim()).filter(Boolean),
    image: safeUrl(o.image),
    link: safeUrl(o.link),
    body: clampText(o.body, LIMITS.body),
    unlock: cmdName(o.unlock),
  };
}

// ---------- templates ----------
const BLANK = {};
const TEMPLATES = {
  hackerman: {
    label: 'Indie Developer (Ubuntu / Hackerman)',
    config: {
      osName: 'KEANE-OS v1.0', handle: 'keane', theme: 'ubuntu', crt: false,
      bio: 'indie dev. builds small weird tools and games. mostly python and java.',
      bootText: 'KEANE BIOS v1.0\nMemory test ........ 640K OK\nMounting /home/keane ... OK\nLoading desktop ........ OK',
      wallpaper: { type: 'grid', value: '#2b0d24' },
      socials: [{ label: 'github', url: 'https://github.com/keane3029-lab' }],
      items: [
        { kind: 'project', title: 'Void Run 3D', description: 'a 3d space shooter in python using ursina.', tags: ['python', 'ursina'], link: 'https://github.com/keane3029-lab' },
        { kind: 'project', title: 'Familiar', description: 'open source parenting app for android, built in java.', tags: ['java', 'android'], link: 'https://github.com/keane3029-lab/familiar-app' },
        { kind: 'text', folder: 'About', title: 'readme.md', body: 'hi. i build things. try the terminal.' },
        { kind: 'secret', title: 'secret_project.txt', unlock: 'secret', body: 'the thing i keep almost finishing. one day.' },
      ],
      commands: [
        { name: 'neofetch', response: 'OS: KEANE-OS v1.0\nShell: retro-sh\nStack: python, java, firebase, vanilla js' },
        { name: 'hire', response: 'email: you@example.com' },
        { name: 'secret', response: 'shh. access granted. check Secrets/' },
      ],
    },
  },
  win95: {
    label: 'Digital Artist (Classic Windows 95)',
    config: {
      osName: 'WIN95-ART v4.0', handle: 'artist', theme: 'win95', crt: false,
      bio: 'digital artist and comic creator. open for commissions.',
      bootText: 'PASTEL BIOS 4.0\nChecking palettes ... OK\nLoading gallery ..... OK',
      wallpaper: { type: 'grid', value: '#ff9ed2' },
      socials: [],
      items: [
        { kind: 'project', title: 'Piece 01', description: 'sunset city study.', tags: ['digital'], image: 'https://placehold.co/600x400/ff9ed2/333333.png' },
        { kind: 'project', title: 'Piece 02', description: 'comic page, arc 2.', tags: ['comic'], image: 'https://placehold.co/600x400/9ed2ff/333333.png' },
        { kind: 'text', folder: 'About', title: 'Commission Menu.txt', body: 'busts: 500php\nhalf body: 900php\nfull body: 1500php\nturnaround: about 2 weeks' },
        { kind: 'text', folder: 'About', title: 'Terms of Service.txt', body: 'one revision included. full payment before work starts. no refunds after sketch approval.' },
      ],
      commands: [{ name: 'commission', response: 'send a message with your reference and budget.' }],
    },
  },
  lore: {
    label: 'Writer & Lore Worldbuilder (Cyberpunk CRT Amber)',
    config: {
      osName: 'LORE-OS v0.9', handle: 'worldbuilder', theme: 'amber', crt: true,
      bio: 'writing a city that never turns its lights off.',
      bootText: 'ARCHIVE BIOS 0.9\nSignal lock ........ OK\nLoading chapters ... OK',
      wallpaper: { type: 'color', value: '#050300' },
      socials: [],
      items: [
        { kind: 'text', folder: 'About', title: 'chapter_01.md', body: 'chapter one. the rain comes in sideways over district nine.' },
        { kind: 'text', folder: 'About', title: 'dossier_kael.txt', body: 'kael. ex-courier. owes money to the wrong people. remembers everything.' },
        { kind: 'secret', title: 'decoded.txt', unlock: 'decode', body: 'the city was built on top of an older one. the old one is still breathing.' },
        { kind: 'secret', title: 'lore_fragment.txt', unlock: 'lore', body: 'fragment 7: the blackout was a choice, not an accident.' },
        { kind: 'secret', title: 'archive.txt', unlock: 'archive', body: 'the archive keeps every version of everyone who ever asked it to forget.' },
      ],
      commands: [
        { name: 'decode', response: 'decoding... fragment restored. check Secrets/' },
        { name: 'lore', response: 'the lore hums at a frequency you can only hear at night.' },
        { name: 'archive', response: 'archive index loaded. some entries are still locked.' },
      ],
    },
  },
  student: {
    label: 'Minimalist Student / Resume (Macintosh Classic)',
    config: {
      osName: 'MAC OS 9 (student edition)', handle: 'student', theme: 'mac', crt: false,
      bio: 'computer science student. looking for internships.',
      bootText: 'Welcome to Macintosh.\nLoading extensions ... done',
      wallpaper: { type: 'color', value: '#d9d9d9' },
      socials: [{ label: 'email', url: 'https://example.com' }],
      items: [
        { kind: 'project', title: 'Resume.pdf', description: 'my resume. full pdf below.', link: 'https://example.com/resume.pdf' },
        { kind: 'text', folder: 'About', title: 'Skills.txt', body: 'python, java, javascript, sql, git' },
        { kind: 'text', folder: 'About', title: 'Education.txt', body: 'bsc computer science, currently enrolled' },
      ],
      commands: [{ name: 'contact', response: 'email: you@example.com' }],
    },
  },
};

// ---------- share links + firebase ----------
function encodeShare(cfg) {
  const bytes = new TextEncoder().encode(JSON.stringify(cfg));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeShare(raw) {
  if (raw.length > LIMITS.shareChars) throw new Error('link payload too big');
  let b64 = raw.replace(/[^A-Za-z0-9_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return sanitizeConfig(JSON.parse(json));
}

let fbCache = null;
async function firebaseApp() {
  if (fbCache) return fbCache;
  if (FIREBASE_CONFIG.apiKey === 'PASTE_ME') throw new Error('firebase not set up yet. paste your config into FIREBASE_CONFIG in script.js');
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
  const [appMod, authMod, fsMod, fnMod] = await Promise.all([
    import(`${base}firebase-app.js`),
    import(`${base}firebase-auth.js`),
    import(`${base}firebase-firestore.js`),
    import(`${base}firebase-functions.js`),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  fbCache = {
    authMod,
    auth: authMod.getAuth(app),
    db: fsMod.getFirestore(app),
    fs: fsMod,
    functions: fnMod.getFunctions(app),
    fn: fnMod,
  };
  return fbCache;
}

function requireUser(f) {
  const user = f.auth.currentUser;
  if (user === null) throw new Error('sign in first (top right)');
  return user;
}

async function publishSite(rawSlug) {
  const f = await firebaseApp();
  const user = requireUser(f);
  const slug = clampText(rawSlug, 30).trim().toLowerCase();
  if (SLUG_RE.test(slug) === false) throw new Error('handle: 3-30 chars, a-z, 0-9, dash');
  if (RESERVED.includes(slug)) throw new Error('that handle is reserved');
  const cfg = sanitizeConfig(draft);
  const ref = f.fs.doc(f.db, 'sites', slug);
  const snap = await f.fs.getDoc(ref);
  if (snap.exists() && snap.data().ownerUid !== user.uid) throw new Error('that handle is taken');
  await f.fs.setDoc(ref, {
    ownerUid: user.uid, slug, config: JSON.stringify(cfg), published: true, updatedAt: f.fs.serverTimestamp(),
  }, { merge: true });
  return slug;
}

async function bindDomain(rawDomain, rawSlug) {
  const f = await firebaseApp();
  const user = requireUser(f);
  const domain = clampText(rawDomain, 253).trim().toLowerCase();
  const slug = clampText(rawSlug, 30).trim().toLowerCase();
  if (DOMAIN_RE.test(domain) === false) throw new Error('that does not look like a domain');
  if (domain === 'retrofolio.app' || domain.endsWith('.retrofolio.app')) throw new Error('retrofolio subdomains come from handles, not custom domains');
  if (SLUG_RE.test(slug) === false) throw new Error('publish your handle first');
  const ref = f.fs.doc(f.db, 'domains', domain);
  const snap = await f.fs.getDoc(ref);
  if (snap.exists() && snap.data().ownerUid !== user.uid) throw new Error('that domain is already claimed');
  if (snap.exists() && snap.data().verified === true) throw new Error('already verified and live');
  const token = randomToken();
  await f.fs.setDoc(ref, {
    ownerUid: user.uid, slug, verified: false, token, createdAt: f.fs.serverTimestamp(),
  }, { merge: true });
  return { domain, token };
}

async function verifyDomain(domain) {
  const f = await firebaseApp();
  const user = requireUser(f);
  const idToken = await user.getIdToken();
  const res = await fetch('/api/verify-domain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    body: JSON.stringify({ domain }),
  });
  const body = await res.json();
  if (res.ok === false) throw new Error(body.error || 'verify failed');
  return body.verified === true;
}

async function loadBySlug(slug) {
  if (SLUG_RE.test(slug) === false) return null;
  const f = await firebaseApp();
  const snap = await f.fs.getDoc(f.fs.doc(f.db, 'sites', slug));
  if (snap.exists() === false || snap.data().published !== true) return null;
  return sanitizeConfig(JSON.parse(snap.data().config));
}

async function loadByDomain(host) {
  const f = await firebaseApp();
  const snap = await f.fs.getDoc(f.fs.doc(f.db, 'domains', host));
  if (snap.exists() === false || snap.data().verified !== true) return null;
  return loadBySlug(snap.data().slug);
}

// ---------- renderer (shared by builder preview, live viewer, and export) ----------
function applyWallpaper(root, wp) {
  const s = root.style;
  s.backgroundImage = '';
  s.backgroundColor = '';
  s.backgroundSize = '';
  if (wp.type === 'color') s.backgroundColor = wp.value;
  if (wp.type === 'grid') {
    s.backgroundColor = wp.value;
    s.backgroundImage = GRID_BG;
    s.backgroundSize = '24px 24px';
  }
  if (wp.type === 'image' && wp.value) {
    s.backgroundImage = 'url(' + JSON.stringify(wp.value) + ')';
    s.backgroundSize = 'cover';
  }
}

const visibleItems = (os) => os.cfg.items.filter((i) => i.unlock === '' || os.unlocked.has(i.unlock));
const iconBtn = (label, fn) => el('button', { class: 'icon', type: 'button', text: label, onclick: fn });
const winBtn = (label, fn) => el('button', { class: 'wbtn', type: 'button', text: label, onclick: fn });
const focusWin = (os, win) => { win.style.zIndex = String(++os.zTop); };

function renderOS(root, cfg, opts = {}) {
  if (root.clockTimer) clearInterval(root.clockTimer);
  root.textContent = '';
  root.dataset.theme = cfg.theme;
  root.classList.toggle('crt', cfg.crt);
  applyWallpaper(root, cfg.wallpaper);

  const os = { root, cfg, zTop: 10, unlocked: new Set(), open: new Map() };
  os.desktop = el('div', { class: 'desktop' },
    el('div', { class: 'icons' },
      iconBtn('File Explorer', () => openExplorer(os)),
      iconBtn('Terminal', () => openTerminal(os)),
      iconBtn('About Me', () => openAbout(os)),
    ),
  );
  os.startMenu = el('div', { class: 'start-menu hidden' });
  os.openList = el('div', { class: 'task-open' });
  os.clock = el('span', { class: 'clock' });
  const startBtn = el('button', { class: 'start-btn', type: 'button', text: 'start', onclick: () => os.startMenu.classList.toggle('hidden') });
  const taskbar = el('div', { class: 'taskbar' }, startBtn, os.openList, os.clock);
  root.append(os.desktop, os.startMenu, taskbar);

  fillStartMenu(os);
  tickClock(os);
  root.clockTimer = setInterval(() => tickClock(os), 1000);
  if (opts.boot) runBoot(root, cfg.bootText);
  return os;
}

function tickClock(os) {
  os.clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fillStartMenu(os) {
  const menu = os.startMenu;
  menu.textContent = '';
  const add = (label, fn) => menu.append(el('button', { type: 'button', text: label, onclick: () => { menu.classList.add('hidden'); fn(); } }));
  add('File Explorer', () => openExplorer(os));
  add('Terminal', () => openTerminal(os));
  add('About Me', () => openAbout(os));
  visibleItems(os).filter((i) => i.kind === 'project' && i.link).forEach((i) => menu.append(el('a', { href: i.link, target: '_blank', rel: 'noopener noreferrer nofollow', text: '↗ ' + i.title })));
  os.cfg.socials.forEach((s) => menu.append(el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer nofollow', text: '↗ ' + s.label })));
}

function openWindow(os, key, title, build) {
  const existing = os.open.get(key);
  if (existing) { existing.classList.remove('minimized'); focusWin(os, existing); return; }
  const n = os.open.size % 8;
  const win = el('div', { class: 'window' });
  win.dataset.title = title;
  win.style.left = (30 + n * 26) + 'px';
  win.style.top = (20 + n * 22) + 'px';
  const bar = el('div', { class: 'titlebar' },
    el('span', { class: 'win-title', text: title }),
    el('div', { class: 'win-btns' },
      winBtn('_', () => win.classList.toggle('minimized')),
      winBtn('[]', () => win.classList.toggle('maximized')),
      winBtn('x', () => closeWindow(os, key)),
    ),
  );
  const body = el('div', { class: 'win-body' });
  win.append(bar, body);
  os.desktop.append(win);
  os.open.set(key, win);
  build(body, os);
  makeDraggable(win, bar);
  win.addEventListener('pointerdown', () => focusWin(os, win));
  focusWin(os, win);
  renderTaskbar(os);
}

function closeWindow(os, key) {
  const win = os.open.get(key);
  if (win) win.remove();
  os.open.delete(key);
  renderTaskbar(os);
}

function renderTaskbar(os) {
  os.openList.textContent = '';
  for (const win of os.open.values()) {
    os.openList.append(el('button', {
      class: 'task-btn', type: 'button', text: win.dataset.title,
      onclick: () => { win.classList.toggle('minimized'); if (win.classList.contains('minimized') === false) focusWin(os, win); },
    }));
  }
}

function makeDraggable(win, bar) {
  let drag = null;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { x: e.clientX, y: e.clientY, left: win.offsetLeft, top: win.offsetTop };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    win.style.left = Math.max(0, drag.left + e.clientX - drag.x) + 'px';
    win.style.top = Math.max(0, drag.top + e.clientY - drag.y) + 'px';
  });
  const stop = () => { drag = null; };
  bar.addEventListener('pointerup', stop);
  bar.addEventListener('pointercancel', stop);
}

function openExplorer(os) {
  openWindow(os, 'explorer', 'File Explorer', (body) => {
    const crumb = el('div', { class: 'crumb' });
    const grid = el('div', { class: 'file-grid' });
    let current = 'Projects';
    const paint = () => {
      crumb.textContent = '/' + current;
      grid.textContent = '';
      const files = visibleItems(os).filter((i) => i.folder === current);
      if (files.length === 0) {
        grid.append(el('p', { class: 'dim', text: current === 'Secrets' ? 'empty. some things only answer to the right command.' : 'nothing in here yet.' }));
      }
      files.forEach((item) => grid.append(el('button', { class: 'file', type: 'button', text: '📄 ' + item.title, onclick: () => openItem(os, item) })));
    };
    const folders = el('div', { class: 'folders' }, FOLDERS.map((name) => el('button', {
      class: 'folder-btn', type: 'button', text: name, onclick: () => { current = name; paint(); },
    })));
    body.append(folders, crumb, grid);
    os.root.addEventListener('unlock', paint);
    paint();
  });
}

function openItem(os, item) {
  openWindow(os, 'item:' + item.id, item.title, (body) => {
    if (item.kind !== 'project') {
      body.append(el('pre', { class: 'notepad', text: item.body || item.description || '(empty file)' }));
      return;
    }
    body.append(el('p', { class: 'project-desc', text: item.description }));
    if (item.tags.length > 0) body.append(el('div', { class: 'tags' }, item.tags.map((t) => el('span', { class: 'tag', text: t }))));
    if (item.image) {
      const img = el('img', { class: 'project-img', alt: item.title, loading: 'lazy', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', () => img.remove());
      img.src = item.image;
      body.append(img);
    }
    if (item.link) body.append(el('a', { class: 'btn-link', href: item.link, target: '_blank', rel: 'noopener noreferrer nofollow', text: 'open live demo ->' }));
  });
}

function openAbout(os) {
  openWindow(os, 'about', 'About Me', (body) => {
    body.append(
      el('h3', { text: os.cfg.osName }),
      el('p', { text: 'handle: ' + (os.cfg.handle || 'guest') }),
      el('p', { class: 'project-desc', text: os.cfg.bio }),
      ...os.cfg.socials.map((s) => el('a', { class: 'btn-link', href: s.url, target: '_blank', rel: 'noopener noreferrer nofollow', text: s.label + ' ->' })),
    );
  });
}

function openTerminal(os) {
  openWindow(os, 'terminal', 'Terminal', (body) => {
    body.classList.add('terminal');
    const out = el('div', { class: 'term-out' });
    const print = makePrint(out);
    const prompt = el('span', { class: 'prompt', text: (os.cfg.handle || 'guest') + '@retro-os:~$' });
    const field = el('input', { class: 'term-in', type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'terminal input' });
    const past = [];
    let at = 0;
    body.append(out, el('div', { class: 'term-row' }, prompt, field));
    print('type help to see what works.', 'dim');
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const line = field.value;
        field.value = '';
        if (line.trim()) { past.push(line); at = past.length; }
        print(prompt.textContent + ' ' + line, 'echo');
        runCommand(os, line, print, out);
      }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (at > 0) at -= 1; field.value = past[at] || ''; }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (at < past.length) at += 1; field.value = past[at] || ''; }
    });
    body.addEventListener('click', () => field.focus());
    setTimeout(() => field.focus(), 50);
  });
}

function runCommand(os, raw, print, out) {
  const line = clampText(raw, 200).trim();
  if (line === '') return;
  const [name, ...args] = line.toLowerCase().split(/\s+/);
  const visible = visibleItems(os);
  const builtins = {
    help: () => print('built-ins: help ls cat whoami theme clear\ncustom: ' + (os.cfg.commands.map((c) => c.name).join(' ') || '(none yet)')),
    ls: () => FOLDERS.forEach((f) => print(f + '/  ' + visible.filter((i) => i.folder === f).map((i) => i.title).join('   '))),
    cat: () => {
      const target = args.join(' ');
      if (!target) return print('usage: cat <file>', 'err');
      const hit = visible.find((i) => i.title.toLowerCase() === target);
      if (!hit) return print('cat: ' + target + ': no such file', 'err');
      print(hit.kind === 'project' ? [hit.description, hit.link].filter(Boolean).join('\n') : (hit.body || '(empty)'));
    },
    whoami: () => print((os.cfg.handle || 'guest') + (os.cfg.bio ? '\n' + os.cfg.bio : '')),
    theme: () => {
      if (!args[0]) return print('themes: ' + THEMES.join(' ') + ' (this session only)');
      if (THEMES.includes(args[0]) === false) return print('no such theme', 'err');
      os.root.dataset.theme = args[0];
      print('theme -> ' + args[0]);
    },
    clear: () => { out.textContent = ''; },
  };
  if (Object.prototype.hasOwnProperty.call(builtins, name)) return builtins[name]();

  const custom = os.cfg.commands.find((c) => c.name === name);
  const unlocks = os.cfg.items.some((i) => i.unlock === name);
  if (custom) print(custom.response || '(no output)');
  if (unlocks && os.unlocked.has(name) === false) {
    os.unlocked.add(name);
    print('[+] something unlocked. check Secrets/', 'ok');
    os.root.dispatchEvent(new Event('unlock'));
  }
  if (!custom && !unlocks) print('command not found: ' + name + '. try help', 'err');
}

function runBoot(root, text) {
  const lines = String(text || 'RETRO BIOS v1.0\nbooting...').split('\n').slice(0, 40);
  const overlay = el('div', { class: 'boot' });
  root.append(overlay);
  let i = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    overlay.remove();
    document.removeEventListener('keydown', finish);
  };
  overlay.addEventListener('click', finish);
  document.addEventListener('keydown', finish);
  const step = () => {
    if (done) return;
    if (i >= lines.length) { setTimeout(finish, 700); return; }
    overlay.append(el('div', { class: 'boot-line', text: lines[i] }));
    i += 1;
    setTimeout(step, 160);
  };
  step();
}

// ---------- builder ----------
const ui = {};
let draft = null;
let activeTab = 'templates';
let saveTimer = null;
let previewTimer = null;
let toastTimer = null;

function flash(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add('hidden'), 2600);
}

function commit() {
  try { draft = sanitizeConfig(draft); } catch (err) { flash(err.message); return; }
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => renderOS(ui.preview, draft), 150);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (err) { flash('local save failed'); }
  }, 300);
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? sanitizeConfig(JSON.parse(raw)) : null;
  } catch (err) { return null; }
}

function startBuilder() {
  hideHome();
  ui.viewer.classList.add('hidden');
  ui.builder.classList.remove('hidden');
  draft = sanitizeConfig(loadDraft() || clone(TEMPLATES.hackerman.config));
  if (location.hash.startsWith('#data=') && confirm('load the config from this link over your current edits?')) {
    try { draft = decodeShare(location.hash.slice(6)); } catch (err) { flash('bad link: ' + err.message); }
  }
  const modeBtn = $('#mode-toggle');
  modeBtn.addEventListener('click', () => {
    ui.builder.classList.toggle('show-preview');
    modeBtn.textContent = ui.builder.classList.contains('show-preview') ? 'Edit Mode' : 'Live Preview';
  });
  $('#login-btn').addEventListener('click', async () => {
    try {
      const f = await firebaseApp();
      await f.authMod.signInWithPopup(f.auth, new f.authMod.GoogleAuthProvider());
    } catch (err) { flash(err.message); }
  });
  watchAuth();
  renderTabs();
  renderBody();
  renderOS(ui.preview, draft);
}

async function watchAuth() {
  try {
    const f = await firebaseApp();
    f.authMod.onAuthStateChanged(f.auth, (user) => { $('#login-btn').textContent = user ? 'signed in' : 'sign in'; });
  } catch (err) { /* not configured yet, the publish tab explains */ }
}

const TABS = [['templates', 'Templates'], ['profile', 'Profile & Boot'], ['theme', 'Theme'], ['items', 'Desktop Items'], ['commands', 'Commands'], ['publish', 'Publish']];
const VIEWS = { templates: viewTemplates, profile: viewProfile, theme: viewTheme, items: viewItems, commands: viewCommands, publish: viewPublish };

function renderTabs() {
  ui.tabs.textContent = '';
  for (const [key, label] of TABS) {
    ui.tabs.append(el('button', {
      class: 'tab' + (key === activeTab ? ' active' : ''), type: 'button', text: label,
      onclick: () => { activeTab = key; renderTabs(); renderBody(); },
    }));
  }
}

function renderBody() {
  ui.body.textContent = '';
  VIEWS[activeTab](ui.body);
}

const field = (label, control) => el('label', { class: 'field' }, el('span', { text: label }), control);
const input = (value = '', extra = {}) => el('input', { type: 'text', value, ...extra });
const area = (value = '', max = 500) => {
  const t = el('textarea', { maxlength: String(max) });
  t.value = value;
  return t;
};
const btn = (label, fn) => el('button', { class: 'btn', type: 'button', text: label, onclick: fn });
const bind = (control, key) => {
  control.addEventListener('input', () => { draft[key] = control.value; commit(); });
  return control;
};

function downloadBlob(blob, name) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
}

function viewTemplates(host) {
  const load = (cfg, label) => {
    if (confirm('overwrite your current edits with "' + label + '"?') === false) return;
    draft = clone(cfg);
    commit();
    renderBody();
  };
  host.append(el('p', { class: 'dim', text: 'start fresh or load a preset. loading one overwrites your edits, so you get a warning first.' }));
  host.append(btn('Start from scratch', () => load(BLANK, 'blank')));
  for (const t of Object.values(TEMPLATES)) host.append(btn(t.label, () => load(t.config, t.label)));

  const file = el('input', { type: 'file', accept: 'application/json,.json' });
  file.addEventListener('change', async () => {
    const picked = file.files[0];
    if (!picked) return;
    if (picked.size > LIMITS.configBytes) return flash('file is over 100 KB');
    try {
      const cfg = sanitizeConfig(JSON.parse(await picked.text()));
      if (confirm('import this and overwrite your edits?')) { draft = cfg; commit(); renderBody(); }
    } catch (err) { flash('import failed: ' + err.message); }
  });
  host.append(
    el('h3', { text: 'Import / export' }),
    file,
    btn('Export config .json', () => downloadBlob(new Blob([JSON.stringify(sanitizeConfig(draft), null, 2)], { type: 'application/json' }), 'retrofolio-config.json')),
  );
}

function viewProfile(host) {
  host.append(
    field('OS name', bind(input(draft.osName, { maxlength: String(LIMITS.osName) }), 'osName')),
    field('User handle', bind(input(draft.handle, { maxlength: String(LIMITS.handle) }), 'handle')),
    field('Bio', bind(area(draft.bio, LIMITS.bio), 'bio')),
    field('BIOS boot text (one line per row)', bind(area(draft.bootText, LIMITS.bootText), 'bootText')),
    el('h3', { text: 'Social links' }),
    socialsEditor(),
  );
}

function socialsEditor() {
  const rows = el('div', { class: 'col' });
  const label = input('', { placeholder: 'label (github, email...)', maxlength: '30' });
  const url = input('', { placeholder: 'https://...' });
  const paint = () => {
    rows.textContent = '';
    draft.socials.forEach((s, i) => rows.append(el('div', { class: 'row' },
      el('span', { text: s.label + ' -> ' + s.url }),
      el('button', { class: 'mini', type: 'button', text: 'remove', onclick: () => { draft.socials.splice(i, 1); commit(); paint(); } }),
    )));
  };
  paint();
  return el('div', { class: 'col' }, rows, field('Label', label), field('Link', url), btn('Add link', () => {
    const s = sanitizeSocial({ label: label.value, url: url.value });
    if (!s) return flash('need a label and an http(s) link');
    if (draft.socials.length >= LIMITS.socials) return flash('max 10 links');
    draft.socials.push(s);
    label.value = '';
    url.value = '';
    commit();
    paint();
  }));
}

function viewTheme(host) {
  const themeRow = el('div', { class: 'row-wrap' }, THEMES.map((t) => el('button', {
    class: 'tab' + (draft.theme === t ? ' active' : ''), type: 'button', text: t,
    onclick: () => { draft.theme = t; commit(); renderBody(); },
  })));
  const type = el('select', {}, WALLPAPERS.map((w) => el('option', { value: w, text: w })));
  type.value = draft.wallpaper.type;
  const color = el('input', { type: 'color', value: draft.wallpaper.type === 'image' ? '#008080' : draft.wallpaper.value });
  const image = input(draft.wallpaper.type === 'image' ? draft.wallpaper.value : '', { placeholder: 'https://... image url' });
  const applyWp = () => {
    const t = type.value;
    const wp = sanitizeWallpaper({ type: t, value: t === 'image' ? image.value : color.value });
    if (t === 'image' && !wp.value) return flash('image url must be http(s)');
    draft.wallpaper = wp;
    commit();
  };
  type.addEventListener('change', applyWp);
  color.addEventListener('input', applyWp);
  image.addEventListener('change', applyWp);
  const crt = el('input', { type: 'checkbox' });
  crt.checked = draft.crt;
  crt.addEventListener('change', () => { draft.crt = crt.checked; commit(); });
  host.append(
    el('h3', { text: 'Preset theme' }), themeRow,
    field('Wallpaper type', type),
    field('Color (solid or grid)', color),
    field('Image url (when type is image)', image),
    field('CRT scanlines', crt),
  );
}

function viewItems(host) {
  const list = el('div', { class: 'col' });
  const paint = () => {
    list.textContent = '';
    draft.items.forEach((item, i) => list.append(el('div', { class: 'row' },
      el('span', { text: '[' + item.folder + '] ' + item.title + (item.unlock ? '  (unlock: ' + item.unlock + ')' : '') }),
      el('button', { class: 'mini', type: 'button', text: 'remove', onclick: () => { draft.items.splice(i, 1); commit(); paint(); } }),
    )));
    if (draft.items.length === 0) list.append(el('p', { class: 'dim', text: 'no items yet. add a project, a text file, or a secret below.' }));
  };
  const kind = el('select', {}, KINDS.map((k) => el('option', { value: k, text: k })));
  const folder = el('select', {}, [el('option', { value: 'About', text: 'About' }), el('option', { value: 'Projects', text: 'Projects' })]);
  const title = input('', { placeholder: 'title (Void Run 3D or notes.txt)', maxlength: '60' });
  const desc = area('', LIMITS.text);
  const tags = input('', { placeholder: 'tags, comma separated' });
  const image = input('', { placeholder: 'image url (optional)' });
  const link = input('', { placeholder: 'live link (optional)' });
  const body = area('', LIMITS.body);
  const unlock = input('', { placeholder: 'command that unlocks it (secret files)' });
  host.append(
    el('h3', { text: 'Desktop items' }), list,
    el('h3', { text: 'Add item' }),
    field('Type', kind), field('Folder (text files only)', folder), field('Title', title),
    field('Description', desc), field('Tags', tags), field('Image url', image), field('Live link', link),
    field('Body text (text and secret files)', body), field('Unlock command (secret files)', unlock),
    btn('Add item', () => {
      if (draft.items.length >= LIMITS.items) return flash('max 30 items');
      const item = sanitizeItem({
        kind: kind.value, folder: folder.value, title: title.value, description: desc.value,
        tags: tags.value.split(','), image: image.value, link: link.value, body: body.value, unlock: unlock.value,
      });
      if (!item) return flash('pick a valid type');
      draft.items.push(item);
      title.value = ''; desc.value = ''; tags.value = ''; image.value = ''; link.value = ''; body.value = ''; unlock.value = '';
      commit();
      paint();
    }),
  );
  paint();
}

function viewCommands(host) {
  const list = el('div', { class: 'col' });
  const paint = () => {
    list.textContent = '';
    draft.commands.forEach((c, i) => list.append(el('div', { class: 'row' },
      el('span', { text: c.name + ' -> ' + (c.response || '(no output)') }),
      el('button', { class: 'mini', type: 'button', text: 'remove', onclick: () => { draft.commands.splice(i, 1); commit(); paint(); } }),
    )));
  };
  const name = input('', { placeholder: 'command name (hire, neofetch...)', maxlength: '24' });
  const response = area('', LIMITS.cmdResponse);
  host.append(
    el('p', { class: 'dim', text: 'built-ins (help ls cat whoami theme clear) always win over your custom names.' }),
    list,
    field('Command', name), field('Response', response),
    btn('Add command', () => {
      if (draft.commands.length >= LIMITS.commands) return flash('max 50 commands');
      const c = sanitizeCommand({ name: name.value, response: response.value });
      if (!c) return flash('command needs a name');
      draft.commands.push(c);
      name.value = '';
      response.value = '';
      commit();
      paint();
    }),
  );
  paint();
}

function instantUrl() {
  const hash = encodeShare(sanitizeConfig(draft));
  if (hash.length > LIMITS.shareChars) throw new Error('too big to share as a link. trim it down');
  return location.origin + '/#data=' + hash;
}

function viewPublish(host) {
  const handle = input(draft.handle, { placeholder: 'your-handle', maxlength: '30' });
  const siteOut = el('p', { class: 'dim' });
  const domain = input('', { placeholder: 'keane.dev or portfolio.yourdomain.com' });
  const statusEl = el('div', { class: 'dim', text: '' });
  const dnsBox = el('div', { class: 'col' });

  const showDns = (info) => {
    dnsBox.textContent = '';
    dnsBox.append(
      el('div', { class: 'row', text: 'CNAME   ' + info.domain + '  ->  ' + CNAME_TARGET }),
      el('div', { class: 'row', text: 'TXT     ' + info.domain + '  ->  retrofolio-verify=' + info.token }),
      statusEl,
      btn('Verify DNS', async () => {
        try {
          const ok = await verifyDomain(info.domain);
          statusEl.textContent = ok ? 'Active SSL' : 'Pending';
          if (ok === false) flash('still pending. dns can take a while');
        } catch (err) { flash(err.message); }
      }),
    );
    statusEl.textContent = 'Pending';
  };

  host.append(
    el('h3', { text: 'Publish to a link' }),
    el('p', { class: 'dim', text: 'publishing needs google sign in (top right). your current draft goes live under this handle.' }),
    field('Handle (retrofolio.app/<handle>)', handle),
    btn('Publish', async () => {
      try { siteOut.textContent = 'live at retrofolio.app/' + await publishSite(handle.value); } catch (err) { flash(err.message); }
    }),
    siteOut,
    btn('Copy instant URL (no account)', async () => {
      try { await navigator.clipboard.writeText(instantUrl()); flash('instant url copied'); } catch (err) { flash(err.message); }
    }),
    el('h3', { text: 'Custom domain' }),
    field('Domain you own', domain),
    btn('Bind domain', async () => {
      try { showDns(await bindDomain(domain.value, handle.value)); } catch (err) { flash(err.message); }
    }),
    dnsBox,
    el('h3', { text: 'Offline backup' }),
    btn('Download index.html', () => exportStandalone().catch((err) => flash(err.message))),
  );
}

// ---------- standalone export (inline script + style, locked down with sha256 csp) ----------
async function fetchText(name) {
  const res = await fetch(name);
  if (!res.ok) throw new Error('could not read ' + name);
  return res.text();
}

async function sriHash(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return 'sha256-' + btoa(String.fromCharCode(...new Uint8Array(digest)));
}

async function exportStandalone() {
  const cfg = sanitizeConfig(draft);
  const [css, js] = await Promise.all([fetchText('style.css'), fetchText('script.js')]);
  const wrapped = '(function () {\n' + js + '\n})();';
  const cssHash = await sriHash(css);
  const jsHash = await sriHash(wrapped);
  const embed = JSON.stringify(cfg).replace(/</g, '\\u003c');
  const csp = [
    "default-src 'none'",
    `script-src '${jsHash}'`,
    `style-src '${cssHash}'`,
    'img-src https: http: data:',
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  const html = [
    '<!DOCTYPE html>',
    '<html lang="en"><head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<title>${escapeHtml(cfg.osName)}</title>`,
    `<style>${css}</style>`,
    '</head><body>',
    '<div id="viewer" class="os-root full"></div>',
    `<script type="application/json" id="embed">${embed}</script>`,
    `<script>${wrapped}</script>`,
    '</body></html>',
  ].join('\n');
  downloadBlob(new Blob([html], { type: 'text/html' }), 'index.html');
}

// ---------- routing ----------
function hideHome() {
  const home = document.getElementById('home');
  if (home) home.classList.add('hidden');
}

function showHome() {
  const home = document.getElementById('home');
  if (home) home.classList.remove('hidden');
  if (ui.builder) ui.builder.classList.add('hidden');
  if (ui.viewer) ui.viewer.classList.add('hidden');
}

async function showViewer(loader) {
  hideHome();
  if (ui.builder) ui.builder.classList.add('hidden');
  ui.viewer.classList.remove('hidden');
  ui.viewer.textContent = 'loading...';
  try {
    const cfg = await loader();
    if (cfg === null) {
      // unknown slug on our own hosts goes home. on a custom domain with no site, show a plain message (redirecting would loop)
      const ownHost = MAIN_HOSTS.includes(location.hostname) || location.hostname.endsWith('.vercel.app');
      if (ownHost) { location.replace('/'); return; }
      ui.viewer.textContent = 'no retro os lives here.';
      return;
    }
    renderOS(ui.viewer, cfg, { boot: true });
  } catch (err) {
    ui.viewer.textContent = 'could not load: ' + err.message;
  }
}

function route() {
  Object.assign(ui, {
    builder: $('#builder'), viewer: $('#viewer'), preview: $('#os-root'),
    tabs: $('#tabs'), body: $('#tab-body'), toast: $('#toast'),
  });

  // exported standalone file: config is embedded, no builder, no firebase
  const embedded = document.getElementById('embed');
  if (embedded) return showViewer(async () => sanitizeConfig(JSON.parse(embedded.textContent)));

  const host = location.hostname;
  const seg = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const studio = seg === 'studio' || seg === 'edit';

  if (MAIN_HOSTS.includes(host) === false && host.endsWith('.vercel.app') === false) return showViewer(() => loadByDomain(host));
  if (location.hash.startsWith('#data=') && studio === false) return showViewer(async () => decodeShare(location.hash.slice(6)));
  if (studio) return startBuilder();
  if (seg === '') return showHome();
  return showViewer(() => loadBySlug(seg));
}

route();
