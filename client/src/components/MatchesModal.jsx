import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function MatchesModal({ itemId, itemTitle, onClose }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/items/${itemId}/matches`);

        // Safely extract the array whether returned as an object or raw array
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.matches || res.data?.data || [];

        setMatches(list);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to search for potential matches.');
      } finally {
        setLoading(false);
      }
    };

    if (itemId) {
      fetchMatches();
    }
  }, [itemId]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(35, 50, 74, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 0,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '20px', margin: 0 }}>Matching Candidates</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--board-muted)' }}>
              Comparing your lost report: <strong>"{itemTitle}"</strong> against all active found items.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              boxShadow: 'none',
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="board__status">Scanning bulletin notices for matches...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : matches.length === 0 ? (
          <div className="board__empty" style={{ padding: '24px 16px' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>No strong matches right now.</p>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--board-muted)' }}>
              When someone reports a found item matching your report's category, location, and keywords, you will receive an automatic notification.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {matches.map((match) => (
              <div
                key={match._id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '14px',
                  background: '#ffffff',
                  display: 'flex',
                  gap: '14px',
                }}
              >
                {match.imageUrl && (
                  <img
                    src={match.imageUrl}
                    alt={match.title}
                    style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>{match.title}</h3>
                    <span
                      className="badge"
                      style={{
                        background: match.matchScore >= 70 ? '#dcfce7' : '#fef3c7',
                        color: match.matchScore >= 70 ? '#166534' : '#854d0e',
                        border: `1px solid ${match.matchScore >= 70 ? '#bbf7d0' : '#fef08a'}`,
                        fontWeight: 700,
                      }}
                    >
                      {match.matchScore}% Match
                    </span>
                  </div>

                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#4b5563', lineHeight: 1.4 }}>
                    {match.description || 'No description provided.'}
                  </p>

                  <div style={{ fontSize: '11.5px', color: 'var(--board-muted)', display: 'flex', gap: '12px' }}>
                    <span>📍 {match.location || 'Location unspecified'}</span>
                    <span>
                      📅{' '}
                      {match.dateOccurred
                        ? new Date(match.dateOccurred).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : 'Recent'}
                    </span>
                    <span>🏷️ {match.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}