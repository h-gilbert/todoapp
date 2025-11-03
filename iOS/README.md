# Todo App - iOS

This is the iOS version of the Todo App that connects to the shared backend.

## Features

- User authentication (username-based login)
- Project management
- Section organization within projects
- Task management with descriptions
- Task completion tracking
- Pull-to-refresh for data updates
- Shared backend with web app

## Setup Instructions

### 1. Backend Setup

Make sure your backend server is running:

```bash
cd ../backend
npm start
```

The backend should be running on `http://localhost:3000`

### 2. iOS App Configuration

The iOS app is configured to connect to `http://localhost:3000` by default. This works for the iOS Simulator.

**For testing on a physical device:**

1. Find your computer's local IP address:
   - Mac: System Settings > Network > Your connection (IP address shown)
   - Or run in terminal: `ipconfig getifaddr en0`

2. Update the API base URL in `APIService.swift`:
   ```swift
   private let baseURL = "http://YOUR_LOCAL_IP:3000/api"
   ```
   For example: `http://192.168.1.100:3000/api`

### 3. App Transport Security

The app is configured to allow HTTP connections to localhost for development. If you need to connect to other non-HTTPS servers, you'll need to update the Info.plist with App Transport Security exceptions.

To add this in Xcode:
1. Open the project in Xcode
2. Select the TodoApp target
3. Go to the "Info" tab
4. Add a new key: "App Transport Security Settings"
5. Add a dictionary item under it: "Allow Arbitrary Loads" set to YES (only for development)

### 4. Adding Files to Xcode

All Swift files have been created in the TodoApp directory. To add them to your Xcode project:

1. Open `TodoApp.xcodeproj` in Xcode
2. In the Project Navigator, right-click on the "TodoApp" folder
3. Select "Add Files to TodoApp..."
4. Select all the following files:
   - `Models.swift`
   - `APIService.swift`
   - `AuthManager.swift`
   - `LoginView.swift`
   - `ProjectListView.swift`
   - `ProjectDetailView.swift`
   - `SectionDetailView.swift`
5. Make sure "Copy items if needed" is unchecked (files are already in the right location)
6. Make sure "TodoApp" target is checked
7. Click "Add"

**Note:** `TodoAppApp.swift` has already been updated with the authentication flow.

### 5. Build and Run

1. Select a simulator or your device
2. Press Cmd+R to build and run
3. Enter a username to login (any username works, accounts are created automatically)

## Project Structure

```
TodoApp/
├── TodoAppApp.swift          # App entry point with auth flow
├── Models.swift              # Data models matching backend API
├── APIService.swift          # Networking layer for backend communication
├── AuthManager.swift         # Authentication state management
├── LoginView.swift           # Login screen
├── ProjectListView.swift     # List of all projects
├── ProjectDetailView.swift   # List of sections in a project
└── SectionDetailView.swift   # List of tasks in a section
```

## API Endpoints Used

The app uses the following backend endpoints:

- `POST /api/users/login` - Login/create user
- `GET /api/users/:userId/projects` - Get user's projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/:projectId/sections` - Get sections
- `POST /api/sections` - Create section
- `PUT /api/sections/:id` - Update section
- `DELETE /api/sections/:id` - Delete section
- `GET /api/sections/:sectionId/tasks` - Get tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Architecture

The app follows a modern SwiftUI architecture:

- **Models**: Codable structs matching the backend API responses
- **Services**: `APIService` handles all network requests with async/await
- **State Management**: `@StateObject` and `@Published` for reactive UI updates
- **Views**: SwiftUI views with ViewModels using `ObservableObject`
- **Authentication**: Centralized `AuthManager` singleton for user state

## Features to Add Later

These features are available in the backend but not yet implemented in the iOS app:

- [ ] Task photos (upload and display)
- [ ] Search functionality (global and project-specific)
- [ ] Task reordering
- [ ] Section reordering
- [ ] Project reordering
- [ ] Archive/unarchive functionality
- [ ] Programmatic task completion
- [ ] Task moving between sections

## Troubleshooting

### Cannot connect to backend

1. Make sure the backend is running: `cd ../backend && npm start`
2. Check the console for the exact error message
3. Verify the URL in `APIService.swift` matches your backend address
4. For physical devices, use your computer's local IP instead of localhost

### Build errors

1. Make sure all Swift files are added to the Xcode project (see step 4 above)
2. Clean build folder: Product > Clean Build Folder (Cmd+Shift+K)
3. Rebuild the project

### "The data couldn't be read because it isn't in the correct format"

This usually means there's a mismatch between the API response and the model. Check:
1. Backend is running the latest version
2. Network tab in Xcode console for the actual API response
