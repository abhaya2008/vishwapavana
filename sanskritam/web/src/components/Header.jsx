import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to search page
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            <span className="logo-icon">🕉</span>
            <span className="logo-text">संस्कृतम्</span>
          </Link>

          <form className="search-container" onSubmit={handleSearch}>
            <div className="search-bar">
              <input
                type="text"
                className="search-input"
                placeholder="खोजें..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="search-btn">
                🔍
              </button>
            </div>
          </form>

          <button 
            className="menu-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <svg className="menu-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Navigation Drawer for Mobile */}
      <div 
        className={`nav-drawer-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <nav className={`nav-drawer ${drawerOpen ? 'open' : ''}`}>
        <button 
          className="vyakhya-close"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
        >
          ✕
        </button>
        <ul className="nav-list">
          <li className="nav-item">
            <Link to="/" className="nav-link" onClick={() => setDrawerOpen(false)}>
              गृहम् (Home)
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/about" className="nav-link" onClick={() => setDrawerOpen(false)}>
              परिचयः (About)
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/feedback" className="nav-link" onClick={() => setDrawerOpen(false)}>
              प्रतिक्रिया (Feedback)
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
