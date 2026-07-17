// Sanskritam API server — reads/writes JSON files in web/public/data/
// No SQLite or native modules required. Pure Node.js.
const fs      = require('fs');
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const DATA_DIR = path.join(__dirname, '../web/public/data');
const PORT     = 3001;

const app = express();
app.use(cors());
app.use(express.json());

// ── JSON helpers ──────────────────────────────────────────────────────────────

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, d) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
}

function readMeta()       { return readJson(path.join(DATA_DIR, 'meta.json')); }
function writeMeta(meta)  { writeJson(path.join(DATA_DIR, 'meta.json'), meta); }

function readVerseList(chapterId) {
    const p = path.join(DATA_DIR, 'verses', `${chapterId}.json`);
    return fs.existsSync(p) ? readJson(p) : [];
}
function writeVerseList(chapterId, verses) {
    writeJson(path.join(DATA_DIR, 'verses', `${chapterId}.json`), verses);
}

function readCommentaryFile(verseId) {
    const p = path.join(DATA_DIR, 'commentary', `${verseId}.json`);
    return fs.existsSync(p) ? readJson(p) : { verse: null, commentaries: [] };
}
function writeCommentaryFile(verseId, data) {
    writeJson(path.join(DATA_DIR, 'commentary', `${verseId}.json`), data);
}

// A verse added via "Add Verses" only gets written into its chapter's verses/{id}.json
// list — its commentary/{id}.json (which holds the canonical `verse` object) is meant
// to be created lazily on first save. Find its row in the verses lists so callers can
// seed that first commentary file correctly instead of 404ing.
function findVerseRow(verseId) {
    const dir = path.join(DATA_DIR, 'verses');
    for (const fname of fs.readdirSync(dir)) {
        if (!fname.endsWith('.json')) continue;
        const verses = readJson(path.join(dir, fname));
        const v = verses.find(v => v.id === verseId);
        if (v) return v;
    }
    return null;
}

// Like readCommentaryFile, but lazily seeds `verse` from the verses-list data when the
// commentary file doesn't exist yet — mirrors the client's static-mode fallback in
// sGetCommentariesByVerse. Without this, the first save for a brand-new verse 404s.
function readOrInitCommentaryFile(verseId) {
    const data = readCommentaryFile(verseId);
    if (data.verse) return data;
    const verse = findVerseRow(verseId);
    return verse ? { verse, commentaries: data.commentaries } : data;
}

function nextId(items) {
    return items.length === 0 ? 1 : Math.max(...items.map(i => i.id)) + 1;
}

// Commentary ids are only unique WITHIN a single verse's file (each file's id
// counter restarts at 1 via nextId()), so the SAME id exists across many verses.
// Always look up by verse_id when it's known — scanning all files for a bare id
// silently matches the wrong verse's commentary and corrupts it.
function findCommentaryInVerse(verseId, cid) {
    const data = readCommentaryFile(verseId);
    const c = data.commentaries.find(c => c.id === cid);
    if (!c) return null;
    return { data, c, verseId: +verseId };
}

// Legacy fallback ONLY for callers that don't pass verse_id — scans all
// commentary/{n}.json files and returns the FIRST match, which is unsafe if the
// id collides across verses (it will). Prefer findCommentaryInVerse.
function findCommentaryById(cid) {
    const dir = path.join(DATA_DIR, 'commentary');
    for (const fname of fs.readdirSync(dir)) {
        if (!fname.endsWith('.json')) continue;
        const data = readJson(path.join(dir, fname));
        const c = data.commentaries.find(c => c.id === cid);
        if (c) return { data, c, verseId: data.verse?.id };
    }
    return null;
}

// ── Categories ────────────────────────────────────────────────────────────────

