import { useState, useEffect } from 'react';
import { useDatabase } from '../db/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import HimalayaTree from '../components/HimalayaTree';


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
                {loading ? (
                    <div className="container text-center">
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                        <p className="mt-md">Loading texts...</p>
                    </div>
                ) : error ? (
                    <div className="container text-center">
                        <p style={{ color: 'var(--color-maroon)' }}>
                            Error loading categories: {error}
                        </p>
                    </div>
                ) : (
                    <HimalayaTree categories={categories} />
                )}
            </main>

            <Footer />
        </div>
    );
}
