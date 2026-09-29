import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDatabase } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';

// अनुक्रमणिका pages for a text (currently Srimad Bhagavatam): one page per index, with
// a tab row to switch between them. Two layouts, chosen by the manifest's `kind`:
//   groups  — headed lists of links (stuti, vishaya; vakta is collapsible per speaker)
//   letters — pick an akshara, load that shard (akshara = shloka first lines, pada =
//             word concordance with its occurrences)
// Every item carries ref "skandha.adhyaya[.verse]"; manifest.chapters maps
// "skandha.adhyaya" to the chapter id, and the verse becomes ?n= for the reader.

const DEVA = '०१२३४५६७८९';
const toDeva = (s) => String(s).replace(/[0-9]/g, d => DEVA[d]);
const CAP = 600;

function refPath(chapters, ref) {
    const [sk, a, v] = ref.split('.');
    const cid = chapters[`${sk}.${a}`];
    if (!cid) return null;
    return `/mahabharata/chapter/${cid}${v ? `?n=${v}` : ''}`;
}

function RefLink({ chapters, refStr, children, className }) {
    const path = refPath(chapters, refStr);
    return path ? <Link to={path} className={className}>{children}</Link> : <span className={className}>{children}</span>;
}

function GroupsIndex({ data, chapters }) {
    const [filter, setFilter] = useState('');
    const [open, setOpen] = useState(null);
    const q = filter.trim().toLowerCase();

    const groups = useMemo(() => {
        if (!q) return data.groups;
        return data.groups
            .map(g => ({ ...g, items: g.items.filter(it => `${it.label} ${it.sub || ''}`.toLowerCase().includes(q)) }))
            .filter(g => g.items.length || g.title.toLowerCase().includes(q));
    }, [data, q]);

    return (
        <>
            {(data.searchable || data.collapsible) && (
                <input
                    type="text"
                    className="mb-search-input"
                    placeholder="अन्विष्यतु… (search)"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            )}
            <div className="anu-groups">
                {groups.map((g, gi) => {
                    const isOpen = !data.collapsible || open === gi || !!q;
                    return (
                        <section key={gi} className="anu-group">
                            {data.collapsible ? (
                                <button className="mb-section-hdr anu-group-toggle" onClick={() => setOpen(open === gi ? null : gi)}>
                                    <span className="text-title">{g.title}</span>
                                    {g.sub && <span className="mb-section-count">{g.sub}</span>}
                                    <span className="text-arrow chapter-chevron">{isOpen ? '▲' : '▼'}</span>
                                </button>
                            ) : (
                                <h2 className="anu-group-title">{g.title}</h2>
                            )}
                            {isOpen && g.items.map((it, i) => (
                                <RefLink key={i} chapters={chapters} refStr={it.ref || ''} className="anu-row">
                                    {it.range && <span className="mb-topic-range">{toDeva(it.range)}</span>}
                                    <span className="anu-row-body">
                                        <span className="anu-row-label">{it.label}</span>
                                        {it.sub && it.sub !== it.label && <span className="anu-row-sub">{it.sub}</span>}
                                        {it.note && <span className="anu-row-sub">{it.note}</span>}
                                    </span>
                                    {it.count != null && <span className="mb-section-count">{toDeva(it.count)} श्लोकाः</span>}
                                </RefLink>
                            ))}
                        </section>
                    );
                })}
                {groups.length === 0 && <p className="text-center p-xl">न किमपि लब्धम्। No match.</p>}
            </div>
        </>
    );
}

function LettersIndex({ textId, entry, chapters }) {
    const { getAnukramanika } = useDatabase();
    const [letter, setLetter] = useState(null);
    const [shard, setShard] = useState({ hex: null, rows: null });   // last loaded letter shard
    const [filter, setFilter] = useState('');
    const isPada = entry.key === 'pada';

    // typing picks the akshara of the first character automatically
    const typedLetter = filter.trim() ? entry.letters.find(([L]) => L === filter.trim()[0]) : null;
    const active = typedLetter || letter;

    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        const hex = active[1];
        getAnukramanika(textId, `${entry.key}/${hex}`).then(r => { if (!cancelled) setShard({ hex, rows: r }); });
        return () => { cancelled = true; };
    }, [active, entry.key, textId, getAnukramanika]);
    const rows = active && shard.hex === active[1] ? shard.rows : null;

    const shown = useMemo(() => {
        if (!rows) return [];
        const f = filter.trim();
        return f ? rows.filter(r => r[0].startsWith(f)) : rows;
    }, [rows, filter]);

    return (
        <>
            <input
                type="text"
                className="mb-search-input"
                placeholder={isPada ? 'पदम् अन्विष्यतु… (type a word, e.g. कृष्ण)' : 'श्लोकारम्भम् अन्विष्यतु… (type the opening words)'}
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />
            <div className="anu-letters">
                {entry.letters.map(L => (
                    <button key={L[1]} className={`anu-letter${active && active[1] === L[1] ? ' anu-letter-on' : ''}`}
                        onClick={() => { setFilter(''); setLetter(L); }} title={`${L[2]}`}>
                        {L[0]}
                    </button>
                ))}
            </div>

            {!active && <p className="text-center p-xl anu-hint">↑ अक्षरं चिनुत — pick an akshara</p>}
            {active && !rows && <div className="loading-container"><div className="spinner"></div></div>}
            {rows && <LetterList key={active[1]} shown={shown} isPada={isPada} chapters={chapters} />}
        </>
    );
}

