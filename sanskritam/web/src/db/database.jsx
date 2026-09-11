import { createContext, useCallback, useContext, useState } from 'react';
import { ghCommitFile, getGhConfig } from './github-writer';

// true when built with VITE_READONLY=true (GitHub Pages deployment)
export const IS_STATIC = import.meta.env.VITE_READONLY === 'true';

const API = '/api';

// ── Dev mode helpers ──────────────────────────────────────────────────────────

async function apiFetch(path) {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
    return res.json();
}
async function apiPatch(path, body) {
    const res = await fetch(API + path, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
    return res.json();
}
async function apiPost(path, body) {
    const res = await fetch(API + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return res.json();
}

// ── Static mode: in-memory caches ────────────────────────────────────────────

let _meta = null;          // { categories, texts, chapters }
let _verseListCache = {};  // chapterId → verse[]  (full rows incl. padaccheda etc.)
let _commentaryCache = {}; // verseId   → { verse, commentaries }
let _cid2vid = {};         // commentaryId → verseId  (reverse lookup for updates)
let _ullekhaLookup = null; // base_unit_id → { c: chapterId, v: verseId }
let _ullekhaPromise = null;
let _sutraLookup = null;   // "adhyaya.pada.sutra" (e.g. "1.2.41") → { c: chapterId, v: verseId }
let _sutraPromise = null;

// Regex to match href="#BG_C02_V31" or href="#BS_C01_S01_V22" patterns
const ULLEKHA_HREF_RE = /href="#((?:BG|BS)_C\d+(?:_S\d+)?_V\d+)(?:_[A-Z]\d+)?"/g;

async function _loadSutraLookup() {
    if (_sutraLookup) return _sutraLookup;
    try {
        const res = await fetch(dataBase() + 'sutra_lookup.json');
        if (res.ok) _sutraLookup = await res.json();
        else _sutraLookup = {};
    } catch { _sutraLookup = {}; }
    return _sutraLookup;
}

function getSutraLookup() {
    if (_sutraLookup) return _sutraLookup;
    if (!_sutraPromise) _sutraPromise = _loadSutraLookup();
    return null; // not ready yet; will be available on next render
}

async function _loadUllekhaLookup() {
    if (_ullekhaLookup) return _ullekhaLookup;
    try {
        const res = await fetch(dataBase() + 'ullekha_lookup.json');
        if (res.ok) _ullekhaLookup = await res.json();
        else _ullekhaLookup = {};
    } catch { _ullekhaLookup = {}; }
    return _ullekhaLookup;
}

function getUllekhaLookup() {
    if (_ullekhaLookup) return _ullekhaLookup;
    if (!_ullekhaPromise) _ullekhaPromise = _loadUllekhaLookup();
    return null; // not ready yet; will be available on next render
}

/**
 * Replace unresolved #BG_CXX_VYY / #BS_CXX_SYY_VZZ hrefs in commentary HTML
 * with proper #/chapter/{chapterId}/verse/{verseId} app routes.
 */
function resolveUllekhaLinks(html) {
    if (!html || typeof html !== 'string') return html;
    const lookup = _ullekhaLookup;
    if (!lookup) return html;
    return html.replace(ULLEKHA_HREF_RE, (match, baseUnitId) => {
        // Try exact match first, then try without suffix (_I01, _B01 etc.)
        const entry = lookup[baseUnitId];
        if (entry) return `href="#/chapter/${entry.c}/verse/${entry.v}"`;
        // Try stripping trailing _IXX / _BXX suffixes that might be in the data
        const stripped = baseUnitId.replace(/_[IB]\d+$/, '');
        const entry2 = lookup[stripped];
        if (entry2) return `href="#/chapter/${entry2.c}/verse/${entry2.v}"`;
        return match; // leave unchanged if not found
    });
}

// ashtadhyayi-com/data's commentaries use their own lightweight inline markup:
// a sutra is cited as <<sutra text>> immediately followed by its reference in
// [[adhyaya.pada.sutra]] (e.g. <<अपृक्तः एकाल् प्रत्ययः>> [[1.2.41]]), plus a family
// of custom pseudo-tags (<qt>, <hl>, <title>, <pr>, <ex>, ...) for styling. None
// of these are real HTML, so left as-is they either show up as literal bracket
// text or (worse, for names that collide with real tags like <title>) get
// silently dropped by the browser. This turns the sutra citations into real
// links to that sutra's verse page here, and gives the rest of the markup a
// plain, safe rendering.
// Sutra reference digits appear in either script depending on the source file
// (e.g. kashika.txt uses [[३.२.८७]], most others use [[3.2.87]]).
const DIGITS = '[0-9०-९]';
// The quoted text is restricted to "no <" so a <<...>> with nothing immediately
// following it can never be swallowed into a *later*, unrelated <<...>> [[ref]]
// pair further down the string (the source has several back-to-back citations
// where only the last one carries a [[ref]]).
const SUTRA_CITE_RE = new RegExp(`<<([^<]*?)>>\\s*\\[\\[(${DIGITS}+)\\.(${DIGITS}+)\\.(${DIGITS}+)\\]\\]`, 'g');
const SUTRA_BARE_REF_RE = new RegExp(`\\[\\[(${DIGITS}+)\\.(${DIGITS}+)\\.(${DIGITS}+)\\]\\]`, 'g');
const SUTRA_LONE_QUOTE_RE = /<<([^<]*?)>>/g;
const DEVA_TO_ASCII_DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };

function toAsciiDigits(s) {
    return s.replace(/[०-९]/g, (d) => DEVA_TO_ASCII_DIGITS[d]);
}
const SK_PARA_REF_RE = /<\{SK(\d+)\}>/g;

// tagName → [openReplacement, closeReplacement]. Applied generically so an
// unpaired/mismatched tag (the source data has a few) still degrades safely —
// the browser just auto-closes the span/div at the nearest boundary.
const ASHTADHYAYI_TAG_STYLES = {
    title: ['<div style="font-weight:700;margin:0.6em 0 0.3em;color:var(--color-maroon,#7B2D2D)">', '</div>'],
    pv: ['<div style="font-weight:700;margin:0.6em 0 0.3em;color:var(--color-maroon,#7B2D2D)">', '</div>'], // used interchangeably with <title> in the source
    pr: ['<div style="margin:0.5em 0;padding:0.5em 0.8em;background:#FBF3E7;border-left:3px solid #C9A227;white-space:pre-wrap">', '</div>'],
    source: ['<div style="margin:0.5em 0;padding:0.4em 0.8em;border-left:3px solid #999;font-style:italic;color:#555">', '</div>'],
    karika: ['<div style="text-align:center;font-weight:600;margin:0.6em 0;white-space:pre-wrap">', '</div>'],
    list: ['<div style="margin:0.4em 0;padding:0.4em 0.8em;background:#FBF3E7;border-radius:4px;white-space:pre-wrap">', '</div>'],
    listsp: ['<div style="margin:0.4em 0;padding:0.4em 0.8em;background:#FBF3E7;border-radius:4px;white-space:pre-wrap">', '</div>'],
    gana: ['<div style="margin:0.4em 0;padding:0.4em 0.8em;background:#FBF3E7;border-radius:4px;white-space:pre-wrap">', '</div>'],
    pt: ['<div style="margin:0.4em 0;padding:0.4em 0.8em;background:#FBF3E7;border-radius:4px;white-space:pre-wrap">', '</div>'],
    note: ['<div style="margin:0.4em 0;padding:0.3em 0.7em;border-left:3px solid #6699CC;background:#F0F6FC;font-size:0.95em">', '</div>'],
    spacer: ['<br /><br />', ''],
    hl: ['<b style="color:var(--color-maroon,#7B2D2D)">', '</b>'],
    HL: ['<b style="color:var(--color-maroon,#7B2D2D)">', '</b>'],
    hlb: ['<b style="color:var(--color-maroon,#7B2D2D)">', '</b>'],
    ex: ['<i>', '</i>'],
    nex: ['<i style="color:#a33">', '</i>'],
    qt: ['<span style="color:#8B4513">', '</span>'],
    w: ['<span style="color:#8B4513">', '</span>'],
    x: ['<span style="color:#8B4513">', '</span>'],
    y: ['<span style="color:#8B4513">', '</span>'],
    light: ['<span style="color:#888;font-size:0.9em">', '</span>'],
    lightnl: ['<span style="color:#888;font-size:0.9em">', '</span><br />'],
    inline: ['', ''],
    big: ['<span style="font-size:1.2em">', '</span>'],
};

function resolveAshtadhyayiRefs(html) {
    if (!html || typeof html !== 'string') return html;
    let out = html;
    // Not just an Ashtadhyayi cross-reference — some commentaries use the same
    // [[a.b.c]] bracket syntax for a dhatu-list index instead, which never
    // resolves here. Fall back to plain "(a.b.c)" rather than leaving the
    // brackets, whether that's because the lookup hasn't loaded yet or because
    // the reference simply isn't a sutra.
    const lookup = _sutraLookup || {};

    out = out.replace(SUTRA_CITE_RE, (match, text, a, p, n) => {
        const entry = lookup[`${toAsciiDigits(a)}.${toAsciiDigits(p)}.${toAsciiDigits(n)}`];
        return entry ? `<a href="#/chapter/${entry.c}/verse/${entry.v}">${text}</a>` : text;
    });
    out = out.replace(SUTRA_BARE_REF_RE, (match, a, p, n) => {
        const entry = lookup[`${toAsciiDigits(a)}.${toAsciiDigits(p)}.${toAsciiDigits(n)}`];
        return entry ? `<a href="#/chapter/${entry.c}/verse/${entry.v}">[${a}.${p}.${n}]</a>` : `(${a}.${p}.${n})`;
    });

    // A <<sutra text>> with no [[ref]] following it (common — it's usually
    // quoting the very sutra the reader is already on) has nothing to link to;
    // still style it as a quoted citation instead of leaving the raw <<...>>.
    out = out.replace(SUTRA_LONE_QUOTE_RE, '<b>$1</b>');

    // Siddhanta-Kaumudi paragraph numbers — no browsable target here, just
    // render as plain readable text instead of the raw <{SK179}> syntax.
    out = out.replace(SK_PARA_REF_RE, '(SK$1)');

    for (const [tag, [openRepl, closeRepl]] of Object.entries(ASHTADHYAYI_TAG_STYLES)) {
        out = out.split(`<${tag}>`).join(openRepl);
        out = out.split(`</${tag}>`).join(closeRepl);
    }

    // Safety net: strip any other custom pseudo-tag this file didn't account
    // for, so it never leaks to the reader as literal "<something>" text.
    out = out.replace(/<\/?(?!a\b|b\b|i\b|u\b|br\b|div\b|span\b|p\b|strong\b|em\b|sup\b|sub\b|ol\b|ul\b|li\b|table\b|tr\b|td\b|th\b)[a-zA-Z][a-zA-Z0-9]*\b[^>]*>/g, '');

    return out;
}

function dataBase() {
    // import.meta.env.BASE_URL ends with '/'
    return import.meta.env.BASE_URL + 'data/';
}

// Baked in at build time by the GitHub Actions workflow.
const _BUILD_GH_OWNER     = import.meta.env.VITE_GH_OWNER;
const _BUILD_GH_REPO      = import.meta.env.VITE_GH_REPO;
const _BUILD_GH_BRANCH    = import.meta.env.VITE_GH_BRANCH || 'main';
const _BUILD_GH_DATA_PATH = import.meta.env.VITE_GH_DATA_PATH;

async function staticGet(relPath) {
    const cfg = getGhConfig();

    // Editor with token: GitHub Contents API — zero CDN cache, always latest commit.
    if (cfg?.token && cfg?.owner && cfg?.repo && cfg?.dataPath) {
        const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.dataPath}/${relPath}`;
        const res = await fetch(url, {
            headers: {
                Authorization: `token ${cfg.token}`,
                Accept: 'application/vnd.github.raw+json',
            },
            cache: 'no-store',
        });
        if (!res.ok) throw new Error(`[github] ${relPath} → ${res.status}`);
        return res.json();
    }

    // Public visitor: raw.githubusercontent.com — latest commit, ~5 min CDN cache max.
    // Repo info is baked in at build time via VITE_GH_* env vars.
    if (_BUILD_GH_OWNER && _BUILD_GH_REPO && _BUILD_GH_DATA_PATH) {
        const url = `https://raw.githubusercontent.com/${_BUILD_GH_OWNER}/${_BUILD_GH_REPO}/${_BUILD_GH_BRANCH}/${_BUILD_GH_DATA_PATH}/${relPath}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`[raw] ${relPath} → ${res.status}`);
        return res.json();
    }

    // Final fallback: deployed static files (local dev or missing build vars).
    const res = await fetch(dataBase() + relPath);
    if (!res.ok) throw new Error(`[static] ${relPath} → ${res.status}`);
    return res.json();
}

