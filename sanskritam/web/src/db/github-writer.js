// GitHub Contents API writer — used by database.jsx in static (GitHub Pages) mode.
// Commits a file directly to the repo so edits persist without a server.

const GH_CONFIG_KEY = 'skt_gh_config';

export function getGhConfig() {
    try { return JSON.parse(localStorage.getItem(GH_CONFIG_KEY) || 'null'); }
    catch { return null; }
}

export function setGhConfig(cfg) {
    localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(cfg));
}

export function clearGhConfig() {
    localStorage.removeItem(GH_CONFIG_KEY);
}

export function isGhConfigured() {
    const cfg = getGhConfig();
    return !!(cfg?.token && cfg?.owner && cfg?.repo);
}

/**
 * Commit a file to GitHub.
 * @param {string} filePath  - path within repo, e.g. "web/public/data/commentary/7.json"
 * @param {string} content   - UTF-8 file content
 * @param {string} message   - commit message
 */
export async function ghCommitFile(filePath, content, message) {
    const cfg = getGhConfig();
    if (!cfg?.token || !cfg?.owner || !cfg?.repo) {
        throw new Error('GitHub not configured. Please set up GitHub settings.');
    }

    const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;
    const headers = {
        Authorization: `token ${cfg.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    };

    // 1. Get current file SHA (needed for updates; 404 means new file — that's fine)
    // cache:'no-store' prevents the browser serving a cached raw-content response
    // that was stored by staticGet() for the same URL with a different Accept type.
    let sha;
    const getRes = await fetch(apiUrl, { headers, cache: 'no-store' });
    if (getRes.ok) {
        sha = (await getRes.json()).sha;
    } else if (getRes.status !== 404) {
        const err = await getRes.json().catch(() => ({}));
        throw new Error(err.message || `GitHub GET failed: ${getRes.status}`);
    }

    // 2. Base64-encode content (handle Unicode via URI encoding trick)
    const encoded = btoa(unescape(encodeURIComponent(content)));

    // 3. PUT (create or update)
    const body = { message, content: encoded, branch: cfg.branch || 'main' };
    if (sha) body.sha = sha;

    const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
    });
    if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        throw new Error(err.message || `GitHub PUT failed: ${putRes.status}`);
    }
    return putRes.json();
}
