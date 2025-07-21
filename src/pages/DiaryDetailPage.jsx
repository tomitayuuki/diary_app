import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';

const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

ChartJS.register(
  RadialLinearScale, PointElement, LineElement, Filler, Tooltip
);

function DiaryDetailPage() {
  const { id } = useParams(); // URLからidを取得 (例: /diaries/abc-123)
  const [diary, setDiary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const fetchDiary = async () => {
      try {
        // APIエンドポイントにidを追加して、特定の日記をリクエスト
        const res = await fetch(`${API_ENDPOINT}/${id}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || '日記の読み込みに失敗しました。');
        }
        const data = await res.json();
        setDiary(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiary();
  }, [id]); // idが変更されたらAPIを再実行

  if (isLoading) return <p>読み込み中...</p>;
  if (error) return <p style={{ color: 'red' }}>エラー: {error}</p>;
  if (!diary) return <p>日記が見つかりませんでした。</p>;

  const emotionLabels = {
    joy: '喜',
    anger: '怒',
    sadness: '哀',
    pleasure: '楽'
  };

  // レーダーチャート用のデータとオプション
  const radarData = {
    labels: Object.keys(diary.emotion_params || {}).map(key => emotionLabels[key] || key),
    datasets: [
      {
        label: '感情スコア',
        data: Object.values(diary.emotion_params || {}),
        backgroundColor: 'rgba(0, 123, 255, 0.2)',
        borderColor: 'rgba(0, 123, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  const radarOptions = {
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: {
          display: true,
        },
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: {
          backdropPadding: 0,
          padding: 10,
          stepSize: 25,
        },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  return (
    <div>
      {location.state?.error && (
        <p style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}>{location.state.error}</p>
      )}
      <Link to="/diaries" style={{ textDecoration: 'none', color: '#007bff', marginBottom: '15px', display: 'inline-block' }}>&larr; 一覧に戻る</Link>
      <article style={{ border: '1px solid #eee', padding: '20px', borderRadius: '5px' }}>
        <header style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
            <small><strong>投稿日時:</strong> {new Date(diary.timestamp).toLocaleString('ja-JP')}</small>
        </header>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0 }}>
          {diary.text}
        </p>

        {/* 感情分析セクション */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          {/* 左半分: レーダーチャート */}
          {diary.emotion_params && Object.keys(diary.emotion_params).length > 0 && (
            <div style={{ flex: '1 1 250px', minWidth: 0 }}>
              <strong>感情バランス:</strong>
              <div style={{ position: 'relative', height: '250px', marginTop: '10px' }}>
                <Radar data={radarData} options={radarOptions} />
              </div>
            </div>
          )}

          {/* 右半分: AIコメント */}
          <div style={{ flex: '1 1 300px' }}>
            {diary.emotion_evaluation && (
              <div style={{ marginBottom: '20px' }}>
                <strong>今のあなたの気持ち:</strong>
                <p style={{
                  backgroundColor: '#f8f9fa',
                  borderLeft: '4px solid #007bff',
                  padding: '10px 15px',
                  margin: '10px 0 0 0',
                  whiteSpace: 'pre-wrap'
                }}>
                  {diary.emotion_evaluation}
                </p>
              </div>
            )}
            {diary.emotion_advice && (
              <div>
                <strong>ワンポイントアドバイス:</strong>
                <p style={{
                  backgroundColor: '#f8f9fa',
                  borderLeft: '4px solid #28a745',
                  padding: '10px 15px',
                  margin: '10px 0 0 0',
                  whiteSpace: 'pre-wrap'
                }}>
                  {diary.emotion_advice}
                </p>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

export default DiaryDetailPage;
