import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import authFetch from '../utils/authFetch';
import styles from './TeacherDashboard.module.css';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', grade: '', section: '', roll_number: '', rfid_tag: '', photo: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [newStudent, setNewStudent] = useState({ name: '', grade: '', section: '', roll_number: '' });
  const fileInputRef = useRef(null);

  const fetchStudents = () => {
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
  };

  const fetchStudentDetails = (id) => {
    authFetch(`/api/v1/students/${id}/`)
      .then(res => res.json())
      .then(data => {
        setStudentDetails(data);
        setEditForm({
          name: data.name || '',
          grade: data.grade || '',
          section: data.section || '',
          roll_number: data.roll_number || '',
          rfid_tag: data.rfid_tag || '',
          photo: null
        });
        setSelectedStudentId(id);
        setIsEditing(false);
      })
      .catch(err => console.error("Error fetching student details:", err));
  };

  const closeStudentModal = () => {
    setSelectedStudentId(null);
    setStudentDetails(null);
    setIsEditing(false);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', editForm.name);
    formData.append('grade', editForm.grade);
    formData.append('section', editForm.section);
    formData.append('roll_number', editForm.roll_number);
    if (editForm.rfid_tag) formData.append('rfid_tag', editForm.rfid_tag);
    if (editForm.photo) formData.append('photo', editForm.photo);

    try {
      const res = await authFetch(`/api/v1/students/${selectedStudentId}/`, {
        method: 'PATCH',
        body: formData
      });
      if (res.ok) {
        setIsEditing(false);
        fetchStudentDetails(selectedStudentId);
        fetchStudents(); // Refresh main list
      } else {
        alert("Failed to update student details.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating student.");
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploadStatus('Uploading...');

    try {
      const res = await authFetch('/api/v1/students/bulk_upload/', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus('Upload successful!');
        fetchStudents();
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
    setUploadStatus('Adding student...');
    try {
      const res = await authFetch('/api/v1/students/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent)
      });
      if (res.ok) {
        setUploadStatus('Student added successfully!');
        setShowAddModal(false);
        setNewStudent({ name: '', grade: '', section: '', roll_number: '' });
        fetchStudents();
      } else {
        const data = await res.json();
        setUploadStatus('Add failed: ' + JSON.stringify(data));
      }
    } catch (err) {
      setUploadStatus('Add error: ' + err.message);
    }
  };

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    student.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.dashboard}>
      <Sidebar />
      <main className={styles.mainContent}>
        <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 className={styles.headerTitle}>Student Directory</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Search students..." 
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
                  <th style={{ padding: '1rem' }}>Roll Number</th>
                  <th style={{ padding: '1rem' }}>Name</th>
                  <th style={{ padding: '1rem' }}>Grade</th>
                  <th style={{ padding: '1rem' }}>Section</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem' }}>{student.roll_number}</td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>
                      <span 
                        onClick={() => fetchStudentDetails(student.id)}
                        style={{ cursor: 'pointer', color: '#3b82f6', textDecoration: 'underline' }}
                      >
                        {student.name}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>{student.grade}</td>
                    <td style={{ padding: '1rem' }}>{student.section}</td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>No students found matching your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>

      {/* Manual Add Student Modal */}
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
            <h2 style={{marginTop: 0, marginBottom: '1.5rem'}}>Add Student</h2>
            <form onSubmit={handleManualAdd} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <div>
                <label style={{display: 'block', marginBottom: '0.5rem'}}>Full Name</label>
                <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '0.5rem'}}>Roll Number</label>
                <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={newStudent.roll_number} onChange={e => setNewStudent({...newStudent, roll_number: e.target.value})} />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '0.5rem'}}>Grade (e.g. 10)</label>
                <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={newStudent.grade} onChange={e => setNewStudent({...newStudent, grade: e.target.value})} />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '0.5rem'}}>Section (e.g. A)</label>
                <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={newStudent.section} onChange={e => setNewStudent({...newStudent, section: e.target.value})} />
              </div>
              <button type="submit" style={{ padding: '0.75rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}>
                Save Student
              </button>
            </form>
          </div>
        </div>
      )}

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
            <h2 style={{marginTop: 0, marginBottom: '1.5rem'}}>
              {isEditing ? 'Edit Student' : 'Student Details'}
            </h2>
            
            {!isEditing ? (
              <>
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
                <div style={{marginTop: '1.5rem', textAlign: 'right'}}>
                  <button 
                    onClick={() => setIsEditing(true)}
                    style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Edit Details
                  </button>
                </div>
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
                  <label style={{display: 'block', marginBottom: '0.5rem'}}>Roll Number</label>
                  <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={editForm.roll_number} onChange={e => setEditForm({...editForm, roll_number: e.target.value})} />
                </div>
                <div style={{display: 'flex', gap: '1rem'}}>
                  <div style={{flex: 1}}>
                    <label style={{display: 'block', marginBottom: '0.5rem'}}>Grade</label>
                    <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={editForm.grade} onChange={e => setEditForm({...editForm, grade: e.target.value})} />
                  </div>
                  <div style={{flex: 1}}>
                    <label style={{display: 'block', marginBottom: '0.5rem'}}>Section</label>
                    <input required style={{width: '100%', padding: '0.5rem'}} type="text" value={editForm.section} onChange={e => setEditForm({...editForm, section: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '0.5rem'}}>RFID Tag (Optional)</label>
                  <input style={{width: '100%', padding: '0.5rem'}} type="text" value={editForm.rfid_tag} onChange={e => setEditForm({...editForm, rfid_tag: e.target.value})} />
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
