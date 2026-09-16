## Project Purpose

This is a **Visual IDE** project - a canvas-based development environment where developers can open projects, drag code editors onto the canvas, and see real-time output. Think of it as an interactive whiteboard for code development.

## Current Development Phase

**Phase 1: File Management & Code Editing**
- Primary focus: Enable opening project files in draggable code editor shapes
- Goal: Create file browser functionality integrated with tldraw canvas
- Status: Basic code editor shape implemented, need file system integration

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Environment Setup

Required environment variable:

- `LIVEBLOCKS_SECRET_KEY` - Get from
  [Liveblocks Dashboard](https://liveblocks.io/dashboard/apikeys)

## Architecture Overview

This Visual IDE is built on a collaborative whiteboard foundation with:

- **Next.js 14** (App Router) - Application framework
- **Liveblocks** - Real-time collaboration infrastructure
- **tldraw** - Drawing canvas and tools
- **Yjs** - Collaborative data structures for code editing
- **CodeMirror** - Code editor with syntax highlighting

### Custom Extensions

1. **Code Editor Component** (`src/components/code-editor/`):
   - `code-editor.component.tsx` - Draggable code editor shape for IDE
   - `code-editor.tool.ts` - Tool for creating code editor instances on canvas
   - Uses CodeMirror with syntax highlighting and Yjs for collaboration

## Known Issues

- tldraw requires commercial license to remove watermark

## Basic Rules which are required to follow

1. First think through the problem, read the codebase for relevant files, and
   write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you
   complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what
   changes you made
6. Make every task and code change you do as simple as possible. We want to
   avoid making any massive or complex changes. Every change should impact as
   little code as possible. Everything is about simplicity.
7. Finally, add a review section to the [todo.md](http://todo.md/) file with a
   summary of the changes you made and any other relevant information.
