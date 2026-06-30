import { HashRouter, Routes, Route } from 'react-router-dom';
import { DatabaseProvider } from './db/database';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import TextPage from './pages/TextPage';
import VersePage from './pages/VersePage';
import './styles/index.css';

function App() {
  return (
    <DatabaseProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:id" element={<CategoryPage />} />
          <Route path="/text/:id" element={<TextPage />} />
          <Route path="/chapter/:chapterId" element={<VersePage />} />
          <Route path="/chapter/:chapterId/verse/:verseId" element={<VersePage />} />
        </Routes>
      </HashRouter>
    </DatabaseProvider>
  );
}

export default App;
