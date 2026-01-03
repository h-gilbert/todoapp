# Todo App

## Project Overview
Full-featured todo application with Vue 3 frontend, Node.js/Express backend, iOS mobile app, and MCP server integration for Claude Code.

## Tech Stack
- **Frontend**: Vue 3, Vite, Pinia, Vue Router
- **Backend**: Node.js 18, Express 5
- **Database**: SQLite
- **Mobile**: iOS (Swift)
- **Web Server**: Nginx (production)
- **Containerization**: Docker with Docker Compose

## Port Configuration

| Service | Port | Description |
|---------|------|-------------|
| Frontend (Dev) | 5176 | Vite dev server |
| Frontend (Docker) | 3001 | Nginx serving build |
| Backend API | 3500 | Express server |
| iOS API Target | 3500 | Same as backend |

## Running Locally

### Development Mode
```bash
# Start backend
cd backend && npm run dev

# Start frontend (in another terminal)
cd frontend && npm run dev
```

### Docker Mode
```bash
docker-compose up
```

### Production Docker
```bash
docker-compose -f docker-compose.production.yml up
```

## Environment Variables

### Backend
- `PORT`: 3500 (configured in server.js)
- `NODE_ENV`: development/production
- `TZ`: Pacific/Auckland

### Frontend (vite.config.js)
- Dev server port: 5176
- API proxy target: http://localhost:3500

## Docker Services
- **frontend**: Nginx on port 3001
- **backend**: Express on port 3500

## Project Structure
```
todo-app/
├── frontend/          # Vue 3 + Vite
├── backend/           # Express API
│   └── data/          # SQLite database
├── iOS/               # Swift mobile app
├── mcp-server/        # Claude Code integration
├── docker-compose.yml
├── docker-compose.production.yml
└── nginx.conf
```

## MCP Server Integration
The MCP server allows Claude Code to interact with todos:
- Production URL: https://todo.hamishgilbert.com
- Local URL: http://localhost:3500

## Notes
- Uses SQLite for simplicity (no external database service needed)
- Frontend port changed from 5173 to 5176 to avoid conflicts
- Backend runs on 3500 which is unique across all projects
- iOS app connects to 192.168.1.28:3500 for local network testing
