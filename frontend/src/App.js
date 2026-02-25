import React, { useState, useEffect, useRef } from 'react';
import './index.css';

const API_URL = 'http://localhost:5000/api/ask';

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { text: "Hello! I am your AI Travel Assistant. How can I help you today?", isUser: false, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const clearChat = () => {
    setMessages([{ text: "Hello! I am your AI Travel Assistant. How can I help you today?", isUser: false, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { text: input, isUser: true, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
    setMessages(prev => [...prev, userMessage]);

    const botMessagePlaceholder = { text: '', isUser: false, contextUsed: true, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
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
        <div className="header-left">
          <div className="logo">✈️</div>
          <div>
            <h1>Travel AI Assistant</h1>
            <p className="subtitle">Your personal travel guide</p>
          </div>
        </div>
        <button className="clear-btn" onClick={clearChat} title="Clear chat">🗑️</button>
      </header>

      <div className="chat-window">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-wrapper ${msg.isUser ? 'user-wrapper' : 'bot-wrapper'}`}>
            {!msg.isUser && <div className="avatar bot-avatar">🤖</div>}
            <div className={`message ${msg.isUser ? 'user' : 'bot'}`}>
              {msg.contextUsed && !msg.isUser && <span className="context-badge">✓ Verified</span>}
              <div className="message-text">{msg.text || (loading && idx === messages.length - 1 ? <span className="typing"><span></span><span></span><span></span></span> : '')}</div>
              <span className="message-time">{msg.time}</span>
            </div>
            {msg.isUser && <div className="avatar user-avatar">👤</div>}
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
          {loading ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  );
}

export default App;
