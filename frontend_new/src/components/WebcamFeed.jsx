import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://classguard-9om7.onrender.com';

export default function WebcamFeed({ deviceId, label, autoStart = false, style = {} }) {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState('');
  const [imgKey, setImgKey] = useState(0);
  const timeoutRef = useRef(null);

  const startStream = () => {
    setError('');
    setImgKey(prev => prev + 1); // Force img element to reload
    setIsActive(true);

    // Set a timeout — if the img doesn't load within 15s, show error
    timeoutRef.current = setTimeout(() => {
      setError('Connection timed out');
      setIsActive(false);
    }, 15000);
  };

  const stopStream = () => {
    setIsActive(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleImgLoad = () => {
    // Image started loading successfully, cancel timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (autoStart) {
      startStream();
    }
    return () => {
      stopStream();
    };
  }, [deviceId, autoStart]);

  return (
    <div style={{
      position: 'relative',
      aspectRatio: '16/9',
      background: '#111827',
      borderRadius: '10px',
      overflow: 'hidden',
      ...style
    }}>
      {/* Label */}
      {label && (
        <span style={{
          position: 'absolute',
          top: '0.5rem',
          left: '0.5rem',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          padding: '0.25rem 0.6rem',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: '500',
          zIndex: 2,
          backdropFilter: 'blur(4px)'
        }}>
          {label}
        </span>
      )}

      {/* Status indicator */}
      <span style={{
        position: 'absolute',
        top: '0.5rem',
        right: '0.5rem',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: isActive ? '#10b981' : (error ? '#ef4444' : '#f59e0b'),
        zIndex: 2,
        boxShadow: isActive ? '0 0 6px #10b981' : (error ? '0 0 6px #ef4444' : '0 0 6px #f59e0b')
      }} />

      {/* Image element pointing to backend stream */}
      {isActive && (
        <img
          key={imgKey}
          src={`${API_BASE}/api/v1/video_feed/${deviceId || 1}/?token=${localStorage.getItem('access') || ''}`}
          alt="Video Feed"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
          onLoad={handleImgLoad}
          onError={() => {
            setError('Failed to connect to camera feed');
            setIsActive(false);
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
          }}
        />
      )}

      {/* Offline placeholder */}
      {!isActive && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          gap: '0.5rem'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span style={{ fontSize: '0.85rem', color: error ? '#ef4444' : '#6b7280' }}>
            {error || 'Camera Offline'}
          </span>
          <button
            onClick={startStream}
            style={{
              marginTop: '0.5rem',
              padding: '0.4rem 1rem',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            {error ? '🔄 Retry' : 'Start'}
          </button>
        </div>
      )}

      {/* Stop button overlay when active */}
      {isActive && (
        <button
          onClick={stopStream}
          style={{
            position: 'absolute',
            bottom: '0.5rem',
            right: '0.5rem',
            padding: '0.3rem 0.75rem',
            background: 'rgba(239, 68, 68, 0.9)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            zIndex: 2,
            backdropFilter: 'blur(4px)'
          }}
        >
          Stop
        </button>
      )}
    </div>
  );
}
