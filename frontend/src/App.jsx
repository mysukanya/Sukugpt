import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Send, 
  Sparkles, 
  Plus, 
  Bot, 
  User, 
  AlertCircle, 
  Copy, 
  Check, 
  RefreshCw,
  Lightbulb
} from 'lucide-react';
import './App.css';

// Backend API URL (Reads environment variable in production, falls back to http://localhost:5000)
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

const STARTER_PROMPTS = [
  { icon: '💡', title: 'Explain a Concept', prompt: 'Explain how the internet works like I am 10 years old.' },
  { icon: '💻', title: 'Write Code', prompt: 'Write a simple JavaScript function to reverse a string with comments.' },
  { icon: '🚀', title: 'Brainstorm Ideas', prompt: 'Give me 5 creative ideas for beginner web development projects.' },
  { icon: '✍️', title: 'Learning Plan', prompt: 'Create a 1-week study plan to learn HTML and CSS basics.' }
];

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isBackendConnected, setIsBackendConnected] = useState(true);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Check backend connectivity on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (response.ok) {
          setIsBackendConnected(true);
        } else {
          setIsBackendConnected(false);
        }
      } catch (err) {
        console.warn('Backend not connected yet:', err);
        setIsBackendConnected(false);
      }
    };
    checkHealth();
  }, []);

  // Handle textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputMessage]);

  // Start a fresh conversation
  const handleNewChat = () => {
    setMessages([]);
    setError(null);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Send message to backend
  const handleSendMessage = async (textToSend = inputMessage) => {
    const message = textToSend.trim();
    if (!message || isLoading) return;

    setError(null);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // 1. Add User Message to conversation state
    const userMsg = {
      role: 'user',
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Prepare history of previous messages to send to backend for multi-turn chat memory
    const historyPayload = messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      text: msg.text
    }));

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 2. Call our Node.js/Express backend
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          history: historyPayload
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server returned error ${response.status}`);
      }

      // 3. Add AI Response to conversation state
      const aiMsg = {
        role: 'ai',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
      setIsBackendConnected(true);
    } catch (err) {
      console.error('Error sending message:', err);
      let errMsg = err.message;
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errMsg = 'Cannot connect to backend server. Make sure your Node.js backend is running on port 5000 (run `npm run dev` in the backend folder).';
        setIsBackendConnected(false);
      }
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard shortcut (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Copy text to clipboard
  const handleCopyText = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="chat-container">
      {/* Top Navbar */}
      <header className="chat-header">
        <div className="brand-group">
          <div className="brand-logo">
            <Sparkles className="logo-sparkle" size={20} />
          </div>
          <div>
            <h1 className="brand-title">SukuGPT</h1>
            <span className="brand-subtitle">Powered by Gemini AI</span>
          </div>
        </div>

        <div className="header-actions">
          <div className={`status-badge ${isBackendConnected ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {isBackendConnected ? 'Backend Connected' : 'Backend Offline'}
          </div>

          <button 
            className="new-chat-btn"
            onClick={handleNewChat}
            title="Start a new conversation"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* Main Chat Scroll Area */}
      <main className="messages-area">
        {messages.length === 0 ? (
          /* Empty / Welcome State */
          <div className="welcome-screen">
            <div className="welcome-icon-box">
              <Sparkles size={40} className="welcome-sparkle" />
            </div>
            <h2 className="welcome-heading">Welcome to SukuGPT</h2>
            <p className="welcome-desc">
              Your personal AI assistant powered by Google Gemini. Ask me anything, explore ideas, debug code, or learn new concepts!
            </p>

            <div className="starter-grid">
              {STARTER_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  className="starter-card"
                  onClick={() => handleSendMessage(item.prompt)}
                >
                  <div className="starter-card-header">
                    <span className="starter-emoji">{item.icon}</span>
                    <span className="starter-title">{item.title}</span>
                  </div>
                  <p className="starter-text">"{item.prompt}"</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="messages-list">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`message-row ${msg.role === 'user' ? 'user-row' : 'ai-row'}`}
              >
                <div className="message-avatar">
                  {msg.role === 'user' ? (
                    <User size={18} />
                  ) : (
                    <Bot size={18} />
                  )}
                </div>

                <div className="message-content-wrapper">
                  <div className="message-sender-info">
                    <span className="sender-name">{msg.role === 'user' ? 'You' : 'SukuGPT'}</span>
                    <span className="message-time">{msg.timestamp}</span>
                  </div>

                  <div className="message-bubble">
                    {msg.role === 'user' ? (
                      <p className="user-message-text">{msg.text}</p>
                    ) : (
                      <div className="ai-markdown-content">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {msg.role === 'ai' && (
                    <div className="message-footer-actions">
                      <button 
                        className="copy-btn"
                        onClick={() => handleCopyText(msg.text, idx)}
                        title="Copy to clipboard"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check size={14} className="copied-icon" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator Bubble */}
            {isLoading && (
              <div className="message-row ai-row">
                <div className="message-avatar">
                  <Bot size={18} />
                </div>
                <div className="message-content-wrapper">
                  <div className="message-sender-info">
                    <span className="sender-name">SukuGPT</span>
                  </div>
                  <div className="message-bubble typing-bubble">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="typing-text">SukuGPT is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} className="error-icon" />
          <span className="error-text">{error}</span>
          <button className="error-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Bottom Input Section */}
      <footer className="chat-footer">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Type your message here... (Press Enter to send)"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button
            className={`send-button ${inputMessage.trim() && !isLoading ? 'active' : ''}`}
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            title="Send message (Enter)"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="footer-disclaimer">
          SukuGPT may produce inaccurate information. Powered by Google Gemini AI SDK.
        </p>
      </footer>
    </div>
  );
}

export default App;
