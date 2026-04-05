# 🌌 Virtual Cosmos

[![Live Demo](https://img.shields.io/badge/Live_Demo-Play_Now-0ea5e9?style=for-the-badge)](https://virtual-cosmos-three.vercel.app/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://pixijs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

**Virtual Cosmos** is a real-time, spatial communication environment. It allows users to log in, navigate a 2D WebGL-rendered arena, and communicate seamlessly via WebSockets—but with a twist: **you can only chat with users who are within your physical proximity radius.**

It was built as a Minimum Viable Product (MVP) to demonstrate proficiency in Full-Stack architecture, high-performance web rendering, and real-time bidirectional networking.

---

## 🚀 Live Links

- **Frontend (Client):** [virtual-cosmos-three.vercel.app](https://virtual-cosmos-three.vercel.app/)
- **Backend (API/Sockets):** [virtual-cosmos-5o0a.onrender.com](https://virtual-cosmos-5o0a.onrender.com/)

---

## ✨ Key Features

- **Spatial Proximity Filtering:** Messages are dynamically filtered using Euclidean distance. Chat activates only within a 120px radius.
- **Smooth Network Interpolation (LERP):** Remote avatars move smoothly instead of teleporting.
- **Hardware-Accelerated Rendering:** Built with **PixiJS (v8)** for smooth 60FPS WebGL rendering.
- **Real-Time WebSockets:** Powered by `Socket.io` with sub-100ms latency.
- **Typing Indicators:** WhatsApp-style real-time typing bubbles.
- **Parallax Starfield Engine:** Animated 150-star background for 3D depth effect.
- **Persistent Sessions & Stats:** MongoDB integration for tracking user activity.

---

## 🛠️ Technology Stack

### Frontend
- **React + Vite**
- **PixiJS**
- **Tailwind CSS**
- **Socket.io-Client**

### Backend
- **Node.js & Express**
- **Socket.io**
- **MongoDB & Mongoose**

### Deployment
- **Vercel** (Frontend)
- **Render** (Backend)

---

## 🧠 System Architecture

1. **Game Loop:** PixiJS ticker runs at 60 FPS, processes input, updates positions, and emits `(X,Y)` to server.
2. **LERP System:** Smooth interpolation toward `targetX` and `targetY` to reduce lag.
3. **Proximity Engine:** Calculates distance; enables chat if `distance < 120`.

---

## 💻 Local Development Setup

### Prerequisites
- Node.js
- MongoDB Atlas account

---

### 1. Clone the repository

```bash
git clone https://github.com/harshtadas8/Virtual_Cosmos.git
cd Virtual_Cosmos
```

---

### 2. Setup Backend

```bash
cd server
npm install
```

Create `.env` file:

```
MONGO_URI=mongodb+srv://<your_username>:<your_password>@cluster0.xxxxx.mongodb.net/virtual_cosmos?retryWrites=true&w=majority
PORT=3000
```

Run backend:

```bash
npm run dev
```

Server runs on:
```
http://localhost:3000
```

---

### 3. Setup Frontend

```bash
cd client
npm install
```

⚠️ Ensure API URLs in `App.jsx` point to:
```
http://localhost:3000
```

Run frontend:

```bash
npm run dev
```

Client runs on:
```
http://localhost:5173
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the issues page.
