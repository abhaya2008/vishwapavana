#!/usr/bin/env node
// Export all SQLite data to JSON files for static hosting (GitHub Pages).
// Run from project root: node scripts/export-to-json.js
// Or run from server/ dir: node ../scripts/export-to-json.js
//
// NOTE: better-sqlite3 must be built for the current Node version.
// If it fails to load, run:  cd server && npm install
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH  = path.join(__dirname, '../server/database.sqlite');
const DATA_DIR = path.join(__dirname, '../web/public/data');

const db = new Database(DB_PATH, { readonly: true });

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeJson(p, d) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
    console.log('  wrote', path.relative(process.cwd(), p));
}

console.log('Exporting SQLite → JSON...\n');

// ── meta.json: categories + texts + chapters ──────────────────────────────────
ensureDir(DATA_DIR);
const categories = db.prepare('SELECT * FROM categories ORDER BY display_order').all();
const texts      = db.prepare('SELECT * FROM texts      ORDER BY display_order').all();
const chapters   = db.prepare('SELECT * FROM chapters   ORDER BY display_order').all();
writeJson(path.join(DATA_DIR, 'meta.json'), { categories, texts, chapters });

// ── verses/{chapter_id}.json: full verse rows for each chapter ────────────────
// Includes all fields (padaccheda, anvaya, etc.) so VersePage works without
// loading the commentary file just to show verse content.
ensureDir(path.join(DATA_DIR, 'verses'));
for (const chapter of chapters) {
    const verses = db.prepare(
        'SELECT * FROM verses WHERE chapter_id = ? ORDER BY display_order'
    ).all(chapter.id);
    writeJson(path.join(DATA_DIR, 'verses', `${chapter.id}.json`), verses);
}

// ── commentary/{verse_id}.json: verse + all its commentaries ─────────────────
ensureDir(path.join(DATA_DIR, 'commentary'));
const allVerses     = db.prepare('SELECT * FROM verses      ORDER BY id').all();
const allComms      = db.prepare('SELECT * FROM commentaries ORDER BY verse_id, id').all();
const commsByVerse  = {};
for (const c of allComms) {
    (commsByVerse[c.verse_id] ??= []).push(c);
}
for (const verse of allVerses) {
    const commentaries = commsByVerse[verse.id] || [];
    writeJson(path.join(DATA_DIR, 'commentary', `${verse.id}.json`), { verse, commentaries });
}

db.close();
console.log('\nDone. JSON files are in web/public/data/');
