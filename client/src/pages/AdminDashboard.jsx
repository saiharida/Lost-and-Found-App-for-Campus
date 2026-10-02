import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('flagged'); // 'flagged' | 'all_reports' | 'overdue' | 'create' | 'users'

  // Data states
  const [flaggedReports, setFlaggedReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [overdueItems, setOverdueItems] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Broadcast Alert Form state
  const [alertSubject, setAlertSubject] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  // Admin Direct Post form state
  const [postForm, setPostForm] = useState({
    type: 'found',
    title: '',
    description: '',
    category: 'Other',
    location: '',
    contactInfo: '',
    imageUrl: '',
  });

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'flagged') {
        const res = await api.get('/admin/reports/flagged');
        setFlaggedReports(res.data);
      } else if (activeTab === 'all_reports') {
        const res = await api.get('/admin/reports');
        setAllReports(res.data);
      } else if (activeTab === 'overdue') {
        const res = await api.get('/admin/overdue-items');
        setOverdueItems(res.data);
      } else if (activeTab === 'users') {
        const res = await api.get('/admin/users');
        setUsersList(res.data);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load administrative data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'create') {
      fetchAdminData();
    }
  }, [activeTab]);

  // Remove report action
  const handleRemoveReport = async (itemId) => {
    if (!window.confirm('Are you sure you want to remove this report and penalize the poster?')) return;
    try {
      await api.delete(`/admin/reports/${itemId}`);
      setSuccess('Report removed and poster penalized successfully.');
      fetchAdminData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove report.');
    }
  };

  // User moderation action (suspend/unsuspend/strike)
  const handleUserAction = async (userId, action) => {
    const reason = prompt('Enter a reason for this moderation action (optional):');
    try {
      await api.put(`/admin/users/${userId}/flag`, { action, reason });
      setSuccess('User status updated successfully.');
      fetchAdminData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  // Broadcast Alert All
  const handleAlertAll = async (e) => {
    e.preventDefault();
    if (!alertSubject || !alertMessage) {
      setError('Please provide both a subject and message for the alert.');
      return;
    }
    setBroadcasting(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/admin/alert-all', { subject: alertSubject, message: alertMessage });
      setSuccess(res.data.message || 'Alert broadcasted successfully to campus domain.');
      setAlertSubject('');
      setAlertMessage('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to broadcast alert.');
    } finally {
      setBroadcasting(false);
    }
  };

  // Create admin post handler
  const handleCreateReportSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/admin/create-report', postForm);
      setSuccess('Report posted successfully on behalf of staff/library.');
      setPostForm({
        type: 'found',
        title: '',
        description: '',
        category: 'Other',
        location: '',
        contactInfo: '',
        imageUrl: '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post report.');
    }
  };

  return (
    <div className="board" style={{ paddingBottom: '60px' }}>
      {/* Header Plaque */}
      <div className="board__header">
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <p className="board__eyebrow">Campus Administration Panel</p>
              <h1 className="board__title" style={{ margin: 0 }}>Moderation & Command Center</h1>
              <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', opacity: 0.9 }}>
                Logged in as: <strong>{user?.email || 'Admin'}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              Logout
            </button>
          </div>

          {/* Admin Navigation Tabs */}
          <div className="board__tabs" style={{ flexWrap: 'wrap', marginTop: '20px' }}>
            <button
              type="button"
              className={`board__tab ${activeTab === 'flagged' ? 'board__tab--active' : ''}`}
              onClick={() => setActiveTab('flagged')}
            >
              ⚠️ Flagged Reports
            </button>
            <button
              type="button"
              className={`board__tab ${activeTab === 'all_reports' ? 'board__tab--active' : ''}`}
              onClick={() => setActiveTab('all_reports')}
            >
              📋 All Reports
            </button>
            <button
              type="button"
              className={`board__tab ${activeTab === 'overdue' ? 'board__tab--active' : ''}`}
              onClick={() => setActiveTab('overdue')}
            >
              ⏳ Overdue Items (&gt;3 Days)
            </button>
            <button
              type="button"
              className={`board__tab ${activeTab === 'users' ? 'board__tab--active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              👥 Campus Users
            </button>
            <button
              type="button"
              className={`board__tab ${activeTab === 'create' ? 'board__tab--active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              ➕ Admin Post Item
            </button>
          </div>
        </div>
      </div>

      <div className="board__body" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '20px', fontWeight: 500 }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '12px 16px', backgroundColor: '#dcfce7', color: '#065f46', borderRadius: '6px', marginBottom: '20px', fontWeight: 500 }}>
            ✓ {success}
          </div>
        )}

        {/* TAB 1: FLAGGED REPORTS */}
        {activeTab === 'flagged' && (
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Flagged Malicious or Fake Reports</h2>
            <p style={{ color: 'var(--board-muted)', marginBottom: '20px', fontSize: '14px' }}>
              Reports below have received flags from genuine users. If a report has 3 or more flags, it is recommended to remove it and penalize the user.
            </p>

            {loading ? (
              <p>Loading flagged reports...</p>
            ) : flaggedReports.length === 0 ? (
              <div className="board__empty"><p>No flagged items found. The bulletin is clean!</p></div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {flaggedReports.map((item) => (
                  <div key={item._id} className="card" style={{ borderLeft: '4px solid #dc2626', margin: 0, padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <span className="badge" style={{ background: '#ffeeee', color: '#dc2626', fontWeight: 700, marginBottom: '8px', display: 'inline-block' }}>
                          🚩 Flag Count: {item.flagCount || item.flags?.length || 0}
                        </span>
                        <h3 style={{ margin: '4px 0 8px', fontSize: '18px' }}>{item.title}</h3>
                        <p style={{ margin: '0 0 12px', color: '#4a453e', fontSize: '14px' }}>{item.description}</p>
                        <div style={{ fontSize: '13px', color: 'var(--board-muted)' }}>
                          <div>📍 Location: {item.location || 'Unspecified'}</div>
                          <div>👤 Reported By: <strong>{item.reportedBy?.name}</strong> ({item.reportedBy?.email}) - Role: {item.reportedBy?.role || 'student'}</div>
                          <div>⚠️ Poster Total Strikes: <strong style={{ color: '#dc2626' }}>{item.reportedBy?.strikeCount || 0}</strong></div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveReport(item._id)}
                          style={{ background: '#dc2626', color: '#fff', fontSize: '13px', padding: '8px 14px' }}
                        >
                          Remove Report & Penalize
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ALL REPORTS */}
        {activeTab === 'all_reports' && (
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>All Campus Bulletin Reports</h2>
            {loading ? (
              <p>Loading reports ledger...</p>
            ) : allReports.length === 0 ? (
              <div className="board__empty"><p>No reports logged in system.</p></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card-bg)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <thead>
                    <tr style={{ background: 'var(--board-panel)', textAlign: 'left', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                      <th style={{ padding: '12px' }}>Date</th>
                      <th style={{ padding: '12px' }}>Title</th>
                      <th style={{ padding: '12px' }}>Type / Category</th>
                      <th style={{ padding: '12px' }}>Location</th>
                      <th style={{ padding: '12px' }}>Reported User</th>
                      <th style={{ padding: '12px' }}>Flags</th>
                      <th style={{ padding: '12px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: '13.5px' }}>
                    {allReports.map((item) => (
                      <tr key={item._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px' }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{item.title}</td>
                        <td style={{ padding: '12px' }}>{item.type} / {item.category}</td>
                        <td style={{ padding: '12px' }}>{item.location || 'N/A'}</td>
                        <td style={{ padding: '12px' }}>
                          {item.reportedBy?.name || 'Unknown'}<br />
                          <span style={{ fontSize: '11.5px', color: 'var(--board-muted)' }}>{item.reportedBy?.email} ({item.reportedBy?.role})</span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700, color: item.flagCount > 0 ? '#dc2626' : 'inherit' }}>
                          {item.flagCount || 0}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveReport(item._id)}
                            style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '4px 8px', fontSize: '12px', boxShadow: 'none' }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: OVERDUE ITEMS & ALERT ALL */}
        {activeTab === 'overdue' && (
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Unreturned Items Overdue (&gt; 3 Days)</h2>
            <p style={{ color: 'var(--board-muted)', marginBottom: '24px', fontSize: '14px' }}>
              Found items listed below have not been handed over or claimed for more than 3 days. You can broadcast an alert to all college users below.
            </p>

            {loading ? (
              <p>Scanning overdue repository...</p>
            ) : overdueItems.length === 0 ? (
              <div className="board__empty" style={{ marginBottom: '30px' }}><p>No overdue items found older than 3 days.</p></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '40px' }}>
                {overdueItems.map((item) => (
                  <div key={item._id} className="card" style={{ margin: 0, padding: '16px', borderTop: '3px solid #d97706' }}>
                    <span className="badge" style={{ background: '#fef3c7', color: '#b45309', marginBottom: '6px' }}>Overdue &gt; 3 Days</span>
                    <h4 style={{ margin: '4px 0 8px', fontSize: '16px' }}>{item.title}</h4>
                    <p style={{ fontSize: '13px', color: 'var(--board-muted)', margin: '0 0 8px' }}>📍 {item.location}</p>
                    <p style={{ fontSize: '12.5px', margin: 0 }}>Found by: <strong>{item.reportedBy?.name}</strong> ({item.reportedBy?.email})</p>
                  </div>
                ))}
              </div>
            )}

            {/* Alert All Broadcast Section */}
            <div className="card" style={{ maxWidth: '700px', margin: '0 auto', background: 'var(--card-bg)' }}>
              <h3 style={{ fontSize: '18px', margin: '0 0 12px', color: '#b45309' }}>📢 Broadcast Campus-Wide Email Alert ("Alert All")</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--board-muted)', marginBottom: '16px' }}>
                Send an urgent email notification to all registered users in the college domain regarding unclaimed items or security notices.
              </p>
              <form onSubmit={handleAlertAll}>
                <div style={{ marginBottom: '14px' }}>
                  <label>Subject</label>
                  <input
                    type="text"
                    value={alertSubject}
                    onChange={(e) => setAlertSubject(e.target.value)}
                    placeholder="e.g. Urgent: Unclaimed Valuables at Library Desk"
                    required
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label>Message Body</label>
                  <textarea
                    rows={4}
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    placeholder="Provide details about the overdue items or campus advisory..."
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--board-panel)', color: 'var(--board-ink)', fontFamily: 'inherit' }}
                    required
                  />
                </div>
                <button type="submit" disabled={broadcasting} style={{ background: '#b45309', color: '#fff', width: '100%' }}>
                  {broadcasting ? 'Broadcasting Email to Campus...' : '🚀 Send Alert All Email'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: CAMPUS USERS & SUSPENSIONS */}
        {activeTab === 'users' && (
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Registered Campus Users & Disciplinary Control</h2>
            {loading ? (
              <p>Loading user directory...</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card-bg)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <thead>
                    <tr style={{ background: 'var(--board-panel)', textAlign: 'left', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                      <th style={{ padding: '12px' }}>Name</th>
                      <th style={{ padding: '12px' }}>Email / Designation</th>
                      <th style={{ padding: '12px' }}>Strikes / Flags</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: '13.5px' }}>
                    {usersList.map((u) => (
                      <tr key={u._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: '12px' }}>
                          {u.email}<br />
                          <span style={{ fontSize: '11.5px', color: 'var(--board-muted)' }}>Role: {u.role}</span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700, color: u.strikeCount > 0 ? '#dc2626' : 'inherit' }}>
                          {u.strikeCount || 0} strikes
                        </td>
                        <td style={{ padding: '12px' }}>
                          {u.isSuspended ? (
                            <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Suspended</span>
                          ) : (
                            <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>Active</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handleUserAction(u._id, 'add_strike')}
                            style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 8px', fontSize: '11.5px', boxShadow: 'none' }}
                          >
                            + Strike
                          </button>
                          {u.isSuspended ? (
                            <button
                              type="button"
                              onClick={() => handleUserAction(u._id, 'unsuspend')}
                              style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', padding: '4px 8px', fontSize: '11.5px', boxShadow: 'none' }}
                            >
                              Unsuspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUserAction(u._id, 'suspend')}
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '4px 8px', fontSize: '11.5px', boxShadow: 'none' }}
                            >
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ADMIN POST ITEM */}
        {activeTab === 'create' && (
          <div className="card" style={{ maxWidth: '700px', margin: '0 auto', background: 'var(--card-bg)' }}>
            <h2 style={{ fontSize: '20px', margin: '0 0 16px' }}>Post Lost/Found Report on Behalf of Staff (Library/Cleaning Desk)</h2>
            <form onSubmit={handleCreateReportSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label>Notice Type</label>
                <select
                  value={postForm.type}
                  onChange={(e) => setPostForm({ ...postForm, type: e.target.value })}
                  required
                >
                  <option value="found">Found Item</option>
                  <option value="lost">Lost Item</option>
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Item Title</label>
                <input
                  type="text"
                  value={postForm.title}
                  onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                  placeholder="e.g. Black Calculator handed over at Library"
                  required
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Category</label>
                <select
                  value={postForm.category}
                  onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}
                >
                  <option value="Electronics">Electronics</option>
                  <option value="ID Card">ID Card</option>
                  <option value="Wallet">Wallet</option>
                  <option value="Jewellery">Jewellery</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Location Found/Lost</label>
                <input
                  type="text"
                  value={postForm.location}
                  onChange={(e) => setPostForm({ ...postForm, location: e.target.value })}
                  placeholder="e.g. Central Library Counter"
                  required
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Contact Info / Desk Extension</label>
                <input
                  type="text"
                  value={postForm.contactInfo}
                  onChange={(e) => setPostForm({ ...postForm, contactInfo: e.target.value })}
                  placeholder="e.g. library-desk@college.edu"
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Image URL (Optional)</label>
                <input
                  type="url"
                  value={postForm.imageUrl}
                  onChange={(e) => setPostForm({ ...postForm, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label>Description</label>
                <textarea
                  rows={4}
                  value={postForm.description}
                  onChange={(e) => setPostForm({ ...postForm, description: e.target.value })}
                  placeholder="Provide precise details of the item..."
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--board-panel)', color: 'var(--board-ink)', fontFamily: 'inherit' }}
                  required
                />
              </div>
              <button type="submit" style={{ width: '100%', background: 'var(--board-found)' }}>
                Publish Admin Notice
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}