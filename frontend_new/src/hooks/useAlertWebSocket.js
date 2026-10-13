import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook to connect to the ClassGuard alert WebSocket channel.
 * Receives real-time alerts pushed from the backend and triggers the onAlert callback.
 * Automatically reconnects with exponential backoff on disconnect.
 *
 * @param {Function} onAlert - Callback invoked with alert payload when a new alert arrives
 * @returns {{ isConnected: boolean }}
 */
export default function useAlertWebSocket(onAlert) {
  const [isConnected, setIsConnected] = useState(false);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectDelayRef = useRef(2000);
  const failureCountRef = useRef(0);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isUnmountedRef.current = false;

    function connect() {
      if (isUnmountedRef.current) return;

      const token = localStorage.getItem('access');
      if (!token) {
        // Not logged in yet
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/alerts/?token=${encodeURIComponent(token)}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmountedRef.current) {
            ws.close();
            return;
          }
          setIsConnected(true);
          failureCountRef.current = 0;
          reconnectDelayRef.current = 2000;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.alert && onAlertRef.current) {
              onAlertRef.current(data.alert);
            }
          } catch (err) {
            console.error('Failed to parse WebSocket alert message:', err);
          }
        };

        ws.onerror = () => {
          // Handled gracefully in onclose
        };

        ws.onclose = (event) => {
          setIsConnected(false);
          wsRef.current = null;

          // Do not reconnect if unmounted or if authentication failed (4001)
          if (isUnmountedRef.current || event.code === 4001) {
            return;
          }

          failureCountRef.current += 1;
          if (failureCountRef.current > 5) {
            // After 5 consecutive connection failures, relax to 30s
            // (REST polling fallback continues to keep alerts updated)
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, 30000);
            return;
          }

          // Exponential backoff reconnect (up to 15 seconds)
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(delay * 1.5, 15000);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };
      } catch (err) {
        console.warn('Could not establish WebSocket:', err);
      }
    }

    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore close errors
        }
        wsRef.current = null;
      }
    };
  }, []);

  return { isConnected };
}
