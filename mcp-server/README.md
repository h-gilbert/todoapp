# Todo App MCP Server

Model Context Protocol (MCP) server that enables Claude Code to interact with your Todo App programmatically. Claude can create tasks, track bugs, manage features, and mark items complete - all while you can view and manage everything through the web interface.

## Features

**Task Management:**
- Create, update, and delete tasks
- Mark tasks complete/incomplete
- Create subtasks (2-level nesting)
- Search across all tasks

**Task Types:**
- 📋 **Tasks** - General todos
- 🐛 **Bugs** - Issues to fix
- ✨ **Features** - New functionality to implement
- 💡 **Ideas** - Future considerations

**Organization:**
- Labels/tags for categorization
- Projects and sections
- Filter by type, label, status
- Dedicated bug/feature/idea views

## Available Tools

### Project & Section Management
- `list_projects` - Get all your projects
- `create_project` - Create a new project
- `list_sections` - List sections in a project
- `create_section` - Create a new section in a project

### Task Operations
- `list_tasks` - Get tasks in a section (with filters)
- `get_task` - Get detailed task info with subtasks and labels
- `create_task` - Create a new task (any type)
- `create_subtask` - Create a subtask under a parent
- `update_task` - Modify task properties
- `complete_task` - Mark task done
- `uncomplete_task` - Reopen a task
- `delete_task` - Permanently remove a task

### Search & Filtering
- `search_tasks` - Search by keyword with type/label filters
- `get_bugs` - Get all bugs in a project
- `get_features` - Get all features in a project
- `get_ideas` - Get all ideas in a project

### Labels
- `list_labels` - Get all available labels
- `create_label` - Create a new label with name and color
- `add_label_to_task` - Tag a task
- `remove_label_from_task` - Untag a task

### Convenience Methods
- `add_bug` - Quick bug creation (auto-sets type to "bug")

## Setup Instructions

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Generate API Token

Start your Todo App backend, then generate an API token:

```bash
curl -X POST http://localhost:3300/api/users/1/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Claude Code MCP",
    "scopes": "read,write",
    "expiresInDays": 365
  }'
```

Save the returned token - you'll need it in the next step.

### 3. Create .env File

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```bash
TODO_APP_URL=http://localhost:3300
API_TOKEN=your_generated_token_here
USER_ID=1
```

### 4. Build the Server

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 5. Configure Claude Desktop

Add this server to your Claude Desktop configuration:

**Location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "todo-app": {
      "command": "node",
      "args": [
        "/Users/hamishgilbert/Downloads/Projects/todo-app/mcp-server/dist/index.js"
      ],
      "env": {
        "TODO_APP_URL": "http://localhost:3300",
        "API_TOKEN": "your_generated_token_here",
        "USER_ID": "1"
      }
    }
  }
}
```

**Important:** Update the path in `args` to match your actual installation path.

### 6. Restart Claude Desktop

Close and reopen Claude Desktop (or Claude Code) to load the new MCP server.

### 7. Verify Connection

In Claude Code, you should now see the todo-app tools available. Try:

```
Can you list my projects from the todo app?
```

## Usage Examples

### Example 1: Create a Bug

```
I found a bug in the login form - it's not validating email addresses properly.
Can you add this to my todo app in the "Backend" project's "To Do" section?
```

Claude will:
1. Use `list_projects` to find your Backend project
2. Use `list_sections` to find the "To Do" section
3. Use `add_bug` to create the bug with description

### Example 2: Track Implementation

```
I need to implement user authentication. Can you break this down into tasks
and add them to my todo app?
```

Claude will:
1. Create a parent feature task
2. Create multiple subtasks for each step
3. Optionally add labels like "backend", "security"

### Example 3: Mark Work Complete

```
I just fixed the login bug (task #45). Mark it complete in the todo app.
```

Claude will use `complete_task` to update the status.

### Example 4: Review Open Bugs

```
Show me all the open bugs in my Frontend project.
```

Claude will use `get_bugs` to fetch and display them.

## Use Cases

**For Claude Code:**
- Log bugs discovered during code review
- Create implementation plans as task hierarchies
- Track progress by marking tasks complete
- Search for existing tasks before creating duplicates
- Organize work with labels and types

**For You:**
- View everything Claude has logged in the web UI
- Add your own tasks, bugs, and feature requests
- Reorganize tasks across sections
- Add photos/files to bug reports
- Track overall project progress

**Together:**
- Shared task backlog between you and Claude
- Claude can work on tasks you create
- You can refine tasks Claude creates
- Persistent memory of project requirements

## Development

### Watch Mode (for development)

```bash
npm run dev
```

Uses `tsx` to watch for changes and auto-reload.

### Testing with Claude Code

After making changes:

```bash
npm run build
```

Then restart Claude Desktop to reload the server.

## Troubleshooting

**Server not appearing in Claude:**
- Check that `claude_desktop_config.json` path is correct
- Verify the `args` path points to the compiled `dist/index.js`
- Ensure Claude Desktop was fully restarted

**API errors:**
- Verify Todo App backend is running (`docker ps`)
- Check API_TOKEN is valid (not expired)
- Confirm TODO_APP_URL is accessible
- Test API manually: `curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3300/api/health`

**Build errors:**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Check Node.js version (should be 18+)

**Token expired:**
- Generate a new token (see step 2)
- Update `.env` and `claude_desktop_config.json`
- Restart Claude Desktop

## Architecture

```
┌─────────────────┐
│  Claude Code    │
│   (MCP Client)  │
└────────┬────────┘
         │ stdio
         │
┌────────▼────────┐
│  MCP Server     │
│  (this project) │
└────────┬────────┘
         │ HTTP + Bearer Token
         │
┌────────▼────────┐
│  Todo App API   │
│  (Express.js)   │
└────────┬────────┘
         │
┌────────▼────────┐
│  SQLite DB      │
└─────────────────┘
```

## Security Notes

- API tokens are stored in your environment/config only
- Never commit `.env` or tokens to version control
- Tokens can be revoked via the Todo App API
- MCP server only has access to your user's data
- All communication is local (localhost)

## License

MIT

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Todo App API logs: `docker logs local-todo-app-backend`
3. Check MCP server logs in Claude Desktop's developer console