app.get('/api/categories', (req, res) => {
    const { categories } = readMeta();
    res.json(categories.filter(c => c.parent_id == null).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
});

app.get('/api/categories/:id', (req, res) => {
    const { categories } = readMeta();
    const cat = categories.find(c => c.id === +req.params.id);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    res.json(cat);
});

app.get('/api/categories/:id/subcategories', (req, res) => {
    const { categories } = readMeta();
    res.json(categories.filter(c => c.parent_id === +req.params.id).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
});

// ── Texts ─────────────────────────────────────────────────────────────────────

app.get('/api/categories/:id/texts', (req, res) => {
    const { texts } = readMeta();
    res.json(texts.filter(t => t.category_id === +req.params.id).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
});

app.get('/api/texts/:id', (req, res) => {
    const { texts, categories } = readMeta();
    const text = texts.find(t => t.id === +req.params.id);
    if (!text) return res.status(404).json({ error: 'Not found' });
    const cat = categories.find(c => c.id === text.category_id);
    res.json({ ...text, category_name: cat?.name_sanskrit });
});

// ── Chapters ──────────────────────────────────────────────────────────────────

app.get('/api/texts/:id/chapters', (req, res) => {
    const { chapters } = readMeta();
    res.json(chapters.filter(c => c.text_id === +req.params.id).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
});

app.get('/api/chapters/:id', (req, res) => {
    const { chapters, texts } = readMeta();
    const ch = chapters.find(c => c.id === +req.params.id);
    if (!ch) return res.status(404).json({ error: 'Not found' });
    const text = texts.find(t => t.id === ch.text_id);
    res.json({ ...ch, text_name: text?.name_sanskrit, text_id: text?.id });
});

// ── Verses ────────────────────────────────────────────────────────────────────

app.get('/api/chapters/:id/verses', (req, res) => {
    const verses = readVerseList(req.params.id);
    res.json(verses.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
});

app.get('/api/verses/:id', (req, res) => {
    const { verse } = readOrInitCommentaryFile(+req.params.id);
    if (!verse) return res.status(404).json({ error: 'Not found' });
    res.json(verse);
});

app.patch('/api/verses/:id', (req, res) => {
    const allowed = ['content_sanskrit', 'avatarnika', 'padaccheda', 'anvaya', 'meaning_sanskrit', 'meaning_english'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });

    const vid = +req.params.id;
    const data = readOrInitCommentaryFile(vid);
    if (!data.verse) return res.status(404).json({ error: 'Not found' });

    data.verse = { ...data.verse, ...updates };
    writeCommentaryFile(vid, data);

    const verses = readVerseList(data.verse.chapter_id);
    writeVerseList(data.verse.chapter_id, verses.map(v => v.id === vid ? { ...v, ...updates } : v));

    res.json(data.verse);
});

// ── Commentaries ──────────────────────────────────────────────────────────────

app.get('/api/verses/:id/commentaries', (req, res) => {
    const { commentaries } = readOrInitCommentaryFile(+req.params.id);
    res.json(commentaries);
});

app.post('/api/commentaries', (req, res) => {
    const { verse_id, commentary_type, author, content } = req.body;
    if (!verse_id || !commentary_type || !content) {
        return res.status(400).json({ error: 'verse_id, commentary_type and content are required' });
    }
    const vid = +verse_id;
    const data = readOrInitCommentaryFile(vid);
    const newId = nextId(data.commentaries);
    const newC = { id: newId, verse_id: vid, commentary_type, author: author || '', content };
    data.commentaries.push(newC);
    writeCommentaryFile(vid, data);
    res.status(201).json(newC);
});

app.patch('/api/commentaries/:id', (req, res) => {
    const { content, author, commentary_type, verse_id } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });

    const cid = +req.params.id;
    const found = verse_id != null ? findCommentaryInVerse(+verse_id, cid) : findCommentaryById(cid);
    if (!found) return res.status(404).json({ error: 'Commentary not found' });

    found.c.content = content;
    if (author !== undefined) found.c.author = author;
    if (commentary_type !== undefined) found.c.commentary_type = commentary_type;
    found.data.commentaries = found.data.commentaries.map(c => c.id === cid ? found.c : c);
    writeCommentaryFile(found.verseId, found.data);

    res.json(found.c);
});

app.listen(PORT, () => {
    console.log(`Sanskritam API server running at http://localhost:${PORT} (JSON-file mode)`);
});
