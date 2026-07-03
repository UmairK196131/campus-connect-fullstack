'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPut } from '../../lib/api';
import { colorForName } from '../../lib/colors';
import { useTheme } from '../../lib/theme';

export default function ProfilePage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    apiGet('/user/profile')
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    setPwLoading(true);

    try {
      const data = await apiPut('/user/password', {
        current_password: currentPw,
        new_password: newPw,
      });
      setPwSuccess(data.message);
      setCurrentPw('');
      setNewPw('');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwLoading(false);
    }
  }

  if (loading || !profile) return null;

  return (
    <div className="home-page">
      <nav className="navbar">
        <div className="nav-brand">
          <Link href="/home" className="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Link>
          <span className="nav-title">My Profile</span>
        </div>
        <div className="nav-right">
          <button onClick={toggleTheme} className="btn btn-outline btn-sm" title="Toggle theme">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </nav>

      <div className="home-container" style={{ maxWidth: '600px' }}>

        {/* Profile Card */}
        <div className="panel" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            <div
              className="avatar"
              style={{
                background: colorForName(profile.username),
                width: '72px',
                height: '72px',
                fontSize: '1.8rem',
                borderRadius: '50%',
                flexShrink: 0,
              }}
            >
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>
                {profile.username}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Joined {profile.joined}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="stat-card">
              <div className="stat-number">{profile.total_messages}</div>
              <div className="stat-label">Messages Sent</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{profile.total_rooms}</div>
              <div className="stat-label">Rooms Created</div>
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="panel" style={{ marginBottom: '24px' }}>
          <h2 className="panel-title">
            <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Appearance
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>
                {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {theme === 'dark' ? 'Deep Space theme is active' : 'Light theme is active'}
              </p>
            </div>
            <button onClick={toggleTheme} className="theme-toggle-btn">
              <span className={`theme-toggle-slider${theme === 'light' ? ' on' : ''}`}></span>
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className="panel">
          <h2 className="panel-title">
            <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Change Password
          </h2>

          {pwError && <div className="alert alert-error">{pwError}</div>}
          {pwSuccess && <div className="alert alert-success">{pwSuccess}</div>}

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Enter new password (min 4 characters)"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={pwLoading}>
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}