async function getMeta() {
    if (!_meta) _meta = await staticGet('meta.json');
    return _meta;
}

// Commit a commentary file to GitHub and update local cache
async function commitCommentary(verseId) {
    const cfg = getGhConfig();
    if (!cfg?.token) throw new Error('GitHub not configured. Please open ⚙ GitHub Settings.');
    const data = _commentaryCache[verseId];
    const repoPath = `${cfg.dataPath || 'sanskritam/web/public/data'}/commentary/${verseId}.json`;
    await ghCommitFile(repoPath, JSON.stringify(data, null, 2), `Update verse ${verseId} commentary [skip ci]`);
}

async function commitVerseList(chapterId) {
    const cfg = getGhConfig();
    if (!cfg?.token) return; // verse list commit is best-effort (main data is in commentary file)
    const data = _verseListCache[chapterId];
    if (!data) return;
    const repoPath = `${cfg.dataPath || 'sanskritam/web/public/data'}/verses/${chapterId}.json`;
    await ghCommitFile(repoPath, JSON.stringify(data, null, 2), `Update verse list for chapter ${chapterId} [skip ci]`);
}

// ── Static read functions ─────────────────────────────────────────────────────

function byDisplayOrder(a, b) {
    return (a.display_order ?? 0) - (b.display_order ?? 0);
}
async function sGetCategories() {
    const { categories } = await getMeta();
    return categories.filter(c => c.parent_id == null).sort(byDisplayOrder);
}
async function sGetCategory(id) {
    const { categories } = await getMeta();
    return categories.find(c => c.id === +id) || null;
}
async function sGetSubCategories(parentId) {
    const { categories } = await getMeta();
    return categories.filter(c => c.parent_id === +parentId).sort(byDisplayOrder);
}
async function sGetTextsByCategory(categoryId) {
    const { texts, categories } = await getMeta();
    const cid = +categoryId;
    const subCatIds = categories.filter(c => c.parent_id === cid).map(c => c.id);
    const targetCatIds = [cid, ...subCatIds];
    return texts.filter(t => targetCatIds.includes(t.category_id));
}
async function sGetText(id) {
    const { texts, categories } = await getMeta();
    const text = texts.find(t => t.id === +id);
    if (!text) return null;
    const cat = categories.find(c => c.id === text.category_id);
    return { ...text, category_name: cat?.name_sanskrit };
}
async function sGetChaptersByText(textId) {
    const { chapters } = await getMeta();
    return chapters.filter(c => c.text_id === +textId);
}
async function sGetChapter(id) {
    const { chapters, texts } = await getMeta();
    const ch = chapters.find(c => c.id === +id);
    if (!ch) return null;
    const text = texts.find(t => t.id === ch.text_id);
    return { ...ch, text_name: text?.name_sanskrit, text_id: text?.id };
}
async function sGetVersesByChapter(chapterId) {
    const cid = +chapterId;
    if (!_verseListCache[cid]) {
        _verseListCache[cid] = await staticGet(`verses/${cid}.json`);
    }
    return _verseListCache[cid];
}
// One bundled fetch of { verseId: commentaries[] } for a whole chapter — used by the
// Mahabharata continuous-reading page instead of one fetch per verse (most verses
// have no commentary at all, so per-verse fetching would be hundreds of 404s/chapter).
let _chapterCommentaryCache = {};
async function sGetChapterCommentary(chapterId) {
    const cid = +chapterId;
    if (!(cid in _chapterCommentaryCache)) {
        try {
            _chapterCommentaryCache[cid] = await staticGet(`mb-commentary/${cid}.json`);
        } catch (_) {
            _chapterCommentaryCache[cid] = {};
        }
    }
    return _chapterCommentaryCache[cid];
}
async function sGetCommentariesByVerse(verseId) {
    const vid = +verseId;
    if (!_commentaryCache[vid]) {
        try {
            const data = await staticGet(`commentary/${vid}.json`);
            _commentaryCache[vid] = data;
            if (data.commentaries) {
                data.commentaries.paragraphs = data.paragraphs || [];
            }
            for (const c of (data.commentaries || [])) _cid2vid[c.id] = vid;
        } catch (_) {
            const verse = Object.values(_verseListCache).flat().find(v => v.id === vid) || { id: vid };
            const comms = [];
            comms.paragraphs = [];
            _commentaryCache[vid] = { verse, commentaries: comms };
        }
    }
    const res = _commentaryCache[vid].commentaries || [];
    if (!res.paragraphs) {
        res.paragraphs = _commentaryCache[vid].paragraphs || [];
    }
    return res;
}

