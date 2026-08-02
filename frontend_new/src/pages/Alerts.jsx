import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useToast, ToastContainer } from '../components/Toast';
import Sidebar from '../components/Sidebar';
import AlertCard from '../components/AlertCard';
import authFetch from '../utils/authFetch';
import styles from './TeacherDashboard.module.css';

const formatType = (type) => {
  if (!type) return 'Alert';
  if (type === 'recognition') return 'Face Recognition';
  if (type === 'motion') return 'Motion Detected';
  if (type === 'unauthorized') return 'Unauthorized Entry';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const { toasts, addToast, removeToast } = useToast();
  const prevCountRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [forwardStatus, setForwardStatus] = useState('');
  const [selectedForwardStaff, setSelectedForwardStaff] = useState('');
  const [messageChannel, setMessageChannel] = useState('whatsapp');

  useEffect(() => {
    const fetchAlerts = () => {
      authFetch('/api/v1/alerts/')
        .then(res => {
          if (!res.ok) throw new Error("Network error");
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            if (hasInitializedRef.current && data.length > prevCountRef.current) {
              const newestAlert = data[0];
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
                    alert_type: newestAlert.alert_type,
                    camera_name: newestAlert.camera_name || 'Camera',
                    time: newestAlert.created_at ? new Date(newestAlert.created_at).toLocaleString() : ''
                  },
                  snapshot: newestAlert.snapshot
                });
              }
            }
            prevCountRef.current = data.length;
            hasInitializedRef.current = true;
            setAlerts(data);
          }
        })
        .catch(err => console.error("Error fetching alerts:", err));
    };

    const fetchStaff = () => {
      authFetch('/api/v1/staff/')
        .then(res => res.json())
        .then(data => setStaffList(data))
        .catch(err => console.error(err));
    };

    fetchAlerts();
    fetchStaff();
    const intervalId = setInterval(fetchAlerts, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleAlertClick = (alert) => {
    setSelectedAlert(alert);
  };

  const closeAlertModal = () => {
    setSelectedAlert(null);
    setForwardStatus('');
    setSelectedForwardStaff('');
    setMessageChannel('whatsapp');
  };

  const handleForwardAlert = (isSmartRoute = false) => {
    const payload = isSmartRoute ? { channel: messageChannel } : { staff_id: selectedForwardStaff, channel: messageChannel };
    
    if (!isSmartRoute && !selectedForwardStaff) {
      setForwardStatus('Please select a staff member first.');
      return;
    }

    setForwardStatus('Sending...');
    authFetch(`/api/v1/alerts/${selectedAlert.id}/forward/`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(res => res.json().then(data => ({ status: res.status, data })))
    .then(({ status, data }) => {
      if (status === 200) {
        setForwardStatus(`Success: ${data.message}`);
      } else {
        setForwardStatus(`Error: ${data.error || 'Failed to forward'}`);
      }
    })
    .catch(err => setForwardStatus(`Network error: ${err.message}`));
  };

  return (
    <div className={styles.dashboard}>
      <Sidebar />
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>All Alerts</h1>
        </header>
        <div className={styles.contentGrid} style={{ display: 'block' }}>
          <section className={styles.alertSection} style={{ maxWidth: '100%' }}>
            <div className={styles.alertsList}>
              {alerts.map((alert, idx) => (
                <AlertCard 
                  key={alert.id || idx}
                  type={alert.alert_type || alert.type || 'Alert'} 
                  time={alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : (alert.time || '')} 
                  severity={alert.severity || 'medium'} 
                  snapshot={alert.snapshot}
                  studentName={alert.student_name}
                  studentId={alert.student_id}
                  onStudentClick={fetchStudentDetails}
                  onCardClick={handleAlertClick}
                  fullAlert={alert}
                  description={alert.description}
                />
              ))}
              {alerts.length === 0 && <p>No alerts in the system.</p>}
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
                  src={`${import.meta.env.VITE_API_URL || 'https://classguard-backend-4php.onrender.com'}${studentDetails.photo}`} 
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

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '2rem', borderRadius: '8px', 
            maxWidth: '600px', width: '100%', position: 'relative'
          }}>
            <button 
              onClick={closeAlertModal} 
              style={{ position: 'absolute', top: '10px', right: '15px', border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              &times;
            </button>
            <h2 style={{marginTop: 0, marginBottom: '1.5rem'}}>Alert Details</h2>
            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              {selectedAlert.snapshot && (
                <div style={{width: '100%', textAlign: 'center', backgroundColor: '#f0f0f0', borderRadius: '8px', padding: '1rem'}}>
                  <img 
                    src={selectedAlert.snapshot.startsWith('http') ? selectedAlert.snapshot : `${import.meta.env.VITE_API_URL || 'https://classguard-backend-4php.onrender.com'}${selectedAlert.snapshot}`} 
                    alt="Alert Snapshot" 
                    style={{maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '4px'}} 
                  />
                </div>
              )}
              {selectedAlert.student_photo && (
                <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem'}}>
                  <img 
                    src={selectedAlert.student_photo.startsWith('http') ? selectedAlert.student_photo : `${import.meta.env.VITE_API_URL || 'https://classguard-backend-4php.onrender.com'}${selectedAlert.student_photo}`} 
                    alt="Registered Face" 
                    style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #ddd'}} 
                  />
                  <div>
                    <span style={{fontSize: '0.85rem', color: '#6b7280', display: 'block'}}>Registered Face</span>
                    <strong>{selectedAlert.student_name}</strong>
                  </div>
                </div>
              )}
              <div>
                <p><strong>Type:</strong> <span style={{textTransform: 'capitalize'}}>{formatType(selectedAlert.alert_type || selectedAlert.type)}</span></p>
                <p><strong>Time:</strong> {selectedAlert.created_at ? new Date(selectedAlert.created_at).toLocaleString() : (selectedAlert.time || '')}</p>
                <p><strong>Severity:</strong> <span style={{textTransform: 'capitalize', color: selectedAlert.severity === 'high' ? 'red' : 'orange'}}>{selectedAlert.severity || 'medium'}</span></p>
                <p><strong>Description:</strong> {selectedAlert.description || 'No description available'}</p>
                {selectedAlert.student_name && <p><strong>Student Recognized:</strong> {selectedAlert.student_name}</p>}
                <p><strong>Camera:</strong> {selectedAlert.camera || 'Main Camera'}</p>
              </div>
              
              <hr style={{ border: '1px solid #eee', margin: '1rem 0' }} />
              
              <div>
                <h3 style={{marginTop: 0, marginBottom: '0.5rem'}}>Forward Alert</h3>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="radio" 
                      name="channel" 
                      value="whatsapp" 
                      checked={messageChannel === 'whatsapp'} 
                      onChange={(e) => setMessageChannel(e.target.value)} 
                    />
                    WhatsApp
                  </label>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="radio" 
                      name="channel" 
                      value="sms" 
                      checked={messageChannel === 'sms'} 
                      onChange={(e) => setMessageChannel(e.target.value)} 
                    />
                    SMS
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <select 
                    value={selectedForwardStaff} 
                    onChange={e => setSelectedForwardStaff(e.target.value)}
                    style={{ padding: '0.5rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="">-- Select Staff --</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => handleForwardAlert(false)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Send to Staff
                  </button>
                </div>
                
                {selectedAlert.student_id && (
                  <div style={{ marginBottom: '1rem' }}>
                    <button 
                      onClick={() => handleForwardAlert(true)}
                      style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
                    >
                      Smart Route to Current Class Teacher
                    </button>
                  </div>
                )}
                
                {forwardStatus && (
                  <div style={{ padding: '0.5rem', backgroundColor: forwardStatus.includes('Error') ? '#fee2e2' : '#d1fae5', color: forwardStatus.includes('Error') ? '#991b1b' : '#065f46', borderRadius: '4px' }}>
                    {forwardStatus}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
