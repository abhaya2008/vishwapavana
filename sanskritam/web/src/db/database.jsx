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

function dataBase() {
    // import.meta.env.BASE_URL ends with '/'
    return import.meta.env.BASE_URL + 'data/';
}

async function staticGet(relPath) {
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
    const repoPath = `${cfg.dataPath || 'web/public/data'}/commentary/${verseId}.json`;
    await ghCommitFile(repoPath, JSON.stringify(data, null, 2), `Update verse ${verseId} commentary`);
}

async function commitVerseList(chapterId) {
    const cfg = getGhConfig();
    if (!cfg?.token) return; // verse list commit is best-effort (main data is in commentary file)
    const data = _verseListCache[chapterId];
    if (!data) return;
    const repoPath = `${cfg.dataPath || 'web/public/data'}/verses/${chapterId}.json`;
    await ghCommitFile(repoPath, JSON.stringify(data, null, 2), `Update verse list for chapter ${chapterId}`);
}

// ── Static read functions ─────────────────────────────────────────────────────

async function sGetCategories() {
    const { categories } = await getMeta();
    return categories.filter(c => c.parent_id == null);
}
async function sGetCategory(id) {
    const { categories } = await getMeta();
    return categories.find(c => c.id === +id) || null;
}
async function sGetSubCategories(parentId) {
    const { categories } = await getMeta();
    return categories.filter(c => c.parent_id === +parentId);
}
async function sGetTextsByCategory(categoryId) {
    const { texts } = await getMeta();
    return texts.filter(t => t.category_id === +categoryId);
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
async function sGetCommentariesByVerse(verseId) {
    const vid = +verseId;
    if (!_commentaryCache[vid]) {
        const data = await staticGet(`commentary/${vid}.json`);
        _commentaryCache[vid] = data;
        for (const c of data.commentaries) _cid2vid[c.id] = vid;
    }
    return _commentaryCache[vid].commentaries;
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
    const vid = _cid2vid[id];
    if (!vid) throw new Error(`Commentary ${id} not in cache — open the verse page first.`);

    _commentaryCache[vid] = {
        ..._commentaryCache[vid],
        commentaries: _commentaryCache[vid].commentaries.map(c =>
            c.id === id ? { ...c, ...fields } : c
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

// ── Context ───────────────────────────────────────────────────────────────────

const DatabaseContext = createContext(null);

export function DatabaseProvider({ children }) {
    const [loading] = useState(false);
    const [error]   = useState(null);

    const getCategories        = useCallback((     ) => IS_STATIC ? sGetCategories()         : apiFetch('/categories'),                    []);
    const getCategory          = useCallback((id   ) => IS_STATIC ? sGetCategory(id)          : apiFetch(`/categories/${id}`),              []);
    const getSubCategories     = useCallback((id   ) => IS_STATIC ? sGetSubCategories(id)     : apiFetch(`/categories/${id}/subcategories`),[]);
    const getTextsByCategory   = useCallback((id   ) => IS_STATIC ? sGetTextsByCategory(id)   : apiFetch(`/categories/${id}/texts`),        []);
    const getText              = useCallback((id   ) => IS_STATIC ? sGetText(id)              : apiFetch(`/texts/${id}`),                   []);
    const getChaptersByText    = useCallback((id   ) => IS_STATIC ? sGetChaptersByText(id)    : apiFetch(`/texts/${id}/chapters`),          []);
    const getChapter           = useCallback((id   ) => IS_STATIC ? sGetChapter(id)           : apiFetch(`/chapters/${id}`),               []);
    const getVersesByChapter   = useCallback((id   ) => IS_STATIC ? sGetVersesByChapter(id)   : apiFetch(`/chapters/${id}/verses`),        []);
    const getCommentariesByVerse = useCallback((id ) => IS_STATIC ? sGetCommentariesByVerse(id): apiFetch(`/verses/${id}/commentaries`),   []);

    const updateVerse          = useCallback((id, f) => IS_STATIC ? sUpdateVerse(id, f)       : apiPatch(`/verses/${id}`, f),              []);
    const updateCommentary     = useCallback((id, f) => IS_STATIC ? sUpdateCommentary(id, f)  : apiPatch(`/commentaries/${id}`, f),        []);
    const createCommentary     = useCallback((d    ) => IS_STATIC ? sCreateCommentary(d)      : apiPost('/commentaries', d),              []);

    const value = {
        loading, error,
        getCategories, getCategory, getSubCategories, getTextsByCategory,
        getText, getChaptersByText, getChapter, getVersesByChapter,
        getCommentariesByVerse,
        updateVerse, updateCommentary, createCommentary,
    };

    return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
    const ctx = useContext(DatabaseContext);
    if (!ctx) throw new Error('useDatabase must be used within DatabaseProvider');
    return ctx;
}
