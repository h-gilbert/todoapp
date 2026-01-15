# iOS Todo App - Setup Guide

## Status: Ready to Build

The iOS Todo App is ready to build and run in Xcode.

## Features

### Core Features:
- User authentication (username-based login with persistence)
- Project management (create, view, delete)
- Section management within projects
- Task management (create, edit, toggle, delete)
- Pull-to-refresh on all screens
- Swipe-to-delete functionality
- Native iOS UI with SwiftUI
- Shared backend with web app

### Files:
1. **Models.swift** - Data models (User, Project, Section, TodoTask, etc.)
2. **APIService.swift** - Complete networking layer with async/await
3. **AuthManager.swift** - Authentication state management
4. **LoginView.swift** - Login screen
5. **ProjectListView.swift** - Projects list
6. **ProjectDetailView.swift** - Sections in a project
7. **SectionDetailView.swift** - Tasks in a section
8. **TodoAppApp.swift** - App entry point

## How to Run

### 1. Start the Backend

Open a terminal and run:
```bash
cd backend
npm start
```

The backend should start on `http://localhost:3500`

### 2. Run the iOS App

1. Open `iOS/TodoApp/TodoApp.xcodeproj` in Xcode
2. Select a simulator (e.g., iPhone 15)
3. Press Cmd+R to build and run
4. The app will launch in the simulator

### 3. Using the App

1. **Login**: Enter any username (accounts are created automatically)
2. **Create Project**: Tap the + button in the top right
3. **Add Sections**: Tap on a project, then tap + to add sections
4. **Add Tasks**: Tap on a section, then tap + to add tasks
5. **Complete Tasks**: Tap the circle icon to mark tasks as complete
6. **Delete Items**: Swipe left on any item to delete

## App Configuration

### API Connection
- **Default**: `http://localhost:3500/api`
- **Location**: `APIService.swift` line 20
- **For Physical Devices**: Change to your computer's local IP address (e.g., `http://192.168.1.100:3500/api`)

### Finding Your Local IP
```bash
ipconfig getifaddr en0
```

## Testing with Physical Device

1. Find your computer's local IP address (see above)
2. Update `APIService.swift`:
   ```swift
   private let baseURL = "http://YOUR_IP_ADDRESS:3500/api"
   ```
3. Make sure your iPhone and computer are on the same WiFi network
4. Build and run on your device

## Architecture

- **SwiftUI**: Modern declarative UI framework
- **Combine**: Reactive programming for state management
- **Async/Await**: Modern concurrency for network calls
- **MVVM Pattern**: ViewModels manage business logic
- **ObservableObject**: Reactive state updates

## Shared Account System

The iOS app and web app share the same backend, so:
- Login with the same username on both platforms
- All projects, sections, and tasks are synced
- Changes made on one platform appear on the other

## Potential Enhancements

- Task photos (backend API ready, just needs UI)
- Search functionality (backend API ready)
- Drag-and-drop reordering
- Archive/unarchive features
- Task descriptions editing
- Due dates and priorities
- Push notifications
- Offline mode with sync

## Troubleshooting

### "Cannot connect to backend"
- Make sure backend is running: `cd backend && npm start`
- Check the URL in `APIService.swift`
- For physical devices, use local IP instead of localhost

### "Build failed"
- Clean build folder: Product > Clean Build Folder (Cmd+Shift+K)
- Close and reopen Xcode
- Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData/TodoApp-*`

### "The data couldn't be read"
- Check backend is running
- Check network connection
- View console output in Xcode for API response details

## Project Structure

```
iOS/TodoApp/
├── TodoApp.xcodeproj    # Xcode project file
├── TodoApp/
│   ├── TodoAppApp.swift       # App entry point
│   ├── Models.swift           # Data models
│   ├── APIService.swift       # Networking
│   ├── AuthManager.swift      # Auth state
│   ├── LoginView.swift        # Login UI
│   ├── ProjectListView.swift  # Projects UI
│   ├── ProjectDetailView.swift # Sections UI
│   ├── SectionDetailView.swift # Tasks UI
│   └── ContentView.swift      # Main view
├── TodoAppTests/        # Unit tests
└── TodoAppUITests/      # UI tests
```
