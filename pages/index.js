import Head from 'next/head';
import { useState, useRef } from 'react';
import Header from '../components/Header';

const MIN_WORDS = 200;

export default function Home() {
  const [resumeText, setResumeText] = useState('');
  const [roast, setRoast] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  // ── Chat State ──────────────────────────────────────────────────────────────
  const [conversationId, setConversationId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  // ── Copy state & Abort Controller Ref ───────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const abortControllerRef = useRef(null);

  const wordCount = resumeText.trim() === '' ? 0 : resumeText.trim().split(/\s+/).length;
  const isReady = wordCount >= MIN_WORDS;

  const handleTextChange = (e) => {
    setResumeText(e.target.value);
    if (validationError) setValidationError('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setResumeText(''); // Clear existing text immediately
    setPdfLoading(true);
    setError('');
    setValidationError('');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/pdf' },
        body: file,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to parse file.');
        return;
      }

      setResumeText(data.text);
    } catch (err) {
      setError('Error reading file.');
    } finally {
      setPdfLoading(false);
      e.target.value = '';
    }
  };

  const handleCancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setError('Generation stopped by user.');
  };

  const handleRoast = async () => {
    if (!isReady) {
      setValidationError(`Add ${MIN_WORDS - wordCount} more words — that barely qualifies as a bio.`);
      return;
    }

    // Cancel any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError('');
    setRoast('');
    setConversationId(null);
    setChatMessages([]);
    setChatError('');

    try {
      const response = await fetch('/api/roast-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      // Scroll to results section immediately so the user sees the start of streaming
      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamRoastText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Preserve the last (potentially partial) line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.conversationId) {
                setConversationId(parsed.conversationId);
              }
              if (parsed.text) {
                streamRoastText += parsed.text;
                setRoast(streamRoastText);
              }
              if (parsed.error) {
                setError(parsed.error);
                break;
              }
            } catch (e) {
              // Ignore partial JSON parse errors during stream chunking
            }
          }
        }
      }

      // Set chat messages history once complete
      if (streamRoastText) {
        setChatMessages([
          {
            role: 'assistant',
            content: streamRoastText,
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Ignore user-triggered aborts
        return;
      }
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading || !conversationId) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatError('');
    setChatLoading(true);

    // Optimistically add user's message to the list
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: userMsg, createdAt: userTime },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userMessage: userMsg }),
      });

      const data = await response.json();

      if (!response.ok) {
        setChatError(data.error || 'Failed to get follow-up response.');
        return;
      }

      const assistantTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, createdAt: assistantTime },
      ]);
    } catch (err) {
      setChatError('Network error. Failed to send message.');
    } finally {
      setChatLoading(false);
      // Scroll chat list to bottom
      setTimeout(() => {
        const chatList = document.getElementById('chat-messages-box');
        if (chatList) {
          chatList.scrollTop = chatList.scrollHeight;
        }
      }, 50);
    }
  };

  const handleCopyRoast = () => {
    navigator.clipboard.writeText(roast);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setRoast('');
    setConversationId(null);
    setChatMessages([]);
    setChatInput('');
    setError('');
    setValidationError('');
    setChatError('');
    document.getElementById('roast-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Head>
        <title>Resume Roaster — AI-Powered Brutally Honest Feedback</title>
        <meta
          name="description"
          content="Paste your resume and get witty, brutally honest AI feedback in seconds. Stop sending bad resumes. Get roasted. Get hired."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📝</text></svg>" />
      </Head>

      <div className="page-wrapper">
        <Header />

        <main>
          {/* ── Hero ── */}
          <section className="hero">
            <div className="hero-badge">
              ✦ AI-Powered &nbsp;·&nbsp; Brutally Honest &nbsp;·&nbsp; Actually Useful
            </div>
            <h1 className="hero-title">
              Your Resume<br />
              <span className="highlight">Deserves a Roast</span>
            </h1>
            <p className="hero-subtitle">
              Stop wondering why you&apos;re not getting callbacks. Paste your resume
              and let our AI tear it apart — then tell you exactly how to fix it.
            </p>
          </section>

          {/* ── Roast Card ── */}
          <section id="roast-section" className="container">
            <div className="roast-card">
              <p className="card-label">Step 1 — Paste your resume or upload document</p>

              <textarea
                id="resume-input"
                className="resume-textarea"
                placeholder="Paste your full resume here...&#10;&#10;Experience, education, skills — all of it. The more you give the AI, the more it has to work with (and roast)."
                value={resumeText}
                onChange={handleTextChange}
                aria-label="Resume text input"
                disabled={loading || pdfLoading}
              />

              <div className="textarea-meta">
                <label htmlFor="file-upload" className={`upload-label-btn ${pdfLoading ? 'loading' : ''}`}>
                  {pdfLoading ? (
                    <>
                      <span className="spinner" style={{ borderColor: 'rgba(37,99,235,0.3)', borderTopColor: '#2563eb', width: '12px', height: '12px' }} />
                      Reading document...
                    </>
                  ) : (
                    '📄 Upload PDF / Image'
                  )}
                  <input
                    type="file"
                    id="file-upload"
                    accept=".pdf, image/*"
                    onChange={handleFileUpload}
                    disabled={loading || pdfLoading}
                    style={{ display: 'none' }}
                  />
                </label>

                <div className="meta-right-flex">
                  {validationError && (
                    <span className="validation-error" role="alert" style={{ marginRight: '16px' }}>
                      ⚠ {validationError}
                    </span>
                  )}
                  <span className={`char-count ${isReady ? 'ready' : ''}`}>
                    {isReady ? '✓ Ready to roast!' : `${wordCount}/${MIN_WORDS} words minimum`}
                  </span>
                </div>
              </div>

              <button
                id="roast-button"
                className="roast-btn"
                onClick={loading ? handleCancelStream : handleRoast}
                aria-busy={loading}
              >
                <span className="btn-inner">
                  {loading ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Stop Generating
                    </>
                  ) : (
                    'Roast My Resume'
                  )}
                </span>
              </button>
            </div>

            {/* ── Error Banner ── */}
            {error && (
              <div className="error-banner" role="alert">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* ── Results ── */}
            {(roast || (loading && !roast)) && (
              <div id="results" className="results-section">
                <div className="results-card">
                  <div className="results-header">
                    <span className="results-icon">📝</span>
                    <div>
                      <h2 className="results-title">Your Roast is Ready</h2>
                      <p className="results-subtitle">Brutally honest. Genuinely useful.</p>
                    </div>
                  </div>
                  <p className="roast-text">
                    {roast || (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Waiting for response stream...
                      </span>
                    )}
                    {loading && roast && <span className="streaming-cursor">▊</span>}
                  </p>
                </div>

                {/* ── Follow-up Chat ── */}
                {conversationId && !loading && (
                  <div className="chat-container">
                    <div className="chat-header">
                      <h3 className="chat-header-title">💬 Have questions about your roast?</h3>
                      <p className="chat-header-subtitle">Ask follow-up questions strictly about your resume details</p>
                    </div>

                    <div id="chat-messages-box" className="chat-messages">
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`chat-message ${msg.role}`}>
                          <div className="chat-message-content">{msg.content}</div>
                          <div className="chat-timestamp">{msg.createdAt}</div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="chat-message assistant">
                          <div className="btn-inner" style={{ color: 'var(--text-secondary)' }}>
                            <span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--text-secondary)', width: '12px', height: '12px' }} />
                            Thinking...
                          </div>
                        </div>
                      )}
                    </div>

                    {chatError && (
                      <div className="chat-error-banner" role="alert">
                        ⚠️ {chatError}
                      </div>
                    )}

                    <form onSubmit={handleSendChatMessage} className="chat-input-wrapper">
                      <input
                        type="text"
                        className="chat-input"
                        placeholder="e.g. How can I rewrite my experience section to sound more impressive?"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={chatLoading}
                      />
                      <button
                        type="submit"
                        className="chat-send-btn"
                        disabled={chatLoading || !chatInput.trim()}
                      >
                        Send
                      </button>
                    </form>
                  </div>
                )}

                {!loading && (
                  <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button className="retry-btn" onClick={handleCopyRoast}>
                      {copied ? '✓ Copied!' : '📋 Copy Roast'}
                    </button>
                    <button
                      id="roast-again-button"
                      className="retry-btn"
                      onClick={handleReset}
                      aria-label="Roast another resume"
                    >
                      ↩ Roast Another Resume
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>

        <footer className="site-footer">
          <p>&copy; {new Date().getFullYear()} Resume Roaster. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}
