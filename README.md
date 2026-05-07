# ChatApp — Real-time Messaging App

A full-stack real-time chat app built with React + Node.js + Socket.io.

## Project Structure

```
chat-app/
├── .gitignore
├── README.md
├── server/
│   ├── index.js
│   ├── package.json
│   └── .env.example
└── client/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env                  ← local dev (empty VITE_SERVER_URL)
    ├── .env.production       ← production (Render URL)
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx
        ├── context/AuthContext.jsx
        ├── hooks/useSocket.js
        └── pages/
            ├── AuthPage.jsx
            └── ChatPage.jsx
```

## Run Locally

```bash
# Terminal 1 - Backend
cd server
npm install
npm run dev

# Terminal 2 - Frontend
cd client
npm install
npm run dev
```

Open http://localhost:5173

## Deploy

### Backend → Render
- New Web Service
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `node index.js`
- Environment Variable: `JWT_SECRET=your_secret_here`

### Frontend → Vercel
- New Project → import repo
- Root Directory: `client`
- Framework: Vite
- Environment Variable: `VITE_SERVER_URL=https://chat-app-server.onrender.com`

## Update After Changes

```bash
git add .
git commit -m "your change description"
git push
```

Render and Vercel redeploy automatically.
