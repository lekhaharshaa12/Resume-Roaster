import React from 'react';

const Header = () => {
  return (
    <header className="site-header">
      <div className="nav-inner">
        <a href="/" className="nav-logo">
          <span className="logo-flame">🔥</span>
          Resume Roaster
        </a>
        <a href="#roast-section" className="nav-cta">
          Roast My Resume →
        </a>
      </div>
    </header>
  );
};

export default Header;