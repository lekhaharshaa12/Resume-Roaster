import Head from 'next/head';
import { useState, useRef, useEffect } from 'react';
import Header from '../components/Header';

const MIN_WORDS = 200;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export default function Home() {
  const [user, setUser] = useState(null);
  const [userRoasts, setUserRoasts] = useState([]);
  const [resumeText, setResumeText] = useState('');
  const [roast, setRoast] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  // ── Attached File State (Gemini Style) ──
  const [attachedFile, setAttachedFile] = useState(null); // { name, size, type, data (base64) }

  // ── Left Slide-In History Sidebar State ──
  const [showSidebar, setShowSidebar] = useState(false);

  // ── Auth Modal State ──
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authType, setAuthType] = useState('signin'); // 'signin' | 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Toggle show/hide password
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // Toggle show/hide confirm password
  const [resendTimer, setResendTimer] = useState(0); // 30 seconds resend OTP timer
  const [passwordValidationErrors, setPasswordValidationErrors] = useState([]); // Separate error boxes list

  // Signup Step Tracker
  const [signupStep, setSignupStep] = useState('options'); // 'options' | 'verify' | 'password'
  const [authCode, setAuthCode] = useState(['', '', '', '', '', '']);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [idleNotice, setIdleNotice] = useState(false); // Idle notice banner

  // Streaming State & Abort Controller
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef(null);

  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const lastActivityRef = useRef(Date.now());

  // ── Session check on mount ──
  useEffect(() => {
    fetchSession();
    
    // Idle timer event listeners
    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);
    window.addEventListener('scroll', resetIdleTimer);

    // Activity check loop (every 10 seconds)
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        handleAutoLogout();
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      window.removeEventListener('scroll', resetIdleTimer);
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ── Resend Code Countdown Timer ──
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setUserRoasts(data.roasts);
      }
    } catch (err) {
      console.error('Session load failed:', err);
    }
  };

  const handleAutoLogout = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      setUser(null);
      setUserRoasts([]);
      setRoast('');
      setAttachedFile(null);
      setShowSidebar(false);
      setIdleNotice(true);
      setTimeout(() => setIdleNotice(false), 5000);
    } catch (err) {
      console.error('Auto logout failed:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      setUser(null);
      setUserRoasts([]);
      setRoast('');
      setAttachedFile(null);
      setShowSidebar(false);
    } catch (err) {
      console.error('Signout failed:', err);
    }
  };

  // ── Local File Base64 Reader ──
  const handleFileAttach = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPdfLoading(true);
    setError('');
    setValidationError('');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      setAttachedFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type || 'application/pdf',
        data: base64String
      });
      setPdfLoading(false);
      e.target.value = '';
    };

    reader.onerror = () => {
      setError('Failed to read file.');
      setPdfLoading(false);
    };
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    setError('');
  };

  // ── Stop Stream Handler ──
  const handleCancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setLoading(false);
    }
  };

  // ── Roast Submission (Streaming) ──
  const handleRoastSend = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!attachedFile && !resumeText.trim()) {
      setValidationError('Write a prompt or attach a PDF/Image resume first.');
      return;
    }

    setLoading(true);
    setError('');
    setRoast('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/roast-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: attachedFile?.data || null,
          fileType: attachedFile?.type || null,
          resumeText: resumeText || null
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to initiate roast streaming.');
        setIsStreaming(false);
        setLoading(false);
        return;
      }

      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep last incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const dataObj = JSON.parse(dataStr);
              if (dataObj.error) {
                setError(dataObj.error);
                break;
              }
              if (dataObj.text) {
                setRoast(prev => prev + dataObj.text);
              }
            } catch (parseErr) {
              console.error('SSE JSON parse failed:', parseErr);
            }
          }
        }
      }

      setAttachedFile(null);
      setResumeText('');
      fetchSession();
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Roast stream aborted.');
      } else {
        setError('Network error. Failed to stream roast feedback.');
      }
    } finally {
      setIsStreaming(false);
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Copy Feedback
  const handleCopyRoast = () => {
    navigator.clipboard.writeText(roast);
    alert('Resume roast copied to clipboard! 📋');
  };

  // Share link
  const handleShareRoast = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    alert('Share link copied to clipboard! 🔗');
  };

  // ── Password Strength Rules Evaluator ──
  const checkPasswordStrength = (pass) => {
    const rules = {
      length: pass.length >= 8,
      upper: /[A-Z]/.test(pass),
      lower: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      symbol: /[!@#$%^&*(),.?":{}|<>_\-]/.test(pass),
    };

    let score = 0;
    if (rules.length) score++;
    if (rules.upper) score++;
    if (rules.lower) score++;
    if (rules.number) score++;
    if (rules.symbol) score++;

    return { rules, score };
  };

  // ── Authentication Actions ──
  const handleOpenAuth = (type) => {
    setAuthType(type);
    setAuthEmail('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setSignupStep('options');
    setAuthCode(['', '', '', '', '', '']);
    setAuthError('');
    setPasswordValidationErrors([]);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setResendTimer(0);
    setShowAuthModal(true);
  };

  const handleSignupSendCode = async (e) => {
    e.preventDefault();
    if (!authEmail) return;
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/signup-send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Failed to send verification code.');
        return;
      }
      setSignupStep('verify');
      setResendTimer(30); // Start 30 seconds countdown
    } catch (err) {
      setAuthError('Connection error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Resend Code Handler ──
  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/signup-send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Failed to resend code.');
        return;
      }
      setResendTimer(30);
      setAuthCode(['', '', '', '', '', '']);
      if (otpRefs[0].current) {
        otpRefs[0].current.focus();
      }
    } catch (err) {
      setAuthError('Connection error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignupVerifyCode = async (codeString) => {
    setAuthLoading(true);
    setAuthError('');
    if (codeString.length === 6) {
      setSignupStep('password');
      setAuthLoading(false);
    } else {
      setAuthError('Please enter the full 6-digit code.');
      setAuthLoading(false);
    }
  };

  const handleSignupComplete = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    // Evaluate password validation rules
    const errs = [];
    if (authPassword.length < 8) {
      errs.push("Password must be at least 8 characters long.");
    }
    if (!/[A-Z]/.test(authPassword)) {
      errs.push("Password must contain at least one uppercase letter (A-Z).");
    }
    if (!/[a-z]/.test(authPassword)) {
      errs.push("Password must contain at least one lowercase letter (a-z).");
    }
    if (!/[0-9]/.test(authPassword)) {
      errs.push("Password must contain at least one number (0-9).");
    }
    if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(authPassword)) {
      errs.push("Password must contain at least one special symbol (!@#$%^&*).");
    }
    if (authPassword !== authConfirmPassword) {
      errs.push("Confirm password does not match original password.");
    }

    if (errs.length > 0) {
      setPasswordValidationErrors(errs);
      return;
    }

    setPasswordValidationErrors([]);
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/signup-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail,
          code: authCode.join(''),
          password: authPassword,
          confirmPassword: authConfirmPassword
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Failed to register account.');
        return;
      }
      setUser(data.user);
      setShowAuthModal(false);
      fetchSession();
    } catch (err) {
      setAuthError('Connection error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Incorrect email or password.');
        return;
      }
      setUser(data.user);
      setShowAuthModal(false);
      fetchSession();
    } catch (err) {
      setAuthError('Connection error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newCode = [...authCode];
    newCode[index] = value.substring(value.length - 1);
    setAuthCode(newCode);

    if (value && index < 5) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !authCode[index] && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/[^0-9]/g, '');
    if (pastedData.length >= 6) {
      const codeArray = pastedData.slice(0, 6).split('');
      setAuthCode(codeArray);
      if (otpRefs[5].current) {
        otpRefs[5].current.focus();
      }
    }
  };

  // Password evaluation score
  const { rules: strengthRules, score: strengthScore } = checkPasswordStrength(authPassword);

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

      {idleNotice && (
        <div className="idle-notice-banner" style={{ background: '#ef4444', color: '#ffffff', padding: '8px', textAlign: 'center', fontWeight: '600', position: 'sticky', top: 0, zIndex: 1000 }}>
          ⚠️ Logged out automatically due to 10 minutes of inactivity.
        </div>
      )}

      {/* Left Slide-In History Sidebar Overlay */}
      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)}></div>}

      {/* Left Slide-In History Sidebar */}
      <div className={`history-sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3 className="sidebar-title">📜 Saved History</h3>
          <button className="sidebar-close-btn" onClick={() => setShowSidebar(false)}>&times;</button>
        </div>
        <div className="sidebar-list">
          {userRoasts.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRoast(r.roastText);
                setShowSidebar(false);
                setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
              className="sidebar-item"
            >
              <div className="sidebar-item-date">
                {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <h4 className="sidebar-item-title">Resume Roast</h4>
              <p className="sidebar-item-preview">{r.resumeText || "Uploaded Resume File"}</p>
            </button>
          ))}
          {userRoasts.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', marginTop: '20px' }}>
              No saved roasts found.
            </p>
          )}
        </div>
      </div>

      {/* Floating Sidebar Open Trigger */}
      {user && (
        <button className="floating-history-btn" onClick={() => setShowSidebar(true)}>
          📜 Saved History
        </button>
      )}

      <div className="page-wrapper">
        <Header 
          user={user} 
          onSignInClick={() => handleOpenAuth('signin')} 
          onSignUpClick={() => handleOpenAuth('signup')} 
          onSignOut={handleSignOut} 
        />

        <main>
          {/* Hero - Hidden when logged in */}
          {!user && (
            <section className="hero">
              <div className="hero-badge">
                ✦ SMTP Verification &nbsp;·&nbsp; On-Demand Roaster
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
          )}

          {/* Container wrapper - only rendered when logged in */}
          {user && (
            <section id="roast-section" className="container">
              {/* Authenticated View: Gemini-Style Prompt / Upload Box */}
              <div className="roast-card gemini-card">
                <h3 className="results-title" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', marginBottom: '16px', fontWeight: '700' }}>
                  📝 Resume Roaster
                </h3>

                <div className="gemini-input-container">
                  {attachedFile && (
                    <div className="attachment-chip">
                      <span className="chip-icon">📄</span>
                      <div className="chip-details">
                        <span className="chip-filename">{attachedFile.name}</span>
                        <span className="chip-size">{attachedFile.size}</span>
                      </div>
                      <button onClick={handleRemoveAttachment} className="chip-remove-btn">&times;</button>
                    </div>
                  )}

                  <textarea
                    id="resume-input"
                    className="gemini-textarea"
                    placeholder="Write prompts or paste text here... (Or click the clip icon below to attach your PDF / Image resume)"
                    value={resumeText}
                    onChange={(e) => { setResumeText(e.target.value); if (validationError) setValidationError(''); }}
                    disabled={loading || pdfLoading}
                  />

                  <div className="gemini-actions">
                    <label htmlFor="file-upload" className={`gemini-attach-btn ${pdfLoading ? 'loading' : ''}`}>
                      {pdfLoading ? (
                        <span className="spinner" style={{ width: '14px', height: '14px' }} />
                      ) : (
                        '📎 Attach'
                      )}
                      <input
                        type="file"
                        id="file-upload"
                        accept=".pdf, image/*"
                        onChange={handleFileAttach}
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
                      
                      {/* Cancel Stream action button */}
                      {isStreaming && (
                        <button
                          onClick={handleCancelStream}
                          className="gemini-attach-btn"
                          style={{ borderColor: '#ef4444', color: '#ef4444', marginRight: '8px' }}
                        >
                          🛑 Cancel
                        </button>
                      )}

                      <button
                        onClick={handleRoastSend}
                        className="gemini-send-btn"
                        disabled={loading || pdfLoading || (!attachedFile && !resumeText.trim())}
                      >
                        {loading ? 'Roasting...' : 'Send Roast →'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="error-banner" role="alert">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Loading / Results Section */}
              {(roast || loading) && (
                <div id="results" className="results-section" style={{ marginTop: '32px' }}>
                  <div className="results-card">
                    <div className="results-header">
                      <span className="results-icon">🔥</span>
                      <div>
                        <h2 className="results-title">Resume Burn Transcript</h2>
                        <p className="results-subtitle">Brutally honest feedback on your credentials.</p>
                      </div>
                    </div>
                    
                    {/* Live Stream / Typewriter output */}
                    <p className="roast-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                      {roast || (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Stoking the fire... preparing to incinerate... 🔥
                        </span>
                      )}
                    </p>


                  </div>
                </div>
              )}
            </section>
          )}
        </main>

        {/* Authentication Modal */}
        {showAuthModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <button onClick={() => setShowAuthModal(false)} className="modal-close-btn">&times;</button>
              
              <h2 className="modal-title">
                {authType === 'signin' ? 'Sign In' : 'Sign Up'}
              </h2>
              <p className="modal-subtitle" style={{ marginBottom: '24px' }}>
                {authType === 'signin' 
                  ? 'Access your resume roaster account.' 
                  : 'Create a new account with email verification.'}
              </p>

              {authError && <div className="modal-error-banner">⚠️ {authError}</div>}

              {/* ── EMAIL SIGN IN FLOW ── */}
              {authType === 'signin' ? (
                <form onSubmit={handleSignIn} className="modal-form">
                  <input
                    type="email"
                    className="modal-input"
                    placeholder="name@email.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="modal-input"
                      placeholder="Enter password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                      style={{ paddingRight: '50px' }}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button type="submit" className="modal-btn" disabled={authLoading}>
                    {authLoading ? 'Signing In...' : 'Sign In'}
                  </button>
                  <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '12px' }}>
                    Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => handleOpenAuth('signup')} className="modal-link-btn" style={{ padding: 0 }}>Sign Up</button>
                  </p>
                </form>
              ) : (
                /* ── EMAIL SIGN UP FLOW (3 STEPS) ── */
                <div>
                  {/* Step 1: Input Email & Request Code */}
                  {signupStep === 'options' && (
                    <form onSubmit={handleSignupSendCode} className="modal-form">
                      <input
                        type="email"
                        className="modal-input"
                        placeholder="name@email.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        required
                        disabled={authLoading}
                      />
                      <button type="submit" className="modal-btn" disabled={authLoading}>
                        {authLoading ? 'Sending Code...' : 'Send Verification Code'}
                      </button>
                      <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '12px' }}>
                        Already have an account?{' '}
                        <button type="button" onClick={() => handleOpenAuth('signin')} className="modal-link-btn" style={{ padding: 0 }}>Sign In</button>
                      </p>
                    </form>
                  )}

                  {/* Step 2: Verification Code Input */}
                  {signupStep === 'verify' && (
                    <div className="modal-form">
                      <div className="otp-container">
                        {authCode.map((digit, index) => (
                          <input
                            key={index}
                            ref={otpRefs[index]}
                            type="text"
                            maxLength="1"
                            className="otp-input"
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            onPaste={handleOtpPaste}
                            disabled={authLoading}
                          />
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                        <button
                          type="button"
                          onClick={handleResendCode}
                          className="modal-link-btn"
                          disabled={resendTimer > 0 || authLoading}
                          style={{ padding: 0, fontSize: '0.8rem' }}
                        >
                          {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : 'Resend Verification Code'}
                        </button>
                        
                        <button 
                          onClick={() => { setSignupStep('options'); setAuthCode(['','','','','','']); }} 
                          className="modal-link-btn" 
                          style={{ padding: 0, fontSize: '0.8rem' }}
                          disabled={authLoading}
                        >
                          Change Email
                        </button>
                      </div>

                      <button 
                        onClick={() => handleSignupVerifyCode(authCode.join(''))} 
                        className="modal-btn" 
                        disabled={authLoading || authCode.join('').length < 6}
                        style={{ marginTop: '24px' }}
                      >
                        Verify Code
                      </button>
                    </div>
                  )}

                  {/* Step 3: Enter Passwords & Complete Register */}
                  {signupStep === 'password' && (
                    <form onSubmit={handleSignupComplete} className="modal-form">
                      {/* Hidden Email input to associate credentials in Chrome/Google Password Manager */}
                      <input 
                        type="email" 
                        name="email" 
                        value={authEmail} 
                        readOnly 
                        style={{ display: 'none' }} 
                        autoComplete="username" 
                      />

                      {/* Password Field */}
                      <div className="password-input-wrapper">
                        <input
                          type={showPassword ? "text" : "password"}
                          className="modal-input"
                          placeholder="Create Password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          required
                          disabled={authLoading}
                          style={{ paddingRight: '50px' }}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>

                      {/* Confirm Password Field */}
                      <div className="password-input-wrapper">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          className="modal-input"
                          placeholder="Confirm Password"
                          value={authConfirmPassword}
                          onChange={(e) => setAuthConfirmPassword(e.target.value)}
                          required
                          disabled={authLoading}
                          style={{ paddingRight: '50px' }}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? "Hide" : "Show"}
                        </button>
                      </div>

                      {/* ── LIVE PASSWORD STRENGTH METER ── */}
                      {authPassword && (
                        <div className="password-strength-container">
                          <span className="strength-label">
                            Password Strength: {' '}
                            {strengthScore <= 2 && <span style={{ color: '#ef4444' }}>Weak</span>}
                            {strengthScore === 3 && <span style={{ color: '#eab308' }}>Medium</span>}
                            {strengthScore === 4 && <span style={{ color: '#84cc16' }}>Good</span>}
                            {strengthScore === 5 && <span style={{ color: '#22c55e' }}>Strong</span>}
                          </span>

                          <div className={`strength-bar-wrapper strength-level-${strengthScore}`}>
                            <div className="strength-bar-segment" />
                            <div className="strength-bar-segment" />
                            <div className="strength-bar-segment" />
                            <div className="strength-bar-segment" />
                            <div className="strength-bar-segment" />
                          </div>

                          <ul className="password-rules-list">
                            <li className={`password-rule-item ${strengthRules.length ? 'met' : ''}`}>
                              <span className="password-rule-icon">{strengthRules.length ? '✓' : '•'}</span>
                              At least 8 characters
                            </li>
                            <li className={`password-rule-item ${strengthRules.upper ? 'met' : ''}`}>
                              <span className="password-rule-icon">{strengthRules.upper ? '✓' : '•'}</span>
                              At least one uppercase letter (A-Z)
                            </li>
                            <li className={`password-rule-item ${strengthRules.lower ? 'met' : ''}`}>
                              <span className="password-rule-icon">{strengthRules.lower ? '✓' : '•'}</span>
                              At least one lowercase letter (a-z)
                            </li>
                            <li className={`password-rule-item ${strengthRules.number ? 'met' : ''}`}>
                              <span className="password-rule-icon">{strengthRules.number ? '✓' : '•'}</span>
                              At least one number (0-9)
                            </li>
                            <li className={`password-rule-item ${strengthRules.symbol ? 'met' : ''}`}>
                              <span className="password-rule-icon">{strengthRules.symbol ? '✓' : '•'}</span>
                              At least one special symbol (!@#$%^&*)
                            </li>
                          </ul>
                        </div>
                      )}

                      {/* ── SEPARATE LIVE ERROR BOXES ── */}
                      {passwordValidationErrors.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginBottom: '16px' }}>
                          {passwordValidationErrors.map((err, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: '#fef2f2',
                                borderLeft: '4px solid #ef4444',
                                color: '#b91c1c',
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                width: '100%',
                                textAlign: 'left',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                            >
                              <span>⚠️</span>
                              <span>{err}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <button 
                        type="submit" 
                        className="modal-btn" 
                        disabled={authLoading}
                      >
                        {authLoading ? 'Registering...' : 'Complete Register'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="site-footer">
          <p>&copy; {new Date().getFullYear()} Resume Roaster. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}
