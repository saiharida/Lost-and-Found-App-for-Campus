import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const initialFilters = {
  type: 'all',
  category: 'all',
  location: '',
  date: '',
  search: '',
};

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(initialFilters);
  const [errorMessage, setErrorMessage] = useState('');

  // Modal & Claim & Flag states
  const [selectedItem, setSelectedItem] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState('');

  const [flagging, setFlagging] = useState(false);
  const [flagError, setFlagError] = useState('');
  const [flagSuccess, setFlagSuccess] = useState('');

  // Logged-in user comes from AuthContext (persisted under `lf_user`)
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id || null;

  const fetchItems = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const params = new URLSearchParams();
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.location.trim()) params.append('location', filters.location.trim());
      if (filters.date) params.append('date', filters.date);
      if (filters.search.trim()) params.append('search', filters.search.trim());

      const res = await api.get(`/items?${params.toString()}`);

      // Ensure state is always an array
      if (Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load notices from server.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleTypeTab = (typeValue) => {
    setFilters((prev) => ({ ...prev, type: typeValue }));
  };

  const handleClearFilters = () => setFilters(initialFilters);

  const openItemDetails = (item) => {
    setSelectedItem(item);
    setClaimError('');
    setClaimSuccess('');
    setFlagError('');
    setFlagSuccess('');
  };

  const closeItemDetails = () => {
    setSelectedItem(null);
    setClaimError('');
    setClaimSuccess('');
    setFlagError('');
    setFlagSuccess('');
  };

  const handleClaim = async () => {
    if (!selectedItem) return;

    setClaiming(true);
    setClaimError('');
    setClaimSuccess('');

    try {
      const res = await api.post(`/items/${selectedItem._id}/claim`);
      setClaimSuccess('Claim request sent! The founder will verify ownership before handing the item over.');
      setSelectedItem(res.data);
      setItems((prev) => prev.map((it) => (it._id === res.data._id ? res.data : it)));
    } catch (err) {
      setClaimError(err.response?.data?.message || 'Failed to submit claim.');
    } finally {
      setClaiming(false);
    }
  };

  const handleFlagReport = async () => {
    if (!selectedItem) return;
    if (!window.confirm('Are you sure you want to flag this report as fake, malicious, or inappropriate?')) {
      return;
    }

    setFlagging(true);
    setFlagError('');
    setFlagSuccess('');

    try {
      // Calls admin router endpoint for flagging item reports
      const res = await api.post(`/admin/items/${selectedItem._id}/flag`);
      setFlagSuccess('Report flagged successfully. Thank you for keeping the campus bulletin clean.');
      
      // Update item flag count locally in state
      const updatedItem = {
        ...selectedItem,
        flagCount: res.data.flagCount || (selectedItem.flagCount || 0) + 1,
      };
      setSelectedItem(updatedItem);
      setItems((prev) => prev.map((it) => (it._id === updatedItem._id ? updatedItem : it)));
    } catch (err) {
      setFlagError(err.response?.data?.message || 'Failed to flag report.');
    } finally {
      setFlagging(false);
    }
  };

  const isOwner =
    selectedItem &&
    currentUserId &&
    (selectedItem.reportedBy?._id === currentUserId ||
      selectedItem.reportedBy === currentUserId ||
      selectedItem.reportedBy?._id?.toString() === currentUserId?.toString());

  const userClaim = selectedItem?.claims?.find((c) => {
    const cId = c?.claimant?._id || c?.claimant;
    return cId?.toString() === currentUserId?.toString() && c.status !== 'rejected';
  });
  const hasUserClaimed = Boolean(userClaim);

  const isHandedOver =
    selectedItem && (selectedItem.status === 'handed_over' || selectedItem.status === 'closed');

  return (
    <div className="board">
      {/* Header Plaque */}
      <div className="board__header">
        <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 24px' }}>
          <p className="board__eyebrow">Campus Bulletin</p>
          <h1 className="board__title">LoKey Board</h1>

          {/* Quick Filter Tabs */}
          <div className="board__tabs">
            <button
              type="button"
              className={`board__tab ${filters.type === 'all' ? 'board__tab--active' : ''}`}
              onClick={() => handleTypeTab('all')}
            >
              All Items
            </button>
            <button
              type="button"
              className={`board__tab ${filters.type === 'lost' ? 'board__tab--active board__tab--lost' : ''}`}
              onClick={() => handleTypeTab('lost')}
            >
              Lost Items
            </button>
            <button
              type="button"
              className={`board__tab ${filters.type === 'found' ? 'board__tab--active board__tab--found' : ''}`}
              onClick={() => handleTypeTab('found')}
            >
              Found Items
            </button>
          </div>
        </div>
      </div>

      <div className="board__body">
        {/* Error notification if backend query fails */}
        {errorMessage && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '13.5px',
              fontWeight: 500,
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Filter Shelf */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '16px 20px',
            marginBottom: '32px',
            boxShadow: '0 4px 12px -6px rgba(35, 50, 74, 0.2)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '14px',
            alignItems: 'end',
          }}
        >
          <div>
            <label>Category</label>
            <select name="category" value={filters.category} onChange={handleFilterChange}>
              <option value="all">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="ID Card">ID Card</option>
              <option value="Wallet">Wallet</option>
              <option value="Jewellery">Jewellery</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label>Location</label>
            <input
              type="text"
              name="location"
              value={filters.location}
              onChange={handleFilterChange}
              placeholder="e.g. Library"
            />
          </div>

          <div>
            <label>Date</label>
            <input
              type="date"
              name="date"
              value={filters.date}
              onChange={handleFilterChange}
            />
          </div>

          <div>
            <label>Search</label>
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="e.g. Backpack, charger"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                width: '100%',
                background: 'var(--board-panel)',
                color: 'var(--board-ink)',
                border: '1px solid var(--border-color)',
                boxShadow: 'none',
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Board Cards Grid */}
        {loading ? (
          <p className="board__status">Inspecting notice board...</p>
        ) : !Array.isArray(items) || items.length === 0 ? (
          <div className="board__empty">
            <p style={{ margin: 0, fontWeight: 600 }}>No reports posted for this filter query.</p>
          </div>
        ) : (
          <div className="board__grid">
            {items.map((item) => {
              if (!item) return null;
              const isFound = item.type === 'found';
              const isItemHandedOver = item.status === 'handed_over' || item.status === 'closed';

              return (
                <div
                  key={item._id}
                  className={`board-card ${isFound ? 'board-card--found' : ''}`}
                  onClick={() => openItemDetails(item)}
                  style={{ cursor: 'pointer', opacity: isItemHandedOver ? 0.75 : 1 }}
                >
                  <div className="board-card__pin" />

                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="board-card__image"
                    />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="board-card__type">{item.type}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {isItemHandedOver ? (
                        <span className="badge" style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                          Handed Over
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'var(--board-panel)', color: 'var(--board-ink)' }}>
                          Active
                        </span>
                      )}
                      <span className={`badge ${isFound ? 'found' : 'lost'}`}>
                        {item.category}
                      </span>
                    </div>
                  </div>

                  <h3 className="board-card__title">{item.title}</h3>

                  <p className="board-card__desc">
                    {item.description || 'No detailed note left.'}
                  </p>

                  <div className="board-card__meta">
                    <div>📍 {item.location || 'Location unspecified'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span>
                        {item.dateOccurred
                          ? new Date(item.dateOccurred).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                          : 'Recent'}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--board-ink)' }}>
                        Read Note ↗
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div
          onClick={closeItemDetails}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(35, 50, 74, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              maxWidth: '640px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderTop: `4px solid ${selectedItem.type === 'found' ? 'var(--board-found)' : 'var(--board-lost)'}`,
              margin: 0,
            }}
          >
            <div
              className="board-card__pin"
              style={{
                top: '-9px',
                width: '16px',
                height: '16px',
                background: selectedItem.type === 'found' ? 'var(--board-found)' : 'var(--board-pin)',
              }}
            />

            <button
              type="button"
              onClick={closeItemDetails}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'var(--board-panel)',
                color: 'var(--board-ink)',
                border: '1px solid var(--border-color)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                boxShadow: 'none',
              }}
            >
              ✕
            </button>

            {/* Badges & Flag option button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className={`badge ${selectedItem.type === 'found' ? 'found' : 'lost'}`}>
                  {selectedItem.type}
                </span>
                <span className="badge" style={{ background: 'var(--board-panel)', color: 'var(--board-ink)' }}>
                  {selectedItem.category}
                </span>
                <span
                  className="badge"
                  style={{
                    background: isHandedOver ? '#d1fae5' : '#fdfbf6',
                    color: isHandedOver ? '#065f46' : 'var(--board-muted)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  ● {isHandedOver ? 'HANDED OVER' : 'ACTIVE'}
                </span>
              </div>

              {!isOwner && (
                <button
                  type="button"
                  onClick={handleFlagReport}
                  disabled={flagging}
                  style={{
                    background: '#fef2f2',
                    color: '#991b1b',
                    border: '1px solid #fecaca',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    boxShadow: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {flagging ? 'Flagging...' : `🚩 Flag Report (${selectedItem.flagCount || 0})`}
                </button>
              )}
            </div>

            <h2 style={{ fontSize: '24px', margin: '0 0 16px', color: 'var(--board-ink)' }}>
              {selectedItem.title}
            </h2>

            {selectedItem.imageUrl && (
              <div
                style={{
                  width: '100%',
                  maxHeight: '380px',
                  backgroundColor: '#000',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.title}
                  style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block' }}
                />
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                padding: '14px',
                backgroundColor: 'var(--board-panel)',
                borderRadius: '4px',
                marginBottom: '18px',
              }}
            >
              <div>
                <label style={{ margin: 0, fontSize: '11px' }}>Location</label>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{selectedItem.location || 'Unspecified'}</span>
              </div>
              <div>
                <label style={{ margin: 0, fontSize: '11px' }}>Date</label>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>
                  {selectedItem.dateOccurred
                    ? new Date(selectedItem.dateOccurred).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Unspecified'}
                </span>
              </div>
              <div>
                <label style={{ margin: 0, fontSize: '11px' }}>Reported By</label>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{selectedItem.reportedBy?.name || 'Campus Member'}</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label>Description</label>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: '#3a3630', whiteSpace: 'pre-wrap' }}>
                {selectedItem.description || 'No detailed description provided.'}
              </p>
            </div>

            {claimSuccess && (
              <div style={{ padding: '10px 14px', background: '#dcfce7', color: 'var(--board-found)', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                ✓ {claimSuccess}
              </div>
            )}
            {claimError && <p className="error">{claimError}</p>}

            {flagSuccess && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                ⚠️ {flagSuccess}
              </div>
            )}
            {flagError && <p className="error">{flagError}</p>}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
              {isHandedOver ? (
                <span className="item-meta" style={{ fontWeight: 600, color: 'var(--board-found)' }}>
                  ✓ Handover completed. This notice is resolved.
                </span>
              ) : isOwner ? (
                <span className="item-meta">You posted this notice.</span>
              ) : selectedItem.type === 'lost' ? (
                <div style={{ fontSize: '13px', color: 'var(--board-muted)' }}>
                  Found this item? Contact the owner at:{' '}
                  <a
                    href={`mailto:${selectedItem.contactInfo || selectedItem.reportedBy?.email || ''}`}
                    style={{ color: 'var(--board-found)', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    {selectedItem.contactInfo || selectedItem.reportedBy?.email || 'Provided Contact'}
                  </a>
                </div>
              ) : hasUserClaimed ? (
                <span className="item-meta" style={{ fontWeight: 600, color: '#b45309' }}>
                  ✓ You have submitted a claim. The founder will review it.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  style={{ background: 'var(--board-found)' }}
                >
                  {claiming ? 'Submitting Claim...' : 'Claim This Found Item'}
                </button>
              )}

              <button
                type="button"
                onClick={closeItemDetails}
                style={{ background: 'var(--board-panel)', color: 'var(--board-ink)', boxShadow: 'none' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}