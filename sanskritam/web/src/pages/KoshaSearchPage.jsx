import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';

// One dictionary's result — collapsed by default, since a common word can pull
// in 30-40 dictionaries' full entries and an all-expanded page becomes unusable.
function ResultPane({ name, defs, open, onToggle }) {
    return (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.8rem', overflow: 'hidden' }}>
            <button
                type="button"
                onClick={onToggle}
                className="sanskrit"
                style={{
                    display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--cream-dark, #F0E8DB)', color: 'var(--color-maroon-dark, #702d2d)',
                    fontWeight: 700, padding: '0.5rem 0.9rem', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
            >
                <span>{name}</span>
                <span>{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div style={{ padding: '0.7rem 0.9rem' }}>
                    {defs.map((def, i) => (
                        <p key={i} style={{ whiteSpace: 'pre-wrap', margin: i > 0 ? '0.6rem 0 0' : 0 }}>
                            {def}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function KoshaSearchPage() {
    const { getKoshaManifest, getKoshaShard } = useDatabase();
    const [manifest, setManifest] = useState(null);
    const [query, setQuery] = useState('');
    const [searched, setSearched] = useState('');
    const [results, setResults] = useState(null);
    const [openAbbrs, setOpenAbbrs] = useState(() => new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const toggleOpen = (abbr) => {
        setOpenAbbrs(prev => {
            const next = new Set(prev);
            if (next.has(abbr)) next.delete(abbr); else next.add(abbr);
            return next;
        });
    };

    useEffect(() => {
        getKoshaManifest().then(setManifest).catch(() => setManifest([]));
    }, [getKoshaManifest]);

    const runSearch = useCallback(async (word) => {
        const w = word.trim();
        if (!w || !manifest) return;
        setBusy(true);
        setError('');
        setSearched(w);
        try {
            const letter = w[0];
            const candidates = manifest.filter(d => d.letters.includes(letter));
            const settled = await Promise.allSettled(
                candidates.map(async (d) => {
                    const shard = await getKoshaShard(d.abbr, letter);
                    const defs = shard && shard[w];
                    return defs ? { abbr: d.abbr, name: d.name, defs } : null;
                })
            );
            const found = settled
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => r.value);
            setResults(found);
            setOpenAbbrs(new Set());
        } catch (err) {
            setError(err?.message || 'अन्वेषणे त्रुटिः अभवत्। Search failed.');
            setResults([]);
        } finally {
            setBusy(false);
        }
    }, [manifest, getKoshaShard]);

    const handleSubmit = (e) => {
        e.preventDefault();
        runSearch(query);
    };

    return (
        <div className="page-wrapper">
            <Header />
            <main className="main-content">
                <div className="container">
                    <Breadcrumb items={[
                        { label: 'वेदाङ्गम्', path: '/category/10' },
                        { label: 'कोशाः', path: '/category/35' },
                        { label: 'कोशान्वेषणम्', path: '/kosha/search' },
                    ]} />

                    <section className="page-title-section">
                        <h1 className="page-title">॥ कोशान्वेषणम् ॥</h1>
                        <p className="page-description mt-sm">
                            {manifest ? `${manifest.length} dictionaries` : 'Loading…'} — search a Sanskrit word across all of them at once.
                        </p>
                    </section>

                    <form onSubmit={handleSubmit} className="mt-md" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            className="sanskrit"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="पदं लिखतु… (e.g. भू, राम, धर्म)"
                            style={{
                                flex: '1 1 260px', padding: '0.6rem 0.9rem', fontSize: '1.1rem',
                                border: '1px solid var(--border-color)', borderRadius: '6px',
                            }}
                            autoFocus
                        />
                        <button type="submit" className="bulk-btn-primary" disabled={!manifest || busy}>
                            {busy ? 'अन्वेष्यते…' : 'अन्वेषणम् (Search)'}
                        </button>
                    </form>

                    <section className="mt-md">
                        {busy ? (
                            <div className="text-center"><div className="spinner" /></div>
                        ) : error ? (
                            <p className="sanskrit text-center" style={{ color: 'var(--red-color, #c00000)' }}>{error}</p>
                        ) : results === null ? null : results.length === 0 ? (
                            <p className="sanskrit text-center mt-md">
                                “{searched}” इति पदं कोशेषु न लब्धम्। No entries found for “{searched}”.
                            </p>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
                                    <p className="sanskrit" style={{ color: 'var(--color-text-light)', margin: 0 }}>
                                        “{searched}” — {results.length} dictionar{results.length === 1 ? 'y' : 'ies'} matched
                                    </p>
                                    <button
                                        type="button"
                                        className="bulk-btn-secondary"
                                        onClick={() => setOpenAbbrs(openAbbrs.size === results.length ? new Set() : new Set(results.map(r => r.abbr)))}
                                    >
                                        {openAbbrs.size === results.length ? 'सर्वे संवृणु (Collapse all)' : 'सर्वे प्रसारयतु (Expand all)'}
                                    </button>
                                </div>
                                {results.map((r) => (
                                    <ResultPane
                                        key={r.abbr}
                                        name={r.name}
                                        defs={r.defs}
                                        open={openAbbrs.has(r.abbr)}
                                        onToggle={() => toggleOpen(r.abbr)}
                                    />
                                ))}
                            </>
                        )}
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
}
