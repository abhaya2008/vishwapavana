import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDatabase } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';

const LAKARA_NAMES = {
    plat: 'लट् लकारः (वर्तमानकालः)',
    plit: 'लिट् लकारः (परोक्षभूतः)',
    plut: 'लुट् लकारः (अनद्यतनभविष्यत्)',
    plrut: 'लृट् लकारः (सामान्यभविष्यत्)',
    plot: 'लोट् लकारः (आज्ञार्थः)',
    plang: 'लङ् लकारः (अनद्यतनभूतः)',
    pvidhiling: 'विधिलिङ् लकारः',
    pashirling: 'आशीर्लिङ् लकारः',
    plung: 'लुङ् लकारः (सामान्यभूतः)',
    plrung: 'लृङ् लकारः (क्रियातिपत्तिः)',
};
const LAKARA_ORDER = Object.keys(LAKARA_NAMES);

const CATEGORY_LABELS = {
    shuddha_kartari: 'कर्तरि',
    shuddha_karmani: 'भावकर्मणोः',
    shuddha_krut: 'कृदन्तः',
    san_kartari: 'सन्नन्ते-कर्तरि',
    san_karmani: 'सन्नन्ते-भावकर्मणोः',
    san_krut: 'सन्नन्ते-कृदन्तः',
    nich_kartari: 'णिजन्ते-कर्तरि',
    nich_karmani: 'णिजन्ते-भावकर्मणोः',
    nich_krut: 'णिजन्ते-कृदन्तः',
    yang_kartari: 'यङन्ते-कर्तरि',
    yang_karmani: 'यङन्ते-भावकर्मणोः',
    yang_krut: 'यङन्ते-कृदन्तः',
    yangluk_kartari: 'यङ्लुगन्ते-कर्तरि',
    yangluk_karmani: 'यङ्लुगन्ते-भावकर्मणोः',
    yangluk_krut: 'यङ्लुगन्ते-कृदन्तः',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function LakaraTable({ lakaraKey, forms }) {
    const rows = [
        { label: 'प्रथमपुरुषः', cells: forms.slice(0, 3) },
        { label: 'मध्यमपुरुषः', cells: forms.slice(3, 6) },
        { label: 'उत्तमपुरुषः', cells: forms.slice(6, 9) },
    ];
    return (
        <div style={{ marginBottom: '1.2rem' }}>
            <div style={{
                background: 'var(--cream-dark, #F0E8DB)', color: 'var(--color-maroon-dark, #702d2d)',
                fontWeight: 700, padding: '0.4rem 0.8rem', borderRadius: '6px 6px 0 0',
                fontFamily: 'var(--font-sanskrit)', fontSize: '1.07rem',
            }}>
                {LAKARA_NAMES[lakaraKey] || lakaraKey}
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sanskrit)', fontSize: '1.05rem' }}>
                    <thead>
                        <tr style={{ background: '#fff8ec' }}>
                            <th style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-color)' }}></th>
                            <th style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-color)' }}>एकवचनम्</th>
                            <th style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-color)' }}>द्विवचनम्</th>
                            <th style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-color)' }}>बहुवचनम्</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#fff4e2' : '#fff' }}>
                                <td style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--color-maroon)' }}>{row.label}</td>
                                {row.cells.map((cell, j) => (
                                    <td key={j} style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--border-color)' }}>
                                        {(cell || '').split(',').join(', ')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function KrutTable({ forms }) {
    return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sanskrit)', fontSize: '1.05rem' }}>
                <thead>
                    <tr style={{ background: 'var(--cream-dark, #F0E8DB)' }}>
                        <th style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--color-maroon)' }}>प्रत्ययः</th>
                        <th style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--color-maroon)' }}>रूपम्</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(forms).map(([pratyaya, form], i) => (
                        <tr key={pratyaya} style={{ background: i % 2 === 0 ? '#fff4e2' : '#fff' }}>
                            <td style={{ padding: '0.35rem 0.8rem', border: '1px solid var(--border-color)', fontWeight: 600 }}>{pratyaya}</td>
                            <td style={{ padding: '0.35rem 0.8rem', border: '1px solid var(--border-color)' }}>{String(form).split(',').join(', ')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function DhatuRupaPage() {
    const { baseindex } = useParams();
    const navigate = useNavigate();
    const { getDhatuLookup, getVersesByChapter, getDhatuForms } = useDatabase();

    const [verse, setVerse] = useState(null);
    const [siblings, setSiblings] = useState([]);
    const [forms, setForms] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [category, setCategory] = useState('shuddha_kartari');

    useEffect(() => {
        let cancelled = false;
        setForms(null);
        setNotFound(false);
        async function load() {
            const lookup = await getDhatuLookup();
            const entry = lookup[baseindex];
            if (!entry) { if (!cancelled) setNotFound(true); return; }
            const chapterVerses = await getVersesByChapter(entry.c);
            const v = chapterVerses.find(x => x.id === entry.v);
            const formsData = await getDhatuForms(baseindex);
            if (cancelled) return;
            setVerse(v || null);
            setSiblings(chapterVerses);
            setForms(formsData || {});
        }
        load();
        return () => { cancelled = true; };
    }, [baseindex, getDhatuLookup, getVersesByChapter, getDhatuForms]);

    const availableCategories = useMemo(() => {
        if (!forms) return [];
        return CATEGORY_ORDER.filter(k => forms[k]);
    }, [forms]);

    useEffect(() => {
        if (availableCategories.length && !availableCategories.includes(category)) {
            setCategory(availableCategories[0]);
        }
    }, [availableCategories, category]);

    const { prevBaseindex, nextBaseindex } = useMemo(() => {
        if (!verse || !siblings.length) return {};
        const idx = siblings.findIndex(v => v.id === verse.id);
        return {
            prevBaseindex: idx > 0 ? siblings[idx - 1].dhatu_baseindex : null,
            nextBaseindex: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].dhatu_baseindex : null,
        };
    }, [verse, siblings]);

    if (notFound) {
        return (
            <div className="page-wrapper">
                <Header />
                <main className="main-content container text-center">
                    <p className="sanskrit mt-md">एतत् धातुरूपं न लब्धम्। Dhatu not found.</p>
                </main>
                <Footer />
            </div>
        );
    }

    const isKrut = category.endsWith('_krut');
    const categoryData = forms && forms[category];

    return (
        <div className="page-wrapper">
            <Header />
            <main className="main-content">
                <div className="container">
                    <Breadcrumb items={[
                        { label: 'व्याकरणम्', path: '/category/2' },
                        { label: 'धातुपाठः', path: verse ? `/chapter/${verse.chapter_id}` : '/category/8' },
                        { label: verse ? verse.content_sanskrit : baseindex, path: `/vyakaranam/dhatu/${baseindex}` },
                    ]} />

                    <section className="page-title-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <h1 className="page-title">॥ {verse ? verse.content_sanskrit : baseindex} ॥</h1>
                            {verse && (
                                <p className="page-description mt-sm">
                                    {baseindex} · {verse.padaccheda} · {verse.meaning_sanskrit}
                                    {verse.meaning_english ? ` — ${verse.meaning_english}` : ''}
                                </p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className="bulk-btn-secondary"
                                disabled={!prevBaseindex}
                                onClick={() => prevBaseindex && navigate(`/vyakaranam/dhatu/${prevBaseindex}`)}
                            >← पूर्वः</button>
                            <button
                                className="bulk-btn-secondary"
                                disabled={!nextBaseindex}
                                onClick={() => nextBaseindex && navigate(`/vyakaranam/dhatu/${nextBaseindex}`)}
                            >अग्रिमः →</button>
                        </div>
                    </section>

                    {forms === null ? (
                        <div className="text-center mt-md"><div className="spinner" /></div>
                    ) : availableCategories.length === 0 ? (
                        <p className="sanskrit text-center mt-md">अस्य धातोः रूपाणि अनुपलब्धानि। No conjugated forms available for this root.</p>
                    ) : (
                        <>
                            <section className="mt-md" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {availableCategories.map(k => (
                                    <button
                                        key={k}
                                        onClick={() => setCategory(k)}
                                        style={{
                                            padding: '0.4rem 0.9rem', borderRadius: '999px', cursor: 'pointer',
                                            fontFamily: 'var(--font-sanskrit)', fontSize: '0.97rem',
                                            border: '1px solid var(--border-color)',
                                            background: category === k ? 'var(--color-maroon, #935655)' : '#fff8ec',
                                            color: category === k ? '#fff8f0' : 'var(--color-maroon-dark, #702d2d)',
                                            fontWeight: category === k ? 700 : 500,
                                        }}
                                    >
                                        {CATEGORY_LABELS[k]}
                                    </button>
                                ))}
                            </section>

                            <section className="mt-md">
                                {isKrut ? (
                                    <KrutTable forms={categoryData} />
                                ) : (
                                    LAKARA_ORDER.filter(lk => categoryData?.[lk]).map(lk => (
                                        <LakaraTable key={lk} lakaraKey={lk} forms={categoryData[lk]} />
                                    ))
                                )}
                            </section>
                        </>
                    )}

                    {verse && (
                        <p className="text-center mt-md">
                            <Link to={`/chapter/${verse.chapter_id}`} className="sanskrit" style={{ color: 'var(--color-maroon)' }}>
                                ← धातुपाठः (प्रति गच्छतु)
                            </Link>
                        </p>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
