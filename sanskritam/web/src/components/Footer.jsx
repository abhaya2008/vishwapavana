import { Link } from 'react-router-dom';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container footer-content">
                <div className="footer-logo">
                    🕉 संस्कृतम्
                </div>
                <nav className="footer-links">
                    <Link to="/" className="footer-link">गृहम्</Link>
                    <Link to="/about" className="footer-link">परिचयः</Link>
                    <Link to="/feedback" className="footer-link">प्रतिक्रिया</Link>
                </nav>
            </div>
        </footer>
    );
}
