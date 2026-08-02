import { useState, useEffect, useRef, useCallback } from 'react';

const useWebcam = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [isActive, setIsActive] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const getDevices = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      setError('Media devices not supported in this browser.');
      return;
    }

    try {
      let mediaDevices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = mediaDevices.filter(d => d.kind === 'videoinput');

      // Request temporary stream to get device labels if they are missing
      if (videoDevices.length > 0 && !videoDevices[0].label) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach(track => track.stop());
          
          mediaDevices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = mediaDevices.filter(d => d.kind === 'videoinput');
        } catch (permissionErr) {
          console.warn('Permission denied for temporary stream to fetch labels', permissionErr);
        }
      }

      const formattedDevices = videoDevices.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${index + 1}`
      }));

      setDevices(formattedDevices);
      
      // If no device is currently selected, default to the first one available
      setSelectedDeviceId(prev => {
        if (!prev && formattedDevices.length > 0) {
          return formattedDevices[0].deviceId;
        }
        return prev;
      });

    } catch (err) {
      console.error('Error enumerating devices:', err);
      setError('Failed to enumerate devices.');
    }
  }, []);

  useEffect(() => {
    getDevices();

    // Listen for changes in connected media devices (e.g., plugging in a USB webcam)
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', getDevices);
      
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', getDevices);
      };
    }
  }, [getDevices]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError('');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Media devices not supported in this browser.');
      return;
    }

    try {
      const constraints = {
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setIsActive(true);
      
      // Device labels might become available after a successful getUserMedia call
      getDevices();
    } catch (err) {
      console.error('Error starting camera:', err);
      setError(err.message || 'Failed to start camera.');
      setIsActive(false);
    }
  }, [selectedDeviceId, stopCamera, getDevices]);

  useEffect(() => {
    // Automatically switch the camera if selectedDeviceId changes while active
    if (isActive && selectedDeviceId) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    videoRef,
    stream,
    startCamera,
    stopCamera,
    error,
    isActive
  };
};

export default useWebcam;
