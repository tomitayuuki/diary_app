import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DiaryFormPage from './pages/DiaryFormPage';
import DiaryListPage from './pages/DiaryListPage';
import DiaryDetailPage from './pages/DiaryDetailPage';


function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DiaryFormPage />} />
        <Route path="/diaries" element={<DiaryListPage />} />
        <Route path="/diaries/:id" element={<DiaryDetailPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
