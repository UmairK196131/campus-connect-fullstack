'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { apiGet, apiPost } from '../../../lib/api';
import { colorForName } from '../../../lib/colors';

const SUPPORTED_EMOJIS = ['👍', '❤️', '😂'];
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

function emptyReactions() {
  const result = {};
  SUPPORTED_EMOJIS.forEach((emoji) => {
    result[emoji] = { count: 0, mine: false };
  });
  return result;
}

function normalizeReactions(rawByEmoji, currentUsername) {
  const result = {};
  SUPPORTED_EMOJIS.forEach((emoji) => {
    const users = rawByEmoji[emoji] || [];
    result[emoji] = { count: users.length, mine: users.includes(currentUsername) };
  });
  return result;
}

export default function RoomPage({ params }) {
  const { id: roomId } = params;
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [activeCount, setActiveCount] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const socketRef = useRef(null);
  const messagesRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const usernameRef = useRef('');

  // Keep a ref mirror of `username` so socket callbacks created once inside the
  // join effect below (which only depends on roomId) always see the latest
  // value instead of the stale '' they'd otherwise capture at mount time.
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  // ─── Load room + history, then connect the socket ───────────────────────────
  useEffect(() => {
    let socket;

    apiGet(`/rooms/${roomId}`)
      .then((data) => {
        setUsername(data.username);
        setRoom(data.room);
        setMessages(data.history.map((m) => ({ ...m, is_system: false })));
        setLoading(false);

        socket = io(SOCKET_URL, { withCredentials: true });
        socketRef.current = socket;

        socket.emit('join', { room_id: roomId, username: data.username });

        socket.on('message', (msg) => {
          if (!msg.is_system) {
            setTypingUsers((prev) => prev.filter((u) => u !== msg.username));
          }
          setMessages((prev) => [
            ...prev,
            msg.is_system ? msg : { ...msg, reactions: msg.reactions || emptyReactions() },
          ]);
        });

        socket.on('user_typing', (data) => {
          setTypingUsers((prev) => (prev.includes(data.username) ? prev : [...prev, data.username]));
        });

        socket.on('user_stopped_typing', (data) => {
          setTypingUsers((prev) => prev.filter((u) => u !== data.username));
        });

        socket.on('active_users', (data) => {
          setActiveCount(data.count);
        });

        socket.on('reaction_update', (data) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.message_id
                ? { ...m, reactions: normalizeReactions(data.reactions, usernameRef.current) }
                : m
            )
          );
        });
      })
      .catch(() => router.replace('/login'));

    return () => {
      if (socket) {
        socket.emit('leave', { room_id: roomId, username: usernameRef.current });
        socket.emit('stop_typing', { room_id: roomId, username: usernameRef.current });
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ─── Always scroll to the latest message ─────────────────────────────────────
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── Typing detection ─────────────────────────────────────────────────────────
  function handleInputChange(e) {
    setInputText(e.target.value);

    if (!socketRef.current) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit('typing', { room_id: roomId, username });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socketRef.current.emit('stop_typing', { room_id: roomId, username });
    }, 1500);
  }

  function sendMessage(e) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.emit('send_message', {
      room_id: roomId,
      username,
      text,
      reply_to_id: replyingTo ? replyingTo.id : null,
    });

    setInputText('');
    setReplyingTo(null);

    clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    socketRef.current.emit('stop_typing', { room_id: roomId, username });
  }

  function handleReact(messageId, emoji) {
    if (!socketRef.current) return;
    socketRef.current.emit('react', { room_id: roomId, message_id: messageId, username, emoji });
  }

  function handleReply(msg) {
    setReplyingTo({ id: msg.id, username: msg.username, text: msg.text });
  }

  function jumpToMessage(targetId) {
    const el = document.querySelector(`[data-msg-id="${targetId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 1200);
  }

  async function handleLogout() {
    await apiPost('/logout', {});
    router.push('/login');
  }

  function typingLabel() {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
    return 'Several people are typing';
  }

  if (loading || !room) return null;

  return (
    <div className="room-page">
      <nav className="navbar">
        <div className="nav-brand">
          <Link href="/home" className="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Link>
          <span className="nav-room-name">{room.name}</span>
        </div>
        <div className="nav-right">
          <span className="nav-user">
            <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="label-text">{username}</span>
          </span>
          <button onClick={handleLogout} className="btn btn-outline btn-sm">
            <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Log out
          </button>
        </div>
      </nav>

      <div className="chat-container">
        <div className="room-info-bar">
          <span className="room-title-bar">{room.name}</span>
          {room.description && <span className="room-desc-bar">{room.description}</span>}
          <span className="active-count">
            <span className="pulse-dot"></span>
            <span>{activeCount === null ? '— online' : `${activeCount} online`}</span>
          </span>
        </div>

        <div className="messages-area" ref={messagesRef}>
          <div className="chat-welcome">
            <p>Welcome to <strong>{room.name}</strong>! Say hello 👋</p>
          </div>

          {messages.map((msg, i) =>
            msg.is_system ? (
              <div className="message system" key={`sys-${i}`}>
                <div className="msg-bubble">{msg.text}</div>
              </div>
            ) : (
              <div
                key={msg.id}
                className={`message ${msg.username === username ? 'mine' : 'theirs'}`}
                data-msg-id={msg.id}
              >
                {msg.username !== username && (
                  <div className="avatar" style={{ background: colorForName(msg.username) }}>
                    {msg.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="message-content">
                  <div className="msg-header">
                    <span className="msg-username">{msg.username === username ? 'You' : msg.username}</span>
                    <span className="msg-time">{msg.time}</span>
                  </div>

                  {msg.reply_to && (
                    <div className="reply-quote" onClick={() => jumpToMessage(msg.reply_to.id)}>
                      <span className="reply-quote-user">{msg.reply_to.username}</span>
                      <span className="reply-quote-text">{msg.reply_to.text}</span>
                    </div>
                  )}

                  <div className="msg-bubble">{msg.text}</div>

                  <div className="reaction-bar">
                    {SUPPORTED_EMOJIS.map((emoji) => {
                      const r = msg.reactions ? msg.reactions[emoji] : { count: 0, mine: false };
                      return (
                        <button
                          key={emoji}
                          className={`react-btn${r.mine ? ' active' : ''}`}
                          onClick={() => handleReact(msg.id, emoji)}
                        >
                          {emoji}{r.count > 0 ? ` ${r.count}` : ''}
                        </button>
                      );
                    })}
                    <button className="reply-btn" title="Reply" onClick={() => handleReply(msg)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 14 4 9l5-5M4 9h10a5 5 0 0 1 5 5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        <div className={`typing-indicator${typingUsers.length > 0 ? ' active' : ''}`}>
          <span>{typingLabel()}</span>
          <span className="typing-dots"><i></i><i></i><i></i></span>
        </div>

        {replyingTo && (
          <div className="reply-banner">
            <div className="reply-banner-content">
              <span className="reply-banner-label">
                Replying to <strong>{replyingTo.username}</strong>
              </span>
              <span className="reply-banner-text">
                {replyingTo.text.length > 60 ? replyingTo.text.slice(0, 57) + '...' : replyingTo.text}
              </span>
            </div>
            <button className="reply-banner-cancel" onClick={() => setReplyingTo(null)} type="button">
              ✕
            </button>
          </div>
        )}

        <form className="chat-input-area" onSubmit={sendMessage}>
          <input
            type="text"
            className="message-input"
            placeholder="Type your message and press Enter…"
            autoComplete="off"
            maxLength={500}
            value={inputText}
            onChange={handleInputChange}
          />
          <button type="submit" className="btn btn-send">
            <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 11l18-8-8 18-2.5-7.5L3 11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span className="btn-label">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
