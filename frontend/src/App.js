import React, { useState, useEffect, useRef } from 'react';
import './index.css';

const API_URL = 'http://localhost:5000/api/ask';

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { text: "Hello! I am your AI Travel Assistant. How can I help you today?", isUser: false }
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { text: input, isUser: true };
    setMessages(prev => [...prev, userMessage]);

    // Add a placeholder bot message for streaming
    const botMessagePlaceholder = { text: '', isUser: false, contextUsed: true };
    setMessages(prev => [...prev, botMessagePlaceholder]);

    setInput('');
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input })
      });

      if (!response.ok) throw new Error("Server error");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Update the last message (the bot's streaming message)
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], text: fullText };
          return updated;
        });
      }

    } catch (error) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { text: "Sorry, I'm having trouble connecting to the server.", isUser: false };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">✈️</div>
        <h1>Travel AI Bot (Streaming)</h1>
      </header>

      <div className="chat-window">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.isUser ? 'user' : 'bot'}`}>
            {msg.contextUsed && !msg.isUser && <span className="context-badge">Database Verified</span>}
            {msg.text || (loading && idx === messages.length - 1 ? '...' : '')}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about travel packages, itineraries..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default App;