// ── Static write functions ────────────────────────────────────────────────────

async function sUpdateVerse(verseId, fields) {
    const vid = +verseId;

    // Find chapterId — from commentary cache (if loaded) or verse list cache
    let chapterId;
    if (_commentaryCache[vid]) {
        chapterId = _commentaryCache[vid].verse.chapter_id;
    } else {
        for (const [cid, verses] of Object.entries(_verseListCache)) {
            if (verses.find(v => v.id === vid)) { chapterId = +cid; break; }
        }
    }

    // Update commentary cache
    if (_commentaryCache[vid]) {
        _commentaryCache[vid] = {
            ..._commentaryCache[vid],
            verse: { ..._commentaryCache[vid].verse, ...fields },
        };
    }

    // Update verse list cache
    if (chapterId && _verseListCache[chapterId]) {
        _verseListCache[chapterId] = _verseListCache[chapterId].map(v =>
            v.id === vid ? { ...v, ...fields } : v
        );
    }

    // Commit both files (commentary first — it's the authoritative source)
    if (_commentaryCache[vid]) await commitCommentary(vid);
    if (chapterId) await commitVerseList(chapterId);

    // Return updated verse object (matches what the API route returns)
    return _commentaryCache[vid]?.verse
        || (_verseListCache[chapterId] || []).find(v => v.id === vid)
        || { id: vid, ...fields };
}

