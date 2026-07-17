import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';
import sandhiContent from '../data/sandhiContent.json';

export default function SandhiCategoryPage() {
    const { categoryKey } = useParams();
    const [mode, setMode] = useState('join');

    const category = sandhiContent.categories.find(c => c.key === categoryKey);

    if (!category) {
        return (
            <div className="page-wrapper">
                <Header />
                <main className="main-content">
                    <div className="container text-center">
                        <p className="sanskrit" style={{ color: 'var(--color-subheading-hero)' }}>
                            वर्गः न लब्धः।<br />Category not found.
                        </p>
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
                        { label: 'व्याकरणम्', path: '/category/2' },
                        { label: 'सन्धि-अभ्यासः', path: '/vyakaranam/sandhi' },
                        { label: category.name, path: `/vyakaranam/sandhi/${categoryKey}` },
                    ]} />

                    <section className="page-title-section">
                        <h1 className="page-title">॥ {category.name} ॥</h1>
                        <p className="page-description mt-sm">{category.nameEn}</p>
                    </section>

                    <div className="sandhi-mode-toggle">
                        <button
                            className={mode === 'join' ? 'active' : ''}
                            onClick={() => setMode('join')}
                        >
                            सन्धि-योजनम् (Join)
                        </button>
                        <button
                            className={mode === 'split' ? 'active' : ''}
                            onClick={() => setMode('split')}
                        >
                            सन्धि-विच्छेदः (Split)
                        </button>
                    </div>

                    <section className="mt-md">
                        <div className="text-list">
                            {category.lessonIds.map((id, i) => {
                                const lesson = sandhiContent.lessons[id];
                                const set = lesson[mode] || lesson.join || lesson.split;
                                if (!set) return null;
                                return (
                                    <Link key={id} to={`/vyakaranam/sandhi/${categoryKey}/${id}/${mode}`} className="text-item">
                                        <span className="text-number">{i + 1}</span>
                                        <span className="text-title">
                                            {set.title || `पाठः ${i + 1}`}
                                            <span className="chapter-name-en"> · {set.questions.length} प्रश्नाः</span>
                                        </span>
                                        <span className="text-arrow">→</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
