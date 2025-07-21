import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { FaSun, FaFire, FaCloudRain, FaStar } from 'react-icons/fa';
import 'react-calendar/dist/Calendar.css'; // カレンダーのスタイルをインポート
import './Calendar.css'; // カスタムスタイルを後で適用

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

// ローカルタイムゾーンでYYYY-MM-DD形式の文字列を生成するヘルパー関数
const toYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const emotionIcons = {
  joy: <FaSun style={{ color: 'rgba(255, 193, 7, 0.9)', fontSize: '0.8em' }} />,
  anger: <FaFire style={{ color: 'rgba(220, 53, 69, 0.9)', fontSize: '0.8em' }} />,
  sadness: <FaCloudRain style={{ color: 'rgba(0, 123, 255, 0.9)', fontSize: '0.8em' }} />,
  pleasure: <FaStar style={{ color: 'rgba(40, 167, 69, 0.9)', fontSize: '0.8em' }} />,
};

function DiaryListPage() {
  const [diaries, setDiaries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDiaries = async () => {
      try {
        const res = await fetch(API_ENDPOINT);
        if (!res.ok) {
          throw new Error('日記の読み込みに失敗しました。');
        }
        const data = await res.json();
        // 日付をキーにしたMapを作成して検索を高速化
        const diariesMap = new Map(data.map(d => [d.date, d]));
        setDiaries(diariesMap);

        // グラフ用のデータを準備
        if (data.length > 0) {
          // 日付が古い順にソート
          const sortedDiaries = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          const labels = sortedDiaries.map(d => d.date);
          const joyData = sortedDiaries.map(d => d.emotion_params?.joy || 0);
          const angerData = sortedDiaries.map(d => d.emotion_params?.anger || 0);
          const sadnessData = sortedDiaries.map(d => d.emotion_params?.sadness || 0);
          const pleasureData = sortedDiaries.map(d => d.emotion_params?.pleasure || 0);

          setChartData({
            labels,
            datasets: [
              {
                label: '喜',
                data: joyData,
                borderColor: 'rgba(255, 193, 7, 1)',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
              },
              {
                label: '怒',
                data: angerData,
                borderColor: 'rgba(220, 53, 69, 1)',
                backgroundColor: 'rgba(220, 53, 69, 0.2)',
              },
              {
                label: '哀',
                data: sadnessData,
                borderColor: 'rgba(0, 123, 255, 1)',
                backgroundColor: 'rgba(0, 123, 255, 0.2)',
              },
              {
                label: '楽',
                data: pleasureData,
                borderColor: 'rgba(40, 167, 69, 1)',
                backgroundColor: 'rgba(40, 167, 69, 0.2)',
              },
            ],
          });
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiaries();
  }, []); // 初回レンダリング時にのみ実行

  if (isLoading) return <p>読み込み中...</p>;
  if (error) return <p style={{ color: 'red' }}>エラー: {error}</p>;

  // グラフのオプション
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false, // <h2>と重複するため非表示に
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  };

  // 日付に日記があるかチェックし、CSSクラスを返す関数
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const dateString = toYYYYMMDD(date);
      if (diaries.has(dateString)) {
        const diary = diaries.get(dateString);
        const classes = ['diary-day'];
        if (diary.strongest_emotion) {
          classes.push(`emotion-${diary.strongest_emotion}`);
        }
        return classes.join(' ');
      }
    }
    return null;
  };

  // 日付にアイコンを追加する関数
  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dateString = toYYYYMMDD(date);
      if (diaries.has(dateString)) {
        const diary = diaries.get(dateString);
        if (diary.strongest_emotion && emotionIcons[diary.strongest_emotion]) {
          // アイコンを中央下に配置するためのスタイル
          return <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)' }}>{emotionIcons[diary.strongest_emotion]}</div>;
        }
      }
    }
    return null;
  };

  // 日付クリック時の処理
  const handleDateClick = (date) => {
    const dateString = toYYYYMMDD(date);
    const diary = diaries.get(dateString);
    if (diary) {
      navigate(`/diaries/${diary.id}`);
    }
  };

  return (
    <div style={{ paddingBottom: '50px' }}>
      {chartData && (
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px' }}>
          <h3 style={{ textAlign: 'center', margin: '0 0 1rem 0' }}>感情の推移</h3>
          <Line options={chartOptions} data={chartData} />
        </div>
      )}
      <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>過去の日記</h2>
      <Calendar onClickDay={handleDateClick} tileClassName={tileClassName} tileContent={tileContent} locale="ja-JP" />
    </div>
  );
}

export default DiaryListPage;
