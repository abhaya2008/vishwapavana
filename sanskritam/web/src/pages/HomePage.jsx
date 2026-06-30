import { useState, useEffect } from 'react';
import { useDatabase } from '../db/database';
import CategoryCard from '../components/CategoryCard';
import Header from '../components/Header';
import Footer from '../components/Footer';

// Sample floating characters for background animation
const floatingChars = ['ॐ', 'श्री', 'अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ'];

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

            <main className="main-content">
                {/* Hero Section */}
                <section className="hero">
                    <div className="floating-chars">
                        {floatingChars.map((char, i) => (
                            <span
                                key={i}
                                className="floating-char"
                                style={{
                                    left: `${(i * 8) % 100}%`,
                                    top: `${(i * 15) % 80}%`,
                                    animationDelay: `${i * 0.5}s`,
                                    fontSize: `${1.5 + (i % 3) * 0.5}rem`
                                }}
                            >
                                {char}
                            </span>
                        ))}
                    </div>

                    <div className="container">
                        <h1 className="hero-title">॥ संस्कृतम् ॥</h1>
                        <p className="hero-subtitle">
                            वेद-व्याकरण-शास्त्र-ग्रन्थानां संग्रहः
                            <br />
                            <span style={{ color: 'var(--color-text-light)' }}>
                                A comprehensive collection of Vedas, Grammar, and Shastra texts
                            </span>
                        </p>
                    </div>
                </section>

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
                        <div className="cards-grid">
                            {categories.map(category => (
                                <CategoryCard key={category.id} category={category} />
                            ))}
                        </div>
                    )}
                </section>
            </main>

            <Footer />
        </div>
    );
}
