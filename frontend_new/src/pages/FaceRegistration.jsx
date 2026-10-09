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
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');

  // Camera source mode: 'local' (Laptop Webcam), 'backend' (Backend Stream), 'file' (Upload Photo File)
  const [cameraSource, setCameraSource] = useState('local');

  // Local browser webcam devices
  const [localDevices, setLocalDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // Backend cameras
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFacesCount, setDetectedFacesCount] = useState(null);

  // Fetch student roster
  const fetchStudents = () => {
    authFetch('/api/v1/students/')
      .then((res) => res.json())
      .then((data) => {
        const studentList = Array.isArray(data) ? data : data.results || [];
        setStudents(studentList);
      })
      .catch((err) => console.error('Error fetching students:', err));
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Fetch backend registered cameras
  useEffect(() => {
    authFetch('/api/v1/cameras/')
      .then((res) => res.json())
      .then((data) => {
        const camList = Array.isArray(data) ? data : data.results || [];
        setCameras(camList);
        if (camList.length > 0) {
          setSelectedCameraId(camList[0].id);
        }
      })
      .catch((err) => console.error('Error fetching cameras:', err));
  }, []);

  // Enumerate local browser webcams
  const enumerateLocalDevices = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter((d) => d.kind === 'videoinput');

      if (videoDevices.length > 0 && !videoDevices[0].label) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach((track) => track.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = devices.filter((d) => d.kind === 'videoinput');
        } catch {
          // Grant permission later on start
        }
      }

      const formatted = videoDevices.map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${idx + 1}`,
      }));
      setLocalDevices(formatted);
      if (formatted.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(formatted[0].deviceId);
      }
    } catch (err) {
      console.error('Error enumerating browser webcams:', err);
    }
  };

  useEffect(() => {
    enumerateLocalDevices();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', enumerateLocalDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', enumerateLocalDevices);
      };
    }
  }, []);

  // Stop camera tracks cleanly
  const stopLocalCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleStartCamera = async () => {
    if (cameraSource === 'local') {
      stopLocalCamera();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addToast('Media devices not supported in this browser.', 'error');
        return;
      }
      try {
        const constraints = {
          video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
        addToast('Laptop camera feed active.', 'info');
        enumerateLocalDevices();
      } catch (err) {
        console.error('Failed to open laptop webcam:', err);
        addToast(`Could not access webcam: ${err.message || 'Permission denied'}`, 'error');
        setIsCameraActive(false);
      }
    } else if (cameraSource === 'backend') {
      if (!selectedCameraId) {
        addToast('Please select a backend camera first.', 'warning');
        return;
      }
      setIsCameraActive(true);
      addToast('Connecting to backend camera feed...', 'info');
    }
  };

  const handleStopCamera = () => {
    if (cameraSource === 'local') {
      stopLocalCamera();
    }
    setIsCameraActive(false);
  };

  const handleSourceChange = (newSource) => {
    handleStopCamera();
    setCameraSource(newSource);
    handleRetake();
  };

  useEffect(() => {
    return () => {
      stopLocalCamera();
    };
  }, []);

  // Handle local file upload
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedStudent) {
      addToast('Please select a student first.', 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    try {
      addToast('Analyzing face in uploaded image...', 'info');
      const result = await detectFacesBackend(file);
      setDetectedFacesCount(result.faceCount);

      if (result.faceCount === 0) {
        addToast('❌ No face detected in uploaded image! Please choose a clearer frontal photo.', 'error');
        setIsProcessing(false);
        return;
      }

      setPreviewBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
      addToast(`✅ Face detected successfully (${result.faceCount} face${result.faceCount > 1 ? 's' : ''})!`, 'success');
    } catch (err) {
      console.warn('Face detection error:', err);
      setPreviewBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
      addToast('Image selected. Ready to register.', 'info');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Frame Capture logic from Webcam or Backend Camera
  const handleCapture = async () => {
    if (!selectedStudent) {
      addToast('Please select a student first.', 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      let blob;

      if (cameraSource === 'local') {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) {
          throw new Error('Webcam video feed is not ready. Please wait a moment and try again.');
        }

        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas element not available.');
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Failed to generate image blob from canvas'))),
            'image/jpeg',
            0.92
          );
        });
      } else if (cameraSource === 'backend') {
        // Fetch direct snapshot from backend Camera API (eliminates canvas CORS taint)
        const snapRes = await authFetch(`/api/v1/cameras/${selectedCameraId}/snapshot/`);
        if (!snapRes.ok) {
          throw new Error('Failed to capture frame from backend camera. Ensure camera is online.');
        }
        blob = await snapRes.blob();
      }

      if (!blob) {
        throw new Error('No frame data could be captured.');
      }

      // Run server-side face detection validation
      try {
        const result = await detectFacesBackend(blob);
        setDetectedFacesCount(result.faceCount);

        if (result.faceCount === 0) {
          addToast('❌ No face detected! Please position your face clearly in the frame.', 'error');
          setIsProcessing(false);
          return;
        }

        if (result.faceCount > 1) {
          addToast('⚠️ Multiple faces detected. The largest face will be used for registration.', 'info');
        } else {
          addToast('✅ Face detected successfully!', 'success');
        }

        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.warn('Face detection validation warning:', err);
        addToast('Proceeding with captured frame.', 'info');
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error('Capture error:', err);
      addToast(`Capture failed: ${err.message || 'Please check camera connection and try again.'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setPreviewBlob(null);
    setDetectedFacesCount(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewBlob || !selectedStudent) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('photo', previewBlob, 'face.jpg');

    try {
      // First attempt dedicated registration endpoint with full validation
      let res = await authFetch(`/api/v1/students/${selectedStudent}/register_face/`, {
        method: 'POST',
        body: formData,
      });

      // Fallback to standard PATCH if register_face is not available
      if (res.status === 404 || res.status === 405) {
        res = await authFetch(`/api/v1/students/${selectedStudent}/`, {
          method: 'PATCH',
          body: formData,
        });
      }

      const resData = await res.json().catch(() => ({}));

      if (res.ok) {
        const studentObj = students.find((s) => String(s.id) === String(selectedStudent));
        const studentName = studentObj ? studentObj.name : 'Student';
        addToast(`🎉 Face successfully registered and encoded for ${studentName}!`, 'success', { playBeep: true });
        handleRetake();
        fetchStudents(); // Refresh roster with updated face encoding status
      } else {
        addToast(`Registration failed: ${resData.error || resData.detail || 'Server could not process face'}`, 'error');
      }
    } catch (err) {
      addToast('Network error while uploading face data.', 'error');
    } finally {
      setIsProcessing(false);
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
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  const currentStudentObj = students.find((s) => String(s.id) === String(selectedStudent));

  return (
    <div className={styles.dashboard}>
      <Sidebar />
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Face Registration</h1>
            <p className={styles.headerSubtitle}>
              Register high-accuracy facial biometric profiles for real-time live recognition and security attendance.
            </p>
          </div>
        </header>

        <div className={styles.contentGrid} style={{ display: 'block', maxWidth: '900px', margin: '0 auto' }}>
          <section className={styles.cameraSection}>
            {/* Student & Camera Selectors */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  1. Select Student:
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
                >
                  <option value="">-- Choose a student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.roll_number}) {s.has_face_encoding ? '✅ [Encoded]' : '⚠️ [No Face]'}
                    </option>
                  ))}
                </select>
                {currentStudentObj && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: currentStudentObj.has_face_encoding ? '#10b981' : '#f59e0b' }}>
                    Status: {currentStudentObj.has_face_encoding ? '✅ Face Biometrics Active' : '⚠️ No Face Registered Yet'}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: '240px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  2. Registration Method:
                </label>
                <select
                  value={cameraSource}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
                  disabled={isCameraActive}
                >
                  <option value="local">💻 Laptop / Webcam (Live Capture)</option>
                  <option value="file">📁 Upload Image File (From Computer / Phone)</option>
                  <option value="backend">📡 Backend Camera Feed</option>
                </select>
              </div>

              {cameraSource === 'local' && localDevices.length > 1 && (
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Select Webcam Device:
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      if (isCameraActive) handleStopCamera();
                    }}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
                    disabled={isCameraActive}
                  >
                    {localDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {cameraSource === 'backend' && (
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Backend Camera:
                  </label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      if (isCameraActive) setIsCameraActive(false);
                    }}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
                    disabled={isCameraActive}
                  >
                    {cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.name}
                      </option>
                    ))}
                    {cameras.length === 0 && <option value="">No cameras registered</option>}
                  </select>
                </div>
              )}
            </div>

            {/* Video / Stream Viewer Container (for local webcam or backend camera) */}
            {cameraSource !== 'file' ? (
              <div
                style={{
                  aspectRatio: '16/9',
                  background: '#1f2937',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative',
                  marginBottom: '1.5rem',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {/* Local Browser Video Element */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: isCameraActive && cameraSource === 'local' ? 'block' : 'none',
                  }}
                />

                {/* Backend MJPEG Stream Element */}
                {isCameraActive && cameraSource === 'backend' && (
                  <img
                    ref={imgRef}
                    crossOrigin="anonymous"
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/video_feed/${selectedCameraId}/?token=${localStorage.getItem('access') || ''}`}
                    alt="Camera Feed"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={() => {
                      addToast('Failed to connect to backend camera feed.', 'error');
                      setIsCameraActive(false);
                    }}
                  />
                )}

                {/* Offline Placeholder */}
                {!isCameraActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9ca3af',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ marginBottom: '1rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span style={{ fontSize: '1.125rem', fontWeight: '500' }}>Camera Offline</span>
                    <span style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {cameraSource === 'local' ? 'Click "Start Camera" to activate your laptop webcam' : 'Click "Start Camera" to connect to backend stream'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* File Upload Zone */
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #3b82f6',
                  borderRadius: '12px',
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  marginBottom: '1.5rem',
                  transition: 'background 0.2s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#eff6ff')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#f8fafc')}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" style={{ margin: '0 auto 1rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                  Click to Choose or Drag & Drop Student Photo
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Supports JPG, PNG, WEBP. Frontal face portraits work best.
                </div>
              </div>
            )}

            {/* Hidden canvas for taking snapshot from webcam */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Camera Actions */}
            {!previewUrl ? (
              cameraSource !== 'file' && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {!isCameraActive ? (
                    <button
                      onClick={handleStartCamera}
                      style={{ ...buttonStyle, background: '#3b82f6' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#2563eb')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '#3b82f6')}
                    >
                      Start Camera
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleCapture}
                        disabled={isProcessing}
                        style={{ ...buttonStyle, background: isProcessing ? '#9ca3af' : '#10b981', cursor: isProcessing ? 'wait' : 'pointer' }}
                        onMouseOver={(e) => {
                          if (!isProcessing) e.currentTarget.style.background = '#059669';
                        }}
                        onMouseOut={(e) => {
                          if (!isProcessing) e.currentTarget.style.background = '#10b981';
                        }}
                      >
                        {isProcessing ? 'Analyzing Frame...' : '📸 Capture & Register'}
                      </button>
                      <button
                        onClick={handleStopCamera}
                        style={{ ...buttonStyle, background: '#ef4444' }}
                        onMouseOver={(e) => (e.currentTarget.style.background = '#dc2626')}
                        onMouseOut={(e) => (e.currentTarget.style.background = '#ef4444')}
                      >
                        Stop Camera
                      </button>
                    </>
                  )}
                </div>
              )
            ) : (
              /* Capture Preview Section */
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1.5rem',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#111827' }}>
                  Captured Face Preview
                </h3>
                <p style={{ marginTop: 0, marginBottom: '1rem', color: '#4b5563', fontSize: '0.9rem' }}>
                  Review the image below. When confirmed, biometric features will be computed and saved for student #{selectedStudent}.
                </p>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <img
                    src={previewUrl}
                    alt="Captured face"
                    style={{ maxWidth: '320px', width: '100%', borderRadius: '8px', border: '2px solid #10b981', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
                    <button
                      onClick={handleConfirmUpload}
                      disabled={isProcessing}
                      style={{ ...buttonStyle, background: '#4f46e5', padding: '0.75rem 2rem', cursor: isProcessing ? 'wait' : 'pointer' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#4338ca')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '#4f46e5')}
                    >
                      {isProcessing ? 'Uploading & Encoding...' : '✅ Confirm & Save Face'}
                    </button>
                    <button
                      onClick={handleRetake}
                      disabled={isProcessing}
                      style={{ ...buttonStyle, background: '#6b7280', padding: '0.75rem 2rem' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#4b5563')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '#6b7280')}
                    >
                      🔄 Retake / Choose Different Photo
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
