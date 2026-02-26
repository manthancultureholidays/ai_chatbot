import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

function App() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qaPairs, setQaPairs] = useState([]);
  const [dataset, setDataset] = useState(null);
  const [view, setView] = useState('ask');

  useEffect(() => {
    loadQAPairs();
  }, []);

  const loadQAPairs = async () => {
    try {
      const res = await axios.get(`${API_URL}/qa-pairs`);
      setQaPairs(res.data.qa_pairs || []);
    } catch (err) {
      console.error('Error loading Q&A pairs:', err);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/ask`, { question });
      setAnswer(res.data);
    } catch (err) {
      setAnswer({ error: err.message });
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setDataset(data);
        
        setLoading(true);
        await axios.post(`${API_URL}/ingest`, { dataset: data });
        await loadQAPairs();
        setLoading(false);
        alert('Dataset ingested successfully!');
      } catch (err) {
        alert('Error: ' + err.message);
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🤖 RAG-Based Q&A System</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setView('ask')} style={btnStyle}>Ask Question</button>
        <button onClick={() => setView('browse')} style={btnStyle}>Browse Q&A</button>
        <button onClick={() => setView('upload')} style={btnStyle}>Upload Dataset</button>
      </div>

      {view === 'upload' && (
        <div style={cardStyle}>
          <h2>Upload Dataset</h2>
          <input type="file" accept=".json" onChange={handleFileUpload} />
          <p style={{ color: '#666', marginTop: '10px' }}>
            Upload a JSON file to analyze and generate Q&A pairs
          </p>
        </div>
      )}

      {view === 'ask' && (
        <div style={cardStyle}>
          <h2>Ask a Question</h2>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your question about the dataset..."
            style={textareaStyle}
            rows={3}
          />
          <button onClick={handleAsk} disabled={loading} style={primaryBtnStyle}>
            {loading ? 'Searching...' : 'Ask'}
          </button>

          {answer && (
            <div style={{ marginTop: '20px' }}>
              <h3>Answer:</h3>
              <div style={answerStyle}>
                {answer.error ? (
                  <p style={{ color: 'red' }}>{answer.error}</p>
                ) : (
                  <>
                    <p>{answer.answer}</p>
                    {answer.context && (
                      <details style={{ marginTop: '10px' }}>
                        <summary>View Context</summary>
                        {answer.context.map((ctx, i) => (
                          <div key={i} style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5' }}>
                            <small>Score: {ctx.score.toFixed(2)}</small>
                            <pre style={{ whiteSpace: 'pre-wrap' }}>{ctx.text.substring(0, 300)}...</pre>
                          </div>
                        ))}
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'browse' && (
        <div style={cardStyle}>
          <h2>Generated Q&A Pairs ({qaPairs.length})</h2>
          {qaPairs.length === 0 ? (
            <p>No Q&A pairs yet. Upload a dataset first.</p>
          ) : (
            <div>
              {qaPairs.map((qa, i) => (
                <div key={i} style={qaItemStyle}>
                  <div style={{ fontWeight: 'bold', color: '#2563eb' }}>
                    Q{i + 1}: {qa.question}
                  </div>
                  <div style={{ marginTop: '5px', color: '#059669' }}>
                    A: {qa.answer}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                    Category: {qa.category}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: 'white',
  padding: '20px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  marginBottom: '20px'
};

const btnStyle = {
  padding: '10px 20px',
  marginRight: '10px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  background: 'white',
  cursor: 'pointer'
};

const primaryBtnStyle = {
  ...btnStyle,
  background: '#2563eb',
  color: 'white',
  border: 'none'
};

const textareaStyle = {
  width: '100%',
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '14px',
  marginBottom: '10px'
};

const answerStyle = {
  padding: '15px',
  background: '#f0f9ff',
  borderRadius: '4px',
  borderLeft: '4px solid #2563eb'
};

const qaItemStyle = {
  padding: '15px',
  marginBottom: '10px',
  background: '#f9fafb',
  borderRadius: '4px',
  borderLeft: '3px solid #10b981'
};

export default App;
