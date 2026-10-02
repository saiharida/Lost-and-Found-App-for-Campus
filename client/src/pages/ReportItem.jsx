import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';

const emptyForm = {
  type: 'lost',
  title: '',
  category: '',
  location: '',
  dateOccurred: '',
  description: '',
};

const STANDARD_CATEGORIES = ['Electronics', 'ID Card', 'Wallet', 'Jewellery'];

// Client-side auto-downscaler: handles multi-megapixel camera and stock photos
function compressImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

export default function ReportItem() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;
    const loadItem = async () => {
      try {
        const { data } = await api.get(`/items/${id}`);
        // Normalize any custom/legacy categories to "Other"
        const assignedCategory = STANDARD_CATEGORIES.includes(data.category)
          ? data.category
          : 'Other';

        setForm({
          type: data.type,
          title: data.title || '',
          category: assignedCategory,
          location: data.location || '',
          dateOccurred: data.dateOccurred ? data.dateOccurred.slice(0, 10) : '',
          description: data.description || '',
        });
        setExistingImageUrl(data.imageUrl || null);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load this report');
      } finally {
        setLoading(false);
      }
    };
    loadItem();
  }, [id, isEditMode]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      return;
    }

    setProcessingImage(true);
    try {
      const optimized = await compressImage(file);
      setPhotoFile(optimized);
    } catch {
      setPhotoFile(file);
    } finally {
      setProcessingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.type === 'found') {
      if (!form.location.trim()) {
        setError('Location is mandatory for found items.');
        return;
      }
      if (!form.dateOccurred) {
        setError('Date is mandatory for found items.');
        return;
      }
      if (!photoFile && !existingImageUrl) {
        setError('An image upload is mandatory for found item reports.');
        return;
      }
    }

    if (form.type === 'lost') {
      if (!form.description.trim()) {
        setError('Description is mandatory for lost items.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (photoFile) payload.append('image', photoFile);

      if (isEditMode) {
        await api.put(`/items/${id}`, payload);
        navigate('/profile');
      } else {
        await api.post('/items', payload);
        navigate('/');
      }
    } catch (err) {
      const backendError = err.response?.data?.error;
      const backendMessage = err.response?.data?.message;
      setError(backendError ? `${backendMessage} (${backendError})` : (backendMessage || 'Could not submit report'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <p>Loading report...</p>
      </div>
    );
  }

  const isFound = form.type === 'found';
  const isLost = form.type === 'lost';
  const isPhotoRequired = isFound && !existingImageUrl;

  return (
    <div className="container">
      <div className="card">
        <h2>{isEditMode ? 'Edit Report' : 'Report a Lost or Found Item'}</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>Report Type</label>
          <select name="type" value={form.type} onChange={handleChange}>
            <option value="lost">Lost Item</option>
            <option value="found">Found Item</option>
          </select>

          <label>Item Title <span style={{ color: 'red' }}>*</span></label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Black wallet"
            required
          />

          <label>Category <span style={{ color: 'red' }}>*</span></label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            required
          >
            <option value="" disabled>Select a Category</option>
            <option value="Electronics">Electronics</option>
            <option value="ID Card">ID Card</option>
            <option value="Wallet">Wallet</option>
            <option value="Jewellery">Jewellery</option>
            <option value="Personal Accessories">Personal Accessories</option>
            <option value="Other">Other</option>
          </select>

          <label>
            Location {isFound && <span style={{ color: 'red' }}>*</span>}
          </label>
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="e.g. Library, 2nd floor"
            required={isFound}
          />

          <label>
            Date {isFound && <span style={{ color: 'red' }}>*</span>}
          </label>
          <input
            type="date"
            name="dateOccurred"
            value={form.dateOccurred}
            onChange={handleChange}
            required={isFound}
          />

          <label>
            Description {isLost && <span style={{ color: 'red' }}>*</span>}
          </label>
          <textarea
            name="description"
            rows={4}
            value={form.description}
            onChange={handleChange}
            placeholder={isLost ? "Please describe the lost item in detail..." : "Additional details..."}
            required={isLost}
          />

          <label>
            Photo {isFound ? <span style={{ color: 'red' }}>*</span> : '(Optional)'}
          </label>
          {existingImageUrl && !photoFile && (
            <img
              src={existingImageUrl}
              alt="Current"
              style={{ width: 120, borderRadius: 6, marginBottom: 4, display: 'block' }}
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            required={isPhotoRequired}
          />
          {processingImage && (
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Optimizing image resolution...
            </p>
          )}

          <button type="submit" disabled={submitting || processingImage}>
            {submitting ? 'Saving…' : isEditMode ? 'Save Changes' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}