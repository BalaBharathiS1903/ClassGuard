import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import authFetch from '../utils/authFetch';
import styles from './TeacherDashboard.module.css';

export default function Staff() {
  const [staffList, setStaffList] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [staffDetails, setStaffDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', role: '', phone_number: '', photo: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [newStaff, setNewStaff] = useState({ name: '', role: '', phone_number: '' });
  const fileInputRef = useRef(null);
  
  // Alert simulation states
  const [showSendAlert, setShowSendAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertChannel, setAlertChannel] = useState('sms');
  const [alertStatus, setAlertStatus] = useState('');

  const fetchStaff = () => {
    authFetch('/api/v1/staff/')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStaffList(data);
        } else if (data.results) {
          setStaffList(data.results);
        }
      })
      .catch(err => console.error("Error fetching staff:", err));
  };

  const fetchStaffDetails = (id) => {
    authFetch(`/api/v1/staff/${id}/`)
      .then(res => res.json())
      .then(data => {
        setStaffDetails(data);
        setEditForm({
          name: data.name || '',
          role: data.role || '',
          phone_number: data.phone_number || '',
          photo: null
        });
        setSelectedStaffId(id);
        setIsEditing(false);
        setShowSendAlert(false);
        setAlertStatus('');
      })
      .catch(err => console.error("Error fetching staff details:", err));
  };

  const closeStaffModal = () => {
    setSelectedStaffId(null);
    setStaffDetails(null);
    setIsEditing(false);
    setShowSendAlert(false);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', editForm.name);
    formData.append('role', editForm.role);
    if (editForm.phone_number) formData.append('phone_number', editForm.phone_number);
    if (editForm.photo) formData.append('photo', editForm.photo);

    try {
      const res = await authFetch(`/api/v1/staff/${selectedStaffId}/`, {
        method: 'PATCH',
        body: formData
      });
      if (res.ok) {
        setIsEditing(false);
        fetchStaffDetails(selectedStaffId);
        fetchStaff(); 
      } else {
        alert("Failed to update staff details.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating staff.");
    }
  };

  const handleSendAlert = async (e) => {
    e.preventDefault();
    setAlertStatus('Sending...');
    try {
      const res = await authFetch(`/api/v1/staff/${selectedStaffId}/send_alert/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: alertMessage, channel: alertChannel })
      });
      const data = await res.json();
      if (res.ok) {
        setAlertStatus(data.message || 'Alert sent successfully!');
        setAlertMessage('');
      } else {
        setAlertStatus('Failed to send: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      setAlertStatus('Error: ' + err.message);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploadStatus('Uploading...');

    try {
      const res = await authFetch('/api/v1/staff/bulk_upload/', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus('Upload successful!');
        fetchStaff();
      } else {
        setUploadStatus('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      setUploadStatus('Upload error: ' + err.message);
    }
    
    // Clear input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    setUploadStatus('Adding staff...');
    try {
      const res = await authFetch('/api/v1/staff/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff)
      });
      if (res.ok) {
        setUploadStatus('Staff added successfully!');
        setShowAddModal(false);
        setNewStaff({ name: '', role: '', phone_number: '' });
        fetchStaff();
      } else {
        const data = await res.json();
        setUploadStatus('Add failed: ' + JSON.stringify(data));
      }
    } catch (err) {
      setUploadStatus('Add error: ' + err.message);
    }
  };

  const filteredStaff = staffList.filter(staff => 
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (staff.role && staff.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={styles.dashboard}>
      <Sidebar />
      <main className={styles.mainContent}>
        <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 className={styles.headerTitle}>Staff Directory</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Search staff..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minWidth: '200px' }}
            />
            <input 
              type="file" 
              accept=".csv" 
              style={{ display: 'none' }} 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => setShowAddModal(true)}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              + Manual Add
            </button>
            <button 
              onClick={() => fileInputRef.current.click()}
              style={{ padding: '0.5rem 1rem', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Bulk Registration (CSV)
            </button>
            {uploadStatus && <span style={{ fontSize: '0.9rem', color: '#666' }}>{uploadStatus}</span>}
          </div>
        </header>
        
        <div className={styles.contentGrid} style={{ display: 'block' }}>
          <section className={styles.cameraSection} style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '1rem' }}>Name</th>
                  <th style={{ padding: '1rem' }}>Role</th>
                  <th style={{ padding: '1rem' }}>Phone Number</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>
                      <span 
                        onClick={() => fetchStaffDetails(staff.id)}
                        style={{ cursor: 'pointer', color: '#3b82f6', textDecoration: 'underline' }}
                      >
                        {staff.name}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>{staff.role}</td>
                    <td style={{ padding: '1rem' }}>{staff.phone_number || 'N/A'}</td>
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ padding: '1rem', textAlign: 'center' }}>No staff found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>

      {/* Manual Add Staff Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '2rem', borderRadius: '8px', 
            maxWidth: '400px', width: '100%', position: 'relative'
          }}>
            <button 
              onClick={() => setShowAddModal(false)} 
              style={{ position: 'absolute', top: '10px', right: '15px', border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              &times;
            </button>
            <h2 style={{marginTop: 0, marginBottom: '1.5rem'}}>Add Staff</h2>
            <form onSubmit={handleManualAdd} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <div>
                <label style={{display: 'block', marginBottom: '0.5rem'}}>Full Name</label>
                <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '0.5rem'}}>Role (e.g. Teacher, Security)</label>
                <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '0.5rem'}}>Phone Number</label>
                <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={newStaff.phone_number} onChange={e => setNewStaff({...newStaff, phone_number: e.target.value})} />
              </div>
              <button type="submit" style={{ padding: '0.75rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}>
                Save Staff
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Staff Details Modal */}
      {selectedStaffId && staffDetails && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '2rem', borderRadius: '8px', 
            maxWidth: '500px', width: '100%', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <button 
              onClick={closeStaffModal} 
              style={{ position: 'absolute', top: '10px', right: '15px', border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              &times;
            </button>
            <h2 style={{marginTop: 0, marginBottom: '1.5rem'}}>
              {isEditing ? 'Edit Staff' : 'Staff Details'}
            </h2>
            
            {!isEditing ? (
              <>
                <div style={{display: 'flex', gap: '1.5rem'}}>
                  {staffDetails.photo ? (
                    <img 
                      src={`http://${window.location.hostname}:8000${staffDetails.photo}`} 
                      alt={staffDetails.name} 
                      style={{width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px'}} 
                    />
                  ) : (
                    <div style={{width: '120px', height: '120px', backgroundColor: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      No Photo
                    </div>
                  )}
                  <div>
                    <p><strong>Name:</strong> {staffDetails.name}</p>
                    <p><strong>Role:</strong> {staffDetails.role}</p>
                    <p><strong>Phone:</strong> {staffDetails.phone_number}</p>
                    <p><strong>Registered on:</strong> {new Date(staffDetails.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {!showSendAlert ? (
                  <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
                    <button 
                      onClick={() => setShowSendAlert(true)}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Send Alert
                    </button>
                    <button 
                      onClick={() => setIsEditing(true)}
                      style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Edit Details
                    </button>
                  </div>
                ) : (
                  <div style={{marginTop: '1.5rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '4px'}}>
                    <h3 style={{marginTop: 0}}>Send Alert to {staffDetails.name}</h3>
                    <form onSubmit={handleSendAlert} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                      <div>
                        <label style={{display: 'block', marginBottom: '0.5rem'}}>Message</label>
                        <textarea 
                          required 
                          rows="3" 
                          style={{width: '100%', padding: '0.5rem'}} 
                          value={alertMessage} 
                          onChange={(e) => setAlertMessage(e.target.value)} 
                          placeholder="Type alert message here..."
                        />
                      </div>
                      <div>
                        <label style={{display: 'block', marginBottom: '0.5rem'}}>Channel</label>
                        <select 
                          value={alertChannel} 
                          onChange={(e) => setAlertChannel(e.target.value)} 
                          style={{width: '100%', padding: '0.5rem'}}
                        >
                          <option value="sms">SMS</option>
                          <option value="whatsapp">WhatsApp</option>
                        </select>
                      </div>
                      {alertStatus && <div style={{ color: alertStatus.includes('Error') || alertStatus.includes('Failed') ? 'red' : 'green' }}>{alertStatus}</div>}
                      <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
                        <button type="button" onClick={() => setShowSendAlert(false)} style={{ padding: '0.5rem 1rem', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Send {alertChannel.toUpperCase()}</button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={handleEditSave} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                <div>
                  <label style={{display: 'block', marginBottom: '0.5rem'}}>Profile Photo</label>
                  <input type="file" accept="image/*" onChange={e => setEditForm({...editForm, photo: e.target.files[0]})} />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '0.5rem'}}>Full Name</label>
                  <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '0.5rem'}}>Role</label>
                  <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '0.5rem'}}>Phone Number</label>
                  <input style={{width: '100%', padding: '0.5rem'}} type="text" value={editForm.phone_number} onChange={e => setEditForm({...editForm, phone_number: e.target.value})} />
                </div>
                <div style={{display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end'}}>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '0.5rem 1rem', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save Changes</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
