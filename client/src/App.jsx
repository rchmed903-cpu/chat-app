import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";

function AppRoutes() {
  const { token } = useAuth();
  
  // Simple: if no token, show auth. If token, show chat.
  if (!token) return <AuthPage />;
  return <ChatPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}