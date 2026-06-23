# Omni Claude — Multi-Model AI Chat Assistant

A self-hosted web chat app that connects to multiple AI model providers through a unified interface.

## Features

- **Multi-model support**: DeepSeek V4 Pro, Qwen Max, Doubao Pro
- **Streaming responses**: Real-time token-by-token output via SSE
- **Bring your own API key**: No backend API key storage — keys stay in the browser session
- **JWT session management**: Secure token-based session with 24h expiry
- **Docker deployment**: Single `docker-compose up` to run everything
- **Production-ready**: Nginx reverse proxy, CORS, health checks, Render blueprint

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Python FastAPI + httpx streaming |
| Auth | JWT (HS256) |
| Deploy | Docker + Docker Compose + Render + Vercel |
| Reverse Proxy | Nginx |

## Quick Start

```bash
# Clone and run
git clone https://github.com/ZJW0420/omni-claude.git
cd omni-claude
docker-compose up -d
```

Then open `http://localhost:8000`, select a model, paste your API key, and start chatting.

## Manual Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## How It Works

1. User selects a model and enters their own API key
2. Backend creates a signed JWT session token
3. Chat requests flow through the backend, which proxies to the selected model provider
4. Responses are streamed back to the frontend via Server-Sent Events

No API keys are stored on the server — they live only in the browser session.

## License

MIT
