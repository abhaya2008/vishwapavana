import { useState } from 'react';
import { getGhConfig, setGhConfig } from '../db/github-writer';

export default function GhSettingsModal({ onClose }) {
    const cfg = getGhConfig() || {};
    const [owner,    setOwner]    = useState(cfg.owner    || '');
    const [repo,     setRepo]     = useState(cfg.repo     || '');
    const [branch,   setBranch]   = useState(cfg.branch   || 'main');
    const [token,    setToken]    = useState(cfg.token    || '');
    const [dataPath, setDataPath] = useState(cfg.dataPath || 'sanskritam/web/public/data');
    const [saving,   setSaving]   = useState(false);
    const [err,      setErr]      = useState('');

    const save = async () => {
        if (!owner.trim() || !repo.trim() || !token.trim()) {
            setErr('Owner, Repository, and Token are required.');
            return;
        }
        setSaving(true);
        setErr('');
        try {
            const res = await fetch(`https://api.github.com/repos/${owner.trim()}/${repo.trim()}`, {
                headers: { Authorization: `token ${token.trim()}`, Accept: 'application/vnd.github.v3+json' },
            });
            if (!res.ok) { setErr('Cannot access that repository. Check owner, repo name and token permissions.'); return; }
            setGhConfig({
                owner:    owner.trim(),
                repo:     repo.trim(),
                branch:   branch.trim() || 'main',
                token:    token.trim(),
                dataPath: dataPath.trim() || 'sanskritam/web/public/data',
            });
            onClose();
        } catch (e) {
            setErr(e.message || 'Network error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="auth-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="auth-modal" style={{ width: 'min(460px, 95vw)' }}>
                <div className="auth-modal-hdr">
                    <span className="auth-modal-title">⚙ GitHub Settings</span>
                    <button className="bulk-close" onClick={onClose}>✕</button>
                </div>
                <div className="auth-modal-body">
                    <p className="auth-hint">
                        When you save edits on GitHub Pages, the app commits the updated JSON file
                        directly to your repo. GitHub Pages then redeploys automatically (~60 s).
                        Create a token at <b>GitHub → Settings → Developer settings → Personal access tokens</b>
                        with <b>Contents: Read &amp; Write</b> permission.
                    </p>
                    {[
                        { label: 'GitHub Owner (username or org)', val: owner,    set: setOwner,    ph: 'your-github-username',       type: 'text' },
                        { label: 'Repository Name',                val: repo,     set: setRepo,     ph: 'your-repo-name',             type: 'text' },
                        { label: 'Branch',                         val: branch,   set: setBranch,   ph: 'main',                       type: 'text' },
                        { label: 'Personal Access Token',          val: token,    set: setToken,    ph: 'ghp_…',                      type: 'password' },
                        { label: 'Data folder path in repo',       val: dataPath, set: setDataPath, ph: 'sanskritam/web/public/data', type: 'text' },
                    ].map(({ label, val, set, ph, type }) => (
                        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <label style={{ fontSize: '0.82rem', color: 'var(--color-subheading-hero)' }}>{label}</label>
                            <input className="auth-input" type={type} value={val}
                                onChange={e => { set(e.target.value); setErr(''); }} placeholder={ph} />
                        </div>
                    ))}
                    {err && <div className="auth-error">{err}</div>}
                    <div className="auth-actions">
                        <button className="mm-editor-save" onClick={save} disabled={saving}>
                            {saving ? 'Testing…' : 'Save & Verify'}
                        </button>
                        <button className="mm-editor-cancel" onClick={onClose}>Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
