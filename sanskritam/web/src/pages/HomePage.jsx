import { useState, useEffect } from 'react';
import { useDatabase } from '../db/database';
import CategoryCard from '../components/CategoryCard';
import Header from '../components/Header';
import Footer from '../components/Footer';


export default function HomePage() {
    const { getCategories, loading, error } = useDatabase();
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        async function fetchCategories() {
            const data = await getCategories();
            setCategories(data);
        }
        fetchCategories();
    }, [getCategories]);

    return (
        <div className="page-wrapper">
            <Header />

            <main className="main-content home-main">
                {/* Categories Grid */}
                <section className="container">
                    {loading ? (
                        <div className="text-center">
                            <div className="spinner" style={{ margin: '0 auto' }}></div>
                            <p className="mt-md">Loading texts...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center">
                            <p style={{ color: 'var(--color-maroon)' }}>
                                Error loading categories: {error}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="home-logo-wrap">
                                <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="स्वाध्यायः" className="home-logo" />
                            </div>
                            <div className="cards-grid">
                                {categories.map(category => (
                                    <CategoryCard key={category.id} category={category} />
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </main>

            <Footer />
        </div>
    );
}
