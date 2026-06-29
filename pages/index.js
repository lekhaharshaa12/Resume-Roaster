import Head from 'next/head';
import { useState } from 'react';
import Header from '../components/Header';

const MIN_WORDS = 200;

export default function Home() {
  const [resumeText, setResumeText] = useState('');
  const [roast, setRoast] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  const wordCount = resumeText.trim() === '' ? 0 : resumeText.trim().split(/\s+/).length;
  const isReady = wordCount >= MIN_WORDS;

  const handleTextChange = (e) => {
    setResumeText(e.target.value);
    if (validationError) setValidationError('');
  };

  const handleRoast = async () => {
    if (!isReady) {
      setValidationError(`Add ${MIN_WORDS - wordCount} more words — that barely qualifies as a bio.`);
      return;
    }

    setLoading(true);
    setError('');
    setRoast('');

    try {
      const response = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setRoast(data.roast);

      // Scroll to results
      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRoast('');
    setError('');
    setValidationError('');
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
              <p className="card-label">Step 1 — Paste your resume</p>

              <textarea
                id="resume-input"
                className="resume-textarea"
                placeholder="Paste your full resume here...&#10;&#10;Experience, education, skills — all of it. The more you give the AI, the more it has to work with (and roast)."
                value={resumeText}
                onChange={handleTextChange}
                aria-label="Resume text input"
                disabled={loading}
              />

              <div className="textarea-meta">
                <span className={`char-count ${isReady ? 'ready' : ''}`}>
                  {isReady ? '✓' : wordCount} {isReady ? 'Ready to roast!' : `/ ${MIN_WORDS} words min`}
                </span>
                {validationError && (
                  <span className="validation-error" role="alert">
                    ⚠ {validationError}
                  </span>
                )}
              </div>

              <button
                id="roast-button"
                className="roast-btn"
                onClick={handleRoast}
                disabled={loading}
                aria-busy={loading}
              >
                <span className="btn-inner">
                  {loading ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Roasting your resume…
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
            {roast && (
              <div id="results" className="results-section">
                <div className="results-card">
                  <div className="results-header">
                    <span className="results-icon">📝</span>
                    <div>
                      <h2 className="results-title">Your Roast is Ready</h2>
                      <p className="results-subtitle">Brutally honest. Genuinely useful.</p>
                    </div>
                  </div>
                  <p className="roast-text">{roast}</p>
                </div>

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
          </section>
        </main>

        <footer className="site-footer">
          <p>&copy; {new Date().getFullYear()} Resume Roaster. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}
