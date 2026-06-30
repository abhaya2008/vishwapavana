import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IS_STATIC } from '../db/database';
import { isGhConfigured } from '../db/github-writer';
import { EDIT_PASSWORD, isAuthed, storeAuth } from '../utils/auth';
import GhSettingsModal from './GhSettingsModal';

function GhAuthPrompt({ onSuccess, onClose }) {
    const [pwd, setPwd] = useState('');
    const [err, setErr] = useState('');
    const inputRef = useRef(null);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

    const submit = () => {
        if (pwd === EDIT_PASSWORD) {
            storeAuth();
            onClose();
            onSuccess();
        } else {
            setErr('Incorrect password');
            setPwd('');
        }
    };

    return (
        <div className="auth-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="auth-modal">
                <div className="auth-modal-hdr">
                    <span className="auth-modal-title">🔐 Admin Access</span>
                    <button className="bulk-close" onClick={onClose}>✕</button>
                </div>
                <div className="auth-modal-body">
                    <p className="auth-hint">Enter the editor password to access GitHub Settings.</p>
                    <input
                        ref={inputRef}
                        type="password"
                        className="auth-input"
                        value={pwd}
                        onChange={e => { setPwd(e.target.value); setErr(''); }}
                        onKeyDown={e => e.key === 'Enter' && submit()}
                        placeholder="Password"
                        autoComplete="current-password"
                    />
                    {err && <div className="auth-error">{err}</div>}
                    <div className="auth-actions">
                        <button className="mm-editor-save" onClick={submit}>Unlock</button>
                        <button className="mm-editor-cancel" onClick={onClose}>Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Header() {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [ghModal, setGhModal] = useState(false);
    const [authPrompt, setAuthPrompt] = useState(false);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
        }
    };

    const handleGhClick = () => {
        if (isAuthed()) {
            setGhModal(true);
        } else {
            setAuthPrompt(true);
        }
    };

    const configured = IS_STATIC && isGhConfigured();

    return (
        <>
            <header className="header">
                <div className="container header-inner">
                    <Link to="/" className="logo">
                        <span className="logo-icon">🕉</span>
                        <span className="logo-text">संस्कृतम्</span>
                    </Link>

                    <form className="search-container" onSubmit={handleSearch}>
                        <div className="search-bar">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="खोजें..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button type="submit" className="search-btn">
                                🔍
                            </button>
                        </div>
                    </form>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {IS_STATIC && (
                            <button
                                className="gh-settings-btn"
                                onClick={handleGhClick}
                                title={configured ? 'GitHub connected — click to change settings' : 'GitHub not configured — set up to enable saving'}
                                style={{
                                    background: configured ? 'var(--color-gold-light, #FFF3CD)' : 'var(--red-bg, #FFF0F0)',
                                    border: `1px solid ${configured ? 'var(--color-gold, #D4A017)' : 'var(--red-color, #C0392B)'}`,
                                    borderRadius: '6px',
                                    padding: '0.35rem 0.6rem',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    color: configured ? 'var(--color-maroon, #6B2737)' : '#C0392B',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                ⚙ {configured ? 'GitHub ✓' : 'GitHub'}
                            </button>
                        )}

                        <button
                            className="menu-btn"
                            onClick={() => setDrawerOpen(true)}
                            aria-label="Open menu"
                        >
                            <svg className="menu-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Navigation Drawer */}
            <div
                className={`nav-drawer-overlay ${drawerOpen ? 'open' : ''}`}
                onClick={() => setDrawerOpen(false)}
            />
            <nav className={`nav-drawer ${drawerOpen ? 'open' : ''}`}>
                <button
                    className="vyakhya-close"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close menu"
                >
                    ✕
                </button>
                <ul className="nav-list">
                    <li className="nav-item">
                        <Link to="/" className="nav-link" onClick={() => setDrawerOpen(false)}>
                            गृहम् (Home)
                        </Link>
                    </li>
                    <li className="nav-item">
                        <Link to="/about" className="nav-link" onClick={() => setDrawerOpen(false)}>
                            परिचयः (About)
                        </Link>
                    </li>
                    <li className="nav-item">
                        <Link to="/feedback" className="nav-link" onClick={() => setDrawerOpen(false)}>
                            प्रतिक्रिया (Feedback)
                        </Link>
                    </li>
                </ul>
            </nav>

            {authPrompt && (
                <GhAuthPrompt
                    onSuccess={() => setGhModal(true)}
                    onClose={() => setAuthPrompt(false)}
                />
            )}
            {ghModal && <GhSettingsModal onClose={() => setGhModal(false)} />}
        </>
    );
}
