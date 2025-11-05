# Quick Setup Guide: Todo App MCP Server

## What You Have Now

✅ MCP server built and ready to use
✅ API token generated: `1c57ca1cd3c4c3b5397d59492d7c232cf6517fe3fe9c9d6d3614126782003580`
✅ All 19 tools implemented and tested
✅ Connected to your local Todo App at http://localhost:3300

## Setup for Claude Desktop / Claude Code

### Step 1: Locate Your Config File

**For Claude Desktop:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**For Claude Code:**
Same location - Claude Code shares configuration with Claude Desktop.

### Step 2: Add the MCP Server

Open the config file and add this to the `mcpServers` section:

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
        "API_TOKEN": "1c57ca1cd3c4c3b5397d59492d7c232cf6517fe3fe9c9d6d3614126782003580",
        "USER_ID": "1"
      }
    }
  }
}
```

**If you already have other MCP servers**, your config will look like:

```json
{
  "mcpServers": {
    "existing-server": {
      "command": "...",
      "args": ["..."]
    },
    "todo-app": {
      "command": "node",
      "args": [
        "/Users/hamishgilbert/Downloads/Projects/todo-app/mcp-server/dist/index.js"
      ],
      "env": {
        "TODO_APP_URL": "http://localhost:3300",
        "API_TOKEN": "1c57ca1cd3c4c3b5397d59492d7c232cf6517fe3fe9c9d6d3614126782003580",
        "USER_ID": "1"
      }
    }
  }
}
```

### Step 3: Restart Claude

**Completely quit and reopen** Claude Desktop or Claude Code to load the new configuration.

### Step 4: Verify It's Working

In Claude Code or Claude Desktop, try:

```
List my projects from the todo app
```

You should see all 20 of your projects (Store, Trading Calculator, etc.).

## Quick Test Examples

### Create a Bug
```
Add a bug to my "Todo App" project: The login form doesn't validate email addresses
```

### Create a Feature
```
Create a feature in the "Developer Knowledge Base" project to add dark mode support
```

### List All Bugs
```
Show me all the bugs in my "Gym Trainer App" project
```

### Mark Task Complete
```
I just finished task #45. Mark it complete in the todo app.
```

### Search Tasks
```
Search my tasks for "authentication"
```

## Available Tools

Your new MCP server has 19 tools:

**Project/Section Management:**
- list_projects
- list_sections
- list_tasks

**Task Operations:**
- get_task
- create_task
- create_subtask
- update_task
- complete_task
- uncomplete_task
- delete_task

**Search & Filtering:**
- search_tasks
- get_bugs
- get_features
- get_ideas

**Labels:**
- list_labels
- create_label
- add_label_to_task
- remove_label_from_task

**Convenience:**
- add_bug (quick bug creation)

## How It Works

1. **You or Claude create tasks** - Both of you can add bugs, features, ideas, and tasks
2. **Shared view** - Everything appears in the web UI at http://todo.hamishgilbert.test:8080
3. **Claude tracks progress** - Claude can mark tasks complete as it works
4. **Persistent memory** - Your project backlog is saved and accessible across sessions

## Use Cases

### For Development Work
```
"While working on the authentication module, create a todo for implementing 2FA"
```

### Bug Tracking
```
"I found a bug in the meal planner - it's not saving dietary restrictions. Log this."
```

### Implementation Planning
```
"I need to add user profiles to the gym trainer app. Break this down into tasks."
```

### Progress Tracking
```
"Show me all open tasks for the Portfolio Website project"
```

## Troubleshooting

**Server not showing up in Claude:**
- Verify the config file path is correct
- Check that you fully quit and restarted Claude
- Look in Claude's settings/MCP section to see connected servers

**API errors:**
- Ensure Todo App backend is running: `docker ps | grep todo-app`
- Check backend health: `curl http://localhost:3300/api/health`

**Token issues:**
- Token is valid for 1 year (expires 2026-11-05)
- Generate a new one if needed: See README.md step 2

**Need to rebuild:**
```bash
cd /Users/hamishgilbert/Downloads/Projects/todo-app/mcp-server
npm run build
# Then restart Claude Desktop
```

## Next Steps

1. **Configure Claude** - Add to config and restart
2. **Try it out** - Create a few tasks via Claude
3. **Check the web UI** - See them appear in your todo app
4. **Build your workflow** - Use Claude to track work as you code

## Questions?

Check the full README.md for:
- Detailed tool documentation
- API token management
- Development workflow
- Advanced usage examples
