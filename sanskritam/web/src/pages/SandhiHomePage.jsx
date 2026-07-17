import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';
import sandhiContent from '../data/sandhiContent.json';

export default function SandhiHomePage() {
    return (
        <div className="page-wrapper">
            <Header />

            <main className="main-content">
                <div className="container">
                    <Breadcrumb items={[
                        { label: 'व्याकरणम्', path: '/category/2' },
                        { label: 'सन्धि-अभ्यासः', path: '/vyakaranam/sandhi' },
                    ]} />

                    <section className="page-title-section">
                        <h1 className="page-title">॥ सन्धि-अभ्यासः ॥</h1>
                        <p className="page-description mt-sm">Sanskrit sandhi practice — choose a topic</p>
                    </section>

                    <section className="mt-md">
                        <div className="cards-grid">
                            {sandhiContent.categories.map(c => (
                                <Link key={c.key} to={`/vyakaranam/sandhi/${c.key}`} className="category-card">
                                    <h3 className="card-title">॥ {c.name} ॥</h3>
                                    <p className="card-subtitle">{c.nameEn} · {c.lessonIds.length} पाठाः</p>
                                </Link>
                            ))}
                        </div>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
