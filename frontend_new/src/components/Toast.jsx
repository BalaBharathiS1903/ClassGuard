import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Toast.module.css';

const ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
};

// Persistent AudioContext — reused across all beeps to avoid browser autoplay restrictions.
// Browsers suspend new AudioContexts until user interaction; by reusing one and calling
// resume() we ensure the beep plays even from a background timer.
let _audioCtx = null;

const getAudioContext = () => {
  if (!_audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    _audioCtx = new AudioContextClass();
  }
  return _audioCtx;
};

const playBeepSound = async () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Play a 3-tone alert pattern: beep-beep-beep
    const tones = [
      { freq: 800, start: 0, dur: 0.15 },
      { freq: 1000, start: 0.2, dur: 0.15 },
      { freq: 800, start: 0.4, dur: 0.2 },
    ];

    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(tone.freq, ctx.currentTime + tone.start);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime + tone.start);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + tone.start + tone.dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime + tone.start);
      osc.stop(ctx.currentTime + tone.start + tone.dur);
    }
  } catch (error) {
    console.error("Failed to play toast beep:", error);
  }
};

const formatType = (type) => {
  if (!type) return 'Alert';
  if (type === 'recognition') return 'Face Recognition';
  if (type === 'motion') return 'Motion Detected';
  if (type === 'unauthorized') return 'Unauthorized Entry';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const Toast = ({ id, message, type = 'info', duration = 60000, playBeep = false, beepInterval = 15000, onClose, studentData, snapshot }) => {
  const [isExiting, setIsExiting] = useState(false);
  const beepTimerRef = useRef(null);

  // Play beep sound on mount and repeat every beepInterval
  useEffect(() => {
    if (playBeep) {
      playBeepSound();
      beepTimerRef.current = setInterval(() => {
        playBeepSound();
      }, beepInterval);
    }
    return () => {
      if (beepTimerRef.current) {
        clearInterval(beepTimerRef.current);
      }
    };
  }, [playBeep, beepInterval]);

  // Auto-dismiss timer
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    if (beepTimerRef.current) {
      clearInterval(beepTimerRef.current);
    }
    setTimeout(() => {
      onClose(id);
    }, 400);
  }, [id, onClose]);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const snapshotUrl = snapshot 
    ? (snapshot.startsWith('http') ? snapshot : `${API_BASE}${snapshot}`) 
    : null;
  const photoUrl = studentData?.student_photo
    ? (studentData.student_photo.startsWith('http') ? studentData.student_photo : `${API_BASE}${studentData.student_photo}`)
    : null;

  const hasStudentCard = studentData && studentData.student_name;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={`${styles.toast} ${styles[type] || styles.info} ${isExiting ? styles.exiting : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button 
          onClick={handleClose} 
          className={styles.closeBtn} 
          aria-label="Close notification"
        >
          &times;
        </button>

        {/* Header with icon and alert info */}
        <div className={styles.toastHeader}>
          <span className={styles.icon} aria-hidden="true">
            {ICONS[type] || ICONS.info}
          </span>
          <p className={styles.message}>{message}</p>
        </div>

        {/* Student Details Card */}
        {hasStudentCard && (
          <div className={styles.studentCard}>
            <div className={styles.studentCardInner}>
              {/* Photo / Snapshot */}
              <div className={styles.studentPhotoArea}>
                {snapshotUrl ? (
                  <img src={snapshotUrl} alt="Alert Snapshot" className={styles.studentPhoto} />
                ) : photoUrl ? (
                  <img src={photoUrl} alt={studentData.student_name} className={styles.studentPhoto} />
                ) : (
                  <div className={styles.studentPhotoPlaceholder}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className={styles.studentDetails}>
                <h3 className={styles.studentName}>{studentData.student_name}</h3>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Roll No:</span>
                  <span className={styles.detailValue}>{studentData.student_roll_number || 'N/A'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Class:</span>
                  <span className={styles.detailValue}>
                    {studentData.student_grade || '?'}-{studentData.student_section || '?'}
                  </span>
                </div>
                {studentData.alert_type && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Alert:</span>
                    <span className={`${styles.detailValue} ${styles.alertBadge}`}>
                      {formatType(studentData.alert_type)}
                    </span>
                  </div>
                )}
                {studentData.camera_name && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Camera:</span>
                    <span className={styles.detailValue}>{studentData.camera_name}</span>
                  </div>
                )}
                {studentData.time && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Time:</span>
                    <span className={styles.detailValue}>{studentData.time}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Snapshot only (no student) */}
        {!hasStudentCard && snapshotUrl && (
          <div className={styles.snapshotOnly}>
            <img src={snapshotUrl} alt="Alert Snapshot" className={styles.snapshotImg} />
          </div>
        )}

        {/* Progress bar for auto-dismiss */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ animationDuration: `${duration}ms` }} />
        </div>
      </div>
    </div>
  );
};

export const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;
  
  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration || 60000}
          playBeep={toast.playBeep}
          beepInterval={toast.beepInterval || 15000}
          studentData={toast.studentData}
          snapshot={toast.snapshot}
          onClose={removeToast}
        />
      ))}
    </>
  );
};

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prevToasts) => [
      ...prevToasts,
      { id, message, type, ...options }
    ]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
};
