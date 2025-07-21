import { Link, Outlet } from 'react-router-dom';

const Layout = ({ children }) => {
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto', fontFamily: 'sans-serif' }}>
      <header>
        <nav style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <Link to="/" style={{ marginRight: '15px', textDecoration: 'none', color: '#007bff' }}>日記を書く</Link>
          <Link to="/diaries" style={{ textDecoration: 'none', color: '#007bff' }}>過去の日記</Link>
        </nav>
      </header>
      <main>
        {/* App.jsxの<Routes>内のコンポーネントがここに表示される */}
        {children}
      </main>
    </div>
  );
};

export default Layout;
