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
                        c.id === change.id ? { ...c, content: change.content } : c
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

// Dev-mode fallback: sequential API calls (fast with local server)
async function aApiBulkSave(verseId, changes) {
    for (const change of changes) {
        if (change.kind === 'verseField') {
            await apiPatch(`/verses/${verseId}`, { [change.fieldName]: change.value });
        } else if (change.kind === 'updateCommentary') {
            await apiPatch(`/commentaries/${change.id}`, { content: change.content });
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
    const bulkSaveVerse        = useCallback((id, changes) => IS_STATIC ? sBulkSaveVerse(id, changes) : aApiBulkSave(id, changes),        []);

    const value = {
        loading, error,
        getCategories, getCategory, getSubCategories, getTextsByCategory,
        getText, getChaptersByText, getChapter, getVersesByChapter,
        getCommentariesByVerse,
        updateVerse, updateCommentary, createCommentary, bulkSaveVerse,
    };

    return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
    const ctx = useContext(DatabaseContext);
    if (!ctx) throw new Error('useDatabase must be used within DatabaseProvider');
    return ctx;
}
