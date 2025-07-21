import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// APIエンドポイントをコンポーネント外の定数として定義
const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

// ローカルタイムゾーンでYYYY-MM-DD形式の文字列を生成するヘルパー関数
const toYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function DiaryFormPage() {
  const [entry, setEntry] = useState('');
  // API通信の状態を管理するためのstateを追加
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  // 今日の日付の日記が既に存在するかチェック
  useEffect(() => {
    const checkTodaysEntry = async () => {
      const today = toYYYYMMDD(new Date());
      try {
        const res = await fetch(`${API_ENDPOINT}?date=${today}`);
        const data = await res.json();
        if (data.length > 0) {
          // 既に日記があれば詳細ページにリダイレクト
          navigate(`/diaries/${data[0].id}`);
        }
      } catch (err) {
        console.error("Failed to check today's entry:", err);
      }
    };

    checkTodaysEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!entry.trim()) return; // 空の投稿を防ぐ

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage('');

    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: entry,
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await res.json();

      // 重複エラー(409)のハンドリング
      if (res.status === 409) {
        navigate(`/diaries/${result.item.id}`, {
          state: { error: '今日の日記は既に記録されています。' }
        });
        return;
      }

      if (!res.ok) {
        throw new Error(result.error || '不明なエラーが発生しました。');
      }

      setSuccessMessage(result.message || '登録が完了しました！');
      setEntry(''); // 成功した場合のみ入力欄をクリア
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1>今日の日記</h1>
      <form onSubmit={handleSubmit}>
        <textarea value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="書いてみて！" disabled={isSubmitting} style={{ width: '100%', height: '100px', marginBottom: '10px', boxSizing: 'border-box' }} />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '登録中...' : '書いた！'}
        </button>
      </form>
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
    </div>
  );
}

export default DiaryFormPage;
