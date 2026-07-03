'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { apiGet, apiPost } from '../../../lib/api';
import { colorForName } from '../../../lib/colors';
import { useTheme } from '../../../lib/theme';

const SUPPORTED_EMOJIS = ['👍', '❤️', '😂'];
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';


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
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [activeCount, setActiveCount] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null); // { id, text }
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [pinnedMsg, setPinnedMsg] = useState(null);

  const socketRef = useRef(null);
  const messagesRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const usernameRef = useRef('');

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  // Track active usernames for @mention suggestions
  const activeUsersRef = useRef(new Set());

  useEffect(() => {
    let socket;

    apiGet(`/rooms/${roomId}`)
      .then((data) => {
        setUsername(data.username);
        usernameRef.current = data.username;
        setRoom(data.room);
        setMessages(data.history.map((m) => ({ ...m, is_system: false })));
        setLoading(false);

        socket = io(SOCKET_URL, { withCredentials: true });
        socketRef.current = socket;

        socket.emit('join', { room_id: roomId, username: data.username });

        socket.on('message', (msg) => {
          if (!msg.is_system) {
            setTypingUsers((prev) => prev.filter((u) => u !== msg.username));
            if (msg.username !== data.username) {
              activeUsersRef.current.add(msg.username);
            }
          }
          setMessages((prev) => [
            ...prev,
            msg.is_system ? msg : { ...msg, reactions: msg.reactions || emptyReactions() },
          ]);
        });

        socket.on('user_typing', (d) => {
          setTypingUsers((prev) => (prev.includes(d.username) ? prev : [...prev, d.username]));
        });

        // Load existing pinned message
apiGet(`/rooms/${roomId}/pinned`).then((d) => {
  if (d.pinned) setPinnedMsg(d.pinned);
});

socket.on('message_pinned', (d) => {
  setPinnedMsg({ text: d.text, username: d.username });
});

socket.on('message_unpinned', () => {
  setPinnedMsg(null);
});

        socket.on('user_stopped_typing', (d) => {
          setTypingUsers((prev) => prev.filter((u) => u !== d.username));
        });

        socket.on('active_users', (d) => setActiveCount(d.count));

        socket.on('reaction_update', (d) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === d.message_id
                ? { ...m, reactions: normalizeReactions(d.reactions, usernameRef.current) }
                : m
            )
          );
        });

        socket.on('message_edited', (d) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === d.message_id ? { ...m, text: d.text, edited: true } : m
            )
          );
        });

        socket.on('message_deleted', (d) => {
          setMessages((prev) => prev.filter((m) => m.id !== d.message_id));
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
  }, [roomId]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  function handleInputChange(e) {
    const val = e.target.value;
    setInputText(val);

    // @mention detection
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1) {
      const query = val.slice(atIndex + 1).toLowerCase();
      const suggestions = Array.from(activeUsersRef.current).filter(
        (u) => u !== usernameRef.current && u.toLowerCase().startsWith(query)
      );
      setMentionSuggestions(suggestions);
    } else {
      setMentionSuggestions([]);
    }

    if (!socketRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit('typing', { room_id: roomId, username: usernameRef.current });
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socketRef.current.emit('stop_typing', { room_id: roomId, username: usernameRef.current });
    }, 1500);
  }

  function selectMention(user) {
    const atIndex = inputText.lastIndexOf('@');
    setInputText(inputText.slice(0, atIndex) + `@${user} `);
    setMentionSuggestions([]);
  }

  function sendMessage(e) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !socketRef.current) return;

    if (editingMsg) {
      socketRef.current.emit('edit_message', {
        room_id: roomId,
        message_id: editingMsg.id,
        username: usernameRef.current,
        text,
      });
      setEditingMsg(null);
    } else {
      socketRef.current.emit('send_message', {
        room_id: roomId,
        username: usernameRef.current,
        text,
        reply_to_id: replyingTo ? replyingTo.id : null,
      });
      setReplyingTo(null);
    }

    setInputText('');
    setMentionSuggestions([]);
    clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    socketRef.current.emit('stop_typing', { room_id: roomId, username: usernameRef.current });
  }

  function startEdit(msg) {
    setEditingMsg({ id: msg.id, originalText: msg.text });
    setInputText(msg.text);
    setReplyingTo(null);
  }

  function cancelEdit() {
    setEditingMsg(null);
    setInputText('');
  }

  function deleteMessage(msg) {
    if (!window.confirm('Delete this message?')) return;
    if (!socketRef.current) return;
    socketRef.current.emit('delete_message', {
      room_id: roomId,
      message_id: msg.id,
      username: usernameRef.current,
    });
  }

  function handleReact(messageId, emoji) {
    if (!socketRef.current) return;
    socketRef.current.emit('react', { room_id: roomId, message_id: messageId, username: usernameRef.current, emoji });
  }

  function handleReply(msg) {
    setReplyingTo({ id: msg.id, username: msg.username, text: msg.text });
    setEditingMsg(null);
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

  // Render message text with highlighted @mentions
  function renderText(text) {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="mention">{part}</span>
      ) : (
        part
      )
    );
  }

  if (loading || !room) return null;

  return (
    <div className="room-page">
      <nav className="navbar">
        <div className="nav-brand">
          <Link href="/home" className="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Link>
          <span className="nav-room-name">{room.name}</span>
        </div>
        <div className="nav-right">
          <span className="nav-user">
            <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="label-text">{username}</span>
          </span>
          <button onClick={handleLogout} className="btn btn-outline btn-sm">
            <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <button onClick={toggleTheme} className="btn btn-outline btn-sm" title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
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
                    {msg.edited && <span className="msg-edited">(edited)</span>}
                  </div>

                  {msg.reply_to && (
                    <div className="reply-quote" onClick={() => jumpToMessage(msg.reply_to.id)}>
                      <span className="reply-quote-user">{msg.reply_to.username}</span>
                      <span className="reply-quote-text">{msg.reply_to.text}</span>
                    </div>
                  )}

                  <div className="msg-bubble">{renderText(msg.text)}</div>

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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M9 14 4 9l5-5M4 9h10a5 5 0 0 1 5 5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {msg.username === username && (
                      <>
                        <button className="edit-btn" title="Edit" onClick={() => startEdit(msg)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button className="delete-btn" title="Delete" onClick={() => deleteMessage(msg)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {room.creator_username === username && (
  <button
    className={`pin-btn${msg.is_pinned ? ' pinned' : ''}`}
    title={msg.is_pinned ? 'Unpin' : 'Pin message'}
    onClick={() => {
      if (msg.is_pinned) {
        socketRef.current.emit('unpin_message', { room_id: roomId, username });
      } else {
        socketRef.current.emit('pin_message', { room_id: roomId, message_id: msg.id, username });
      }
    }}
  >
    📌
  </button>
)}
                      </>
                    )}
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
              <span className="reply-banner-label">Replying to <strong>{replyingTo.username}</strong></span>
              <span className="reply-banner-text">
                {replyingTo.text.length > 60 ? replyingTo.text.slice(0, 57) + '...' : replyingTo.text}
              </span>
            </div>
            <button className="reply-banner-cancel" onClick={() => setReplyingTo(null)}>✕</button>
          </div>
        )}

        {editingMsg && (
          <div className="reply-banner">
            <div className="reply-banner-content">
              <span className="reply-banner-label">✏️ Editing message</span>
              <span className="reply-banner-text">{editingMsg.originalText}</span>
            </div>
            <button className="reply-banner-cancel" onClick={cancelEdit}>✕</button>
          </div>
        )}

        {/* @mention suggestions */}
        {mentionSuggestions.length > 0 && (
          <div className="mention-suggestions">
            {mentionSuggestions.map((user) => (
              <button key={user} className="mention-suggestion-item" onClick={() => selectMention(user)}>
                <div className="avatar-sm" style={{ background: colorForName(user) }}>
                  {user.charAt(0).toUpperCase()}
                </div>
                @{user}
              </button>
            ))}
          </div>
        )}

        <form className="chat-input-area" onSubmit={sendMessage}>
          <input
            type="text"
            className="message-input"
            placeholder={editingMsg ? 'Edit your message…' : 'Type your message… (use @ to mention someone)'}
            autoComplete="off"
            maxLength={500}
            value={inputText}
            onChange={handleInputChange}
          />
          <button type="submit" className="btn btn-send">
            <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 11l18-8-8 18-2.5-7.5L3 11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span className="btn-label">{editingMsg ? 'Save' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}