import React from 'react';
import { LayoutDashboard, Camera, AlertTriangle, Users, UserPlus, Briefcase, LogOut } from 'lucide-react';
import styles from './Sidebar.module.css';
import logoImage from '../assets/logoclass.png';
import { useLocation, Link, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    navigate('/login');
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src={logoImage} alt="ClassGuard Logo" style={{ width: '80px', height: 'auto' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>ClassGuard</span>
          <span style={{ fontFamily: "'Bodoni Moda', serif", fontSize: '0.65rem', color: '#9ca3af', marginTop: '2px', lineHeight: '1.2' }}>St. James Matriculation<br/>Higher Secondary School</span>
        </div>
      </div>
      <nav className={styles.nav}>
        <Link to="/dashboard" className={`${styles.navItem} ${location.pathname === '/dashboard' ? styles.active : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link to="/cameras" className={`${styles.navItem} ${location.pathname === '/cameras' ? styles.active : ''}`}>
          <Camera size={20} />
          <span>Cameras</span>
        </Link>
        <Link to="/alerts" className={`${styles.navItem} ${location.pathname === '/alerts' ? styles.active : ''}`}>
          <AlertTriangle size={20} />
          <span>Alerts</span>
        </Link>
        <Link to="/students" className={`${styles.navItem} ${location.pathname === '/students' ? styles.active : ''}`}>
          <Users size={20} />
          <span>Students</span>
        </Link>
        <Link to="/staff" className={`${styles.navItem} ${location.pathname === '/staff' ? styles.active : ''}`}>
          <Briefcase size={20} />
          <span>Staff</span>
        </Link>
        <Link to="/registration" className={`${styles.navItem} ${location.pathname === '/registration' ? styles.active : ''}`}>
          <UserPlus size={20} />
          <span>Face Registration</span>
        </Link>
      </nav>
      <div style={{ marginTop: 'auto', paddingBottom: '1rem' }}>
        <button 
          onClick={handleLogout}
          className={styles.navItem} 
          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit', fontSize: '1rem' }}
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
