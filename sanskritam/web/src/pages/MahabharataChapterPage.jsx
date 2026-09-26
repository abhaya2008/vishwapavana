import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useDatabase } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';

// Continuous single-page reader for one Mahabharata adhyaya — every shloka of the
// chapter renders in one scroll (not one-verse-per-screen like Manimanjari), with any
// Tatparya Nirnaya / Lakshalankara commentary shown as a distinctly boxed block right
// after the shloka it was interleaved with in the source edition. Also serves other
// kanda/sarga-shaped epics (Valmiki Ramayana): the text's chapter_unit names the unit
// (सर्गः vs अध्यायः), and a chapter's audio_url is embedded (streamed from Commons,
// never downloaded) above the shlokas.
//
// Srimad Bhagavatam adds per-shloka audio (verse.audio_url, streamed from the source
// site — a "play the whole adhyaya" bar walks through them in order) and विषय headings
// (verse.topics) shown as dividers plus a clickable विषयसूची. ?n=<verse> deep-links to a
// shloka (used by the अनुक्रमणिका pages).
const DEVA_DIGITS = { '०': 0, '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9 };

// "१-१-२२–२३" → 22 (the shloka's own number: last component, start of a range)
function shlokaNumber(verseNumber) {
    if (!verseNumber) return null;
    const last = verseNumber.split('-').pop().split('–')[0];
    const n = parseInt(last.replace(/[०-९]/g, d => DEVA_DIGITS[d]), 10);
    return Number.isNaN(n) ? null : n;
}

export default function MahabharataChapterPage() {
    const { chapterId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const focusN = searchParams.get('n');
    const autoplay = searchParams.get('autoplay') === '1';   // arrived here by sarga auto-advance
    const { getChapter, getText, getChaptersByText, getVersesByChapter, getChapterCommentary } = useDatabase();

    const [chapter, setChapter] = useState(null);
    const [category, setCategory] = useState(null);
    const [unit, setUnit] = useState('अध्यायः');
    const [siblingChapters, setSiblingChapters] = useState([]);
    const [verses, setVerses] = useState([]);
    const [commentaryMap, setCommentaryMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [playingIdx, setPlayingIdx] = useState(-1);   // index into audioVerses, -1 = stopped
    const [paused, setPaused] = useState(false);
    const audioRef = useRef(null);
    // whole-chapter audio (Ramayana sargas): when on, the end of one sarga opens and plays the next
    const chapterAudioRef = useRef(null);
    const [autoNext, setAutoNext] = useState(() => localStorage.getItem('sarga_autonext') !== '0');

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
            setUnit(text?.chapter_unit || 'अध्यायः');
            setSiblingChapters(allChapters);
            setVerses(versesData);
            setCommentaryMap(commMap || {});
            setPlayingIdx(-1);
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

    // next chapter that has its own recitation (skips e.g. a प्रक्षिप्त sarga without audio)
    const nextAudioChapter = useMemo(() => {
        if (!chapter) return null;
        const idx = siblingChapters.findIndex(c => c.id === chapter.id);
        return siblingChapters.slice(idx + 1).find(c => c.audio_url) || null;
    }, [chapter, siblingChapters]);

    useEffect(() => {
        if (loading || !autoplay) return;
        const el = chapterAudioRef.current;
        if (!el) return;
        el.play().catch(() => {});
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [loading, autoplay, chapterId]);

    const onChapterAudioEnded = () => {
        if (autoNext && nextAudioChapter) navigate(`/mahabharata/chapter/${nextAudioChapter.id}?autoplay=1`);
    };

    const toggleAutoNext = (on) => {
        setAutoNext(on);
        localStorage.setItem('sarga_autonext', on ? '1' : '0');
    };

    const audioVerses = useMemo(() => verses.filter(v => v.audio_url), [verses]);
    const topicList = useMemo(
        () => verses.flatMap(v => (v.topics || []).map((t, i) => ({ ...t, key: `${v.id}-${i}`, verseId: v.id }))),
        [verses],
    );

    const scrollToVerse = useCallback((verseId, flash) => {
        const el = document.getElementById(`shloka-${verseId}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (flash) {
            el.classList.add('mb-shloka-flash');
            setTimeout(() => el.classList.remove('mb-shloka-flash'), 1800);
        }
    }, []);

    // deep link from an अनुक्रमणिका page: ?n=<shloka number>
    useEffect(() => {
        if (loading || !focusN) return;
        const target = verses.find(v => shlokaNumber(v.verse_number) === +focusN);
        if (target) setTimeout(() => scrollToVerse(target.id, true), 50);
    }, [loading, focusN, verses, scrollToVerse]);

    // drive the single <audio> element from playingIdx
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        if (playingIdx < 0 || playingIdx >= audioVerses.length) {
            el.pause();
            el.removeAttribute('src');
            return;
        }
        const v = audioVerses[playingIdx];
        el.src = v.audio_url;
        el.play().catch(() => {});   // onPlay clears `paused`
        scrollToVerse(v.id, false);
    }, [playingIdx, audioVerses, scrollToVerse]);

    const togglePlay = () => {
        const el = audioRef.current;
        if (playingIdx < 0) {
            const start = focusN ? audioVerses.findIndex(v => shlokaNumber(v.verse_number) === +focusN) : 0;
            setPlayingIdx(Math.max(0, start));
        } else if (el.paused) {
            el.play().catch(() => {});
        } else {
            el.pause();
        }
    };

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
    const isSarga = unit === 'सर्गः';

    const chapterNav = (
        <div className="mb-chapter-nav">
            <button className="mb-chapter-nav-btn" disabled={!prevChapter} onClick={() => goTo(prevChapter)}>
                ‹ {isSarga ? 'पूर्वसर्गः' : 'पूर्वाध्यायः'}
            </button>
            <Link to={`/text/${chapter.text_id}`} className="mb-chapter-nav-all">
                {isSarga ? 'सर्वे सर्गाः' : 'सर्वे अध्यायाः'}
            </Link>
            <button className="mb-chapter-nav-btn" disabled={!nextChapter} onClick={() => goTo(nextChapter)}>
                {isSarga ? 'अग्रिमसर्गः' : 'अग्रिमाध्यायः'} ›
            </button>
        </div>
    );

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
                            {' · '}{unit} {indexInParva + 1} / {parvaChapterCount} · {verses.length} श्लोकाः
                        </p>
                    </section>

                    {topicList.length > 0 ? (
                        <div className="mb-synopsis-box mb-topic-map">
                            <div className="mb-topic-map-hdr">विषयसूची</div>
                            {topicList.map(t => (
                                <button key={t.key} className="mb-topic-map-row" onClick={() => scrollToVerse(t.verseId, true)}>
                                    {t.range && <span className="mb-topic-range">{t.range}</span>}
                                    <span>{t.text}</span>
                                </button>
                            ))}
                        </div>
                    ) : chapter.synopsis_sanskrit && (
                        <div className="mb-synopsis-box">{chapter.synopsis_sanskrit}</div>
                    )}

                    {chapterNav}

                    {chapter.audio_url && (
                        <div className="mb-audio-box">
                            <div className="mb-audio-label">🔊 {chapter.name_sanskrit} श्रूयताम्</div>
                            {/* key forces the element to reload its sources on chapter change */}
                            <audio key={chapter.id} ref={chapterAudioRef} className="mb-audio-player" controls
                                preload={autoplay ? 'auto' : 'none'} onEnded={onChapterAudioEnded}>
                                <source src={chapter.audio_url} type="audio/ogg" />
                                {chapter.audio_url_mp3 && <source src={chapter.audio_url_mp3} type="audio/mpeg" />}
                            </audio>
                            {nextAudioChapter && (
                                <label className="mb-audio-autonext">
                                    <input type="checkbox" checked={autoNext} onChange={e => toggleAutoNext(e.target.checked)} />
                                    {' '}समाप्तौ अग्रिमं {unit === 'सर्गः' ? 'सर्गं' : 'अध्यायं'} स्वयं वादयतु
                                    {' '}(auto-play next: {nextAudioChapter.section_sanskrit !== chapter.section_sanskrit
                                        ? `${nextAudioChapter.section_sanskrit} · ` : ''}{nextAudioChapter.name_sanskrit})
                                </label>
                            )}
                        </div>
                    )}

                    {audioVerses.length > 0 && (
                        <div className="mb-audio-box mb-audio-bar">
                            <button className="mb-audio-btn" onClick={togglePlay} title="play / pause">
                                {playingIdx >= 0 && !paused ? '⏸' : '▶'}
                            </button>
                            <button className="mb-audio-btn" disabled={playingIdx <= 0}
                                onClick={() => setPlayingIdx(i => i - 1)} title="previous shloka">⏮</button>
                            <button className="mb-audio-btn" disabled={playingIdx < 0 || playingIdx >= audioVerses.length - 1}
                                onClick={() => setPlayingIdx(i => i + 1)} title="next shloka">⏭</button>
                            <span className="mb-audio-label mb-audio-now">
                                {playingIdx >= 0
                                    ? `${audioVerses[playingIdx].verse_number || '…'} · ${playingIdx + 1} / ${audioVerses.length}`
                                    : `🔊 सम्पूर्णम् ${unit === 'सर्गः' ? 'सर्गं' : 'अध्यायं'} शृणुत (${audioVerses.length})`}
                            </span>
                            {playingIdx >= 0 && (
                                <button className="mb-audio-btn" onClick={() => setPlayingIdx(-1)} title="stop">⏹</button>
                            )}
                            <audio
                                ref={audioRef}
                                preload="none"
                                onEnded={() => setPlayingIdx(i => (i + 1 < audioVerses.length ? i + 1 : -1))}
                                onPause={() => setPaused(true)}
                                onPlay={() => setPaused(false)}
                            />
                        </div>
                    )}

                    <div className="mb-shloka-flow">
                        {verses.map(verse => {
                            const comms = commentaryMap[verse.id];
                            const audioIdx = verse.audio_url ? audioVerses.indexOf(verse) : -1;
                            return (
                                <div key={verse.id} id={`shloka-${verse.id}`}
                                    className={`mb-shloka-block${audioIdx >= 0 && audioIdx === playingIdx ? ' mb-shloka-playing' : ''}`}>
                                    {(verse.topics || []).filter(t => t.range).map((t, i) => (
                                        <div key={i} className="mb-topic-divider">
                                            <span className="mb-topic-range">{t.range}</span>
                                            <span>{t.text}</span>
                                        </div>
                                    ))}
                                    <div className="mb-shloka-row">
                                        {verse.verse_number && (
                                            <span className="mb-shloka-num">{verse.verse_number}</span>
                                        )}
                                        <span className="mb-shloka-text">{verse.content_sanskrit}</span>
                                        {audioIdx >= 0 && (
                                            <button className="mb-shloka-play" title="play from here"
                                                onClick={() => setPlayingIdx(audioIdx)}>
                                                {audioIdx === playingIdx && !paused ? '♪' : '▶'}
                                            </button>
                                        )}
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

                    {chapterNav}
                </div>
            </main>

            <Footer />
        </div>
    );
}
