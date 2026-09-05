import { useState, useRef, useEffect } from 'react';
import { Drawer } from './ui';
import { useToast } from '../context/ToastContext';

export default function StudentPhotoPicker({ value, onChange, label = "Student Photo" }) {
  const { error: shout } = useToast();
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState('select'); // 'select' | 'camera'
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helper to compress image to max 400x400 and guarantee size < 300 KB
  const processImage = (srcUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG and check size (< 300 KB base64 string)
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length > 380 * 1024 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > 400 * 1024) {
          reject(new Error('Image exceeds 300 KB even after compression. Please select a smaller photo.'));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = srcUrl;
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      shout('Please select a PNG, JPG, or WebP image.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => shout('Failed to read file.');
    reader.onload = async () => {
      try {
        const compressed = await processImage(reader.result);
        onChange(compressed);
        closeAll();
      } catch (err) {
        shout(err.message);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startCamera = async () => {
    setMode('camera');
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err) {
      shout('Camera access denied or unavailable: ' + (err.message || 'Error'));
      setMode('select');
    }
  };

  useEffect(() => {
    if (mode === 'camera' && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [mode, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const closeAll = () => {
    stopCamera();
    setMode('select');
    setOpenModal(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 400;
    canvas.height = video.videoHeight || 400;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawData = canvas.toDataURL('image/jpeg', 0.85);

    try {
      const compressed = await processImage(rawData);
      onChange(compressed);
      closeAll();
    } catch (err) {
      shout(err.message);
    }
  };

  return (
    <div className="student-photo-field">
      <div className="lbl" style={{ marginBottom: 6 }}>{label}</div>
      <div className="photo-picker-box" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          onClick={() => setOpenModal(true)}
          style={{
            width: 80,
            height: 80,
            borderRadius: 12,
            border: '2px dashed var(--line)',
            background: 'var(--surface-2)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            position: 'relative'
          }}
          title="Click to choose or take student photo"
        >
          {value ? (
            <img src={value} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <div style={{ fontSize: 10, marginTop: 2 }}>Photo</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button type="button" className="btn btn-sm" onClick={() => setOpenModal(true)}>
            {value ? 'Change Photo' : 'Upload / Take Photo'}
          </button>
          {value && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={{ color: 'var(--crit)', padding: '2px 6px', fontSize: 11 }}
              onClick={() => onChange('')}
            >
              Remove
            </button>
          )}
          <span className="tiny muted">Max 300 KB · PNG, JPG or WebP</span>
        </div>
      </div>

      {openModal && (
        <Drawer
          title="Student Photo"
          sub="Choose upload option"
          onClose={closeAll}
          footer={
            <button type="button" className="btn btn-ghost" onClick={closeAll}>
              Cancel
            </button>
          }
        >
          {mode === 'select' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
              <p className="tiny muted" style={{ margin: 0 }}>
                Select how you would like to add the student's photo (stored under 300 KB):
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'grid', placeItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>1. Upload from Computer / Device</div>
                  <div className="tiny muted">Choose an existing image file from your device</div>
                </div>
              </div>

              <div
                onClick={startCamera}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--good-soft)', color: 'var(--good)', display: 'grid', placeItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>2. Take a Photo (Camera)</div>
                  <div className="tiny muted">Use web camera to snap a live photo of the student</div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              <div
                style={{
                  width: '100%',
                  maxHeight: 320,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#000',
                  position: 'relative',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: 300, objectFit: 'cover' }} />
                <div
                  style={{
                    position: 'absolute',
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    border: '2px dashed #fff',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                    pointerEvents: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center' }}>
                <button type="button" className="btn btn-primary" onClick={capturePhoto}>
                  📸 Snap Photo
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
                    startCamera();
                  }}
                >
                  Flip Camera
                </button>
                <button type="button" className="btn" onClick={() => { stopCamera(); setMode('select'); }}>
                  Back
                </button>
              </div>
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}
