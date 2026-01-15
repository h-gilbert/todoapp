# Todo App

A full-featured todo application with Vue 3 frontend, Node.js/Express backend, and iOS mobile app.

## Features

- **Project Management**: Organize tasks into projects and sections
- **Task Management**: Create, edit, complete, and delete tasks
- **Subtasks**: Break down tasks into subtasks for better organization
- **Labels & Tags**: Categorize tasks with customizable labels
- **File Attachments**: Attach images and documents to tasks
- **Search**: Global search across all projects and tasks
- **Archive**: Archive completed projects and tasks
- **Sharing**: Share projects with other users
- **Multi-platform**: Web app + iOS native app with shared backend

## Tech Stack

- **Frontend**: Vue 3, Vite, Pinia, Vue Router
- **Backend**: Node.js 18, Express 5
- **Database**: SQLite
- **Mobile**: iOS (Swift/SwiftUI)
- **Containerization**: Docker with Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Development Mode

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/todo-app.git
cd todo-app

# Start backend
cd backend
npm install
npm run dev

# In another terminal, start frontend
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5176` and the backend API at `http://localhost:3500`.

### Docker Mode

```bash
docker-compose up
```

This starts both frontend (port 3001) and backend (port 3500).

## Project Structure

```
todo-app/
├── frontend/           # Vue 3 + Vite frontend
│   ├── src/
│   │   ├── components/ # Vue components
│   │   ├── views/      # Page views
│   │   ├── stores/     # Pinia stores
│   │   └── router/     # Vue Router config
│   └── vite.config.js
├── backend/            # Express API server
│   ├── server.js       # Main server file
│   ├── database.js     # SQLite database setup
│   └── data/           # Database files (gitignored)
├── iOS/                # Swift/SwiftUI mobile app
│   └── TodoApp/
├── docker-compose.yml
└── nginx.conf
```

## API Endpoints

### Authentication
- `POST /api/login` - Login/register user
- `POST /api/refresh` - Refresh access token
- `POST /api/logout` - Logout user

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Sections
- `GET /api/projects/:id/sections` - List sections in project
- `POST /api/sections` - Create section
- `PUT /api/sections/:id` - Update section
- `DELETE /api/sections/:id` - Delete section

### Tasks
- `GET /api/sections/:id/tasks` - List tasks in section
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3500 |
| `NODE_ENV` | Environment | development |
| `JWT_SECRET` | JWT signing secret | (random) |
| `CORS_ORIGIN` | Production CORS origin | - |

### Frontend
Configure in `vite.config.js`:
- Dev server port: 5176
- API proxy target: http://localhost:3500

## iOS App

See [iOS/SETUP_COMPLETE.md](iOS/SETUP_COMPLETE.md) for iOS app setup instructions.

The iOS app connects to the same backend as the web app, so accounts and data are shared across platforms.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment instructions.

## Security Features

- JWT-based authentication with refresh tokens
- CSRF protection using double-submit cookie pattern
- Rate limiting on API endpoints
- Helmet.js security headers
- Password hashing with bcrypt
- Input validation and sanitization

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.
