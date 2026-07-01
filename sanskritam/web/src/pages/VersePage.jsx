import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDatabase, IS_STATIC } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { EDIT_PASSWORD, isAuthed, storeAuth } from '../utils/auth';

// ── Auth Modal ─────────────────────────────────────────────────────────────────
function AuthModal({ onSuccess, onClose }) {
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
                    <span className="auth-modal-title">🔐 Editor Access</span>
                    <button className="bulk-close" onClick={onClose}>✕</button>
                </div>
                <div className="auth-modal-body">
                    <p className="auth-hint">Enter the editor password to unlock edit mode.</p>
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


// Standard set of headings shown as collapsible panes for every Manimanjari shloka.
// `field` reads directly from the verse row; `match` finds a commentary whose
// commentary_type contains the substring. Panes with no data render a placeholder.
const MANIMANJARI_PANES = [
    { key: 'padaccheda', title: 'पदच्छेदः', field: 'padaccheda' },
    { key: 'anvaya', title: 'अन्वयः', field: 'anvaya' },
    { key: 'anvayartha', title: 'अन्वयार्थः', match: 'अन्वयार्थ' },
    { key: 'sanskrit_vyakhyana', title: 'संस्कृत व्याख्यानम्', match: 'संस्कृत व्याख्यान' },
    { key: 'gudaprakashika', title: 'श्रीमच्छलारि गूडप्रकाशिका', match: 'गूडप्रकाशिका' },
    { key: 'shabda', title: 'शब्दः', match: 'शब्द' },
    { key: 'samasa', title: 'समासः', match: 'समास' },
    { key: 'sandhi', title: 'सन्धिः', match: 'सन्धि' },
    { key: 'dhatu', title: 'धातुः', match: 'धातु' },
    { key: 'tatparya', title: 'तात्पर्यम्', match: 'तात्पर्य' },
    { key: 'vishesha', title: 'विशेषांशः', match: 'विशेष' },
    { key: 'akanksha', title: 'आकांक्षा', match: 'आकांक्षा' },
];

// ── Bulk-import section map ────────────────────────────────────────────────────
const BULK_SECTION_MAP = {
    PADACCHEDA:          { key: 'padaccheda',          title: 'पदच्छेदः',                     tableType: null },
    ANVAYA:              { key: 'anvaya',               title: 'अन्वयः',                        tableType: null },
    ANVAYARTHA:          { key: 'anvayartha',           title: 'अन्वयार्थः',                    tableType: 'word_meanings' },
    SANSKRIT_VYAKHYANA:  { key: 'sanskrit_vyakhyana',  title: 'संस्कृत व्याख्यानम्',           tableType: null },
    GUDAPRAKASHIKA:      { key: 'gudaprakashika',       title: 'श्रीमच्छलारि गूडप्रकाशिका',   tableType: null },
    SHABDA:              { key: 'shabda',               title: 'शब्दः',                         tableType: 'shabda_analysis' },
    SAMASA:              { key: 'samasa',               title: 'समासः',                         tableType: 'samasa' },
    SANDHI:              { key: 'sandhi',               title: 'सन्धिः',                        tableType: 'sandhi' },
    DHATU:               { key: 'dhatu',                title: 'धातुः',                         tableType: 'dhatu' },
    TATPARYA:            { key: 'tatparya',             title: 'तात्पर्यम्',                    tableType: null },
    VISHESHA:            { key: 'vishesha',             title: 'विशेषांशः',                     tableType: null },
    AKANKSHA:            { key: 'akanksha',             title: 'आकांक्षा',                      tableType: null },
};

function parseBulkText(raw) {
    const errors = [];
    const sections = [];

    if (!raw || !raw.trim()) {
        errors.push('Input is empty.');
        return { sections, errors };
    }

    // Split input line-by-line; each "## SECTION_NAME" line starts a new section.
    const lines = raw.split('\n');
    const rawBlocks = [];
    let current = null;
    for (const line of lines) {
        const m = line.match(/^##\s+([A-Z_]+)\s*$/);
        if (m) {
            if (current) rawBlocks.push(current);
            current = { name: m[1], lines: [] };
        } else if (current) {
            current.lines.push(line);
        }
    }
    if (current) rawBlocks.push(current);

    if (rawBlocks.length === 0) {
        errors.push('No section headers found. Each section must start with ## SECTION_NAME on its own line (e.g. ## PADACCHEDA).');
        return { sections, errors };
    }

    for (const block of rawBlocks) {
        const content = block.lines.join('\n').trim();
        const def = BULK_SECTION_MAP[block.name];

        if (!def) {
            errors.push(`Unknown section "## ${block.name}". Allowed: ${Object.keys(BULK_SECTION_MAP).join(', ')}`);
            continue;
        }
        if (!content) continue; // silently skip empty sections

        let parsedData = null;
        let sectionError = null;

        if (def.tableType === 'word_meanings') {
            // Two-column pipe-separated table (Devanagari word | Kannada meaning)
            // Also handles Markdown table format from Gemini: | word | meaning |
            const rows = content.split('\n')
                .map(l => l.trim()).filter(Boolean)
                .map(l => l.replace(/^\|/, '').replace(/\|$/, '').trim()) // strip leading/trailing |
                .filter(l => !/^[-|\s]+$/.test(l)) // skip markdown separator rows (| --- | --- |)
                .filter(Boolean)
                .map(l => l.split('|').map(c => c.trim()).filter(c => c)); // remove empty cols
            const badIdx = rows.findIndex(r => r.length < 2);
            if (badIdx !== -1) {
                sectionError = `## ${block.name} line ${badIdx + 1}: expected "word | meaning" (pipe-separated), got: "${rows[badIdx].join(' ')}"`;
            } else {
                parsedData = { type: 'word_meanings', rows };
            }
        } else if (def.tableType === 'shabda_analysis') {
            // Six-column Sanskrit grammar table: पदम् | शब्दः | अन्तः | लिङ्गम् | विभक्तिः | वचनम्
            // Also handles Markdown table format from Gemini
            const SHABDA_HEADERS = ['पदम्', 'शब्दः', 'अन्तः', 'लिङ्गम्', 'विभक्तिः', 'वचनम्'];
            const rows = content.split('\n')
                .map(l => l.trim()).filter(Boolean)
                .map(l => l.replace(/^\|/, '').replace(/\|$/, '').trim()) // strip leading/trailing |
                .filter(l => !/^[-|\s]+$/.test(l)) // skip markdown separator rows
                .filter(Boolean)
                .map(l => l.split('|').map(c => c.trim()).filter(c => c)); // remove empty cols
            const badIdx = rows.findIndex(r => r.length !== 6);
            if (badIdx !== -1) {
                sectionError = `## SHABDA line ${badIdx + 1}: expected exactly 6 columns (पदम् | शब्दः | अन्तः | लिङ्गम् | विभक्तिः | वचनम्), got ${rows[badIdx].length}.`;
            } else {
                parsedData = { type: 'shabda_analysis', headers: SHABDA_HEADERS, rows };
            }
        } else if (def.tableType === 'samasa') {
            const SAMASA_HEADERS = ['समासपदम्', 'अवयवाः', 'समासप्रकारः'];
            const rows = content.split('\n')
                .map(l => l.trim()).filter(Boolean)
                .map(l => l.replace(/^\|/, '').replace(/\|$/, '').trim())
                .filter(l => !/^[-|\s]+$/.test(l))
                .filter(Boolean)
                .map(l => l.split('|').map(c => c.trim()).filter(c => c));
            const badIdx = rows.findIndex(r => r.length !== 3);
            if (badIdx !== -1) {
                sectionError = `## SAMASA line ${badIdx + 1}: expected exactly 3 columns (समासपदम् | अवयवाः | समासप्रकारः), got ${rows[badIdx].length}.`;
            } else {
                parsedData = { type: 'samasa', headers: SAMASA_HEADERS, rows };
            }
        } else if (def.tableType === 'sandhi') {
            const SANDHI_HEADERS = ['सन्धिपदम्', 'शब्दौ', 'सन्धिप्रकारः'];
            const rows = content.split('\n')
                .map(l => l.trim()).filter(Boolean)
                .map(l => l.replace(/^\|/, '').replace(/\|$/, '').trim())
                .filter(l => !/^[-|\s]+$/.test(l))
                .filter(Boolean)
                .map(l => l.split('|').map(c => c.trim()).filter(c => c));
            const badIdx = rows.findIndex(r => r.length !== 3);
            if (badIdx !== -1) {
                sectionError = `## SANDHI line ${badIdx + 1}: expected exactly 3 columns (सन्धिपदम् | शब्दौ | सन्धिप्रकारः), got ${rows[badIdx].length}.`;
            } else {
                parsedData = { type: 'sandhi', headers: SANDHI_HEADERS, rows };
            }
        } else if (def.tableType === 'dhatu') {
            // Supports multiple dhatus: each HEADER: starts a new group; LAKARA: rows follow.
            const dlines = content.split('\n').map(l => l.trim()).filter(Boolean);
            const dhatus = [];
            let curDhatu = null;
            let curTable = null;
            for (const dl of dlines) {
                if (dl.startsWith('HEADER:')) {
                    if (curTable && curDhatu) { curDhatu.tables.push(curTable); curTable = null; }
                    if (curDhatu) dhatus.push(curDhatu);
                    curDhatu = { header: dl.slice(7).trim(), tables: [] };
                } else if (dl.startsWith('LAKARA:')) {
                    if (!curDhatu) curDhatu = { header: '', tables: [] };
                    if (curTable) curDhatu.tables.push(curTable);
                    curTable = { lakara: dl.slice(7).trim(), rows: [] };
                } else if (curTable) {
                    curTable.rows.push(dl.split('|').map(c => c.trim()));
                }
            }
            if (curTable && curDhatu) curDhatu.tables.push(curTable);
            if (curDhatu) dhatus.push(curDhatu);
            const totalTables = dhatus.reduce((s, d) => s + d.tables.length, 0);
            if (totalTables === 0) {
                sectionError = '## DHATU: at least one "HEADER: ..." + "LAKARA: ..." block is required.';
            } else {
                parsedData = { type: 'dhatu', dhatus };
            }
        }

        if (sectionError) {
            errors.push(sectionError);
        } else {
            sections.push({ key: def.key, title: def.title, content, parsedData });
        }
    }

    return { sections, errors };
}

// ── Bulk Import Modal ──────────────────────────────────────────────────────────
function BulkImportModal({ verse, commentaries, onClose, onSaved }) {
    const { bulkSaveVerse } = useDatabase();
    const [text, setText] = useState('');
    const [parsed, setParsed] = useState(null);
    const [saving, setSaving] = useState(false);
    const [savedOk, setSavedOk] = useState(false);
    const [saveError, setSaveError] = useState('');

    const handleValidate = () => {
        setParsed(parseBulkText(text));
        setSavedOk(false);
        setSaveError('');
    };

    const handleSave = async () => {
        if (!parsed || parsed.errors.length > 0) return;
        setSaving(true);
        setSaveError('');
        try {
            const changes = [];
            for (const sec of parsed.sections) {
                const paneDef = MANIMANJARI_PANES.find(p => p.key === sec.key);
                if (!paneDef) continue;
                const content = sec.parsedData ? JSON.stringify(sec.parsedData) : sec.content;
                if (paneDef.field) {
                    changes.push({ kind: 'verseField', fieldName: paneDef.field, value: content });
                } else {
                    const existing = commentaries.find(c =>
                        (c.commentary_type || '').indexOf(paneDef.match) !== -1
                    );
                    if (existing) {
                        changes.push({ kind: 'updateCommentary', id: existing.id, content });
                    } else {
                        changes.push({ kind: 'createCommentary', commentary_type: paneDef.title, content });
                    }
                }
            }
            await bulkSaveVerse(verse.id, changes);
            setSavedOk(true);
            onSaved(); // refresh parent data; modal stays open to show success
        } catch (e) {
            setSaveError(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const hasErrors  = parsed && parsed.errors.length > 0;
    const hasSections = parsed && parsed.sections.length > 0;

    const previewSummary = (sec) => {
        if (!sec.parsedData) {
            const s = sec.content.slice(0, 120);
            return s + (sec.content.length > 120 ? '…' : '');
        }
        if (sec.parsedData.type === 'word_meanings') {
            return sec.parsedData.rows.slice(0, 3).map(r => r.join(' → ')).join(' · ')
                + (sec.parsedData.rows.length > 3 ? ' …' : '');
        }
        if (sec.parsedData.type === 'shabda_analysis') {
            return sec.parsedData.rows.slice(0, 3).map(r => r[0]).join(' · ')
                + (sec.parsedData.rows.length > 3 ? ' …' : '');
        }
        if (sec.parsedData.type === 'samasa') {
            return sec.parsedData.rows.slice(0, 3).map(r => r[0]).join(' · ')
                + (sec.parsedData.rows.length > 3 ? ' …' : '');
        }
        if (sec.parsedData.type === 'sandhi') {
            return sec.parsedData.rows.slice(0, 3).map(r => r[0]).join(' · ')
                + (sec.parsedData.rows.length > 3 ? ' …' : '');
        }
        if (sec.parsedData.type === 'dhatu') {
            const dhs = sec.parsedData.dhatus || [{ header: sec.parsedData.header || '' }];
            return dhs.map(d => d.header || '—').join(' · ');
        }
        return '';
    };

    const previewBadge = (sec) => {
        if (!sec.parsedData) return null;
        if (sec.parsedData.type === 'word_meanings') return `${sec.parsedData.rows.length} rows`;
        if (sec.parsedData.type === 'shabda_analysis') return `${sec.parsedData.rows.length} rows`;
        if (sec.parsedData.type === 'samasa') return `${sec.parsedData.rows.length} rows`;
        if (sec.parsedData.type === 'sandhi') return `${sec.parsedData.rows.length} rows`;
        if (sec.parsedData.type === 'dhatu') {
            const dhs = sec.parsedData.dhatus || [{ tables: sec.parsedData.tables || [] }];
            const lcount = dhs.reduce((s, d) => s + (d.tables || []).length, 0);
            return `${dhs.length} dhatu${dhs.length !== 1 ? 's' : ''}, ${lcount} lakara`;
        }
        return null;
    };

    return (
        <div className="bulk-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bulk-modal">
                <div className="bulk-modal-hdr">
                    <span className="bulk-modal-title">📋 Bulk Import Commentary</span>
                    <button className="bulk-close" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="bulk-modal-body">
                    <p className="bulk-hint">
                        Paste LLM-generated commentary below. Each section begins with <code>## SECTION_NAME</code> on its own line.
                        Use <strong>Validate &amp; Preview</strong> to check for errors before saving.
                    </p>
                    <textarea
                        className="bulk-textarea"
                        value={text}
                        onChange={e => { setText(e.target.value); setParsed(null); setSavedOk(false); }}
                        placeholder={"## PADACCHEDA\nवन्दे गोविन्दम् आनन्द-ज्ञान-देहं पतिं श्रियः\n\n## ANVAYA\nअहं आनन्दज्ञानदेहं श्रियः पतिं गोविन्दं वन्दे ।\n\n## SHABDA\nअहं | ನಾನು\nगोविन्दं | ನಾರಾಯಣನನ್ನು\n\n## DHATU\nHEADER: वदिँ अभिवादनस्तुत्योः\nLAKARA: लट् लकारः\nवन्दते | वन्देते | वन्दन्ते | प्र०\nवन्दसे | वन्देथे | वन्दध्वे | म०\nवन्दे | वन्दावहे | वन्दामहे | उ०"}
                        spellCheck={false}
                    />
                    <div className="bulk-actions">
                        <button className="bulk-btn-primary" onClick={handleValidate}>
                            Validate &amp; Preview
                        </button>
                        {hasSections && !hasErrors && !savedOk && (
                            <button className="bulk-btn-save" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving…' : `Save ${parsed.sections.length} section${parsed.sections.length !== 1 ? 's' : ''}`}
                            </button>
                        )}
                        {!savedOk && <button className="bulk-btn-secondary" onClick={onClose}>Cancel</button>}
                    </div>

                    {saveError && (
                        <div className="bulk-error-box" style={{ marginTop: '0.5rem' }}>
                            <div className="bulk-error-heading">⚠ Save failed:</div>
                            <div className="bulk-error-line">{saveError}</div>
                        </div>
                    )}

                    {parsed && (
                        <div className="bulk-results">
                            {hasErrors && (
                                <div className="bulk-error-box">
                                    <div className="bulk-error-heading">⚠ Fix the following issues before saving:</div>
                                    {parsed.errors.map((err, i) => (
                                        <div key={i} className="bulk-error-line">• {err}</div>
                                    ))}
                                </div>
                            )}
                            {savedOk && (
                                <div className="bulk-success" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span>✓ {parsed.sections.length} section{parsed.sections.length !== 1 ? 's' : ''} saved to GitHub successfully.</span>
                                    <button className="bulk-btn-secondary" onClick={onClose}>Close</button>
                                </div>
                            )}
                            {hasSections && (
                                <div className="bulk-preview">
                                    <div className="bulk-preview-hdr">
                                        {parsed.sections.length} section{parsed.sections.length !== 1 ? 's' : ''} ready:
                                    </div>
                                    {parsed.sections.map(sec => (
                                        <div key={sec.key} className="bulk-preview-item">
                                            <div className="bulk-preview-item-hdr">
                                                <span className="bulk-check">✓</span>
                                                <span className="bulk-section-title">{sec.title}</span>
                                                {previewBadge(sec) && <span className="bulk-badge">{previewBadge(sec)}</span>}
                                            </div>
                                            <div className="bulk-preview-item-body">{previewSummary(sec)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!hasErrors && !hasSections && (
                                <div className="bulk-error-box">
                                    <div className="bulk-error-line">No content found. Make sure sections are not empty.</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function parseCommentaryContent(content) {
    try {
        const parsed = JSON.parse(content);
        if (parsed && parsed.type) return parsed;
    } catch (_) {}
    return null;
}

// Resolve the data backing a Manimanjari pane: either a verse field value (string)
// or a matched commentary row. Returns null when there is nothing to show.
function resolvePaneData(def, verse, commentaries) {
    if (def.field) {
        const val = verse ? verse[def.field] : '';
        return val && String(val).trim() ? { kind: 'text', value: String(val) } : null;
    }
    const comm = commentaries.find(c => (c.commentary_type || '').indexOf(def.match) !== -1);
    return comm && (comm.content || '').trim() ? { kind: 'commentary', value: comm.content } : null;
}

// ── Rich Text Editor ──────────────────────────────────────────────────────────
function RichTextEditor({ initialValue, onChange, onInsertTable }) {
    const ref = useRef(null);
    const [tableMenuOpen, setTableMenuOpen] = useState(false);

    useEffect(() => {
        if (ref.current) {
            ref.current.innerHTML = initialValue || '';
            ref.current.focus();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close table menu when clicking outside
    useEffect(() => {
        if (!tableMenuOpen) return;
        const close = () => setTableMenuOpen(false);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [tableMenuOpen]);

    const noBlur = (e) => e.preventDefault();

    const exec = (cmd) => {
        ref.current.focus();
        document.execCommand(cmd, false, null);
        onChange(ref.current.innerHTML);
    };

    const insertTable = (type) => {
        setTableMenuOpen(false);
        if (type === 'dhatu') {
            onInsertTable({ type: 'dhatu', dhatus: [{ header: '', tables: [{ lakara: '', rows: [['', '', '', ''], ['', '', '', ''], ['', '', '', '']] }] }] });
        } else if (type === 'shabda_analysis') {
            const SHABDA_HEADERS = ['पदम्', 'शब्दः', 'अन्तः', 'लिङ्गम्', 'विभक्तिः', 'वचनम्'];
            onInsertTable({ type: 'shabda_analysis', headers: SHABDA_HEADERS, rows: [['', '', '', '', '', ''], ['', '', '', '', '', '']] });
        } else if (type === 'samasa') {
            onInsertTable({ type: 'samasa', headers: ['समासपदम्', 'अवयवाः', 'समासप्रकारः'], rows: [['', '', ''], ['', '', '']] });
        } else if (type === 'sandhi') {
            onInsertTable({ type: 'sandhi', headers: ['सन्धिपदम्', 'शब्दौ', 'सन्धिप्रकारः'], rows: [['', '', ''], ['', '', '']] });
        } else {
            onInsertTable({ type: 'word_meanings', rows: [['', ''], ['', '']] });
        }
    };

    return (
        <div className="rte-wrapper">
            <div className="rte-toolbar">
                <button type="button" className="rte-btn" onMouseDown={noBlur} onClick={() => exec('bold')} title="Bold"><b>B</b></button>
                <button type="button" className="rte-btn" onMouseDown={noBlur} onClick={() => exec('italic')} title="Italic"><i>I</i></button>
                <button type="button" className="rte-btn" onMouseDown={noBlur} onClick={() => exec('underline')} title="Underline"><u>U</u></button>
                <button type="button" className="rte-btn" onMouseDown={noBlur} onClick={() => exec('strikeThrough')} title="Strikethrough"><s>S</s></button>
                <span className="rte-sep" />
                <button type="button" className="rte-btn" onMouseDown={noBlur} onClick={() => exec('insertUnorderedList')} title="Bullet list">• List</button>
                <button type="button" className="rte-btn" onMouseDown={noBlur} onClick={() => exec('insertOrderedList')} title="Numbered list">1. List</button>
                <span className="rte-sep" />
                <button type="button" className="rte-btn rte-btn-align" onMouseDown={noBlur} onClick={() => exec('justifyLeft')} title="Align left">⊢</button>
                <button type="button" className="rte-btn rte-btn-align" onMouseDown={noBlur} onClick={() => exec('justifyCenter')} title="Align center">≡</button>
                <button type="button" className="rte-btn rte-btn-align" onMouseDown={noBlur} onClick={() => exec('justifyRight')} title="Align right">⊣</button>
                <span className="rte-sep" />
                <span className="rte-table-wrap" style={{ position: 'relative' }}>
                    <button
                        type="button"
                        className="rte-btn"
                        onMouseDown={noBlur}
                        onClick={(e) => { e.stopPropagation(); setTableMenuOpen(v => !v); }}
                        title="Insert table"
                    >⊞ Table ▾</button>
                    {tableMenuOpen && (
                        <div className="rte-table-menu" onMouseDown={e => e.stopPropagation()}>
                            <button type="button" onClick={() => insertTable('word_meanings')}>Word meanings (2 col)</button>
                            <button type="button" onClick={() => insertTable('shabda_analysis')}>Shabda analysis (6 col)</button>
                            <button type="button" onClick={() => insertTable('samasa')}>Samasa (3 col)</button>
                            <button type="button" onClick={() => insertTable('sandhi')}>Sandhi (3 col)</button>
                            <button type="button" onClick={() => insertTable('dhatu')}>Dhatu conjugation</button>
                        </div>
                    )}
                </span>
            </div>
            <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                className="rte-content"
                onInput={() => onChange(ref.current.innerHTML)}
            />
        </div>
    );
}

// ── Table Editor (for word_meanings / grammar JSON panes) ──────────────────────
function TableEditor({ tableData, onChange, onSwitchToText }) {
    const [rows, setRows] = useState(() => (tableData.rows || [['', '']]).map(r => [...r]));
    const colCount = rows[0]?.length || 2;
    const focusedCellRef = useRef(null);

    const update = (next) => {
        setRows(next);
        onChange({ ...tableData, rows: next });
    };

    const updateCell = (ri, ci, val) =>
        update(rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r));

    const addRow = () => update([...rows, new Array(colCount).fill('')]);
    const addCol = () => update(rows.map(r => [...r, '']));
    const delRow = (ri) => { if (rows.length > 1) update(rows.filter((_, i) => i !== ri)); };
    const delCol = (ci) => { if (colCount > 1) update(rows.map(r => r.filter((_, j) => j !== ci))); };

    const applyBold = () => {
        const el = focusedCellRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        if (start === end) return;
        const ri = parseInt(el.dataset.ri);
        const ci = parseInt(el.dataset.ci);
        const val = rows[ri][ci];
        const newVal = val.slice(0, start) + '<b>' + val.slice(start, end) + '</b>' + val.slice(end);
        const newRows = rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? newVal : c) : r);
        setRows(newRows);
        onChange({ ...tableData, rows: newRows });
        setTimeout(() => { el.focus(); el.setSelectionRange(start + 3, end + 3); }, 0);
    };

    return (
        <div className="tbl-editor">
            <div className="tbl-toolbar">
                <button type="button" className="tbl-btn" onMouseDown={e => e.preventDefault()} onClick={applyBold}><b>B</b></button>
                <span className="rte-sep" />
                <button type="button" className="tbl-btn" onClick={addRow}>+ Row</button>
                <button type="button" className="tbl-btn" onClick={addCol}>+ Column</button>
                <button type="button" className="tbl-btn tbl-btn-alt" onClick={onSwitchToText}>Switch to text</button>
            </div>
            <div className="tbl-scroll">
                <table className="tbl-edit-table">
                    <thead>
                        <tr>
                            {Array.from({ length: colCount }).map((_, ci) => (
                                <th key={ci}>
                                    <button type="button" className="tbl-del-btn" onClick={() => delCol(ci)} title="Delete column">✕ col</button>
                                </th>
                            ))}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr key={ri}>
                                {row.map((cell, ci) => (
                                    <td key={ci}>
                                        <textarea
                                            className="tbl-cell-input"
                                            value={cell}
                                            onChange={e => updateCell(ri, ci, e.target.value)}
                                            onFocus={e => { focusedCellRef.current = e.target; }}
                                            onClick={e => { focusedCellRef.current = e.target; }}
                                            data-ri={ri}
                                            data-ci={ci}
                                            rows={2}
                                        />
                                    </td>
                                ))}
                                <td className="tbl-row-del">
                                    <button type="button" className="tbl-del-btn" onClick={() => delRow(ri)} title="Delete row">✕ row</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Dhatu Editor (nested sub-tables, supports multiple dhatu groups) ──────────
function DhatuEditor({ tableData, onChange, onSwitchToText }) {
    // Normalise: support old { header, tables } and new { dhatus: [{header, tables}] }
    const initDhatus = tableData.dhatus
        || [{ header: tableData.header || '', tables: (tableData.tables || [{ lakara: '', rows: [['', '', '', '']] }]).map(t => ({ ...t, rows: t.rows.map(r => [...r]) })) }];

    const [dhatus, setDhatus] = useState(() =>
        initDhatus.map(d => ({ header: d.header || '', tables: (d.tables || []).map(t => ({ ...t, rows: t.rows.map(r => [...r]) })) }))
    );
    const focusedCellRef = useRef(null);

    const notify = (ds) => onChange({ ...tableData, type: 'dhatu', dhatus: ds });

    const updDhatuHeader = (di, v) => { const n = dhatus.map((d, i) => i === di ? { ...d, header: v } : d); setDhatus(n); notify(n); };
    const updLakara = (di, ti, v) => { const n = dhatus.map((d, i) => i !== di ? d : { ...d, tables: d.tables.map((t, j) => j === ti ? { ...t, lakara: v } : t) }); setDhatus(n); notify(n); };
    const updCell = (di, ti, ri, ci, v) => {
        const n = dhatus.map((d, i) => i !== di ? d : { ...d, tables: d.tables.map((t, j) => j !== ti ? t : { ...t, rows: t.rows.map((r, k) => k !== ri ? r : r.map((c, l) => l === ci ? v : c)) }) });
        setDhatus(n); notify(n);
    };
    const addRow = (di, ti) => { const cols = dhatus[di].tables[ti].rows[0]?.length || 4; const n = dhatus.map((d, i) => i !== di ? d : { ...d, tables: d.tables.map((t, j) => j !== ti ? t : { ...t, rows: [...t.rows, new Array(cols).fill('')] }) }); setDhatus(n); notify(n); };
    const addCol = (di, ti) => { const n = dhatus.map((d, i) => i !== di ? d : { ...d, tables: d.tables.map((t, j) => j !== ti ? t : { ...t, rows: t.rows.map(r => [...r, '']) }) }); setDhatus(n); notify(n); };
    const delRow = (di, ti, ri) => { if (dhatus[di].tables[ti].rows.length <= 1) return; const n = dhatus.map((d, i) => i !== di ? d : { ...d, tables: d.tables.map((t, j) => j !== ti ? t : { ...t, rows: t.rows.filter((_, k) => k !== ri) }) }); setDhatus(n); notify(n); };
    const delCol = (di, ti, ci) => { if ((dhatus[di].tables[ti].rows[0]?.length || 1) <= 1) return; const n = dhatus.map((d, i) => i !== di ? d : { ...d, tables: d.tables.map((t, j) => j !== ti ? t : { ...t, rows: t.rows.map(r => r.filter((_, k) => k !== ci)) }) }); setDhatus(n); notify(n); };
    const addSubTable = (di) => { const cols = dhatus[di].tables[0]?.rows[0]?.length || 4; const n = dhatus.map((d, i) => i !== di ? d : { ...d, tables: [...d.tables, { lakara: '', rows: [new Array(cols).fill('')] }] }); setDhatus(n); notify(n); };
    const delTable = (di, ti) => { if (dhatus[di].tables.length <= 1) return; const n = dhatus.map((d, i) => i !== di ? d : { ...d, tables: d.tables.filter((_, j) => j !== ti) }); setDhatus(n); notify(n); };
    const addDhatu = () => { const n = [...dhatus, { header: '', tables: [{ lakara: '', rows: [['', '', '', ''], ['', '', '', ''], ['', '', '', '']] }] }]; setDhatus(n); notify(n); };
    const delDhatu = (di) => { if (dhatus.length <= 1) return; const n = dhatus.filter((_, i) => i !== di); setDhatus(n); notify(n); };

    const applyBold = () => {
        const el = focusedCellRef.current;
        if (!el) return;
        const start = el.selectionStart, end = el.selectionEnd;
        if (start === end) return;
        const di = parseInt(el.dataset.di), ti = parseInt(el.dataset.ti), ri = parseInt(el.dataset.ri), ci = parseInt(el.dataset.ci);
        const val = dhatus[di].tables[ti].rows[ri][ci];
        const newVal = val.slice(0, start) + '<b>' + val.slice(start, end) + '</b>' + val.slice(end);
        const n = dhatus.map((d, i) => i !== di ? d : { ...d, tables: d.tables.map((t, j) => j !== ti ? t : { ...t, rows: t.rows.map((r, k) => k !== ri ? r : r.map((c, l) => l === ci ? newVal : c)) }) });
        setDhatus(n); notify(n);
        setTimeout(() => { el.focus(); el.setSelectionRange(start + 3, end + 3); }, 0);
    };

    return (
        <div className="tbl-editor">
            <div className="tbl-toolbar">
                <button type="button" className="tbl-btn" onMouseDown={e => e.preventDefault()} onClick={applyBold}><b>B</b></button>
                <span className="rte-sep" />
                <button type="button" className="tbl-btn" onClick={addDhatu}>+ Add Dhatu</button>
                <button type="button" className="tbl-btn tbl-btn-alt" onClick={onSwitchToText}>Switch to text</button>
            </div>
            {dhatus.map((dhatu, di) => (
                <div key={di} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.7rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.6rem' }}>
                        <div style={{ flex: 1 }}>
                            <div className="tbl-field-label">Header / Root info</div>
                            <input
                                type="text"
                                className="tbl-header-input"
                                value={dhatu.header}
                                onChange={e => updDhatuHeader(di, e.target.value)}
                                placeholder="e.g., भू सत्तायाम् (परस्मैपदी, भ्वादिगणः)"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', paddingBottom: '0.1rem' }}>
                            <button type="button" className="tbl-btn tbl-btn-sm" onClick={() => addSubTable(di)}>+ Lakara</button>
                            {dhatus.length > 1 && (
                                <button type="button" className="tbl-del-btn" onClick={() => delDhatu(di)} title="Remove this dhatu">✕ dhatu</button>
                            )}
                        </div>
                    </div>
                    {dhatu.tables.map((t, ti) => (
                        <div key={ti} className="dhatu-subtable">
                            <div className="dhatu-subtable-head">
                                <input
                                    type="text"
                                    className="tbl-lakara-input"
                                    value={t.lakara}
                                    onChange={e => updLakara(di, ti, e.target.value)}
                                    placeholder="Lakara (e.g., लट् लकारः)"
                                />
                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                    <button type="button" className="tbl-btn tbl-btn-sm" onClick={() => addRow(di, ti)}>+ Row</button>
                                    <button type="button" className="tbl-btn tbl-btn-sm" onClick={() => addCol(di, ti)}>+ Col</button>
                                    {dhatu.tables.length > 1 && (
                                        <button type="button" className="tbl-del-btn" onClick={() => delTable(di, ti)}>✕ table</button>
                                    )}
                                </div>
                            </div>
                            <div className="tbl-scroll">
                                <table className="tbl-edit-table">
                                    <thead>
                                        <tr>
                                            {Array.from({ length: t.rows[0]?.length || 4 }).map((_, ci) => (
                                                <th key={ci}>
                                                    <button type="button" className="tbl-del-btn" onClick={() => delCol(di, ti, ci)}>✕ col</button>
                                                </th>
                                            ))}
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {t.rows.map((row, ri) => (
                                            <tr key={ri}>
                                                {row.map((cell, ci) => (
                                                    <td key={ci}>
                                                        <textarea
                                                            className="tbl-cell-input"
                                                            value={cell}
                                                            onChange={e => updCell(di, ti, ri, ci, e.target.value)}
                                                            onFocus={e => { focusedCellRef.current = e.target; }}
                                                            onClick={e => { focusedCellRef.current = e.target; }}
                                                            data-di={di}
                                                            data-ti={ti}
                                                            data-ri={ri}
                                                            data-ci={ci}
                                                            rows={2}
                                                        />
                                                    </td>
                                                ))}
                                                <td className="tbl-row-del">
                                                    <button type="button" className="tbl-del-btn" onClick={() => delRow(di, ti, ri)}>✕ row</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ── Smart Editor: auto-detects table JSON vs rich text ─────────────────────────
function SmartEditor({ rawValue, onDraftChange }) {
    const parsed = (() => {
        try {
            const p = JSON.parse(rawValue);
            return p && (p.type === 'word_meanings' || p.type === 'shabda_analysis' || p.type === 'grammar' || p.type === 'dhatu' || p.type === 'samasa' || p.type === 'sandhi') ? p : null;
        } catch (_) { return null; }
    })();

    const [mode, setMode] = useState(parsed ? 'table' : 'rich');
    const [tableData, setTableData] = useState(parsed || { type: 'word_meanings', rows: [['', '']] });

    const handleTableChange = (data) => { setTableData(data); onDraftChange(JSON.stringify(data)); };

    const handleInsertTable = (tData) => {
        setTableData(tData);
        setMode('table');
        onDraftChange(JSON.stringify(tData));
    };

    if (mode === 'table') {
        if (tableData.type === 'dhatu') {
            return (
                <DhatuEditor
                    tableData={tableData}
                    onChange={handleTableChange}
                    onSwitchToText={() => { setMode('rich'); onDraftChange(''); }}
                />
            );
        }
        return (
            <TableEditor
                tableData={tableData}
                onChange={handleTableChange}
                onSwitchToText={() => { setMode('rich'); onDraftChange(''); }}
            />
        );
    }
    return (
        <RichTextEditor
            initialValue={rawValue}
            onChange={onDraftChange}
            onInsertTable={handleInsertTable}
        />
    );
}

// ── Collapsible Pane ───────────────────────────────────────────────────────────
function CollapsiblePane({ id, title, isOpen, onToggle, hasData, rawText, onSave, onEditRequested, children }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const startEdit = (e) => {
        e.stopPropagation();
        const doEdit = () => { setDraft(rawText || ''); setEditing(true); };
        if (onEditRequested) { onEditRequested(doEdit); } else { doEdit(); }
    };

    const cancelEdit = () => setEditing(false);

    const saveEdit = async () => {
        if (!onSave) return;
        setSaving(true);
        setSaveError('');
        try {
            await onSave(draft);
            setEditing(false);
        } catch (e) {
            setSaveError(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div id={id} className="mm-pane">
            <button
                className="mm-pane-header"
                onClick={onToggle}
                aria-expanded={isOpen}
            >
                <span className="mm-pane-title">॥ {title} ॥</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                        className="mm-edit-btn"
                        role="button"
                        title="Edit"
                        onClick={startEdit}
                    >✎</span>
                    <span className="mm-pane-chevron">{isOpen ? '▲' : '▼'}</span>
                </span>
            </button>
            {isOpen && (
                <div className="mm-pane-content">
                    {editing ? (
                        <div className="mm-editor">
                            <SmartEditor rawValue={rawText || ''} onDraftChange={setDraft} />
                            {saveError && <div className="auth-error" style={{ margin: '0.3rem 0' }}>{saveError}</div>}
                            <div className="mm-editor-actions">
                                <button className="mm-editor-save" onClick={saveEdit} disabled={saving}>
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                                <button className="mm-editor-cancel" onClick={cancelEdit}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        hasData ? children : <span className="mm-pane-empty">— वक्ष्यते —</span>
                    )}
                </div>
            )}
        </div>
    );
}

function WordMeaningsTable({ rows }) {
    return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff4e2' : '#fff' }}>
                            <td style={{ padding: '0.45rem 0.9rem', fontWeight: 600, color: 'var(--ink-mid, #4A3728)', borderRight: '1px solid var(--border-color)', borderBottom: i < rows.length - 1 ? '1px solid var(--border-color)' : 'none', minWidth: '160px', width: '32%', fontFamily: 'var(--font-sanskrit)', whiteSpace: 'pre-wrap' }}>
                                {row[0]}
                            </td>
                            <td style={{ padding: '0.45rem 0.9rem', borderBottom: i < rows.length - 1 ? '1px solid var(--border-color)' : 'none', fontFamily: "'Noto Sans Kannada', sans-serif", fontSize: '0.87rem', color: '#2A1E10' }}>
                                {row[1]}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function GrammarTable({ rows }) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#F8F3EE' : '#fff' }}>
                            <td style={{ padding: '0.4rem 0.9rem', fontWeight: 600, color: 'var(--ink, #1E1510)', borderRight: '1px solid #E0D8CE', borderBottom: '1px solid #E0D8CE', minWidth: '120px', fontFamily: 'var(--font-sanskrit)' }}>
                                {row[0]}
                            </td>
                            <td style={{ padding: '0.4rem 0.9rem', borderBottom: '1px solid #E0D8CE', fontFamily: 'var(--font-sanskrit)', color: 'var(--color-subheading-hero)' }}>
                                {row[1]}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ShabdaTable({ headers, rows }) {
    return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                <thead>
                    <tr style={{ background: 'var(--cream-dark, #F0E8DB)' }}>
                        {(headers || []).map((h, i) => (
                            <th key={i} style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border-color)', fontFamily: 'var(--font-sanskrit)', textAlign: 'left', color: 'var(--color-maroon)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff4e2' : '#fff' }}>
                            {row.map((cell, j) => (
                                <td key={j} style={{ padding: '0.4rem 0.65rem', border: `1px solid var(--border-color)`, fontFamily: 'var(--font-sanskrit)', textAlign: 'left', color: j === 0 ? 'var(--color-maroon)' : '#2A1E10', fontWeight: j === 0 ? 600 : 400 }}>
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DhatuTables({ header, tables, dhatus }) {
    // Normalise: support old { header, tables } and new { dhatus: [{header, tables}] }
    const groups = dhatus || [{ header: header || '', tables: tables || [] }];
    return (
        <div>
            {groups.map((dhatu, gi) => (
                <div key={gi} style={{ marginBottom: groups.length > 1 ? '1.8rem' : 0 }}>
                    {dhatu.header && (
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-maroon)', marginBottom: '0.6rem', fontFamily: 'var(--font-sanskrit)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                            {dhatu.header}
                        </div>
                    )}
                    {(dhatu.tables || []).map((t, ti) => (
                        <div key={ti} style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--sutra-color)', fontFamily: 'var(--font-sanskrit)', marginBottom: '0.25rem', padding: '0.2rem 0.5rem', background: 'rgba(245,121,3,0.08)', borderRadius: '4px' }}>
                                {t.lakara}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sanskrit)', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--cream-dark, #F0E8DB)' }}>
                                            <th style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-color)', textAlign: 'left' }}>एकवचनं</th>
                                            <th style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-color)', textAlign: 'left' }}>द्विवचनं</th>
                                            <th style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-color)', textAlign: 'left' }}>बहुवचनं</th>
                                            <th style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.72rem' }}>पुरुषः</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {t.rows.map((row, ri) => (
                                            <tr key={ri} style={{ background: ri % 2 === 0 ? '#FAF5EF' : '#fff' }}>
                                                {row.map((cell, ci) => (
                                                    <td key={ci} style={{ padding: '0.35rem 0.5rem', border: '1px solid #E8DDD0', textAlign: 'left', color: ci === 3 ? 'var(--sutra-color)' : 'var(--color-subheading-hero)', fontSize: ci === 3 ? '0.72rem' : undefined }}>
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function HeaderedTable({ headers, rows }) {
    return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                <thead>
                    <tr style={{ background: 'var(--cream-dark, #F0E8DB)' }}>
                        {(headers || []).map((h, i) => (
                            <th key={i} style={{ padding: '0.4rem 0.7rem', border: '1px solid var(--border-color)', fontFamily: 'var(--font-sanskrit)', textAlign: 'left', color: 'var(--color-maroon)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff4e2' : '#fff' }}>
                            {row.map((cell, j) => (
                                <td key={j} style={{ padding: '0.4rem 0.7rem', border: '1px solid var(--border-color)', fontFamily: 'var(--font-sanskrit)', textAlign: 'left', color: j === 0 ? 'var(--color-maroon)' : '#2A1E10', fontWeight: j === 0 ? 600 : 400 }}>
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const HTML_TAG_RE = /<[a-zA-Z]/;

function CommentaryContent({ content }) {
    const parsed = parseCommentaryContent(content);
    if (!parsed) {
        if (content && HTML_TAG_RE.test(content)) {
            return <div className="commentary-text rte-output" dangerouslySetInnerHTML={{ __html: content }} />;
        }
        return <div className="commentary-text">{content}</div>;
    }
    if (parsed.type === 'word_meanings') return <WordMeaningsTable rows={parsed.rows} />;
    if (parsed.type === 'shabda_analysis') return <ShabdaTable headers={parsed.headers} rows={parsed.rows} />;
    if (parsed.type === 'samasa') return <HeaderedTable headers={parsed.headers} rows={parsed.rows} />;
    if (parsed.type === 'sandhi') return <HeaderedTable headers={parsed.headers} rows={parsed.rows} />;
    if (parsed.type === 'grammar') return <GrammarTable rows={parsed.rows} />;
    if (parsed.type === 'dhatu') return <DhatuTables header={parsed.header} tables={parsed.tables} dhatus={parsed.dhatus} />;
    return <div className="commentary-text">{content}</div>;
}

export default function VersePage() {
    const { chapterId, verseId } = useParams();
    const navigate = useNavigate();
    const {
        getChapter,
        getVersesByChapter,
        getCommentariesByVerse,
        updateVerse,
        updateCommentary,
        createCommentary,
    } = useDatabase();
    const loading = false;

    const [chapter, setChapter] = useState(null);
    const [verses, setVerses] = useState([]);
    const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
    const [commentaries, setCommentaries] = useState([]);
    const [showPadaccheda] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [openPanes, setOpenPanes] = useState({});
    const [activePane, setActivePane] = useState(null);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [indexMinimized, setIndexMinimized] = useState(false);
    const [editingShloka, setEditingShloka] = useState(false);
    const [shlokaDraft, setShlokaDraft] = useState('');
    const [savingShloka, setSavingShloka] = useState(false);
    const [authModal, setAuthModal] = useState(null); // { onSuccess: fn } when open
    const [savedAt, setSavedAt] = useState(null);
    const verseCardRef = useRef(null);

    const requireAuth = useCallback((onSuccess) => {
        if (isAuthed()) { onSuccess(); }
        else { setAuthModal({ onSuccess }); }
    }, []);

    const isManimanjari = !!(chapter && (
        chapter.text_id === 3 ||
        (chapter.text_name && chapter.text_name.indexOf('मणिमञ्जरी') !== -1)
    ));

    const togglePane = useCallback((key) => {
        setOpenPanes(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const scrollToPane = useCallback((key) => {
        const el = document.getElementById(`mm-pane-${key}`);
        if (el) {
            // Measure the actual bottom of the sticky verse container so the pane
            // appears just below it regardless of how tall the card is.
            const stickyBottom = verseCardRef.current
                ? verseCardRef.current.getBoundingClientRect().bottom
                : 160;
            const top = el.getBoundingClientRect().top + window.scrollY - stickyBottom - 12;
            window.scrollTo({ top, behavior: 'smooth' });
        }
        setOpenPanes(prev => ({ ...prev, [key]: true }));
        setActivePane(key);
    }, []);

    useEffect(() => {
        async function fetchData() {
            const chapterData = await getChapter(chapterId);
            setChapter(chapterData);

            const versesData = await getVersesByChapter(chapterId);
            setVerses(versesData);

            if (verseId) {
                const idx = versesData.findIndex(v => v.id === parseInt(verseId));
                if (idx !== -1) setCurrentVerseIndex(idx);
            }
        }
        fetchData();
    }, [chapterId, verseId, getChapter, getVersesByChapter]);

    const refreshCommentaries = useCallback(async () => {
        if (verses.length > 0 && verses[currentVerseIndex]) {
            const data = await getCommentariesByVerse(verses[currentVerseIndex].id);
            setCommentaries(data);
        }
    }, [currentVerseIndex, verses, getCommentariesByVerse]);

    useEffect(() => {
        refreshCommentaries();
    }, [refreshCommentaries]);

    const handleGhError = useCallback((e) => {
        if (e.message && (e.message.includes('GitHub not configured') || e.message.includes('GitHub'))) {
            alert('GitHub not configured. Click the ⚙ GitHub button in the top-right header to set up saving.');
        }
    }, []);

    // Build a save handler for a pane — persists via API (dev) or GitHub commit (static).
    const buildSaveHandler = useCallback((def, verse, comms) => {
        return async (newText) => {
            try {
                if (def.field) {
                    const updated = await updateVerse(verse.id, { [def.field]: newText });
                    setVerses(prev => prev.map((v, i) => i === currentVerseIndex ? { ...v, ...updated } : v));
                } else {
                    const existing = comms.find(c => (c.commentary_type || '').indexOf(def.match) !== -1);
                    if (existing) {
                        await updateCommentary(existing.id, { content: newText });
                    } else {
                        await createCommentary({
                            verse_id: verse.id,
                            commentary_type: def.title,
                            author: '',
                            content: newText,
                        });
                    }
                    await refreshCommentaries();
                }
                if (IS_STATIC) setSavedAt(Date.now());
            } catch (e) {
                handleGhError(e);
                throw e;
            }
        };
    }, [currentVerseIndex, updateVerse, updateCommentary, createCommentary, refreshCommentaries, handleGhError]);

    // Reset shloka edit mode on verse change
    useEffect(() => { setEditingShloka(false); }, [currentVerseIndex]);

    const saveShloka = async () => {
        if (!currentVerse) return;
        setSavingShloka(true);
        try {
            const updated = await updateVerse(currentVerse.id, { content_sanskrit: shlokaDraft });
            setVerses(prev => prev.map((v, i) => i === currentVerseIndex ? { ...v, ...updated } : v));
            setEditingShloka(false);
            if (IS_STATIC) setSavedAt(Date.now());
        } catch (e) {
            handleGhError(e);
            alert(e.message || 'Save failed');
        } finally {
            setSavingShloka(false);
        }
    };

    // All Manimanjari panes open by default on every verse change.
    useEffect(() => {
        if (!isManimanjari) return;
        const next = {};
        MANIMANJARI_PANES.forEach(def => { next[def.key] = true; });
        setOpenPanes(next);
    }, [isManimanjari, currentVerseIndex]);

    // Scroll to top visibility
    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const goToPrevVerse = useCallback(() => {
        if (currentVerseIndex > 0) {
            const newIdx = currentVerseIndex - 1;
            setCurrentVerseIndex(newIdx);
            navigate(`/chapter/${chapterId}/verse/${verses[newIdx].id}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentVerseIndex, chapterId, verses, navigate]);

    const goToNextVerse = useCallback(() => {
        if (currentVerseIndex < verses.length - 1) {
            const newIdx = currentVerseIndex + 1;
            setCurrentVerseIndex(newIdx);
            navigate(`/chapter/${chapterId}/verse/${verses[newIdx].id}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentVerseIndex, verses, chapterId, navigate]);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') goToPrevVerse();
            if (e.key === 'ArrowRight') goToNextVerse();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToPrevVerse, goToNextVerse]);

    if (loading || !chapter) {
        return (
            <div className="page-wrapper">
                <Header />
                <main className="main-content">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading...</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    const currentVerse = verses[currentVerseIndex];

    return (
        <div className="verse-page-wrapper">
            <Header />

            <main className="verse-main-content" id="mainsection">
                {/* Sticky Verse Card - stays at top on scroll */}
                <div className="sticky-verse-container" ref={verseCardRef}>
                    {currentVerse && (
                        <div className="verse-sticky-card">
                            {/* Verse Number Badge */}
                            <div className="verse-badge-sticky">
                                {currentVerse.verse_number}
                            </div>

                            {/* Shloka Edit Button */}
                            {!editingShloka && (
                                <button
                                    className="shloka-edit-btn"
                                    title="Edit shloka text"
                                    onClick={() => requireAuth(() => { setShlokaDraft(currentVerse.content_sanskrit || ''); setEditingShloka(true); })}
                                >✎</button>
                            )}

                            {/* Main Verse Text */}
                            {editingShloka ? (
                                <div className="shloka-edit-wrap">
                                    <textarea
                                        className="shloka-edit-textarea"
                                        value={shlokaDraft}
                                        onChange={e => setShlokaDraft(e.target.value)}
                                        rows={4}
                                    />
                                    <div className="shloka-edit-actions">
                                        <button className="mm-editor-save" onClick={saveShloka} disabled={savingShloka}>
                                            {savingShloka ? 'Saving…' : 'Save'}
                                        </button>
                                        <button className="mm-editor-cancel" onClick={() => setEditingShloka(false)}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="verse-text-sticky">
                                    {currentVerse.content_sanskrit.split(/\s*।\s*/).filter(Boolean).map((pada, i, arr) => (
                                        <div key={i}>
                                            {pada}{i < arr.length - 1 ? ' ।' : ''}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Commentary Section */}
                <div className="commentary-container">
                    {isManimanjari ? (
                        /* Standard collapsible panes + right index for every Manimanjari shloka */
                        <div className="mm-layout">
                            <div className="mm-panes">
                                <div className="mm-bulk-bar">
                                    <button className="mm-bulk-btn" onClick={() => requireAuth(() => setShowBulkImport(true))}>
                                        📋 Bulk Import
                                    </button>
                                </div>
                                {IS_STATIC && savedAt && (Date.now() - savedAt < 30000) && (
                                    <div style={{ margin: '0.4rem 0', padding: '0.5rem 0.8rem', background: '#F0FFF4', border: '1px solid #68D391', borderRadius: '6px', fontSize: '0.82rem', color: '#276749' }}>
                                        ✓ Saved to GitHub! Refresh the page to see latest data.
                                    </div>
                                )}
                                {MANIMANJARI_PANES.map(def => {
                                    const data = resolvePaneData(def, currentVerse, commentaries);
                                    const rawText = data ? data.value : '';
                                    return (
                                        <CollapsiblePane
                                            key={def.key}
                                            id={`mm-pane-${def.key}`}
                                            title={def.title}
                                            isOpen={!!openPanes[def.key]}
                                            onToggle={() => togglePane(def.key)}
                                            hasData={!!data}
                                            rawText={rawText}
                                            onSave={buildSaveHandler(def, currentVerse, commentaries)}
                                            onEditRequested={requireAuth}
                                        >
                                            {data && data.kind === 'commentary' && (
                                                <CommentaryContent content={data.value} />
                                            )}
                                            {data && data.kind === 'text' && (
                                                HTML_TAG_RE.test(data.value)
                                                    ? <div className="commentary-text rte-output" dangerouslySetInnerHTML={{ __html: data.value }} />
                                                    : <div className="commentary-text" style={{ whiteSpace: 'pre-wrap' }}>{data.value}</div>
                                            )}
                                        </CollapsiblePane>
                                    );
                                })}
                            </div>
                            {/* Right-side sticky index */}
                            <nav className={`mm-index${indexMinimized ? ' mm-index-collapsed' : ''}`} aria-label="Pane index">
                                <div className="mm-index-heading">
                                    {!indexMinimized && <span className="mm-index-title">अनुक्रमणिका</span>}
                                    <button
                                        className="mm-index-toggle"
                                        onClick={() => setIndexMinimized(v => !v)}
                                        title={indexMinimized ? 'Expand index' : 'Collapse index'}
                                    >{indexMinimized ? '»' : '«'}</button>
                                </div>
                                {!indexMinimized && (
                                    <ul className="mm-index-list">
                                        {MANIMANJARI_PANES.map(def => (
                                            <li key={def.key} className="mm-index-item">
                                                <button
                                                    className={`mm-index-btn${activePane === def.key ? ' active' : ''}`}
                                                    onClick={() => scrollToPane(def.key)}
                                                >
                                                    {def.title}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </nav>
                        </div>
                    ) : (
                    <>
                    {/* Anvaya / Meaning Prose (shown first) */}
                    {currentVerse && currentVerse.anvaya && (
                        <div className="commentary-block">
                            <div className="commentary-block-header">॥ अन्वयः ॥</div>
                            <div className="commentary-block-content">{currentVerse.anvaya}</div>
                        </div>
                    )}

                    {/* Commentary Sections with Gold Headers */}
                    {commentaries.length > 0 ? (
                        <div className="commentary-sections">
                            {commentaries.map((comm, idx) => (
                                <div key={comm.id} className="commentary-block">
                                    <div className="commentary-block-header">
                                        ॥ {comm.author || comm.author_name || `Commentary ${idx + 1}`} ॥
                                    </div>
                                    <div className="commentary-block-content">
                                        <CommentaryContent content={comm.content || comm.content_sanskrit || ''} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Show sample sections matching reference */
                        <div className="commentary-sections">
                            <div className="commentary-block">
                                <div className="commentary-block-header">
                                    ॥ छात्रतोषिणी टीका ॥
                                </div>
                                <div className="commentary-block-content has-tabs">
                                    <div className="commentary-tabs-inline">
                                        <button className="commentary-tab-inline active">॥ छात्रतोषिणी टीका ॥</button>
                                        <button className="commentary-tab-inline">॥ विशेष-व्याख्या: ॥</button>
                                    </div>
                                    <div className="commentary-text">
                                        we will add data <span className="highlight-text">soon</span>.
                                    </div>
                                </div>
                            </div>

                            <div className="commentary-block">
                                <div className="commentary-block-header">
                                    ॥ अन्वयदीपिका - गुजराती ॥
                                </div>
                                <div className="commentary-block-content">
                                    we will add data soon.
                                </div>
                            </div>

                            <div className="commentary-block">
                                <div className="commentary-block-header">
                                    ॥ श्रीरघुवीराचार्यश्रीविरचितम् - भाष्यम् ॥
                                </div>
                                <div className="commentary-block-content">
                                    we will add data soon.
                                </div>
                            </div>

                            <div className="commentary-block">
                                <div className="commentary-block-header">
                                    ॥ श्रीभगवत्प्रसादाचार्यश्रीविरचिता - भाष्यार्थबोधि॥
                                </div>
                                <div className="commentary-block-content">
                                    we will add data soon.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Meaning Sections */}
                    {currentVerse && (
                        <>
                            {currentVerse.meaning_sanskrit && (
                                <div className="commentary-block">
                                    <div className="commentary-block-header">
                                        ॥ अर्थः ॥
                                    </div>
                                    <div className="commentary-block-content">
                                        {currentVerse.meaning_sanskrit}
                                    </div>
                                </div>
                            )}

                            {currentVerse.meaning_english && (
                                <div className="commentary-block">
                                    <div className="commentary-block-header">
                                        ॥ English Meaning ॥
                                    </div>
                                    <div className="commentary-block-content">
                                        {currentVerse.meaning_english}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    </>
                    )}
                </div>

                {/* Scroll to Top Button */}
                {showScrollTop && (
                    <button className="scroll-top-btn" onClick={scrollToTop}>
                        ↑
                    </button>
                )}
            </main>

            {/* Fixed Bottom Navigation Bar - like shikshapatri/1 */}
            <nav className="bottom-nav-bar">
                <Link to={`/text/${chapter.text_id}`} className="bottom-nav-btn">
                    ←
                </Link>
                <button
                    className="bottom-nav-btn"
                    onClick={goToPrevVerse}
                    disabled={currentVerseIndex === 0}
                >
                    ‹
                </button>
                <button
                    className="bottom-nav-btn"
                    onClick={goToNextVerse}
                    disabled={currentVerseIndex >= verses.length - 1}
                >
                    ›
                </button>
                <button
                    className="bottom-nav-btn"
                    onClick={() => setSidebarOpen(true)}
                >
                    ≡
                </button>
            </nav>

            {/* Verse Selector Sidebar */}
            {authModal && (
                <AuthModal
                    onSuccess={authModal.onSuccess}
                    onClose={() => setAuthModal(null)}
                />
            )}
            {showBulkImport && currentVerse && (
                <BulkImportModal
                    verse={currentVerse}
                    commentaries={commentaries}
                    onClose={() => setShowBulkImport(false)}
                    onSaved={async () => {
                        // Don't close — BulkImportModal shows success + Close button
                        const versesData = await getVersesByChapter(chapterId);
                        setVerses(versesData);
                        await refreshCommentaries();
                    }}
                />
            )}

            {sidebarOpen && (
                <>
                    <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
                    <div className="verse-selector-sidebar">
                        <div className="sidebar-header">
                            <h3>॥ श्लोक सूची ॥</h3>
                            <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
                        </div>
                        <div className="sidebar-content">
                            <div className="verse-grid-sidebar">
                                {verses.map((v, idx) => (
                                    <button
                                        key={v.id}
                                        className={`verse-grid-btn ${idx === currentVerseIndex ? 'active' : ''}`}
                                        onClick={() => {
                                            setCurrentVerseIndex(idx);
                                            navigate(`/chapter/${chapterId}/verse/${v.id}`);
                                            setSidebarOpen(false);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                    >
                                        {v.verse_number}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
