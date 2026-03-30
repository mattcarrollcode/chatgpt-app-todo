# Deploying the Todo ChatGPT App

This guide covers deploying the MCP-based todo app to Vercel and publishing it on ChatGPT.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
- A [Vercel](https://vercel.com) account
- A [ChatGPT](https://chatgpt.com) account (Plus, Team, or Enterprise)

## Project Structure

```
todo-app/
├── api/mcp.ts          # Vercel serverless function (MCP server)
├── src/
│   ├── App.tsx          # React widget using @openai/apps-sdk-ui
│   ├── main.tsx         # Widget entry point
│   ├── index.css        # Tailwind + apps-sdk-ui styles
│   ├── types.ts         # OpenAI window.openai type definitions
│   ├── use-openai-global.ts
│   └── use-widget-state.ts
├── scripts/
│   └── embed-widget.mjs # Build script: embeds widget HTML into API
├── index.html           # Vite dev HTML template
├── vite.config.ts       # Vite build config
├── vercel.json          # Vercel routing and function config
└── package.json
```

## Local Development

### 1. Install dependencies

```bash
cd todo-app
npm install
```

### 2. Run the dev server

```bash
npm run dev
```

This starts Vite on `http://localhost:5173`. You can preview the widget UI directly in your browser. Note: `window.openai` APIs won't be available outside ChatGPT, but the UI renders and is interactive.

### 3. Build locally

```bash
npm run build
```

This runs `vite build` (producing a single-file `dist/index.html`) and then embeds the HTML into `api/_widget-html.ts` for the serverless function.

## Deploy to Vercel

### 1. Link to Vercel

```bash
vercel link
```

Follow the prompts to create a new project or link to an existing one.

### 2. Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

Vercel will:
1. Run `npm run build` (builds widget + embeds HTML)
2. Deploy `api/mcp.ts` as a serverless function
3. Set up routing per `vercel.json`

### 3. Note your deployment URL

After deployment, you'll get a URL like:
```
https://chatgpt-todo-app-xxxx.vercel.app
```

Your MCP endpoint will be at:
```
https://chatgpt-todo-app-xxxx.vercel.app/api/mcp
```

(The `/mcp` path also works, as it rewrites to `/api/mcp`.)

## Configure in ChatGPT

### 1. Open ChatGPT Settings

Go to [chatgpt.com](https://chatgpt.com) and navigate to:
**Settings > Apps > Add App**

### 2. Add your MCP server

- **App Name**: Todo List
- **MCP Server URL**: `https://your-app.vercel.app/api/mcp`
- **Transport**: Streamable HTTP

### 3. Test the app

Start a new ChatGPT conversation and try:

- "Add buy groceries, walk the dog, and read a book to my todo list"
- "Show me my todo list"
- "Mark buy groceries as done"

ChatGPT will call the `manage-todos` tool, which returns the interactive widget. You can also add, complete, and delete items directly in the widget.

## How It Works

### Architecture

```
User ─── ChatGPT ─── MCP Protocol ─── Vercel Serverless Function
                          │
                          ├── tools/list     → returns tool definitions
                          ├── tools/call     → returns structured content + widget URI
                          ├── resources/list → lists the widget HTML resource
                          └── resources/read → serves the self-contained widget HTML
```

### MCP Protocol

The server implements the [Model Context Protocol](https://modelcontextprotocol.io/) over Streamable HTTP:

- **POST `/api/mcp`**: Handles JSON-RPC 2.0 requests (initialize, tools/list, tools/call, resources/read)
- **Stateless**: Each request is independent; no session state is stored server-side

### Widget

The widget is a React app using `@openai/apps-sdk-ui` components. It's built into a single self-contained HTML file by Vite + `vite-plugin-singlefile`, then embedded in the serverless function at build time.

Key features:
- **`window.openai.toolOutput`**: Receives items from ChatGPT tool calls
- **`window.openai.widgetState`** + **`setWidgetState`**: Persists state across conversation turns
- **`openai/widgetSessionId`**: Links widget state to a session so state survives multiple tool calls

### State Flow

1. User asks ChatGPT to add todos
2. ChatGPT calls `manage-todos` with items
3. Server returns `structuredContent` (items) + `_meta` (widget template URI + session ID)
4. ChatGPT renders the widget HTML in a sandbox
5. Widget reads `toolOutput` for new items, merges with `widgetState` for existing items
6. User interacts directly with widget (add, toggle, delete)
7. Widget calls `setWidgetState()` to persist changes
8. On next tool call, `widgetState` carries the persisted state forward

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| None required | The app runs without any env vars | - |

## Troubleshooting

### Widget doesn't load in ChatGPT
- Verify your deployment URL is accessible: `curl https://your-app.vercel.app/api/mcp -X POST -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
- Check that the response includes the `manage-todos` tool with `_meta` containing `openai/outputTemplate`

### CORS errors
- The `vercel.json` and API handler both set CORS headers. If you see CORS errors, verify your deployment includes the latest `vercel.json`.

### Build fails
- Ensure `vite-plugin-singlefile` is installed: `npm ls vite-plugin-singlefile`
- The build produces `dist/index.html` which must exist before `embed-widget.mjs` runs

### State doesn't persist across turns
- The `openai/widgetSessionId` in the tool response metadata links state across turns. Verify the server returns it in `_meta`.
