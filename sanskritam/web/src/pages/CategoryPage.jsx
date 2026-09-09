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
    const [parentCategory, setParentCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([]);
    const [texts, setTexts] = useState([]);

    useEffect(() => {
        async function fetchData() {
            const categoryData = await getCategory(id);
            setCategory(categoryData);

            if (categoryData?.parent_id) {
                const pData = await getCategory(categoryData.parent_id);
                setParentCategory(pData);
            } else {
                setParentCategory(null);
            }

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

    // texts includes both this category's own texts and its sub-categories' texts
    // (see getTextsByCategory); only the former belong in this page's own "ग्रन्थाः" section.
    const directTexts = texts.filter(t => String(t.category_id) === String(id));

    const breadcrumbItems = parentCategory ? [
        { label: parentCategory.name_sanskrit, path: `/category/${parentCategory.id}` },
        { label: category.name_sanskrit, path: `/category/${id}` }
    ] : [
        { label: category.name_sanskrit, path: `/category/${id}` }
    ];

    return (
        <div className="page-wrapper">
            <Header />

            <main className="main-content">
                <div className="container">
                    <Breadcrumb items={breadcrumbItems} />

                    {/* Back link when viewing a sub-category */}
                    {parentCategory && (
                        <div style={{ marginBottom: '1rem' }}>
                            <Link
                                to={`/category/${parentCategory.id}`}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    color: 'var(--color-maroon, #800000)',
                                    fontWeight: '600',
                                    fontFamily: 'var(--font-sanskrit)',
                                    fontSize: '1.05rem',
                                    textDecoration: 'none',
                                    transition: 'color 0.2s ease'
                                }}
                            >
                                ← {parentCategory.name_sanskrit} (प्रति गच्छतु / Back to {parentCategory.name_english || parentCategory.name_sanskrit})
                            </Link>
                        </div>
                    )}

                    {/* Category Header */}
                    <section className="page-title-section">
                        <h1 className="page-title">॥ {category.name_sanskrit} ॥</h1>
                    </section>

                    {/* Sub-categories (Upavargas), when they exist */}
                    {subCategories.length > 0 && (
                        <section className="mt-md">
                            <h2 className="sanskrit-title mb-lg text-center">उप-वर्गाः</h2>
                            <div className="cards-grid">
                                {subCategories.map(subCat => (
                                    <CategoryCard key={subCat.id} category={subCat} isSubcategory={false} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Texts (Granthas) placed directly on this category — shown alongside
                        sub-categories too, so a text kept at this level (e.g. मणिमञ्जरी on
                        साहित्यम्) isn't hidden once sibling sub-categories exist. */}
                    {directTexts.length > 0 && (
                        <section className="mt-md">
                            <h2 className="sanskrit-title mb-lg text-center">ग्रन्थाः</h2>
                            <div className="cards-grid">
                                {directTexts.map(text => (
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

                    {subCategories.length === 0 && directTexts.length === 0 && id !== VYAKARANAM_CATEGORY_ID && (
                        <div className="text-center mt-md">
                            <p className="sanskrit" style={{ color: 'var(--color-text-light)' }}>
                                अत्र ग्रन्थाः उपलब्धाः न सन्ति।
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