// the rows of one letter shard; keyed by letter so expand/show-all state resets per letter
function LetterList({ shown, isPada, chapters }) {
    const [showAll, setShowAll] = useState(false);
    const [openWord, setOpenWord] = useState(null);
    return (
        <div className="anu-groups">
            <p className="anu-count">{toDeva(shown.length)} {isPada ? 'पदानि' : 'श्लोकाः'}</p>
            {(showAll ? shown : shown.slice(0, CAP)).map(([head, val]) => isPada ? (
                <div key={head} className="anu-pada">
                    <button className="anu-row anu-pada-word" onClick={() => setOpenWord(openWord === head ? null : head)}>
                        <span className="anu-row-label">{head}</span>
                        <span className="mb-section-count">{toDeva(val.length)}</span>
                    </button>
                    {openWord === head && (
                        <div className="anu-pada-refs">
                            {val.map(r => (
                                <RefLink key={r} chapters={chapters} refStr={r} className="mb-topic-range anu-ref-chip">
                                    {toDeva(r)}
                                </RefLink>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <RefLink key={`${head}|${val}`} chapters={chapters} refStr={val} className="anu-row">
                    <span className="mb-topic-range">{toDeva(val)}</span>
                    <span className="anu-row-label">{head}</span>
                </RefLink>
            ))}
            {!showAll && shown.length > CAP && (
                <button className="mb-chapter-nav-btn anu-more" onClick={() => setShowAll(true)}>
                    + {toDeva(shown.length - CAP)} अधिकम् (show all)
                </button>
            )}
        </div>
    );
}

export default function AnukramanikaPage() {
    const { id, indexKey } = useParams();
    const { getText, getAnukramanika } = useDatabase();
    const [text, setText] = useState(null);
    const [manifest, setManifest] = useState(null);
    const [loaded, setLoaded] = useState({ key: null, data: null });   // last loaded groups index
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getText(id), getAnukramanika(id, 'manifest')])
            .then(([t, m]) => { if (!cancelled) { setText(t); setManifest(m); } })
            .catch(e => { if (!cancelled) setError(e.message); });
        return () => { cancelled = true; };
    }, [id, getText, getAnukramanika]);

    const entry = manifest?.indexes.find(i => i.key === indexKey);

    useEffect(() => {
        if (!entry || entry.kind !== 'groups') return;
        let cancelled = false;
        getAnukramanika(id, entry.key).then(d => { if (!cancelled) setLoaded({ key: entry.key, data: d }); });
        return () => { cancelled = true; };
    }, [id, entry, getAnukramanika]);
    const data = entry && loaded.key === entry.key ? loaded.data : null;

    return (
        <div className="page-wrapper">
            <Header />
            <main className="main-content">
                <div className="container">
                    {text && (
                        <Breadcrumb items={[
                            { label: text.category_name || 'Category', path: `/category/${text.category_id}` },
                            { label: text.name_sanskrit, path: `/text/${id}` },
                            ...(entry ? [{ label: entry.name_sanskrit, path: `/text/${id}/anukramanika/${entry.key}` }] : []),
                        ]} />
                    )}

                    <section className="page-title-section">
                        <h1 className="page-title">॥ {entry ? entry.name_sanskrit : 'अनुक्रमणिका'} ॥</h1>
                        {entry && (
                            <p className="page-description mt-sm">
                                {text?.name_sanskrit} · {toDeva(entry.count.toLocaleString('en-IN'))} {entry.unit} · {entry.name_english}
                            </p>
                        )}
                    </section>

                    {manifest && (
                        <nav className="anu-tabs">
                            {manifest.indexes.map(i => (
                                <Link key={i.key} to={`/text/${id}/anukramanika/${i.key}`}
                                    className={`anu-tab${i.key === indexKey ? ' anu-tab-on' : ''}`}>
                                    {i.name_sanskrit}
                                </Link>
                            ))}
                        </nav>
                    )}

                    {error && <p className="text-center p-xl">अनुक्रमणिका न लब्धा। ({error})</p>}
                    {manifest && !entry && <p className="text-center p-xl">अनुक्रमणिका न लब्धा।</p>}
                    {(!manifest && !error) || (entry?.kind === 'groups' && !data) ? (
                        <div className="loading-container"><div className="spinner"></div></div>
                    ) : null}

                    {entry?.kind === 'groups' && data && (
                        <GroupsIndex key={entry.key} data={data} chapters={manifest.chapters} />
                    )}
                    {entry?.kind === 'letters' && (
                        <LettersIndex key={entry.key} textId={id} entry={entry} chapters={manifest.chapters} />
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
