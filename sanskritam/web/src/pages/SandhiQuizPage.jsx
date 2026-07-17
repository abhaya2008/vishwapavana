import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';
import sandhiContent from '../data/sandhiContent.json';

function shuffle(arr) {
    const a = [...(arr || [])];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export default function SandhiQuizPage() {
    const { categoryKey, lessonId, mode } = useParams();
    const navigate = useNavigate();

    const category = sandhiContent.categories.find(c => c.key === categoryKey);
    const set = sandhiContent.lessons[lessonId]?.[mode];
    const questions = useMemo(() => (set ? shuffle(set.questions) : []), [set]);

    const [index, setIndex] = useState(0);
    const [phase, setPhase] = useState('word'); // 'word' | 'rule'
    const [wordPick, setWordPick] = useState(null);
    const [rulePick, setRulePick] = useState(null);
    const [correctCount, setCorrectCount] = useState(0);
    const [finished, setFinished] = useState(false);

    const q = questions[index];
    const hasRule = !!(q && q.sandhi_choice && q.sandhi_choice.length);
    const wordChoices = useMemo(() => (q ? shuffle(q.choice) : []), [q]);
    const ruleChoices = useMemo(() => (hasRule ? shuffle(q.sandhi_choice) : []), [q, hasRule]);

    const backPath = `/vyakaranam/sandhi/${categoryKey}`;
    const breadcrumbBase = [
        { label: 'व्याकरणम्', path: '/category/2' },
        { label: 'सन्धि-अभ्यासः', path: '/vyakaranam/sandhi' },
        { label: category?.name || categoryKey, path: backPath },
    ];

    if (!set) {
        return (
            <div className="page-wrapper">
                <Header />
                <main className="main-content">
                    <div className="container text-center">
                        <p className="sanskrit" style={{ color: 'var(--color-subheading-hero)' }}>
                            पाठः न लब्धः।<br />Lesson not found.
                        </p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    function pickWord(choice) {
        if (wordPick) return;
        setWordPick(choice);
        if (!hasRule && choice === q.answer) setCorrectCount(c => c + 1);
    }

    function pickRule(choice) {
        if (rulePick) return;
        setRulePick(choice);
        if (wordPick === q.answer && choice === q.sandhi_answer) setCorrectCount(c => c + 1);
    }

    function next() {
        if (index + 1 >= questions.length) {
            setFinished(true);
            return;
        }
        setIndex(i => i + 1);
        setPhase('word');
        setWordPick(null);
        setRulePick(null);
    }

    if (finished) {
        return (
            <div className="page-wrapper">
                <Header />
                <main className="main-content">
                    <div className="container">
                        <Breadcrumb items={[...breadcrumbBase, { label: set.title || 'परिणामः', path: '#' }]} />
                        <section className="page-title-section">
                            <h1 className="page-title">॥ {set.title || 'परिणामः'} ॥</h1>
                        </section>
                        <div className="sandhi-quiz-card sandhi-result-card">
                            <p className="sandhi-result-score">{correctCount} / {questions.length}</p>
                            <p className="sandhi-result-sub">प्रश्नाः सम्यक् उत्तरिताः (fully correct)</p>
                            <button className="bulk-btn-save" style={{ width: '100%', marginTop: '1rem' }} onClick={() => window.location.reload()}>
                                पुनः प्रयत्नः (Retry Lesson)
                            </button>
                            <button className="bulk-btn-secondary" style={{ width: '100%', marginTop: '0.6rem' }} onClick={() => navigate(backPath)}>
                                पाठसूचीं गच्छतु (Back to Lessons)
                            </button>
                        </div>
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
                    <Breadcrumb items={[...breadcrumbBase, { label: set.title || 'अभ्यासः', path: '#' }]} />

                    <section className="page-title-section">
                        <h1 className="page-title">॥ {set.title} ॥</h1>
                    </section>

                    <div className="sandhi-progress-bar">
                        <div className="sandhi-progress-fill" style={{ width: `${(index / questions.length) * 100}%` }} />
                    </div>

                    <div className="sandhi-quiz-card">
                        <span className="sandhi-stage-label">
                            {phase === 'word'
                                ? (mode === 'split' ? 'शब्दं विभजतु (Split)' : 'शब्दौ योजयतु (Join)')
                                : 'कः सन्धिनियमः? (Which rule?)'}
                        </span>
                        <p className="sandhi-quiz-question">{q.question}</p>
                        <p className="sandhi-quiz-label">प्रश्नः {index + 1} / {questions.length}</p>

                        {phase === 'word' && (
                            <div className="sandhi-choices">
                                {wordChoices.map(c => {
                                    let cls = 'sandhi-choice-btn';
                                    if (wordPick) {
                                        if (c === q.answer) cls += ' correct';
                                        else if (c === wordPick) cls += ' incorrect';
                                    }
                                    return (
                                        <button key={c} className={cls} disabled={!!wordPick} onClick={() => pickWord(c)}>
                                            {c}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {phase === 'rule' && hasRule && (
                            <div className="sandhi-choices">
                                {ruleChoices.map(c => {
                                    let cls = 'sandhi-choice-btn';
                                    if (rulePick) {
                                        if (c === q.sandhi_answer) cls += ' correct';
                                        else if (c === rulePick) cls += ' incorrect';
                                    }
                                    return (
                                        <button key={c} className={cls} disabled={!!rulePick} onClick={() => pickRule(c)}>
                                            {c}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {phase === 'word' && wordPick && hasRule && (
                            <button className="sandhi-next-btn" onClick={() => setPhase('rule')}>अग्रे (Next)</button>
                        )}
                        {phase === 'word' && wordPick && !hasRule && (
                            <button className="sandhi-next-btn" onClick={next}>
                                {index + 1 >= questions.length ? 'समाप्तिः (Finish)' : 'अग्रिमः प्रश्नः (Next Question)'}
                            </button>
                        )}
                        {phase === 'rule' && rulePick && (
                            <button className="sandhi-next-btn" onClick={next}>
                                {index + 1 >= questions.length ? 'समाप्तिः (Finish)' : 'अग्रिमः प्रश्नः (Next Question)'}
                            </button>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
