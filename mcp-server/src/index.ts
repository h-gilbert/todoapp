#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_URL = process.env.TODO_APP_URL || 'http://localhost:3300';
const API_TOKEN = process.env.API_TOKEN;
const USER_ID = process.env.USER_ID || '1';

if (!API_TOKEN) {
  console.error('ERROR: API_TOKEN environment variable is required');
  console.error('Please generate a token and add it to your .env file or Claude Desktop config');
  process.exit(1);
}

// API helper function
async function apiRequest(endpoint: string, options: any = {}) {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Create MCP server
const server = new Server(
  {
    name: 'todo-app-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define all available tools
const tools: Tool[] = [
  {
    name: 'list_projects',
    description: 'List all projects for the authenticated user. Returns project details including name, description, and IDs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_project',
    description: 'Create a new project for the authenticated user.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          description: 'The name of the project to create',
        },
      },
    },
  },
  {
    name: 'list_sections',
    description: 'List all sections within a specific project. Sections organize tasks into groups like "To Do", "In Progress", "Done".',
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: {
          type: 'number',
          description: 'The ID of the project to list sections from',
        },
      },
    },
  },
  {
    name: 'create_section',
    description: 'Create a new section within a project. Sections organize tasks into groups like "To Do", "In Progress", "Done", etc.',
    inputSchema: {
      type: 'object',
      required: ['projectId', 'name'],
      properties: {
        projectId: {
          type: 'number',
          description: 'The ID of the project to create the section in',
        },
        name: {
          type: 'string',
          description: 'The name of the section (e.g., "To Do", "In Progress", "Done", "Backlog")',
        },
      },
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks in a specific section. Optionally filter by type (task/bug/feature/idea) and completion status. Returns parent tasks only (subtasks are fetched separately).',
    inputSchema: {
      type: 'object',
      required: ['sectionId'],
      properties: {
        sectionId: {
          type: 'number',
          description: 'The ID of the section to list tasks from',
        },
        includeCompleted: {
          type: 'boolean',
          description: 'Whether to include completed tasks (default: false)',
          default: false,
        },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Get detailed information about a specific task, including its subtasks and labels.',
    inputSchema: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: {
          type: 'number',
          description: 'The ID of the task to retrieve',
        },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task with specified type (task/bug/feature/idea). Can optionally add labels and create as a subtask.',
    inputSchema: {
      type: 'object',
      required: ['sectionId', 'title'],
      properties: {
        sectionId: {
          type: 'number',
          description: 'The ID of the section to create the task in',
        },
        title: {
          type: 'string',
          description: 'The title/summary of the task',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the task (optional)',
        },
        type: {
          type: 'string',
          enum: ['task', 'bug', 'feature', 'idea'],
          description: 'Type of task: task (general todo), bug (issue to fix), feature (new functionality), idea (future consideration)',
          default: 'task',
        },
        parentTaskId: {
          type: 'number',
          description: 'ID of parent task if this should be a subtask (optional)',
        },
      },
    },
  },
  {
    name: 'create_subtask',
    description: 'Create a subtask under an existing parent task. Convenience method that automatically sets the parent relationship.',
    inputSchema: {
      type: 'object',
      required: ['parentTaskId', 'title'],
      properties: {
        parentTaskId: {
          type: 'number',
          description: 'The ID of the parent task',
        },
        title: {
          type: 'string',
          description: 'The title of the subtask',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the subtask (optional)',
        },
        type: {
          type: 'string',
          enum: ['task', 'bug', 'feature', 'idea'],
          description: 'Type of subtask',
          default: 'task',
        },
      },
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task. Can modify title, description, type, or move to different section/parent.',
    inputSchema: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: {
          type: 'number',
          description: 'The ID of the task to update',
        },
        title: {
          type: 'string',
          description: 'New title for the task',
        },
        description: {
          type: 'string',
          description: 'New description for the task',
        },
        type: {
          type: 'string',
          enum: ['task', 'bug', 'feature', 'idea'],
          description: 'New type for the task',
        },
        sectionId: {
          type: 'number',
          description: 'Move task to a different section',
        },
      },
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as complete. Use this when you finish working on a task.',
    inputSchema: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: {
          type: 'number',
          description: 'The ID of the task to mark complete',
        },
      },
    },
  },
  {
    name: 'uncomplete_task',
    description: 'Mark a completed task as incomplete. Use this to reopen a task.',
    inputSchema: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: {
          type: 'number',
          description: 'The ID of the task to mark incomplete',
        },
      },
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task permanently. Use with caution.',
    inputSchema: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: {
          type: 'number',
          description: 'The ID of the task to delete',
        },
      },
    },
  },
  {
    name: 'search_tasks',
    description: 'Search for tasks across all projects by keyword. Optionally filter by task type or label.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: 'Search query to match against task titles and descriptions',
        },
        taskType: {
          type: 'string',
          enum: ['task', 'bug', 'feature', 'idea'],
          description: 'Filter by specific task type (optional)',
        },
        labelId: {
          type: 'number',
          description: 'Filter by specific label ID (optional)',
        },
      },
    },
  },
  {
    name: 'get_bugs',
    description: 'Get all bug-type tasks in a specific project. Useful for reviewing all open bugs.',
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: {
          type: 'number',
          description: 'The ID of the project to get bugs from',
        },
      },
    },
  },
  {
    name: 'get_features',
    description: 'Get all feature-type tasks in a specific project. Useful for reviewing planned features.',
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: {
          type: 'number',
          description: 'The ID of the project to get features from',
        },
      },
    },
  },
  {
    name: 'get_ideas',
    description: 'Get all idea-type tasks in a specific project. Useful for brainstorming and future planning.',
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: {
          type: 'number',
          description: 'The ID of the project to get ideas from',
        },
      },
    },
  },
  {
    name: 'list_labels',
    description: 'List all labels/tags available for the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_label',
    description: 'Create a new label/tag with a name and color.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          description: 'Name of the label (e.g., "urgent", "frontend", "backend")',
        },
        color: {
          type: 'string',
          description: 'Hex color code for the label (e.g., "#FF0000")',
          default: '#3B82F6',
        },
      },
    },
  },
  {
    name: 'add_label_to_task',
    description: 'Add a label to a task. Use this to categorize and organize tasks.',
    inputSchema: {
      type: 'object',
      required: ['taskId', 'labelId'],
      properties: {
        taskId: {
          type: 'number',
          description: 'The ID of the task',
        },
        labelId: {
          type: 'number',
          description: 'The ID of the label to add',
        },
      },
    },
  },
  {
    name: 'remove_label_from_task',
    description: 'Remove a label from a task.',
    inputSchema: {
      type: 'object',
      required: ['taskId', 'labelId'],
      properties: {
        taskId: {
          type: 'number',
          description: 'The ID of the task',
        },
        labelId: {
          type: 'number',
          description: 'The ID of the label to remove',
        },
      },
    },
  },
  {
    name: 'add_bug',
    description: 'Convenience method to quickly create a bug report. Creates a bug-type task with appropriate formatting.',
    inputSchema: {
      type: 'object',
      required: ['sectionId', 'title'],
      properties: {
        sectionId: {
          type: 'number',
          description: 'The ID of the section to create the bug in (usually a "Bugs" or "To Do" section)',
        },
        title: {
          type: 'string',
          description: 'Brief description of the bug',
        },
        description: {
          type: 'string',
          description: 'Detailed description including steps to reproduce, expected vs actual behavior',
        },
      },
    },
  },
];

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle call_tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error('Missing arguments');
  }

  try {
    switch (name) {
      case 'list_projects': {
        const projects = await apiRequest(`/api/users/${USER_ID}/projects`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(projects, null, 2),
            },
          ],
        };
      }

      case 'create_project': {
        const project: any = await apiRequest('/api/projects', {
          method: 'POST',
          body: JSON.stringify({
            userId: USER_ID,
            name: args.name,
          }),
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Created project: "${project.name}" (ID: ${project.id})`,
            },
          ],
        };
      }

      case 'list_sections': {
        const sections = await apiRequest(`/api/projects/${args.projectId}/sections?userId=${USER_ID}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sections, null, 2),
            },
          ],
        };
      }

      case 'create_section': {
        const section: any = await apiRequest('/api/sections', {
          method: 'POST',
          body: JSON.stringify({
            projectId: args.projectId,
            name: args.name,
          }),
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Created section: "${section.name}" (ID: ${section.id})`,
            },
          ],
        };
      }

      case 'list_tasks': {
        const tasks = await apiRequest(`/api/sections/${args.sectionId}/tasks?includeCompleted=${args.includeCompleted || false}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      }

      case 'get_task': {
        // Get task details
        const task: any = await apiRequest(`/api/tasks/${args.taskId}`);

        // Get subtasks if any
        if (task.subtask_count > 0) {
          task.subtasks = await apiRequest(`/api/tasks/${args.taskId}/subtasks`);
        }

        // Get labels
        task.labels = await apiRequest(`/api/tasks/${args.taskId}/labels`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(task, null, 2),
            },
          ],
        };
      }

      case 'create_task': {
        const taskData: any = {
          sectionId: args.sectionId,
          title: args.title,
          description: args.description || '',
          type: args.type || 'task',
        };

        if (args.parentTaskId) {
          taskData.parent_task_id = args.parentTaskId;
        }

        const task: any = await apiRequest('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(taskData),
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Created ${task.type}: "${task.title}" (ID: ${task.id})`,
            },
          ],
        };
      }

      case 'create_subtask': {
        const subtask: any = await apiRequest(`/api/tasks/${args.parentTaskId}/subtasks`, {
          method: 'POST',
          body: JSON.stringify({
            title: args.title,
            description: args.description || '',
            type: args.type || 'task',
          }),
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Created subtask: "${subtask.title}" (ID: ${subtask.id})`,
            },
          ],
        };
      }

      case 'update_task': {
        const updates: any = {};
        if (args.title !== undefined) updates.title = args.title;
        if (args.description !== undefined) updates.description = args.description;
        if (args.type !== undefined) updates.type = args.type;
        if (args.sectionId !== undefined) updates.sectionId = args.sectionId;

        const task: any = await apiRequest(`/api/tasks/${args.taskId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Updated task: "${task.title}" (ID: ${task.id})`,
            },
          ],
        };
      }

      case 'complete_task': {
        const task: any = await apiRequest(`/api/tasks/${args.taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ completed: true }),
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Marked task complete: "${task.title}" (ID: ${task.id})`,
            },
          ],
        };
      }

      case 'uncomplete_task': {
        const task: any = await apiRequest(`/api/tasks/${args.taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ completed: false }),
        });

        return {
          content: [
            {
              type: 'text',
              text: `🔄 Marked task incomplete: "${task.title}" (ID: ${task.id})`,
            },
          ],
        };
      }

      case 'delete_task': {
        await apiRequest(`/api/tasks/${args.taskId}`, {
          method: 'DELETE',
        });

        return {
          content: [
            {
              type: 'text',
              text: `🗑️  Deleted task ID: ${args.taskId}`,
            },
          ],
        };
      }

      case 'search_tasks': {
        let endpoint = `/api/users/${USER_ID}/search?q=${encodeURIComponent(String(args.query))}`;
        if (args.taskType) endpoint += `&taskType=${args.taskType}`;
        if (args.labelId) endpoint += `&labelId=${args.labelId}`;

        const results = await apiRequest(endpoint);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_bugs': {
        const bugs = await apiRequest(`/api/projects/${args.projectId}/bugs?userId=${USER_ID}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(bugs, null, 2),
            },
          ],
        };
      }

      case 'get_features': {
        const features = await apiRequest(`/api/projects/${args.projectId}/features?userId=${USER_ID}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(features, null, 2),
            },
          ],
        };
      }

      case 'get_ideas': {
        const ideas = await apiRequest(`/api/projects/${args.projectId}/ideas?userId=${USER_ID}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ideas, null, 2),
            },
          ],
        };
      }

      case 'list_labels': {
        const labels = await apiRequest(`/api/users/${USER_ID}/labels`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(labels, null, 2),
            },
          ],
        };
      }

      case 'create_label': {
        const label: any = await apiRequest('/api/labels', {
          method: 'POST',
          body: JSON.stringify({
            userId: USER_ID,
            name: args.name,
            color: args.color || '#3B82F6',
          }),
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Created label: "${label.name}" (ID: ${label.id}, Color: ${label.color})`,
            },
          ],
        };
      }

      case 'add_label_to_task': {
        await apiRequest(`/api/tasks/${args.taskId}/labels/${args.labelId}`, {
          method: 'POST',
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Added label ${args.labelId} to task ${args.taskId}`,
            },
          ],
        };
      }

      case 'remove_label_from_task': {
        await apiRequest(`/api/tasks/${args.taskId}/labels/${args.labelId}`, {
          method: 'DELETE',
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Removed label ${args.labelId} from task ${args.taskId}`,
            },
          ],
        };
      }

      case 'add_bug': {
        const bug: any = await apiRequest('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            sectionId: args.sectionId,
            title: args.title,
            description: args.description || '',
            type: 'bug',
          }),
        });

        return {
          content: [
            {
              type: 'text',
              text: `🐛 Created bug: "${bug.title}" (ID: ${bug.id})`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Todo-App MCP server running on stdio');
  console.error(`Connected to: ${API_URL}`);
  console.error(`User ID: ${USER_ID}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
