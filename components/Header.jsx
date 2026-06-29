import React from 'react';

const Header = () => {
  const handleScroll = (e) => {
    e.preventDefault();
    const section = document.getElementById('roast-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="site-header">
      <div className="nav-inner">
        <a href="/" className="nav-logo">
          Resume Roaster
        </a>
        <button onClick={handleScroll} className="nav-cta" style={{ border: 'none', cursor: 'pointer' }}>
          Roast My Resume →
        </button>
      </div>
    </header>
  );
};

export default Header;