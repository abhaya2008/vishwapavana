import { HashRouter, Routes, Route } from 'react-router-dom';
import { DatabaseProvider } from './db/database';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import TextPage from './pages/TextPage';
import VersePage from './pages/VersePage';
import MahabharataChapterPage from './pages/MahabharataChapterPage';
import SandhiHomePage from './pages/SandhiHomePage';
import SandhiCategoryPage from './pages/SandhiCategoryPage';
import SandhiQuizPage from './pages/SandhiQuizPage';
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
          <Route path="/mahabharata/chapter/:chapterId" element={<MahabharataChapterPage />} />
          <Route path="/vyakaranam/sandhi" element={<SandhiHomePage />} />
          <Route path="/vyakaranam/sandhi/:categoryKey" element={<SandhiCategoryPage />} />
          <Route path="/vyakaranam/sandhi/:categoryKey/:lessonId/:mode" element={<SandhiQuizPage />} />
        </Routes>
      </HashRouter>
    </DatabaseProvider>
  );
}

export default App;
