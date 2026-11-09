#!/usr/bin/env node
/**
 * Fabrique une page HTML unique et autonome à partir de l'export web Expo
 * (`npx expo export --platform web --output-dir dist-web`) :
 * scripts et médias intégrés, app affichée dans un cadre d'iPhone.
 *
 * Usage : node scripts/build-web-preview.mjs dist-web web-preview/index.html
 */
import fs from 'node:fs';
import path from 'node:path';

// Attention : remplacements par fonction, pour que les « $& » du bundle ne soient pas interprétés.
const args = process.argv.slice(2);
const full = args.includes('--full'); // document HTML complet (GitHub Pages) ; sinon contenu d'artefact
const [distDir = 'dist-web', out = 'web-preview/index.html'] = args.filter((a) => !a.startsWith('--'));
const BASE = (process.env.WEB_BASE_URL ?? '').replace(/\/$/, '');
const MIME = { '.png': 'image/png', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };

let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)];
const strip = (u) => (BASE && u.startsWith(BASE + '/') ? u.slice(BASE.length) : u);
let js = scripts.map((m) => fs.readFileSync(path.join(distDir, strip(m[1])), 'utf8')).join('\n;\n');

// Médias : chaque "/assets/..." devient une data URI.
js = js.replace(/"((?:\/[^"/]+)?\/assets\/[^"]+)"/g, (whole, url) => {
  const local = strip(url);
  const file = path.join(distDir, decodeURIComponent(local));
  if (!fs.existsSync(file)) return whole;
  const mime = MIME[path.extname(file)] ?? 'application/octet-stream';
  return JSON.stringify(`data:${mime};base64,${fs.readFileSync(file).toString('base64')}`);
});
js = js.replace(/<\/script/gi, '<\\/script');

html = html
  .replace('<html lang="en">', '<html lang="fr">')
  .replace(/<link rel="icon"[^>]*>/, '')
  .replace(/<script src="[^"]+" defer><\/script>/g, '')
  .replace('<title>MotMinute</title>', () => `<title>MotMinute aperçu</title>
    <meta name="description" content="Aperçu web cliquable de MotMinute (démo fictive)." />
    <style>
      :root { --page: #ECE6DA; --ink: #2A2C30; --muted: #66625A; --bezel: #1C1C1E; }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme="light"]) { --page: #17171A; --ink: #F2EEE6; --muted: #A9A398; --bezel: #000; }
      }
      :root[data-theme="dark"] { --page: #17171A; --ink: #F2EEE6; --muted: #A9A398; --bezel: #000; }
      html, body { background: var(--page); margin: 0; height: 100%; }
      body { font-family: -apple-system, system-ui, sans-serif; color: var(--ink); }
      #root { background: #F6F1E7; }
      .caption { display: none; }
      @media (min-width: 520px) and (min-height: 700px) {
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; overflow: auto; }
        #root {
          flex: none !important; width: 390px; height: min(844px, calc(100vh - 120px)) !important; margin-top: 16px;
          border: 12px solid var(--bezel); border-radius: 54px; overflow: hidden; position: relative;
          transform: translateZ(0); box-shadow: 0 30px 60px rgba(0,0,0,.25);
        }
        .caption { display: block; font-size: 13px; color: var(--muted); text-align: center; max-width: 420px; padding: 0 16px; }
      }
    </style>`)
  .replace('<div id="root"></div>', () => `<div id="root"></div>
    <p class="caption">Aperçu web de MotMinute : interview démo fictive. La transcription, l’import de fichiers et les achats fonctionnent uniquement dans l’app iPhone.</p>
    <script>try { var b = ${JSON.stringify(BASE)}, p = location.pathname; var ok = b ? p === b || p.indexOf(b + '/') === 0 : p === '/'; if (!ok) history.replaceState(null, '', b + '/'); } catch (e) {}</script>
    <script>${js}</script>`);

// Page d'artefact : uniquement le contenu (le squelette <html>/<head>/<body> est ajouté à la publication).
const head0 = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>|<meta httpEquiv[^>]*>/g, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
if (!full) html = `${head0.trim()}\n${body.trim()}\n`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${out} : ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} Mo`);