async function sUpdateCommentary(id, fields) {
    // Commentary ids collide across verses (each verse's id sequence restarts at 1),
    // so _cid2vid[id] can point at the wrong verse if two loaded verses share an id —
    // prefer an explicit verse_id from the caller when given.
    const { verse_id, ...rest } = fields;
    const vid = verse_id != null ? +verse_id : _cid2vid[id];
    if (!vid) throw new Error(`Commentary ${id} not in cache — open the verse page first.`);

    _commentaryCache[vid] = {
        ..._commentaryCache[vid],
        commentaries: _commentaryCache[vid].commentaries.map(c =>
            c.id === id ? { ...c, ...rest } : c
        ),
    };
    await commitCommentary(vid);
    return _commentaryCache[vid].commentaries.find(c => c.id === id);
}

async function sCreateCommentary(data) {
    const { verse_id, commentary_type, author = '', content } = data;
    const vid = +verse_id;
    if (!_commentaryCache[vid]) throw new Error(`Verse ${verse_id} not loaded — open the verse page first.`);

    const newId = Date.now(); // unique enough without a DB
    const newC = { id: newId, verse_id: vid, commentary_type, author, content };

    _commentaryCache[vid] = {
        ..._commentaryCache[vid],
        commentaries: [..._commentaryCache[vid].commentaries, newC],
    };
    _cid2vid[newId] = vid;

    await commitCommentary(vid);
    return newC;
}

