import { useState } from 'react';
import './App.css';

const API_URL = 'http://127.0.0.1:8000/chat';

function App() {
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState('pt');
  const [response, setResponse] = useState('');
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, language }),
      });
      const data = await res.json();
      setResponse(data.response);
      setCached(data.cached);
    } catch (e) {
      setResponse('Erro ao conectar ao servidor.');
      setCached(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 className="title">NexusAI Chat</h1>
      <textarea
        className="prompt"
        placeholder="Digite sua mensagem..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
      />
      <div className="controls">
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="pt">Português</option>
          <option value="en">English</option>
        </select>
        <button className="sendBtn" onClick={sendMessage} disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
      {response && (
        <div className="responseBox">
          <p className={cached ? 'cached' : ''}>{response}</p>
          {cached && <small>(resposta do cache)</small>}
        </div>
      )}
    </div>
  );
}

export default App;
