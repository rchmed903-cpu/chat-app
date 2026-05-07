import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

let socketInstance = null;

export function useSocket(token) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    if (!socketInstance) {
      socketInstance = io(SERVER_URL, {
        auth: { token },
        transports: ["websocket"],
      });
    }

    socketRef.current = socketInstance;
  }, [token]);

  return socketRef;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