// Bulk-save all changes for a verse in ONE commentary commit + ONE verse-list commit.
// changes: Array of { kind: 'verseField', fieldName, value }
//                 | { kind: 'updateCommentary', id, content }
//                 | { kind: 'createCommentary', commentary_type, content }
async function sBulkSaveVerse(verseId, changes) {
    const vid = +verseId;
    const cfg = getGhConfig();
    if (!cfg?.token) throw new Error('GitHub not configured. Please open ⚙ GitHub Settings.');

    // Ensure commentary cache is warm (page has already loaded it, but guard anyway)
    if (!_commentaryCache[vid]) await sGetCommentariesByVerse(vid);

    // Resolve chapterId
    let chapterId;
    if (_commentaryCache[vid]) {
        chapterId = _commentaryCache[vid].verse.chapter_id;
    } else {
        for (const [cid, vlist] of Object.entries(_verseListCache)) {
            if (vlist.find(v => v.id === vid)) { chapterId = +cid; break; }
        }
    }

    // Apply ALL changes in memory — no commits yet
    let counter = 0;
    for (const change of changes) {
        if (change.kind === 'verseField') {
            if (_commentaryCache[vid]) {
                _commentaryCache[vid] = {
                    ..._commentaryCache[vid],
                    verse: { ..._commentaryCache[vid].verse, [change.fieldName]: change.value },
                };
            }
            if (chapterId && _verseListCache[chapterId]) {
                _verseListCache[chapterId] = _verseListCache[chapterId].map(v =>
                    v.id === vid ? { ...v, [change.fieldName]: change.value } : v
                );
            }
        } else if (change.kind === 'updateCommentary') {
            if (_commentaryCache[vid]) {
                _commentaryCache[vid] = {
                    ..._commentaryCache[vid],
                    commentaries: _commentaryCache[vid].commentaries.map(c =>
                        c.id === change.id
                            ? { ...c, content: change.content, ...(change.commentary_type ? { commentary_type: change.commentary_type } : {}) }
                            : c
                    ),
                };
            }
        } else if (change.kind === 'createCommentary') {
            const newId = Date.now() + counter++;
            const newC = { id: newId, verse_id: vid, commentary_type: change.commentary_type, author: '', content: change.content };
            if (_commentaryCache[vid]) {
                _commentaryCache[vid] = {
                    ..._commentaryCache[vid],
                    commentaries: [...(_commentaryCache[vid].commentaries || []), newC],
                };
                _cid2vid[newId] = vid;
            }
        }
    }

    // Two commits total — regardless of how many sections were changed
    await commitCommentary(vid);
    if (chapterId) await commitVerseList(chapterId);
}

