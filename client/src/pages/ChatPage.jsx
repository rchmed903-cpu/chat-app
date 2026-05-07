import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useSocket, disconnectSocket } from "../hooks/useSocket";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_SERVER_URL || "";

function getAvatarColor(username) {
  const colors = [
    "bg-teal-600", "bg-purple-600", "bg-rose-500",
    "bg-blue-600", "bg-amber-500", "bg-emerald-600",
  ];
  let sum = 0;
  for (const c of username) sum += c.charCodeAt(0);
  return colors[sum % colors.length];
}

function getInitials(username) {
  return username.slice(0, 2).toUpperCase();
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const socketRef = useSocket(token);

  const [contacts, setContacts] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [unread, setUnread] = useState({});

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentRoomRef = useRef(null);

  async function loadContacts() {
    try {
      const { data } = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setContacts(data);
    } catch {
      console.error("Failed to load contacts");
    }
  }

  useEffect(() => {
    loadContacts();
    const interval = setInterval(loadContacts, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on("users:online", (ids) => setOnlineIds(ids));

    socket.on("room:history", (history) => {
      setMessages(history);
    });

    socket.on("message:receive", ({ roomId, message }) => {
      if (roomId === currentRoomRef.current) {
        setMessages((prev) => [...prev, message]);
      } else if (message.senderId !== user.id) {
        setUnread((prev) => ({
          ...prev,
          [message.senderId]: (prev[message.senderId] || 0) + 1,
        }));
      }
    });

    socket.on("typing:update", ({ userId, isTyping }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    });

    return () => {
      socket.off("users:online");
      socket.off("room:history");
      socket.off("message:receive");
      socket.off("typing:update");
    };
  }, [socketRef.current]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function selectContact(contact) {
    setSelectedContact(contact);
    setMessages([]);
    setUnread((prev) => ({ ...prev, [contact.id]: 0 }));
    const socket = socketRef.current;
    if (!socket) return;
    const roomId = [user.id, contact.id].sort().join("_");
    currentRoomRef.current = roomId;
    socket.emit("room:join", contact.id);
  }

  function sendMessage() {
    const content = input.trim();
    if (!content || !selectedContact) return;
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("message:send", { toUserId: selectedContact.id, content });
    setInput("");
    socket.emit("typing:stop", { toUserId: selectedContact.id });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const handleTyping = useCallback(() => {
    if (!selectedContact) return;
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("typing:start", { toUserId: selectedContact.id });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { toUserId: selectedContact.id });
    }, 1500);
  }, [selectedContact]);

  function handleLogout() {
    disconnectSocket();
    logout();
    navigate("/auth");
  }

  const isTyping = selectedContact && typingUsers[selectedContact.id];

  return (
    <div className="h-screen flex bg-[#111b21]">
      {/* Sidebar */}
      <aside className="w-[340px] flex flex-col border-r border-[#2a3942] flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 bg-[#202c33]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold ${getAvatarColor(user.username)}`}>
              {getInitials(user.username)}
            </div>
            <span className="text-[#e9edef] font-semibold">{user.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#8696a0] hover:text-[#e9edef] text-sm px-3 py-1 rounded-lg hover:bg-[#374045] transition"
          >
            Logout
          </button>
        </div>

        <div className="px-3 py-2 bg-[#111b21]">
          <div className="flex items-center gap-2 bg-[#202c33] rounded-xl px-3 py-2">
            <svg className="w-4 h-4 text-[#8696a0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-[#8696a0] text-sm">Search contacts</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 && (
            <p className="text-center text-[#8696a0] text-sm mt-10">
              No other users yet.<br />Ask someone to register!
            </p>
          )}
          {contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => selectContact(contact)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-[#2a3942] transition text-left ${
                selectedContact?.id === contact.id ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
              }`}
            >
              <div className="relative">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getAvatarColor(contact.username)}`}>
                  {getInitials(contact.username)}
                </div>
                {(onlineIds.includes(contact.id) || contact.isOnline) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#111b21]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[#e9edef] font-medium text-sm truncate">{contact.username}</span>
                  {unread[contact.id] > 0 && (
                    <span className="bg-[#00a884] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold flex-shrink-0">
                      {unread[contact.id]}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#8696a0]">
                  {(onlineIds.includes(contact.id) || contact.isOnline) ? "online" : "offline"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col">
        {!selectedContact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-[#222e35]">
            <div className="w-24 h-24 rounded-full bg-[#374045] flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" className="w-12 h-12 fill-[#8696a0]">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5.707 7.293l-6 6a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L11 13.172l5.293-5.293a1 1 0 011.414 1.414z"/>
              </svg>
            </div>
            <h2 className="text-[#e9edef] text-xl font-light mb-2">ChatApp</h2>
            <p className="text-[#8696a0] text-sm max-w-xs">
              Select a contact from the left to start a conversation
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-[#2a3942]">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold ${getAvatarColor(selectedContact.username)}`}>
                {getInitials(selectedContact.username)}
              </div>
              <div>
                <p className="text-[#e9edef] font-medium">{selectedContact.username}</p>
                <p className="text-xs text-[#8696a0]">
                  {isTyping ? (
                    <span className="text-[#00a884]">typing...</span>
                  ) : (
                    onlineIds.includes(selectedContact.id) ? "online" : "offline"
                  )}
                </p>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-1"
              style={{ background: "#0b141a" }}
            >
              {messages.length === 0 && (
                <p className="text-center text-[#8696a0] text-sm mt-10">
                  No messages yet. Say hello! 👋
                </p>
              )}
              {messages.map((msg) => {
                const isMine = msg.senderId === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[65%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                        isMine
                          ? "bg-[#005c4b] text-[#e9edef] rounded-tr-sm"
                          : "bg-[#202c33] text-[#e9edef] rounded-tl-sm"
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p className="text-[10px] text-[#8696a0] text-right mt-1">
                        {formatTime(msg.timestamp)}
                        {isMine && (
                          <span className="ml-1 text-[#53bdeb]">✓✓</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex items-center gap-2 px-4 py-3 bg-[#202c33]">
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                onKeyDown={handleKeyDown}
                placeholder="Type a message"
                className="flex-1 bg-[#2a3942] border border-transparent focus:border-[#374045] rounded-xl px-4 py-3 text-sm text-[#e9edef] placeholder-[#8696a0] outline-none transition"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#02b48a] disabled:opacity-40 flex items-center justify-center transition flex-shrink-0"
              >
                <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
