import React, { useEffect, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import styles from './TeacherDashboard.module.css';
import WebcamFeed from '../components/WebcamFeed';
import useDeviceList from '../hooks/useDeviceList';
import { useToast, ToastContainer } from '../components/Toast';
import authFetch from '../utils/authFetch';

export default function Cameras() {
  const { devices, refreshDevices } = useDeviceList();
  const { toasts, addToast, removeToast } = useToast();
  const toastShown = useRef(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (devices.length > 0 && !toastShown.current) {
      addToast(`Found ${devices.length} camera(s)!`, 'success', { duration: 4000 });
      toastShown.current = true;
    }
  }, [devices.length, addToast]);

  const handleScanWebcams = async () => {
    setScanning(true);
    try {
      const response = await authFetch('/api/v1/scan-webcams/', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Scan failed');
      const data = await response.json();

      const newCount = data.cameras.filter(c => c.created).length;
      if (newCount > 0) {
        addToast(`🎉 Found ${newCount} new webcam(s)! Total: ${data.total}`, 'success', { duration: 5000 });
      } else if (data.total > 0) {
        addToast(`✅ ${data.total} webcam(s) already registered`, 'info', { duration: 4000 });
      } else {
        addToast('⚠️ No webcams detected. Check connections.', 'warning', { duration: 5000 });
      }

      // Refresh the camera list to show the newly registered cameras
      toastShown.current = true; // prevent duplicate toast
      await refreshDevices();
    } catch (err) {
      console.error('Scan webcams error:', err);
      addToast('❌ Failed to scan webcams. Is the backend running?', 'error', { duration: 5000 });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className={styles.dashboard}>
      <Sidebar />
      <main className={styles.mainContent}>
        <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className={styles.headerTitle}>Live Webcams</h1>
            <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              {devices.length} camera(s) detected
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleScanWebcams}
              disabled={scanning}
              style={{
                padding: '0.6rem 1.25rem',
                background: scanning
                  ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: scanning ? 'wait' : 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s ease',
                opacity: scanning ? 0.85 : 1,
              }}
            >
              {scanning ? (
                <>
                  <span style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Scanning...
                </>
              ) : (
                <>📷 Scan Webcams</>
              )}
            </button>
            <button
              onClick={refreshDevices}
              style={{
                padding: '0.6rem 1.25rem',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </header>

        <div className={styles.contentGrid} style={{ display: 'block' }}>
          <section className={styles.cameraSection}>
            {devices.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                color: '#6b7280'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ margin: '0 auto 1rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p style={{ fontWeight: '500', fontSize: '1.1rem', marginBottom: '0.5rem' }}>No webcam devices detected</p>
                <p style={{ marginBottom: '1.5rem' }}>Click <strong>"Scan Webcams"</strong> to auto-detect your laptop camera and external USB webcams.</p>
                <button
                  onClick={handleScanWebcams}
                  disabled={scanning}
                  style={{
                    padding: '0.75rem 2rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  {scanning ? 'Scanning...' : '📷 Scan Webcams'}
                </button>
              </div>
            ) : (
              <div className={styles.cameraGrid}>
                {devices.map((device, index) => (
                  <WebcamFeed
                    key={device.deviceId || index}
                    deviceId={device.deviceId}
                    label={device.label}
                    autoStart={true}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Spinner animation keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
