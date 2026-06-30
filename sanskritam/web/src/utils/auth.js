export const EDIT_PASSWORD = 'manimanjari'; // change this to your desired password
const AUTH_KEY = 'skt_edit_auth';
const AUTH_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function isAuthed() {
    try {
        const s = localStorage.getItem(AUTH_KEY);
        return !!s && Date.now() < JSON.parse(s).exp;
    } catch (_) { return false; }
}

export function storeAuth() {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ exp: Date.now() + AUTH_EXPIRY_MS }));
}
