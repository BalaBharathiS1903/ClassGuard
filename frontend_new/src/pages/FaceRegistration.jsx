import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import styles from './TeacherDashboard.module.css';
import { useToast, ToastContainer } from '../components/Toast';
import { detectFacesBackend } from '../utils/faceDetection';
import authFetch from '../utils/authFetch';

export default function FaceRegistration() {
  const { toasts, addToast, removeToast } = useToast();
  
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Fetch students
  useEffect(() => {
    authFetch('/api/v1/students/')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStudents(data);
        } else if (data.results) {
          setStudents(data.results);
        }
      })
      .catch(err => console.error("Error fetching students:", err));
  }, []);

  // Fetch registered cameras from backend
  useEffect(() => {
    authFetch('/api/v1/cameras/')
      .then(res => res.json())
      .then(data => {
        const camList = Array.isArray(data) ? data : (data.results || []);
        setCameras(camList);
        if (camList.length > 0) {
          setSelectedCameraId(camList[0].id);
        }
      })
      .catch(err => console.error("Error fetching cameras:", err));
  }, []);

  const handleStartCamera = () => {
    if (!selectedCameraId) {
      addToast('Please select a camera first.', 'warning');
      return;
    }
    setIsCameraActive(true);
    addToast('Connecting to camera feed...', 'info');
  };

  const handleStopCamera = () => {
    setIsCameraActive(false);
  };

  const handleCapture = async () => {
    if (!selectedStudent) {
      addToast('Please select a student first.', 'warning');
      return;
    }
    
    if (imgRef.current && canvasRef.current) {
      try {
        const img = imgRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Use natural dimensions of the image stream
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 480;
        
        // Draw the current frame from the MJPEG stream to the canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(b => {
            if (b) resolve(b);
            else reject(new Error('Failed to generate image blob from canvas'));
          }, 'image/jpeg', 0.9);
        });
        
        try {
          const result = await detectFacesBackend(blob);
          
          if (result.faceCount === 0) {
            addToast('❌ No face detected! Please position your face clearly in the frame.', 'error');
            return;
          }
          
          if (result.faceCount > 1) {
            addToast('⚠️ Multiple faces detected! Only one student should be in frame.', 'warning');
            return;
          }
          
          setPreviewBlob(blob);
          setPreviewUrl(URL.createObjectURL(blob));
        } catch (err) {
          addToast('Face detection failed. Proceeding with capture anyway.', 'info');
          setPreviewBlob(blob);
          setPreviewUrl(URL.createObjectURL(blob));
        }
      } catch (err) {
        console.error('Capture error:', err);
        addToast('Failed to capture frame from video feed. Please try again.', 'error');
      }
    }
  };

  const handleRetake = () => {
    setPreviewBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewBlob || !selectedStudent) return;
    
    const formData = new FormData();
    formData.append('photo', previewBlob, 'face.jpg');
    
    try {
      const res = await authFetch(`/api/v1/students/${selectedStudent}/`, {
        method: 'PATCH',
        body: formData
      });
      
      if (res.ok) {
        addToast('Face successfully registered!', 'success', { playBeep: true });
        handleRetake();
      } else {
        addToast('Failed to upload face data.', 'error', { playBeep: true });
      }
    } catch (err) {
      addToast('Failed to upload face data.', 'error', { playBeep: true });
    }
  };

  const buttonStyle = {
    padding: '0.75rem 1.5rem',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  return (
    <div className={styles.dashboard}>
      <Sidebar />
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>Face Registration</h1>
        </header>
        
        <div className={styles.contentGrid} style={{ display: 'block', maxWidth: '800px' }}>
          <section className={styles.cameraSection}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Select Student:</label>
                <select 
                  value={selectedStudent} 
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
                >
                  <option value="">-- Choose a student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.roll_number})</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '250px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Backend Camera:</label>
                <select 
                  value={selectedCameraId} 
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    if (isCameraActive) setIsCameraActive(false);
                  }}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
                  disabled={isCameraActive}
                >
                  {cameras.map(cam => (
                    <option key={cam.id} value={cam.id}>
                      {cam.name}
                    </option>
                  ))}
                  {cameras.length === 0 && <option value="">No cameras registered</option>}
                </select>
              </div>
            </div>
            
            <div style={{ aspectRatio: '16/9', background: '#1f2937', borderRadius: '12px', overflow: 'hidden', position: 'relative', marginBottom: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }}>
              {isCameraActive ? (
                <img
                  ref={imgRef}
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/video_feed/${selectedCameraId}/?token=${localStorage.getItem('access') || ''}`}
                  alt="Camera Feed"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={() => {
                    addToast('Failed to connect to backend feed.', 'error');
                    setIsCameraActive(false);
                  }}
                />
              ) : (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ marginBottom: '1rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span style={{ fontSize: '1.125rem', fontWeight: '500' }}>Camera Offline</span>
                </div>
              )}
            </div>

            {/* Hidden canvas for taking a snapshot */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {!previewUrl ? (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {!isCameraActive ? (
                  <button 
                    onClick={handleStartCamera}
                    style={{ ...buttonStyle, background: '#3b82f6' }}
                    onMouseOver={e => e.currentTarget.style.background = '#2563eb'}
                    onMouseOut={e => e.currentTarget.style.background = '#3b82f6'}
                  >
                    Start Camera
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={handleCapture}
                      style={{ ...buttonStyle, background: '#10b981' }}
                      onMouseOver={e => e.currentTarget.style.background = '#059669'}
                      onMouseOut={e => e.currentTarget.style.background = '#10b981'}
                    >
                      Capture & Register
                    </button>
                    <button 
                      onClick={handleStopCamera}
                      style={{ ...buttonStyle, background: '#ef4444' }}
                      onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                      onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
                    >
                      Stop Camera
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#111827' }}>Preview</h3>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <img 
                    src={previewUrl} 
                    alt="Captured face" 
                    style={{ maxWidth: '320px', width: '100%', borderRadius: '8px', border: '2px solid #e5e7eb' }} 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
                    <button 
                      onClick={handleConfirmUpload}
                      style={{ ...buttonStyle, background: '#4f46e5', padding: '0.75rem 2rem' }}
                      onMouseOver={e => e.currentTarget.style.background = '#4338ca'}
                      onMouseOut={e => e.currentTarget.style.background = '#4f46e5'}
                    >
                      Confirm & Upload
                    </button>
                    <button 
                      onClick={handleRetake}
                      style={{ ...buttonStyle, background: '#6b7280', padding: '0.75rem 2rem' }}
                      onMouseOver={e => e.currentTarget.style.background = '#4b5563'}
                      onMouseOut={e => e.currentTarget.style.background = '#6b7280'}
                    >
                      Retake
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
