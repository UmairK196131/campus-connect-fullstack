'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost, apiFetch } from '../../lib/api';
import { colorForName } from '../../lib/colors';
import { useTheme } from '../../lib/theme';

export default function HomePage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pinnedMsg, setPinnedMsg] = useState(null);

  useEffect(() => {
    apiGet('/me')
      .then((data) => {
        setUsername(data.username);
        return apiGet('/rooms');
      })
      .then((data) => {
        setRooms(data.rooms);
        setLoading(false);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function handleCreateRoom(e) {
    e.preventDefault();
    setError('');

    try {
      const data = await apiPost('/rooms', { room_name: roomName, description });
      setRooms([data.room, ...rooms]);
      setRoomName('');
      setDescription('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteRoom(e, roomId, roomName) {
    e.preventDefault(); // prevent the Link from navigating
    e.stopPropagation();

    if (!window.confirm(`Delete room "${roomName}"? This cannot be undone.`)) return;

    try {
      await apiFetch(`/rooms/${roomId}`, { method: 'DELETE' });
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogout() {
    await apiPost('/logout', {});
    router.push('/login');
  }

  if (loading) return null;

  return (
    <div className="home-page">
      <nav className="navbar">
        <div className="nav-brand">
          <span className="brand-icon-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="8.5" cy="10.5" r="1" fill="currentColor" />
              <circle cx="12" cy="10.5" r="1" fill="currentColor" />
              <circle cx="15.5" cy="10.5" r="1" fill="currentColor" />
            </svg>
          </span>
          <span className="nav-title">Campus Connect</span>
        </div>
        <div className="nav-right">
          <button onClick={toggleTheme} className="btn btn-outline btn-sm" title="Toggle theme">
         {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link href="/profile" className="btn btn-outline btn-sm">
            <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {username}
          </Link>
          <button onClick={handleLogout} className="btn btn-outline btn-sm">
            <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            Log out
          </button>
        </div>
      </nav>

      <div className="home-container">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="home-grid">
          <div className="panel">
            <h2 className="panel-title">
              <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Create a room
            </h2>
            <form onSubmit={handleCreateRoom} className="create-form">
              <div className="form-group">
                <label htmlFor="room_name">Room name</label>
                <input
                  type="text"
                  id="room_name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. CS Study Group"
                  required
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">
                  Description <span className="optional">(optional)</span>
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this room about?"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full">Create room</button>
            </form>
          </div>

          <div className="panel rooms-panel">
            <h2 className="panel-title">
              <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Available rooms
            </h2>

            {rooms.length > 0 ? (
              <div className="rooms-list">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="room-card"
                    style={{ '--room-accent': colorForName(room.name) }}
                  >
                    <Link href={`/room/${room.id}`} className="room-card-link">
                      <span className="room-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </span>
                      <div className="room-info">
                        <div className="room-name">{room.name}</div>
                        {room.description && <div className="room-desc">{room.description}</div>}
                        <div className="room-meta">by {room.creator_username}</div>
                      </div>
                      {pinnedMsg && (
  <div className="pinned-banner">
    <span className="pinned-icon">📌</span>
    <div className="pinned-content">
      <span className="pinned-label">Pinned by {room.creator_username}</span>
      <span className="pinned-text">{pinnedMsg.text}</span>
    </div>
    {room.creator_username === username && (
      <button
        className="reply-banner-cancel"
        onClick={() => socketRef.current.emit('unpin_message', { room_id: roomId, username })}
      >
        ✕
      </button>
    )}
  </div>
)}
                    </Link>

                    {room.creator_username === username && (
                      <button
                        className="room-delete-btn"
                        title="Delete room"
                        onClick={(e) => handleDeleteRoom(e, room.id, room.name)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <svg
                  className="icon"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ margin: '0 auto 14px', display: 'block' }}
                >
                  <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" />
                </svg>
                <p>No rooms yet — start the first conversation.</p>
                <p className="empty-sub">Create a room on the left to get your classmates talking.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}