import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Socket.io ulanishini React komponenti hayoti bilan bog'laydigan hook.
//
// handlers — { event: fn } ko'rinishidagi obyekt. U har renderда yangi
// obyekt bo'lishi mumkin, shuning uchun ref orqali saqlanadi va ulanish
// qayta-qayta uzilib-ulanib ketmaydi.
//
// onReconnect — aloqa tiklanganda chaqiriladi. Uzilish paytida o'tkazib
// yuborilgan hodisalarni qoplash uchun ro'yxatni qayta yuklash kerak.
export function useSocket(token, handlers, onReconnect) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  const reconnectRef = useRef(onReconnect);
  const socketRef = useRef(null);

  handlersRef.current = handlers;
  reconnectRef.current = onReconnect;

  useEffect(() => {
    if (!token) return undefined;

    const socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connected', () => setConnected(true));
    socket.io.on('reconnect', () => {
      setConnected(true);
      if (reconnectRef.current) reconnectRef.current();
    });

    socket.onAny((event, payload) => {
      const fn = handlersRef.current && handlersRef.current[event];
      if (fn) fn(payload);
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [token]);

  return { connected, socket: socketRef };
}
