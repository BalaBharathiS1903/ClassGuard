import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import TeacherDashboard from './pages/TeacherDashboard';
import Cameras from './pages/Cameras';
import Alerts from './pages/Alerts';
import Students from './pages/Students';
import Staff from './pages/Staff';
import FaceRegistration from './pages/FaceRegistration';

function RequireAuth({ children }) {
  return localStorage.getItem('access') ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<RequireAuth><TeacherDashboard /></RequireAuth>} />
        <Route path="/cameras" element={<RequireAuth><Cameras /></RequireAuth>} />
        <Route path="/alerts" element={<RequireAuth><Alerts /></RequireAuth>} />
        <Route path="/students" element={<RequireAuth><Students /></RequireAuth>} />
        <Route path="/staff" element={<RequireAuth><Staff /></RequireAuth>} />
        <Route path="/registration" element={<RequireAuth><FaceRegistration /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