// Add verses to a chapter. Verse list is committed in one shot; commentary files are
// created lazily the first time an editor saves content for each new verse.
async function sAddVersesToChapter(chapterId, specs) {
    const cid = +chapterId;
    const cfg = getGhConfig();
    if (!cfg?.token) throw new Error('GitHub not configured. Please open ⚙ GitHub Settings.');

    if (!_verseListCache[cid]) await sGetVersesByChapter(cid);
    const existing = _verseListCache[cid] || [];
    const baseOrder = existing.length > 0 ? Math.max(...existing.map(v => v.display_order || 0)) : 0;

    const newVerses = specs.map((spec, i) => ({
        id: Date.now() + i,
        chapter_id: cid,
        verse_number: spec.verse_number,
        content_sanskrit: spec.content_sanskrit,
        padaccheda: '',
        anvaya: '',
        meaning_sanskrit: '',
        meaning_english: '',
        audio_url: null,
        display_order: baseOrder + i + 1,
    }));

    _verseListCache[cid] = [...existing, ...newVerses];

    // Pre-populate commentary cache so immediate navigation works without a 404
    for (const verse of newVerses) {
        _commentaryCache[verse.id] = { verse, commentaries: [] };
    }

    await commitVerseList(cid);
    return newVerses;
}

async function aApiAddVersesToChapter(chapterId, specs) {
    const results = [];
    for (const spec of specs) {
        results.push(await apiPost('/verses', { chapter_id: +chapterId, ...spec }));
    }
    return results;
}

