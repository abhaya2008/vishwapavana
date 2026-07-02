import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDatabase, IS_STATIC } from '../db/database';
import { isAuthed, storeAuth, EDIT_PASSWORD } from '../utils/auth';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';

// ── Shloka splitter ────────────────────────────────────────────────────────────
// Strategy 1: split on ।। / ॥ markers (with optional trailing verse numbers).
// Strategy 2: fall back to blank-line separation.
function splitShlokas(raw) {
    const text = raw.replace(/॥/g, '।।').replace(/\r\n/g, '\n').trim();
    if (text.includes('।।')) {
        const parts = text
            .split(/।।[0-9०-९\s।]*/)
            .map(v => v.trim())
            .filter(v => v.length > 3);
        if (parts.length > 0) return parts;
    }
    return text.split(/\n{2,}/).map(v => v.trim()).filter(v => v.length > 3);
}

// ── Auth Modal ─────────────────────────────────────────────────────────────────
function AuthModal({ onSuccess, onClose }) {
    const [pwd, setPwd] = useState('');
    const [err, setErr] = useState('');
    const inputRef = useRef(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
    const submit = () => {
        if (pwd === EDIT_PASSWORD) { storeAuth(); onClose(); onSuccess(); }
        else { setErr('Incorrect password'); setPwd(''); }
    };
    return (
        <div className="auth-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="auth-modal">
                <div className="auth-modal-hdr">
                    <span className="auth-modal-title">🔐 Editor Access</span>
                    <button className="bulk-close" onClick={onClose}>✕</button>
                </div>
                <div className="auth-modal-body">
                    <p className="auth-hint">Enter the editor password to add shlokas.</p>
                    <input ref={inputRef} type="password" className="auth-input" value={pwd}
                        onChange={e => { setPwd(e.target.value); setErr(''); }}
                        onKeyDown={e => e.key === 'Enter' && submit()}
                        placeholder="Password" autoComplete="current-password" />
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

// ── Add Verses Modal ───────────────────────────────────────────────────────────
function AddVersesModal({ chapter, existingVerses, onClose, onAdded }) {
    const { addVersesToChapter } = useDatabase();
    const [mode, setMode] = useState('bulk');
    const [rawText, setRawText] = useState('');
    const [splitResult, setSplitResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [savedOk, setSavedOk] = useState(false);
    const [singleNum, setSingleNum] = useState('');
    const [singleText, setSingleText] = useState('');

    // Compute next verse number from existing verses in this chapter
    const nextInfo = useMemo(() => {
        const prefix = String(chapter.chapter_number || 1);
        let maxN = 0;
        for (const v of (existingVerses || [])) {
            const parts = (v.verse_number || '').split('.');
            if (parts[0] === prefix) {
                const n = parseInt(parts[1]) || 0;
                if (n > maxN) maxN = n;
            }
        }
        return { prefix, next: maxN + 1 };
    }, [chapter.chapter_number, existingVerses]);

    useEffect(() => { setSingleNum(`${nextInfo.prefix}.${nextInfo.next}`); }, [nextInfo]);

    const handleSplit = () => {
        const parts = splitShlokas(rawText);
        setSplitResult(parts.map((content, i) => ({
            verse_number: `${nextInfo.prefix}.${nextInfo.next + i}`,
            content_sanskrit: content,
        })));
    };

    const doSave = async (specs) => {
        if (!specs.length) return;
        setSaving(true); setSaveError('');
        try {
            await addVersesToChapter(chapter.id, specs);
            setSavedOk(true);
            onAdded();
        } catch (e) {
            setSaveError(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bulk-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bulk-modal">
                <div className="bulk-modal-hdr">
                    <span className="bulk-modal-title">+ Shlokas — {chapter.name_sanskrit}</span>
                    <button className="bulk-close" onClick={onClose}>✕</button>
                </div>
                <div className="bulk-modal-body">
                    {!savedOk && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            <button className={`bulk-btn-${mode === 'bulk' ? 'primary' : 'secondary'}`}
                                onClick={() => { setMode('bulk'); setSaveError(''); setSplitResult(null); }}>
                                📋 Bulk Paste
                            </button>
                            <button className={`bulk-btn-${mode === 'single' ? 'primary' : 'secondary'}`}
                                onClick={() => { setMode('single'); setSaveError(''); }}>
                                ✎ Single Shloka
                            </button>
                        </div>
                    )}

                    {savedOk && (
                        <div className="bulk-success" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span>✓ Shlokas added to GitHub successfully.</span>
                            <button className="bulk-btn-secondary" onClick={onClose}>Close</button>
                        </div>
                    )}

                    {/* ── Bulk paste ── */}
                    {!savedOk && mode === 'bulk' && (
                        <>
                            <p className="bulk-hint">
                                Paste all shlokas below. They are split on <code>।।</code>/<code>॥</code> verse-end markers or
                                blank lines. Verse numbers start from <strong>{nextInfo.prefix}.{nextInfo.next}</strong>.
                            </p>
                            <textarea
                                className="bulk-textarea"
                                value={rawText}
                                onChange={e => { setRawText(e.target.value); setSplitResult(null); setSaveError(''); }}
                                placeholder={"वन्दे गोविन्दमानन्द-ज्ञानदेहं पतिं श्रियः ।\nश्रीमदानन्दतीर्थार्य-वल्लभं परमक्षरम् ।।१।।\n\nससर्ज भगवानाऽऽदौ त्रीन् गुणान् प्रकृतेः परः ।\nमहत्तत्त्वं ततो विष्णुः सृष्टवान् ब्रह्मणस्तनुम् ।।२।।"}
                                spellCheck={false}
                            />
                            <div className="bulk-actions">
                                <button className="bulk-btn-primary" onClick={handleSplit} disabled={!rawText.trim()}>
                                    Split &amp; Preview
                                </button>
                                {splitResult && splitResult.length > 0 && (
                                    <button className="bulk-btn-save" onClick={() => doSave(splitResult)} disabled={saving}>
                                        {saving ? 'Saving…' : `Add ${splitResult.length} Shloka${splitResult.length !== 1 ? 's' : ''}`}
                                    </button>
                                )}
                                <button className="bulk-btn-secondary" onClick={onClose}>Cancel</button>
                            </div>
                            {saveError && (
                                <div className="bulk-error-box" style={{ marginTop: '0.5rem' }}>
                                    <div className="bulk-error-heading">⚠ Error:</div>
                                    <div className="bulk-error-line">{saveError}</div>
                                </div>
                            )}
                            {splitResult && (
                                <div className="bulk-results">
                                    <div className="bulk-preview">
                                        <div className="bulk-preview-hdr">
                                            {splitResult.length} shloka{splitResult.length !== 1 ? 's' : ''} detected:
                                        </div>
                                        {splitResult.map((v, i) => (
                                            <div key={i} className="bulk-preview-item">
                                                <div className="bulk-preview-item-hdr">
                                                    <span className="bulk-check">✓</span>
                                                    <input
                                                        type="text"
                                                        value={v.verse_number}
                                                        onChange={e => setSplitResult(prev =>
                                                            prev.map((x, j) => j === i ? { ...x, verse_number: e.target.value } : x)
                                                        )}
                                                        style={{ fontFamily: 'var(--font-sanskrit)', fontSize: '0.82rem', width: '5rem', padding: '0.15rem 0.3rem', border: '1px solid var(--border-color)', borderRadius: '3px' }}
                                                    />
                                                </div>
                                                <div className="bulk-preview-item-body" style={{ fontFamily: 'var(--font-sanskrit)', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                                                    {v.content_sanskrit.slice(0, 120)}{v.content_sanskrit.length > 120 ? '…' : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Single shloka ── */}
                    {!savedOk && mode === 'single' && (
                        <>
                            <div style={{ marginBottom: '0.8rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--ink-mid, #5a4030)', marginBottom: '0.25rem' }}>
                                    Verse number
                                </label>
                                <input type="text" value={singleNum} onChange={e => setSingleNum(e.target.value)}
                                    style={{ fontFamily: 'var(--font-sanskrit)', fontSize: '0.9rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px', width: '8rem' }}
                                    placeholder="e.g. 1.3"
                                />
                            </div>
                            <div style={{ marginBottom: '0.8rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--ink-mid, #5a4030)', marginBottom: '0.25rem' }}>
                                    Shloka text
                                </label>
                                <textarea
                                    className="bulk-textarea"
                                    style={{ minHeight: '100px' }}
                                    value={singleText}
                                    onChange={e => setSingleText(e.target.value)}
                                    placeholder="वन्दे गोविन्दमानन्द-ज्ञानदेहं पतिं श्रियः ।"
                                    spellCheck={false}
                                />
                            </div>
                            <div className="bulk-actions">
                                <button
                                    className="bulk-btn-save"
                                    onClick={() => doSave([{ verse_number: singleNum, content_sanskrit: singleText.trim() }])}
                                    disabled={saving || !singleText.trim()}
                                >
                                    {saving ? 'Saving…' : 'Add Shloka'}
                                </button>
                                <button className="bulk-btn-secondary" onClick={onClose}>Cancel</button>
                            </div>
                            {saveError && (
                                <div className="bulk-error-box" style={{ marginTop: '0.5rem' }}>
                                    <div className="bulk-error-heading">⚠ Error:</div>
                                    <div className="bulk-error-line">{saveError}</div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TextPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getText, getChaptersByText, getVersesByChapter, loading } = useDatabase();

    const [text, setText] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [expandedChapter, setExpandedChapter] = useState(null);
    const [versesByChapter, setVersesByChapter] = useState({});
    const [loadingVerses, setLoadingVerses] = useState({});
    const [authModal, setAuthModal] = useState(null);
    const [addVersesChapter, setAddVersesChapter] = useState(null);

    const requireAuth = useCallback((onSuccess) => {
        if (isAuthed()) onSuccess();
        else setAuthModal({ onSuccess });
    }, []);

    useEffect(() => {
        async function fetchData() {
            const textData = await getText(id);
            setText(textData);
            const chaptersData = await getChaptersByText(id);
            setChapters(chaptersData);
        }
        fetchData();
    }, [id, getText, getChaptersByText]);

    const handleChapterClick = async (chapter) => {
        if (expandedChapter === chapter.id) {
            setExpandedChapter(null);
            return;
        }
        setExpandedChapter(chapter.id);
        if (!versesByChapter[chapter.id]) {
            setLoadingVerses(prev => ({ ...prev, [chapter.id]: true }));
            const verses = await getVersesByChapter(chapter.id);
            setVersesByChapter(prev => ({ ...prev, [chapter.id]: verses }));
            setLoadingVerses(prev => ({ ...prev, [chapter.id]: false }));
        }
    };

    // Load verses for a chapter (if not yet loaded) then open the add-verses modal.
    const handleAddVersesClick = useCallback(async (chapter, e) => {
        e.stopPropagation();
        if (!versesByChapter[chapter.id]) {
            const verses = await getVersesByChapter(chapter.id);
            setVersesByChapter(prev => ({ ...prev, [chapter.id]: verses }));
        }
        requireAuth(() => setAddVersesChapter(chapter));
    }, [versesByChapter, getVersesByChapter, requireAuth]);

    if (loading || !text) {
        return (
            <div className="page-wrapper">
                <Header />
                <main className="main-content">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p className="mt-md">Loading...</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <Header />

            <main className="main-content">
                <div className="container">
                    <Breadcrumb items={[
                        { label: text.category_name || 'Category', path: `/category/${text.category_id}` },
                        { label: text.name_sanskrit, path: `/text/${id}` }
                    ]} />

                    <section className="page-title-section">
                        <h1 className="page-title">॥ {text.name_sanskrit} ॥</h1>
                        {text.name_english && <p className="page-description">{text.name_english}</p>}
                        {text.author && <p className="page-description mt-sm">रचयिता: {text.author}</p>}
                    </section>

                    <section className="mt-xl">
                        <div className="text-list">
                            {chapters.map((chapter, index) => {
                                const isOpen = expandedChapter === chapter.id;
                                const verses = versesByChapter[chapter.id] || [];
                                const isLoadingV = !!loadingVerses[chapter.id];

                                return (
                                    <div key={chapter.id} className={`chapter-accordion${isOpen ? ' chapter-accordion-open' : ''}`}>
                                        {/* Chapter header: toggle button + optional "Add" button side-by-side */}
                                        <div style={{ display: 'flex', alignItems: 'stretch' }}>
                                            <button
                                                className="text-item chapter-accordion-hdr"
                                                style={{ flex: 1, borderRadius: IS_STATIC ? '6px 0 0 6px' : undefined }}
                                                onClick={() => handleChapterClick(chapter)}
                                                aria-expanded={isOpen}
                                            >
                                                <span className="text-number">
                                                    {chapter.chapter_number || index + 1}
                                                </span>
                                                <span className="text-title">
                                                    {chapter.name_sanskrit}
                                                    {chapter.name_english && (
                                                        <span className="chapter-name-en">
                                                            ({chapter.name_english})
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-arrow chapter-chevron">
                                                    {isOpen ? '▲' : '▼'}
                                                </span>
                                            </button>

                                            {IS_STATIC && (
                                                <button
                                                    onClick={e => handleAddVersesClick(chapter, e)}
                                                    title="Add shlokas to this chapter"
                                                    style={{
                                                        padding: '0 1rem',
                                                        background: 'var(--color-maroon, #7B2D2D)',
                                                        color: '#fff8f0',
                                                        border: 'none',
                                                        borderLeft: '1px solid rgba(255,255,255,0.15)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.04em',
                                                        borderRadius: '0 6px 6px 0',
                                                        flexShrink: 0,
                                                        minWidth: '3.5rem',
                                                    }}
                                                >
                                                    + Add
                                                </button>
                                            )}
                                        </div>

                                        {/* Expanded verse list */}
                                        {isOpen && (
                                            <div className="chapter-verse-list">
                                                {isLoadingV ? (
                                                    <div className="chapter-verse-loading">
                                                        <div className="spinner spinner-sm" />
                                                        <span>Loading shlokas…</span>
                                                    </div>
                                                ) : verses.length === 0 ? (
                                                    <div className="chapter-verse-empty">
                                                        अद्य श्लोकाः उपलब्धाः नसन्ति ।
                                                    </div>
                                                ) : (
                                                    verses.map((verse) => (
                                                        <button
                                                            key={verse.id}
                                                            className="chapter-verse-item"
                                                            onClick={() => navigate(`/chapter/${chapter.id}/verse/${verse.id}`)}
                                                        >
                                                            <span className="chapter-verse-num">
                                                                {verse.verse_number}
                                                            </span>
                                                            <span className="chapter-verse-text">
                                                                {verse.content_sanskrit || '—'}
                                                            </span>
                                                            <span className="chapter-verse-arrow">→</span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {chapters.length === 0 && (
                                <div className="text-center p-xl">
                                    <p className="sanskrit" style={{ color: 'var(--color-subheading-hero)' }}>
                                        अध्यायाः उपलब्धाः नसन्ति।<br />
                                        No chapters available yet.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>

            <Footer />

            {authModal && (
                <AuthModal onSuccess={authModal.onSuccess} onClose={() => setAuthModal(null)} />
            )}
            {addVersesChapter && (
                <AddVersesModal
                    chapter={addVersesChapter}
                    existingVerses={versesByChapter[addVersesChapter.id] || []}
                    onClose={() => setAddVersesChapter(null)}
                    onAdded={async () => {
                        // Refresh the verse list from the updated in-memory cache
                        const updated = await getVersesByChapter(addVersesChapter.id);
                        setVersesByChapter(prev => ({ ...prev, [addVersesChapter.id]: updated }));
                        // Auto-expand the chapter so the new verses are visible
                        setExpandedChapter(addVersesChapter.id);
                    }}
                />
            )}
        </div>
    );
}
