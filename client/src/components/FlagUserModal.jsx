import { useState } from 'react';
import api from '../api/axios';

export default function FlagUserModal({ reportedUserId, reportedUserName, itemId, onClose }) {
  const [reasonCategory, setReasonCategory] = useState('fraudulent_claim');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setFeedback({ error: 'Please describe the incident.', success: '' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback({ error: '', success: '' });

      await api.post('/reports', {
        reportedUserId,
        itemId: itemId || null,
        reasonCategory,
        description,
      });

      setFeedback({ error: '', success: 'Report submitted. Campus administrators will review the notice.' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setFeedback({
        error: err.response?.data?.message || 'Failed to submit report. Please try again.',
        success: '',
      });
    } finally {
      setSubmitting(false);
    }
  };

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
        zIndex: 1200,
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: '480px', width: '100%', margin: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#991b1b' }}>🚩 Report User or Notice</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--board-muted)', margin: '0 0 14px' }}>
          Filing a notice against <strong>{reportedUserName || 'Campus User'}</strong>. All submissions are audited by administration.
        </p>

        {feedback.error && <p className="error" style={{ marginBottom: '12px' }}>{feedback.error}</p>}
        {feedback.success && (
          <p style={{ color: '#166534', background: '#dcfce7', padding: '8px', borderRadius: '4px', fontSize: '13px' }}>
            {feedback.success}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '4px' }}>
              Violation Category
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              <option value="fraudulent_claim">Suspicious / False Ownership Claim</option>
              <option value="fake_item">Fake or Misleading Item Report</option>
              <option value="inappropriate_content">Inappropriate Content / Language</option>
              <option value="harassment">Harassment or Threatening Communication</option>
              <option value="spam">Spam / Duplicate Posting</option>
              <option value="other">Other Campus Policy Violation</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '4px' }}>
              Incident Details
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide specific context (e.g., incorrect answer attempts, suspicious contact messages)..."
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: '#b91c1c',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}