import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDatabase } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';
import CategoryCard from '../components/CategoryCard';
import TextCard from '../components/TextCard';

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
                    <section className="hero" style={{ padding: 'var(--space-xl) 0' }}>
                        <h1 className="hero-title">॥ {category.name_sanskrit} ॥</h1>
                        {category.name_english && (
                            <p className="hero-subtitle">{category.name_english}</p>
                        )}
                        {category.description && (
                            <p className="mt-md" style={{ color: 'var(--color-text-light)' }}>
                                {category.description}
                            </p>
                        )}
                    </section>

                    {/* Sub-categories - 2 column grid like /vyakaranam */}
                    {subCategories.length > 0 && (
                        <section className="mt-xl">
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
                        <section className="mt-xl">
                            <h2 className="sanskrit-title mb-lg text-center">ग्रन्थाः</h2>
                            <div className="cards-grid">
                                {texts.map(text => (
                                    <TextCard key={text.id} text={text} />
                                ))}
                            </div>
                        </section>
                    )}

                    {subCategories.length === 0 && texts.length === 0 && (
                        <div className="text-center mt-xl">
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
