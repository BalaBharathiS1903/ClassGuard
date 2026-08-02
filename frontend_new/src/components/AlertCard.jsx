import React from 'react';
import styles from './AlertCard.module.css';

const formatType = (type) => {
  if (!type) return 'Alert';
  if (type === 'recognition') return 'Face Recognition';
  if (type === 'motion') return 'Motion Detected';
  if (type === 'unauthorized') return 'Unauthorized Entry';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export default function AlertCard({ type, time, severity, snapshot, studentName, studentId, description, onStudentClick, onCardClick, fullAlert }) {
  // Backend DRF often returns absolute URLs (starting with http), so we only prefix if it's a relative path
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const snapshotUrl = snapshot 
    ? (snapshot.startsWith('http') ? snapshot : `${API_BASE}${snapshot}`) 
    : null;

  return (
    <div className={styles.card} onClick={() => onCardClick && onCardClick(fullAlert)} style={{ cursor: onCardClick ? 'pointer' : 'default' }}>
      <div className={`${styles.dot} ${styles[severity] || styles.medium}`}></div>
      {snapshotUrl && (
        <img src={snapshotUrl} alt="Alert snapshot" className={styles.thumbnail} />
      )}
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.type}>{formatType(type)}</div>
          <div className={styles.time}>{time}</div>
        </div>
        {studentName && (
          <div className={styles.studentName}>
            Student: <span 
              onClick={(e) => {
                e.stopPropagation();
                if (onStudentClick && studentId) onStudentClick(studentId);
              }}
              style={{ cursor: 'pointer', color: '#3b82f6', textDecoration: 'underline' }}
            >{studentName}</span>
          </div>
        )}
        {description && <div className={styles.description}>{description}</div>}
      </div>
    </div>
  );
}
