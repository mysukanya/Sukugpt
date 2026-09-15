# SukuGPT - Beginner-Friendly AI Chatbot 🤖✨

SukuGPT is a full-stack AI chatbot application built with React, Node.js/Express, and Google's official Gemini AI SDK (`@google/genai`).

---

## 📁 Project Structure

```
sukugpt/
├── backend/                  # Node.js & Express server
│   ├── .env                 # Secret API keys (Keep this private!)
│   ├── .env.example         # Example template for .env
│   ├── package.json         # Backend dependencies & scripts
│   └── server.js            # Express API server connecting to Gemini
├── frontend/                 # React + Vite application
│   ├── index.html           # HTML entry page
│   ├── package.json         # Frontend dependencies & scripts
│   ├── vite.config.js       # Vite development server config
│   └── src/
│       ├── App.jsx          # Main chat interface and logic
│       ├── App.css          # Styling & animations for the chatbot
│       ├── index.css        # Base styling and color design system
│       └── main.jsx         # React mounting entry point
└── .gitignore               # Ensures secret .env files are never uploaded
```

---

## 🚀 How to Run SukuGPT (Step-by-Step)

### Step 1: Add Your Free Gemini API Key
1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open the file `backend/.env`.
3. Replace `your_api_key_here` with your real API key:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualKeyHere
   PORT=5000
   ```

---

### Step 2: Start the Backend Server
Open a terminal in the project root and run:
```bash
cd backend
npm install
npm run dev
```
You will see:
```
🚀 SukuGPT Backend is running on port 5000
👉 Health check: http://localhost:5000/api/health
✅ Gemini API key is configured!
```

---

### Step 3: Start the Frontend React App
Open a **second terminal window** (keep the backend running in the first one) and run:
```bash
cd frontend
npm install
npm run dev
```
This will start the React app at `http://localhost:3000` (or `http://localhost:5173`) and open it in your browser.

---

## 💡 How SukuGPT Works (Explained for Beginners)

1. **You type a message** in the frontend React input box and press **Enter** (or click **Send**).
2. The React frontend sends your message along with previous chat history to your **Node.js backend** (`POST http://localhost:5000/api/chat`).
3. Your **Node.js backend** reads your secure `GEMINI_API_KEY` from the `.env` file and calls Google's Gemini AI using `@google/genai`.
4. Gemini processes your conversation and generates an intelligent reply.
5. The backend receives the reply and sends it back to your React frontend.
6. The frontend displays the AI's response in real-time with clean Markdown formatting!

---

## 🛡️ Security
* **Your API Key is 100% safe**: It is stored only on the backend in `backend/.env`. The frontend never has access to the raw key, preventing it from being leaked to users or web browsers.
* `.gitignore` prevents `.env` and `node_modules` from ever being accidentally pushed to GitHub.
