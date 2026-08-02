import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import AlertCard from '../components/AlertCard';
import WebcamFeed from '../components/WebcamFeed';
import useDeviceList from '../hooks/useDeviceList';
import { useToast, ToastContainer } from '../components/Toast';
import authFetch from '../utils/authFetch';
import styles from './TeacherDashboard.module.css';

export default function TeacherDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [systemStatus, setSystemStatus] = useState('Online');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);

  const { toasts, addToast, removeToast } = useToast();
  
  const { devices } = useDeviceList();

  const prevAlertCountRef = useRef(0);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const fetchAlerts = () => {
      authFetch('/api/v1/alerts/')
        .then(res => {
          if (!res.ok) throw new Error("Network response was not ok");
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setAlerts(data);
            if (hasInitializedRef.current && data.length > prevAlertCountRef.current) {
              const newestAlert = data[0];
              if (newestAlert) {
                const type = newestAlert.alert_type || newestAlert.type;
                // Only show popup and play beep for Face Recognition
                if (type === 'recognition') {
                  addToast('🚨 Face Recognized!', 'info', {
                    playBeep: true,
                    duration: 60000,
                    beepInterval: 15000,
                    studentData: {
                      student_name: newestAlert.student_name,
                      student_roll_number: newestAlert.student_roll_number,
                      student_grade: newestAlert.student_grade,
                      student_section: newestAlert.student_section,
                      student_photo: newestAlert.student_photo,
                      alert_type: type,
                      camera_name: newestAlert.camera_name || 'Camera',
                      time: newestAlert.created_at ? new Date(newestAlert.created_at).toLocaleString() : ''
                    },
                    snapshot: newestAlert.snapshot
                  });
                }
              }
            }
            prevAlertCountRef.current = data.length;
            hasInitializedRef.current = true;
          }
          setSystemStatus('Online');
        })
        .catch(err => {
          console.error("Error fetching alerts:", err);
          setSystemStatus('Offline');
        });
    };

    // Initial fetch
    fetchAlerts();

    // Setup polling interval
    const intervalId = setInterval(fetchAlerts, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [addToast]);

  const fetchStudentDetails = (id) => {
    authFetch(`/api/v1/students/${id}/`)
      .then(res => res.json())
      .then(data => {
        setStudentDetails(data);
        setSelectedStudentId(id);
      })
      .catch(err => console.error("Error fetching student details:", err));
  };

  const closeStudentModal = () => {
    setSelectedStudentId(null);
    setStudentDetails(null);
  };

  return (
    <div className={styles.dashboard}>
      <Sidebar />
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>Classroom Dashboard</h1>
        </header>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>Active Cameras</span>
            <span className={styles.statValue}>{devices.length}/{devices.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>Total Alerts</span>
            <span className={styles.statValue}>{alerts.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>System Status</span>
            <span className={styles.statValue} style={{color: systemStatus === 'Online' ? 'green' : 'red'}}>
              {systemStatus}
            </span>
          </div>
        </div>

        <div className={styles.contentGrid}>
          <section className={styles.cameraSection}>
            <h2 className={styles.sectionTitle}>Live Feeds</h2>
            
            <div className={styles.cameraGrid}>
              {devices.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', background: '#f5f5f5', borderRadius: '8px' }}>
                  No cameras found
                </div>
              ) : (
                devices.map(device => (
                  <WebcamFeed 
                    key={device.deviceId} 
                    deviceId={device.deviceId} 
                    label={device.label} 
                    autoStart={true} 
                  />
                ))
              )}
            </div>
          </section>

          <section className={styles.alertSection}>
            <h2 className={styles.sectionTitle}>Recent Alerts</h2>
            <div className={styles.alertsList}>
              {alerts.slice(0, 10).map((alert, idx) => (
                <AlertCard 
                  key={alert.id || idx}
                  type={alert.alert_type || alert.type || 'Alert'} 
                  time={alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : (alert.time || '')} 
                  severity={alert.severity || 'medium'} 
                  snapshot={alert.snapshot}
                  studentName={alert.student_name}
                  studentId={alert.student_id}
                  onStudentClick={fetchStudentDetails}
                  description={alert.description}
                />
              ))}
              {alerts.length === 0 && <p>No recent alerts.</p>}
            </div>
          </section>
        </div>
      </main>

      {/* Student Details Modal */}
      {selectedStudentId && studentDetails && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '2rem', borderRadius: '8px', 
            maxWidth: '500px', width: '100%', position: 'relative'
          }}>
            <button 
              onClick={closeStudentModal} 
              style={{ position: 'absolute', top: '10px', right: '15px', border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              &times;
            </button>
            <h2 style={{marginTop: 0, marginBottom: '1.5rem'}}>Student Details</h2>
            <div style={{display: 'flex', gap: '1.5rem'}}>
              {studentDetails.photo ? (
                <img 
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${studentDetails.photo}`} 
                  alt={studentDetails.name} 
                  style={{width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px'}} 
                />
              ) : (
                <div style={{width: '120px', height: '120px', backgroundColor: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  No Photo
                </div>
              )}
              <div>
                <p><strong>Name:</strong> {studentDetails.name}</p>
                <p><strong>Roll Number:</strong> {studentDetails.roll_number}</p>
                <p><strong>Grade/Section:</strong> {studentDetails.grade}-{studentDetails.section}</p>
                <p><strong>Registered on:</strong> {new Date(studentDetails.created_at).toLocaleDateString()}</p>
                {studentDetails.rfid_tag && <p><strong>RFID:</strong> {studentDetails.rfid_tag}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
