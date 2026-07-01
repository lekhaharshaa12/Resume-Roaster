import React from 'react';

const Header = ({ user, onSignInClick, onSignUpClick, onSignOut }) => {
  return (
    <header className="site-header">
      <div className="nav-inner">
        <a href="/" className="nav-logo">
          Resume Roaster
        </a>
        <div className="nav-actions">
          {user ? (
            <div className="nav-user-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="nav-username-label" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                👤 {user.email.split('@')[0]}
              </span>
              <button onClick={onSignOut} className="nav-signout-btn" style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)' }}>
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onSignInClick} className="nav-signin-btn">
                Sign In
              </button>
              <button onClick={onSignUpClick} className="nav-signup-btn">
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;