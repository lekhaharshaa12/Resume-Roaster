import React from 'react';

const Header = () => {
    return (
        <header style={styles.header}>
            <h1>Demo Header</h1>
            <nav>
                <ul style={styles.navList}>
                    <li><a href="/" style={styles.link}>Home</a></li>
                    <li><a href="/about" style={styles.link}>About</a></li>
                    <li><a href="/contact" style={styles.link}>Contact</a></li>
                </ul>
            </nav>
        </header>
    );
};

const styles = {
    header: {
        background: '#282c34',
        padding: '20px',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    title: {
        margin: 0,
        fontSize: '1.5rem'
    },
    navList: {
        listStyle: 'none',
        display: 'flex',
        gap: '15px',
        margin: 0,
        padding: 0
    },
    link: {
        color: 'white',
        textDecoration: 'none'
    }
};

export default Header;