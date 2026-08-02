import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import bgImage from '../assets/backgoundimage.png';
import logoImage from '../assets/logoclass.png';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: data.username, password: data.password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Invalid credentials');
      }
      const { access, refresh } = await res.json();
      localStorage.setItem('access', access);
      localStorage.setItem('refresh', refresh);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container} style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className={styles.card}>
        <img src={logoImage} alt="ClassGuard Logo" className={styles.icon} style={{ width: '200px', height: 'auto' }} />
        <h1 className={styles.title} style={{ fontFamily: "'Bodoni Moda', serif", fontSize: '1.4rem', marginBottom: '0.5rem', textAlign: 'center' }}>St. James Matriculation Higher Secondary School</h1>
        <h2 style={{ fontSize: '1.1rem', color: '#9ca3af', marginBottom: '2rem', fontWeight: 'normal', textAlign: 'center' }}>ClassGuard Secure Access System</h2>
        <form className={styles.form} onSubmit={handleLogin}>
          <input name="username" type="text" placeholder="Username" required className={styles.input} autoComplete="username" />
          <input name="password" type="password" placeholder="Password" required className={styles.input} autoComplete="current-password" />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
