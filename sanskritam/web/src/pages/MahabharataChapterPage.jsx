import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDatabase } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';

// Continuous single-page reader for one Mahabharata adhyaya — every shloka of the
// chapter renders in one scroll (not one-verse-per-screen like Manimanjari), with any
// Tatparya Nirnaya / Lakshalankara commentary shown as a distinctly boxed block right
// after the shloka it was interleaved with in the source edition.
export default function MahabharataChapterPage() {
    const { chapterId } = useParams();
    const navigate = useNavigate();
    const { getChapter, getText, getChaptersByText, getVersesByChapter, getChapterCommentary } = useDatabase();

    const [chapter, setChapter] = useState(null);
    const [category, setCategory] = useState(null);
    const [siblingChapters, setSiblingChapters] = useState([]);
    const [verses, setVerses] = useState([]);
    const [commentaryMap, setCommentaryMap] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            const ch = await getChapter(chapterId);
            if (cancelled || !ch) return;
            setChapter(ch);
            const [text, allChapters, versesData, commMap] = await Promise.all([
                getText(ch.text_id),
                getChaptersByText(ch.text_id),
                getVersesByChapter(chapterId),
                getChapterCommentary(chapterId),
            ]);
            if (cancelled) return;
            setCategory({ id: text?.category_id, name: text?.category_name });
            setSiblingChapters(allChapters);
            setVerses(versesData);
            setCommentaryMap(commMap || {});
            setLoading(false);
            window.scrollTo({ top: 0 });
        }
        load();
        return () => { cancelled = true; };
    }, [chapterId, getChapter, getText, getChaptersByText, getVersesByChapter, getChapterCommentary]);

    const { indexInParva, parvaChapterCount, prevChapter, nextChapter } = useMemo(() => {
        if (!chapter || !siblingChapters.length) {
            return { indexInParva: 0, parvaChapterCount: 0, prevChapter: null, nextChapter: null };
        }
        const sameParva = siblingChapters.filter(c => c.section_sanskrit === chapter.section_sanskrit);
        const idxParva = sameParva.findIndex(c => c.id === chapter.id);
        const idxText = siblingChapters.findIndex(c => c.id === chapter.id);
        return {
            indexInParva: idxParva,
            parvaChapterCount: sameParva.length,
            prevChapter: idxText > 0 ? siblingChapters[idxText - 1] : null,
            nextChapter: idxText < siblingChapters.length - 1 ? siblingChapters[idxText + 1] : null,
        };
    }, [chapter, siblingChapters]);

    if (loading || !chapter) {
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

    const goTo = (ch) => ch && navigate(`/mahabharata/chapter/${ch.id}`);

    return (
        <div className="page-wrapper">
            <Header />

            <main className="main-content">
                <div className="container">
                    <Breadcrumb items={[
                        ...(category?.id ? [{ label: category.name, path: `/category/${category.id}` }] : []),
                        { label: chapter.text_name, path: `/text/${chapter.text_id}` },
                        { label: chapter.name_sanskrit, path: `/mahabharata/chapter/${chapter.id}` },
                    ]} />

                    <section className="page-title-section">
                        <h1 className="page-title">॥ {chapter.name_sanskrit} ॥</h1>
                        <p className="page-description mt-sm">
                            {chapter.section_sanskrit}
                            {chapter.subsection_sanskrit ? ` · ${chapter.subsection_sanskrit}` : ''}
                            {' · '}अध्यायः {indexInParva + 1} / {parvaChapterCount} · {verses.length} श्लोकाः
                        </p>
                    </section>

                    {chapter.synopsis_sanskrit && (
                        <div className="mb-synopsis-box">{chapter.synopsis_sanskrit}</div>
                    )}

                    <div className="mb-chapter-nav">
                        <button className="mb-chapter-nav-btn" disabled={!prevChapter} onClick={() => goTo(prevChapter)}>
                            ‹ पूर्वाध्यायः
                        </button>
                        <Link to={`/text/${chapter.text_id}`} className="mb-chapter-nav-all">
                            सर्वे अध्यायाः
                        </Link>
                        <button className="mb-chapter-nav-btn" disabled={!nextChapter} onClick={() => goTo(nextChapter)}>
                            अग्रिमाध्यायः ›
                        </button>
                    </div>

                    <div className="mb-shloka-flow">
                        {verses.map(verse => {
                            const comms = commentaryMap[verse.id];
                            return (
                                <div key={verse.id} className="mb-shloka-block">
                                    <div className="mb-shloka-row">
                                        {verse.verse_number && (
                                            <span className="mb-shloka-num">{verse.verse_number}</span>
                                        )}
                                        <span className="mb-shloka-text">{verse.content_sanskrit}</span>
                                    </div>
                                    {comms && comms.length > 0 && comms.map(c => (
                                        <div key={c.id} className={`mb-commentary-inline${c.lang === 'kn' ? ' mb-commentary-inline-kannada' : ''}`}>
                                            <div className="mb-commentary-inline-hdr">{c.author || c.commentary_type}</div>
                                            <div className="mb-commentary-inline-body">{c.content}</div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}

                        {verses.length === 0 && (
                            <div className="text-center p-xl">
                                <p className="sanskrit" style={{ color: 'var(--color-subheading-hero)' }}>
                                    श्लोकाः उपलब्धाः नसन्ति।
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mb-chapter-nav">
                        <button className="mb-chapter-nav-btn" disabled={!prevChapter} onClick={() => goTo(prevChapter)}>
                            ‹ पूर्वाध्यायः
                        </button>
                        <Link to={`/text/${chapter.text_id}`} className="mb-chapter-nav-all">
                            सर्वे अध्यायाः
                        </Link>
                        <button className="mb-chapter-nav-btn" disabled={!nextChapter} onClick={() => goTo(nextChapter)}>
                            अग्रिमाध्यायः ›
                        </button>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