// Dev-mode fallback: sequential API calls (fast with local server)
async function aApiBulkSave(verseId, changes) {
    for (const change of changes) {
        if (change.kind === 'verseField') {
            await apiPatch(`/verses/${verseId}`, { [change.fieldName]: change.value });
        } else if (change.kind === 'updateCommentary') {
            // verse_id disambiguates commentary ids, which collide across verses.
            await apiPatch(`/commentaries/${change.id}`, {
                content: change.content,
                verse_id: verseId,
                ...(change.commentary_type ? { commentary_type: change.commentary_type } : {}),
            });
        } else if (change.kind === 'createCommentary') {
            await apiPost('/commentaries', {
                verse_id: verseId,
                commentary_type: change.commentary_type,
                author: '',
                content: change.content,
            });
        }
    }
}

// ── Context ───────────────────────────────────────────────────────────────────

const DatabaseContext = createContext(null);

export function DatabaseProvider({ children }) {
    const [loading] = useState(false);
    const [error]   = useState(null);

    // Eagerly load the ullekha (cross-reference) lookup table
    if (!_ullekhaLookup && !_ullekhaPromise) _ullekhaPromise = _loadUllekhaLookup();
    // Eagerly load the Ashtadhyayi sutra-reference lookup table
    if (!_sutraLookup && !_sutraPromise) _sutraPromise = _loadSutraLookup();

    const getCategories        = useCallback((     ) => IS_STATIC ? sGetCategories()         : apiFetch('/categories'),                    []);
    const getCategory          = useCallback((id   ) => IS_STATIC ? sGetCategory(id)          : apiFetch(`/categories/${id}`),              []);
    const getSubCategories     = useCallback((id   ) => IS_STATIC ? sGetSubCategories(id)     : apiFetch(`/categories/${id}/subcategories`),[]);
    const getTextsByCategory   = useCallback((id   ) => IS_STATIC ? sGetTextsByCategory(id)   : apiFetch(`/categories/${id}/texts`),        []);
    const getText              = useCallback((id   ) => IS_STATIC ? sGetText(id)              : apiFetch(`/texts/${id}`),                   []);
    const getChaptersByText    = useCallback((id   ) => IS_STATIC ? sGetChaptersByText(id)    : apiFetch(`/texts/${id}/chapters`),          []);
    const getChapter           = useCallback((id   ) => IS_STATIC ? sGetChapter(id)           : apiFetch(`/chapters/${id}`),               []);
    const getVersesByChapter   = useCallback((id   ) => IS_STATIC ? sGetVersesByChapter(id)   : apiFetch(`/chapters/${id}/verses`),        []);
    const getCommentariesByVerse = useCallback((id ) => IS_STATIC ? sGetCommentariesByVerse(id): apiFetch(`/verses/${id}/commentaries`),   []);
    // Mahabharata-only bundled commentary; this data lives only in the static JSON export,
    // not in the dev-mode SQLite/API schema, so it's always fetched the "static" way.
    const getChapterCommentary  = useCallback((id   ) => sGetChapterCommentary(id),                                                        []);

    const updateVerse          = useCallback((id, f) => IS_STATIC ? sUpdateVerse(id, f)       : apiPatch(`/verses/${id}`, f),              []);
    const updateCommentary     = useCallback((id, f) => IS_STATIC ? sUpdateCommentary(id, f)  : apiPatch(`/commentaries/${id}`, f),        []);
    const createCommentary     = useCallback((d    ) => IS_STATIC ? sCreateCommentary(d)      : apiPost('/commentaries', d),              []);
    const bulkSaveVerse        = useCallback((id, changes) => IS_STATIC ? sBulkSaveVerse(id, changes) : aApiBulkSave(id, changes),        []);
    const addVersesToChapter   = useCallback((cid, specs) => IS_STATIC ? sAddVersesToChapter(cid, specs) : aApiAddVersesToChapter(cid, specs), []);

    const value = {
        loading, error,
        getCategories, getCategory, getSubCategories, getTextsByCategory,
        getText, getChaptersByText, getChapter, getVersesByChapter,
        getCommentariesByVerse, getChapterCommentary,
        updateVerse, updateCommentary, createCommentary, bulkSaveVerse, addVersesToChapter,
    };

    return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
    const ctx = useContext(DatabaseContext);
    if (!ctx) throw new Error('useDatabase must be used within DatabaseProvider');
    return ctx;
}

export { resolveUllekhaLinks, resolveAshtadhyayiRefs };
