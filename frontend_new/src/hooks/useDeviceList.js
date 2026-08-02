import { useState, useEffect, useCallback } from 'react';
import authFetch from '../utils/authFetch';

const useDeviceList = () => {
  const [devices, setDevices] = useState([]);
  const [allDevices, setAllDevices] = useState([]);

  const getDevices = useCallback(async () => {
    try {
      const response = await authFetch('/api/v1/cameras/');
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      
      const formattedDevices = data.map((camera) => ({
        deviceId: camera.id,
        label: camera.name || `Camera ${camera.id}`,
        status: camera.status || 'online',
        rtspUrl: camera.rtsp_url,
      }));

      setAllDevices(formattedDevices);
      // Only show cameras that are online or in maintenance (not offline)
      setDevices(formattedDevices.filter(d => d.status !== 'offline'));
    } catch (err) {
      console.error('Error fetching cameras:', err);
    }
  }, []);

  useEffect(() => {
    getDevices();
  }, [getDevices]);

  return { devices, allDevices, refreshDevices: getDevices };
};

export default useDeviceList;
