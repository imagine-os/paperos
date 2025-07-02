# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

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

This is a collaborative whiteboard application built with:

- **Next.js 14** (App Router) - Application framework
- **Liveblocks** - Real-time collaboration infrastructure
- **tldraw** - Drawing canvas and tools
- **Yjs** - Collaborative data structures for code editing
- **CodeMirror** - Code editor with syntax highlighting

### Key Integration Points

**Liveblocks Configuration** (`src/liveblocks.config.ts`):

- Defines TypeScript interfaces for Presence, Storage, and UserMeta
- Storage uses `LiveMap<string, any>` for tldraw records
- UserMeta includes id, name, color, and avatar

**Main Canvas Component** (`src/components/StorageTldraw.tsx`):

- Integrates tldraw with Liveblocks storage via `useStorageStore` hook
- Registers custom shapes and tools
- Includes UI overrides for custom toolbar items

### Custom Extensions

1. **Interactive Shape Component** (`src/components/custom-shapes/`):

   - `shape.component.tsx` - Defines custom HTML-based shapes with theme support
   - `shape.tool.ts` - Tool for creating interactive shapes

2. **Code Editor Component** (`src/components/code-eidtor/`):

   - `code-editor.component.tsx` - Collaborative code editor shape
   - `code-editor.tool.ts` - Tool for creating code editor instances
   - Uses Yjs for real-time collaborative editing

3. **Storage Hook** (`src/components/useStorageStore.ts`):
   - Synchronizes tldraw state with Liveblocks storage
   - Handles conflict resolution and persistence

### Authentication & Users

Mock authentication system in `src/database.ts` with predefined users. API
endpoint at `src/app/api/liveblocks-auth/` handles user sessions.

### Next.js Configuration

`next.config.js` includes webpack configuration to ensure consistent Yjs module
resolution across the application.

## Custom Shape Development

When adding new custom shapes:

1. Create shape component in `src/components/custom-shapes/`
2. Create corresponding tool in same directory
3. Register both in `StorageTldraw.tsx`:
   - Add to `customShapeUtils` array
   - Add tool to `uiOverrides.tools()`
   - Add to `customTools` array

## Known Issues

- Directory name `code-eidtor` has typo (should be `code-editor`)
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
