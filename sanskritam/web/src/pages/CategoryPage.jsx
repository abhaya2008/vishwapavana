import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDatabase } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';
import CategoryCard from '../components/CategoryCard';
import TextCard from '../components/TextCard';

// व्याकरणम् (Grammar) category id — used to surface tools (like Sandhi Practice)
// that aren't texts/chapters/verses, so they don't need their own DB-driven category.
const VYAKARANAM_CATEGORY_ID = '2';

export default function CategoryPage() {
    const { id } = useParams();
    const { getCategory, getSubCategories, getTextsByCategory, loading } = useDatabase();
    const [category, setCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([]);
    const [texts, setTexts] = useState([]);

    useEffect(() => {
        async function fetchData() {
            const categoryData = await getCategory(id);
            setCategory(categoryData);

            const subCats = await getSubCategories(id);
            setSubCategories(subCats);

            const textsData = await getTextsByCategory(id);
            setTexts(textsData);
        }
        fetchData();
    }, [id, getCategory, getSubCategories, getTextsByCategory]);

    if (loading || !category) {
        return (
            <div className="page-wrapper">
                <Header />
                <main className="main-content container text-center">
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                    <p className="mt-md">Loading...</p>
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
                        { label: category.name_sanskrit, path: `/category/${id}` }
                    ]} />

                    {/* Category Header */}
                    <section className="page-title-section">
                        <h1 className="page-title">॥ {category.name_sanskrit} ॥</h1>
                    </section>

                    {/* Sub-categories */}
                    {subCategories.length > 0 && (
                        <section className="mt-md">
                            <h2 className="sanskrit-title mb-lg text-center">उप-वर्गाः</h2>
                            <div className="subcategory-grid">
                                {subCategories.map(subCat => (
                                    <CategoryCard key={subCat.id} category={subCat} isSubcategory={true} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Texts in this category */}
                    {texts.length > 0 && (
                        <section className="mt-md">
                            <h2 className="sanskrit-title mb-lg text-center">ग्रन्थाः</h2>
                            <div className="cards-grid">
                                {texts.map(text => (
                                    <TextCard key={text.id} text={text} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Tools (not text/chapter/verse content) — currently only Sandhi Practice */}
                    {id === VYAKARANAM_CATEGORY_ID && (
                        <section className="mt-md">
                            <h2 className="sanskrit-title mb-lg text-center">अभ्यासाः</h2>
                            <div className="cards-grid">
                                <Link to="/vyakaranam/sandhi" className="category-card">
                                    <h3 className="card-title">॥ सन्धि-अभ्यासः ॥</h3>
                                    <p className="card-subtitle">Sandhi Practice</p>
                                </Link>
                            </div>
                        </section>
                    )}

                    {subCategories.length === 0 && texts.length === 0 && id !== VYAKARANAM_CATEGORY_ID && (
                        <div className="text-center mt-md">
                            <p className="sanskrit" style={{ color: 'var(--color-text-light)' }}>
                                अत्र ग्रन्थाः उपलब्धाः नसन्ति।
                                <br />
                                No texts available in this category yet.
                            </p>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
