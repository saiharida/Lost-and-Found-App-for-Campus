import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setLoading(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif._id);
    }
    setIsOpen(false);

    // Admin/account notices have no linked activity to open
    if (notif.type === 'system_alert') return;

    // Route claimant notifications to 'claims' and founder notifications to 'reports'
    const isForClaimant =
      notif.message.includes('asked a verification question') ||
      notif.message.includes('New message from founder') ||
      notif.message.includes('Handover confirmed') ||
      notif.message.includes('rejected');

    navigate('/profile', {
      state: { defaultTab: isForClaimant ? 'claims' : 'reports' },
    });
  };

  const getNotificationBadge = (n) => {
    if (n.type === 'potential_match') {
      return { icon: '🔍', title: 'Match Alert', color: '#1d4ed8' };
    }
    if (n.type === 'system_alert') {
      return { icon: '🚩', title: 'Account Notice', color: '#b91c1c' };
    }
    if (n.message.includes('Handover confirmed') || n.message.includes('handed over to you')) {
      return { icon: '✅', title: 'Handover Complete', color: 'var(--board-found)' };
    }
    if (n.message.includes('rejected')) {
      return { icon: '⚠️', title: 'Claim Rejected', color: 'var(--board-lost)' };
    }
    if (n.message.includes('asked a verification question') || n.message.includes('New message from founder')) {
      return { icon: '❓', title: 'Verification Message', color: '#0284c7' };
    }
    if (n.message.includes('answered your verification question')) {
      return { icon: '💬', title: 'Claimant Reply', color: 'var(--board-found)' };
    }
    return { icon: '📦', title: 'New Claim Request', color: '#b45309' };
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          color: '#ffffff',
          fontSize: '1.25rem',
          boxShadow: 'none',
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              background: 'var(--board-lost)',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: '700',
              padding: '2px 5px',
              borderRadius: '999px',
              minWidth: '14px',
              textAlign: 'center',
              lineHeight: 1,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '330px',
            maxHeight: '420px',
            backgroundColor: 'var(--card-bg)',
            borderRadius: '6px',
            boxShadow: '0 12px 28px -4px rgba(35, 50, 74, 0.35)',
            border: '1px solid var(--border-color)',
            borderTop: '3px solid var(--board-ink)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--board-panel)',
            }}
          >
            <span
              style={{
                fontWeight: '700',
                fontSize: '13px',
                color: 'var(--board-ink)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              Notice Alerts
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--board-ink)',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  boxShadow: 'none',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--board-muted)', fontSize: '13px' }}>
                No active notices on your board.
              </div>
            ) : (
              notifications.map((n) => {
                const badge = getNotificationBadge(n);

                return (
                  <div
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      backgroundColor: n.isRead ? 'transparent' : 'rgba(255, 255, 255, 0.9)',
                      borderLeft: !n.isRead ? `3px solid ${badge.color}` : '3px solid transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px' }}>{badge.icon}</span>
                      <strong style={{ fontSize: '12px', color: badge.color, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {badge.title}
                      </strong>
                      {!n.isRead && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: badge.color,
                            marginLeft: 'auto',
                          }}
                        />
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--board-ink)', lineHeight: 1.4 }}>
                      {n.message}
                    </p>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--board-muted)',
                        marginTop: '5px',
                        display: 'block',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}