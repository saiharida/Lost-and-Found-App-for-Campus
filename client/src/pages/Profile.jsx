import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import MatchesModal from '../components/MatchesModal';
import FlagUserModal from '../components/FlagUserModal';

// Helper to resolve image paths and force Cloudinary auto-format (fixes .heic display issues)
const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) {
    if (url.includes('res.cloudinary.com') && !url.includes('/f_auto,q_auto/')) {
      return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
    }
    return url;
  }
  return `http://localhost:5000${url}`;
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const location = useLocation();

  const [profile, setProfile] = useState({ name: '', email: '', role: 'student', phone: '' });
  const [myItems, setMyItems] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [activeTab, setActiveTab] = useState(location.state?.defaultTab || 'reports');
  const [loading, setLoading] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Persistent input states mapped by ID
  const [questionsInput, setQuestionsInput] = useState({});
  const [answersInput, setAnswersInput] = useState({});

  // Match Modal State
  const [checkingMatchesItem, setCheckingMatchesItem] = useState(null);

  // Flag User Modal State
  const [flagModalData, setFlagModalData] = useState(null);

  // Edit Item Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    category: 'Electronics',
    location: '',
    dateOccurred: '',
    contactInfo: '',
    description: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (location.state?.defaultTab) {
      setActiveTab(location.state.defaultTab);
    }
  }, [location.state]);

  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        name: prev.name || user.name || '',
        email: user.email || prev.email || '',
        role: user.role || prev.role || 'student',
        phone: prev.phone || user.phone || '',
      }));
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [profileRes, itemsRes, claimsRes] = await Promise.allSettled([
        api.get('/users/profile'),
        api.get('/items/mine'),
        api.get('/items/claims'),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value?.data) {
        setProfile(profileRes.value.data);
      }
      if (itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value?.data)) {
        setMyItems(itemsRes.value.data);
      }
      if (claimsRes.status === 'fulfilled' && Array.isArray(claimsRes.value?.data)) {
        setMyClaims(claimsRes.value.data);
      }
    } catch (err) {
      console.error('Error fetching profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileMsg('');
    try {
      const { data } = await api.put('/users/profile', {
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
      });
      setProfile(data);
      // updateUser merges into the logged-in user AND persists it, so a refresh keeps the new values
      updateUser({
        name: data.name,
        role: data.role,
        userType: data.userType,
        phone: data.phone,
        mobileNumber: data.mobileNumber,
      });
      setProfileMsg('Profile updated successfully!');
    } catch (err) {
      setProfileMsg(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (item) => {
    setEditingItem(item);
    setEditFormData({
      title: item.title || '',
      category: item.category || 'Electronics',
      location: item.location || '',
      dateOccurred: item.dateOccurred ? item.dateOccurred.split('T')[0] : '',
      contactInfo: item.contactInfo || '',
      description: item.description || '',
    });
    setEditError('');
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditError('');
  };

  // Save Item Updates
  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    setSavingEdit(true);
    setEditError('');
    try {
      const { data } = await api.put(`/items/${editingItem._id}`, editFormData);
      setMyItems((prev) => prev.map((it) => (it._id === editingItem._id ? data : it)));
      closeEditModal();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update report.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Reporter sends a question or follow-up meetup note
  const handleSendQuestion = async (itemId, claimantId) => {
    const questionText = questionsInput[claimantId]?.trim();
    if (!questionText) {
      alert('Please enter a message or question first.');
      return;
    }
    try {
      await api.post(`/items/${itemId}/ask-question`, { claimantId, question: questionText });
      await loadData();
      setQuestionsInput((prev) => ({ ...prev, [claimantId]: '' }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message.');
    }
  };

  // Claimant replies
  const handleSendAnswer = async (itemId) => {
    const answerText = answersInput[itemId]?.trim();
    if (!answerText) {
      alert('Please enter your response first.');
      return;
    }
    try {
      await api.post(`/items/${itemId}/answer-question`, { answer: answerText });
      await loadData();
      setAnswersInput((prev) => ({ ...prev, [itemId]: '' }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit response.');
    }
  };

  // Confirm handover and close item
  const handleHandoverToClaimant = async (itemId, claimantId, claimantName) => {
    if (
      !window.confirm(
        `Confirm handover to ${claimantName}? This will close the report and automatically notify other pending claimants.`
      )
    ) {
      return;
    }
    try {
      const { data } = await api.post(`/items/${itemId}/verify-claim`, { claimantId });
      setMyItems((prev) => prev.map((it) => (it._id === itemId ? data : it)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete handover.');
    }
  };

  // Reject claimant
  const handleRejectSingleClaimant = async (itemId, claimantId, claimantName) => {
    if (
      !window.confirm(
        `Reject claim from ${claimantName}? The item remains active on the board, and they will receive your contact info.`
      )
    ) {
      return;
    }
    try {
      const { data } = await api.post(`/items/${itemId}/reject-claim`, { claimantId });
      setMyItems((prev) => prev.map((it) => (it._id === itemId ? data : it)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject claimant.');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      await api.delete(`/items/${id}`);
      setMyItems((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete report.');
    }
  };

  return (
    <div className="container" style={{ maxWidth: '1040px' }}>
      <h1>My Account & Activity</h1>

      {/* Member Profile Form */}
      <div className="card">
        <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Member Profile</h2>

        {profileMsg && (
          <p
            className={profileMsg.includes('success') ? 'badge found' : 'error'}
            style={{ display: 'block', padding: '10px 14px', marginBottom: '16px', borderRadius: '6px' }}
          >
            {profileMsg}
          </p>
        )}

        <form
          onSubmit={handleProfileUpdate}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          <div>
            <label>Full Name</label>
            <input
              type="text"
              value={profile?.name || ''}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder={loading ? 'Loading...' : 'Your Name'}
              required
            />
          </div>

          <div>
            <label>Email Address</label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              style={{ background: 'var(--board-panel)', color: 'var(--board-muted)', cursor: 'not-allowed' }}
            />
          </div>

          <div>
            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="+91 9876543210"
              value={profile?.phone || ''}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>

          <div>
            <label>Member Type</label>
            {profile?.role === 'admin' ? (
              <input
                type="text"
                value="Administrator"
                disabled
                style={{ background: 'var(--board-panel)', color: 'var(--board-muted)', cursor: 'not-allowed' }}
              />
            ) : (
              <select
                value={['student', 'faculty', 'staff'].includes(profile?.role) ? profile.role : 'student'}
                onChange={(e) => setProfile({ ...profile, role: e.target.value })}
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="staff">Staff</option>
              </select>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={updatingProfile || loading}>
              {updatingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div className="board__tabs" style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className={`board__tab ${activeTab === 'reports' ? 'board__tab--active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          My Reports ({myItems.length})
        </button>
        <button
          type="button"
          className={`board__tab ${activeTab === 'claims' ? 'board__tab--active' : ''}`}
          onClick={() => setActiveTab('claims')}
        >
          My Claims ({myClaims.length})
        </button>
      </div>

      {loading ? (
        <p className="board__status">Loading your activity...</p>
      ) : (
        <>
          {/* TAB 1: User's Reported Items */}
          {activeTab === 'reports' && (
            <div>
              {myItems.length === 0 ? (
                <div className="board__empty">
                  <p style={{ margin: 0, fontWeight: 600 }}>You haven't reported any items yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                  {myItems.map((item) => {
                    const isFound = item.type === 'found';
                    const isHandedOver = item.status === 'handed_over' || item.status === 'closed';
                    const pendingClaims = (item.claims || []).filter((c) => c.status === 'pending');

                    return (
                      <div
                        key={item._id}
                        className="card"
                        style={{
                          margin: 0,
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          borderTop: `4px solid ${isFound ? 'var(--board-found)' : 'var(--board-lost)'}`,
                        }}
                      >
                        {item.imageUrl && (
                          <img
                            src={getImageUrl(item.imageUrl)}
                            alt={item.title}
                            style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '4px', marginBottom: '12px' }}
                          />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span className={`badge ${isFound ? 'found' : 'lost'}`}>{item.type}</span>
                            <span className="badge" style={{ background: 'var(--board-panel)', color: 'var(--board-ink)' }}>
                              {item.category}
                            </span>
                          </div>
                          <span
                            className="badge"
                            style={{
                              background: isHandedOver ? '#d1fae5' : 'var(--board-panel)',
                              color: isHandedOver ? '#065f46' : 'var(--board-ink)',
                              border: `1px solid ${isHandedOver ? '#a7f3d0' : 'var(--border-color)'}`,
                            }}
                          >
                            ● {isHandedOver ? 'HANDED OVER' : 'ACTIVE'}
                          </span>
                        </div>

                        <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: 'var(--board-ink)' }}>{item.title}</h3>
                        <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: '#3a3630', lineHeight: 1.45 }}>
                          {item.description || 'No description provided.'}
                        </p>

                        {/* Check Found Matches Button (Exclusively for Lost Items that are still Active) */}
                        {!isFound && !isHandedOver && (
                          <button
                            type="button"
                            onClick={() => setCheckingMatchesItem(item)}
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              padding: '8px 12px',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              marginBottom: '12px',
                              boxShadow: 'none',
                              borderRadius: '4px',
                            }}
                          >
                            🔍 Check Found Item Matches
                          </button>
                        )}

                        {isHandedOver && (
                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#166534', fontWeight: 600 }}>
                            ✓ Handover Complete & Report Closed
                          </div>
                        )}

                        {/* Pending Claims Section for Found Items */}
                        {!isHandedOver && isFound && pendingClaims.length > 0 && (
                          <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '6px', padding: '12px', marginBottom: '14px', fontSize: '12px' }}>
                            <div style={{ fontWeight: 700, color: '#854d0e', marginBottom: '8px' }}>
                              📬 {pendingClaims.length} Pending Claimant{pendingClaims.length > 1 ? 's' : ''}:
                            </div>

                            {pendingClaims.map((claim) => {
                              const claimantUser = claim.claimant;
                              const claimantName = claimantUser?.name || 'Student';
                              const claimantEmail = claimantUser?.email || 'No email';
                              const claimantId = claimantUser?._id || claimantUser;

                              return (
                                <div
                                  key={claim._id || claimantId}
                                  style={{
                                    borderTop: '1px dashed #fef08a',
                                    paddingTop: '10px',
                                    marginTop: '10px',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                    <div style={{ color: '#713f12' }}>
                                      <strong>{claimantName}</strong> ({claimantEmail})
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setFlagModalData({
                                          reportedUserId: claimantId,
                                          reportedUserName: claimantName,
                                          itemId: item._id,
                                        })
                                      }
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#b91c1c',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        padding: '2px 4px',
                                        boxShadow: 'none',
                                        textDecoration: 'underline',
                                      }}
                                    >
                                      🚩 Flag User
                                    </button>
                                  </div>

                                  {(claim.question || claim.answer) && (
                                    <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                                      {claim.question && (
                                        <div style={{ color: '#475569', fontSize: '11.5px', marginBottom: '4px' }}>
                                          <strong>Your Message / Question:</strong> {claim.question}
                                        </div>
                                      )}
                                      {claim.answer ? (
                                        <div style={{ color: '#166534', fontSize: '11.5px', fontWeight: 600 }}>
                                          <strong>Claimant Reply:</strong> {claim.answer}
                                        </div>
                                      ) : (
                                        <div style={{ color: '#b45309', fontSize: '11px', fontStyle: 'italic' }}>
                                          Awaiting claimant's reply...
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div style={{ marginBottom: '8px' }}>
                                    <input
                                      type="text"
                                      placeholder={
                                        claim.answer
                                          ? 'Send follow-up question or meetup location (e.g., Meet at library 4PM)'
                                          : 'Ask a verification question...'
                                      }
                                      value={questionsInput[claimantId] || ''}
                                      onChange={(e) =>
                                        setQuestionsInput({ ...questionsInput, [claimantId]: e.target.value })
                                      }
                                      style={{ fontSize: '12px', padding: '6px 8px', marginBottom: '6px', width: '100%' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSendQuestion(item._id, claimantId)}
                                      style={{ width: '100%', fontSize: '11px', padding: '6px' }}
                                    >
                                      {claim.question ? 'Send Follow-up / Meetup Note' : 'Send Verification Question'}
                                    </button>
                                  </div>

                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleHandoverToClaimant(item._id, claimantId, claimantName)}
                                      style={{
                                        background: 'var(--board-found)',
                                        color: '#fff',
                                        padding: '6px 8px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        flex: 1,
                                      }}
                                    >
                                      ✓ Handed Over
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRejectSingleClaimant(item._id, claimantId, claimantName)}
                                      style={{
                                        background: '#fee2e2',
                                        color: 'var(--board-lost)',
                                        border: '1px solid #fecaca',
                                        padding: '6px 8px',
                                        fontSize: '11px',
                                        boxShadow: 'none',
                                      }}
                                    >
                                      ✕ Reject
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Card Action Buttons: Edit and Delete */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            disabled={isHandedOver}
                            style={{
                              background: 'var(--board-panel)',
                              color: 'var(--board-ink)',
                              border: '1px solid var(--border-color)',
                              fontSize: '12px',
                              padding: '6px 10px',
                              flex: 1,
                              boxShadow: 'none',
                              opacity: isHandedOver ? 0.5 : 1,
                              cursor: isHandedOver ? 'not-allowed' : 'pointer',
                            }}
                          >
                            ✎ Edit Report
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item._id)}
                            style={{
                              background: '#fee2e2',
                              color: 'var(--board-lost)',
                              border: '1px solid #fecaca',
                              fontSize: '12px',
                              padding: '6px 10px',
                              flex: 1,
                              boxShadow: 'none',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: User's Claimed Items */}
          {activeTab === 'claims' && (
            <div>
              {myClaims.length === 0 ? (
                <div className="board__empty">
                  <p style={{ margin: 0, fontWeight: 600 }}>You have not submitted a claim on any items yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                  {myClaims.map((item) => {
                    const myClaimRecord = item.claims?.find(
                      (c) => (c.claimant?._id || c.claimant) === (user?._id || user?.id)
                    );
                    const myClaimStatus = myClaimRecord?.status || 'pending';
                    const isHandedOverToMe = myClaimStatus === 'verified';
                    const isRejected = myClaimStatus === 'rejected';
                    const founderQuestion = myClaimRecord?.question;
                    const myAnswer = myClaimRecord?.answer;
                    const founderId = item.reportedBy?._id || item.reportedBy;
                    const founderName = item.reportedBy?.name || 'Founder';

                    return (
                      <div
                        key={item._id}
                        className="card"
                        style={{
                          margin: 0,
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          borderTop: `4px solid ${
                            isHandedOverToMe
                              ? 'var(--board-found)'
                              : isRejected
                              ? 'var(--board-lost)'
                              : 'var(--board-ink)'
                          }`,
                        }}
                      >
                        {item.imageUrl && (
                          <img
                            src={getImageUrl(item.imageUrl)}
                            alt={item.title}
                            style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '4px', marginBottom: '12px' }}
                          />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span
                            className="badge"
                            style={{
                              background: isHandedOverToMe ? '#d1fae5' : isRejected ? '#fee2e2' : '#fef3c7',
                              color: isHandedOverToMe ? '#065f46' : isRejected ? '#991b1b' : '#92400e',
                              border: `1px solid ${isHandedOverToMe ? '#a7f3d0' : isRejected ? '#fecaca' : '#fcd34d'}`,
                            }}
                          >
                            {isHandedOverToMe ? 'Handed Over to You' : isRejected ? 'Claim Rejected' : 'Claim Pending'}
                          </span>

                          {/* Flag Founder Button */}
                          {founderId && (
                            <button
                              type="button"
                              onClick={() =>
                                setFlagModalData({
                                  reportedUserId: founderId,
                                  reportedUserName: founderName,
                                  itemId: item._id,
                                })
                              }
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#b91c1c',
                                cursor: 'pointer',
                                fontSize: '11.5px',
                                textDecoration: 'underline',
                                padding: 0,
                                boxShadow: 'none',
                              }}
                            >
                              🚩 Report Founder
                            </button>
                          )}
                        </div>

                        <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: 'var(--board-ink)' }}>{item.title}</h3>
                        <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: '#3a3630', lineHeight: 1.45 }}>
                          {item.description || 'No description provided.'}
                        </p>

                        {!isHandedOverToMe && !isRejected && founderQuestion && (
                          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', marginBottom: '14px' }}>
                            <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a', marginBottom: '4px' }}>
                              📩 Message / Question from Founder:
                            </div>
                            <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: '#334155' }}>
                              "{founderQuestion}"
                            </p>

                            {myAnswer && (
                              <div style={{ fontSize: '12px', color: '#166534', background: '#dcfce7', padding: '6px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                                <strong>Your Last Reply:</strong> {myAnswer}
                              </div>
                            )}

                            <div>
                              <input
                                type="text"
                                placeholder={myAnswer ? 'Send updated reply or response...' : 'Type your answer here...'}
                                value={answersInput[item._id] || ''}
                                onChange={(e) => setAnswersInput({ ...answersInput, [item._id]: e.target.value })}
                                style={{ fontSize: '12px', padding: '6px 8px', marginBottom: '6px', width: '100%' }}
                              />
                              <button
                                type="button"
                                onClick={() => handleSendAnswer(item._id)}
                                style={{ width: '100%', fontSize: '11px', padding: '6px' }}
                              >
                                {myAnswer ? 'Send Another Reply' : 'Submit Answer to Founder'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            background: isHandedOverToMe ? '#f0fdf4' : isRejected ? '#fef2f2' : '#fefce8',
                            border: `1px solid ${isHandedOverToMe ? '#bbf7d0' : isRejected ? '#fecaca' : '#fef08a'}`,
                            borderRadius: '6px',
                            padding: '10px 12px',
                            fontSize: '12px',
                            color: isHandedOverToMe ? '#166534' : isRejected ? '#991b1b' : '#854d0e',
                            marginBottom: '12px',
                          }}
                        >
                          <strong>Status:</strong>{' '}
                          {isHandedOverToMe
                            ? 'Verification complete! The item has been handed over to you.'
                            : isRejected
                            ? 'This claim was rejected or the item was handed over to another owner.'
                            : founderQuestion && !myAnswer
                            ? 'Please answer the question above to verify your ownership.'
                            : 'Claim active. Follow instructions or messages sent by the founder above.'}
                        </div>

                        {item.reportedBy && typeof item.reportedBy === 'object' && (
                          <div className="board-card__meta" style={{ marginTop: 'auto' }}>
                            <div><strong>Reported by:</strong> {item.reportedBy.name || 'Campus Member'}</div>
                            <div>
                              <strong>Founder Contact Email:</strong>{' '}
                              <a href={`mailto:${item.reportedBy.email}`} style={{ color: 'var(--board-found)', textDecoration: 'underline' }}>
                                {item.reportedBy.email || 'Unspecified'}
                              </a>
                            </div>
                            {item.reportedBy.phone && (
                              <div style={{ marginTop: '4px' }}>
                                <strong>Phone:</strong> {item.reportedBy.phone}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div
          onClick={closeEditModal}
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
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', margin: 0 }}>Edit Report Details</h2>
              <button
                type="button"
                onClick={closeEditModal}
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

            {editError && <p className="error" style={{ marginBottom: '14px' }}>{editError}</p>}

            <form onSubmit={handleUpdateItem}>
              <div style={{ marginBottom: '12px' }}>
                <label>Title</label>
                <input
                  type="text"
                  required
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label>Category</label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="ID Card">ID Card</option>
                    <option value="Wallet">Wallet</option>
                    <option value="Jewellery">Jewellery</option>
                    <option value="Personal Stuffs">Personal Stuffs</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label>Date Occurred</label>
                  <input
                    type="date"
                    value={editFormData.dateOccurred}
                    onChange={(e) => setEditFormData({ ...editFormData, dateOccurred: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label>Location</label>
                  <input
                    type="text"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    placeholder="e.g. Library, Lab 2"
                  />
                </div>

                <div>
                  <label>Contact Info</label>
                  <input
                    type="text"
                    value={editFormData.contactInfo}
                    onChange={(e) => setEditFormData({ ...editFormData, contactInfo: e.target.value })}
                    placeholder="Phone or email"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label>Description</label>
                <textarea
                  rows={4}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={closeEditModal}
                  style={{ background: 'var(--board-panel)', color: 'var(--board-ink)', boxShadow: 'none' }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingEdit}>
                  {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scored Matches Popup Modal */}
      {checkingMatchesItem && (
        <MatchesModal
          itemId={checkingMatchesItem._id}
          itemTitle={checkingMatchesItem.title}
          onClose={() => setCheckingMatchesItem(null)}
        />
      )}

      {/* Flag / Report User Modal */}
      {flagModalData && (
        <FlagUserModal
          reportedUserId={flagModalData.reportedUserId}
          reportedUserName={flagModalData.reportedUserName}
          itemId={flagModalData.itemId}
          onClose={() => setFlagModalData(null)}
        />
      )}
    </div>
  );
}