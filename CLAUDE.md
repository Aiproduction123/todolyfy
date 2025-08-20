# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Todolyfy is an AI-powered to-do list application built as a static website with serverless functions. The application allows users to create tasks that are automatically broken down into subtasks using Google's Gemini AI.

**Technology Stack:**
- Frontend: Vanilla HTML, CSS, and JavaScript (no frameworks)
- Serverless Functions: Netlify Functions (Node.js)
- AI Integration: Google Generative AI (Gemini 2.5 Flash)
- Authentication: OAuth2 with Google and Apple Sign-In
- Storage: LocalStorage for client-side task persistence
- Hosting: Netlify

**Key Components:**
- `index.html` - Main application interface with task management UI
- `index.js` - Core application logic including task CRUD operations, drag/drop, and auth
- `netlify/functions/` - Serverless functions for AI generation and authentication
- `netlify.toml` - Netlify configuration with routing rules

## Development Commands

This project uses npm for package management but has minimal build requirements:

```bash
# Install dependencies (only for serverless functions)
npm install

# No build step required - static files served directly
# No test framework configured - uses basic error handling
# No linting tools configured
```

## Core Architecture

**Frontend Architecture:**
- Single-page application with no routing
- State management through global JavaScript variables
- LocalStorage for task persistence
- Event-driven UI updates with manual DOM manipulation
- Drag-and-drop functionality using SortableJS library

**Task Data Structure:**
```javascript
{
  id: "task-${timestamp}",
  text: "Task description",
  completed: boolean,
  subtasks: [{ id, text, completed }],
  isGenerating: boolean,
  isOpen: boolean, // accordion state
  notes: string,
  isEditingNotes: boolean
}
```

**Authentication Flow:**
1. User clicks Google/Apple sign-in buttons
2. Redirected to `/auth/google` or `/auth/apple` (Netlify functions)
3. OAuth flow handled by respective auth functions
4. Callback returns user data via URL parameters
5. Frontend stores user info in LocalStorage

**AI Integration:**
- Tasks are sent to `/api/generate-subtasks` endpoint
- Uses Google Gemini 2.5 Flash model
- Generates 2-3 actionable subtasks
- Preserves original task language
- Error handling for API failures

## Environment Variables

Required for Netlify functions:
- `API_KEY` - Google Generative AI API key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `JWT_SECRET` - JWT signing secret
- `APPLE_*` variables - Apple Sign-In configuration (see apple-auth.js)

## Netlify Configuration

The `netlify.toml` file handles:
- API routing: `/api/*` → `/.netlify/functions/:splat`
- Auth routing: Various auth endpoints to respective functions
- Static file serving from project root

## Key Files to Understand

- `index.js:199-250` - Task creation and AI integration flow
- `index.js:79-140` - Task rendering and DOM manipulation
- `index.js:466-576` - Authentication and user management
- `netlify/functions/generate-subtasks.js` - AI subtask generation logic
- `netlify/functions/auth-*.js` - OAuth authentication handlers

## Development Notes

- No build process - edit files directly and refresh browser
- Use browser DevTools for debugging
- LocalStorage can be cleared to reset application state
- Functions can be tested locally with Netlify CLI: `netlify dev`
- Current branch: `social-signin-fix` - main branch is `main`