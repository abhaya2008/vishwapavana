import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDatabase } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';

export default function TextPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getText, getChaptersByText, getVersesByChapter, loading } = useDatabase();

    const [text, setText] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [expandedChapter, setExpandedChapter] = useState(null);
    const [versesByChapter, setVersesByChapter] = useState({});
    const [loadingVerses, setLoadingVerses] = useState({});

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
                        {text.name_english && (
                            <p className="page-description">{text.name_english}</p>
                        )}
                        {text.author && (
                            <p className="page-description mt-sm">
                                रचयिता: {text.author}
                            </p>
                        )}
                    </section>

                    <section className="mt-xl">
                        <div className="text-list">
                            {chapters.map((chapter, index) => {
                                const isOpen = expandedChapter === chapter.id;
                                const verses = versesByChapter[chapter.id] || [];
                                const isLoadingV = !!loadingVerses[chapter.id];

                                return (
                                    <div key={chapter.id} className={`chapter-accordion${isOpen ? ' chapter-accordion-open' : ''}`}>
                                        {/* Chapter header row */}
                                        <button
                                            className="text-item chapter-accordion-hdr"
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
        </div>
    );
}
