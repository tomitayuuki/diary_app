import { useState } from 'react';

function App() {
  const [entry, setEntry] = useState('');
  const [submitted, setSubmitted] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(entry);
    setEntry('');
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>今日の日記</h1>
      <form onSubmit={handleSubmit}>
        <textarea
          rows={10}
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="今日はどんな日だった？"
          style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
        />
        <button type="submit" style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          書いた！
        </button>
      </form>

      {submitted && (
        <div style={{ marginTop: '2rem' }}>
          <h2>書いた内容</h2>
          <p>{submitted}</p>
        </div>
      )}
    </div>
  );
}

export default App;
