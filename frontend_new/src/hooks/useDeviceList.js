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
      const onlineDevices = formattedDevices.filter(d => d.status !== 'offline');
      // Show online cameras if available, otherwise show all cameras so user can interact/view them
      setDevices(onlineDevices.length > 0 ? onlineDevices : formattedDevices);
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
