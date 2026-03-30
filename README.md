# ChatGPT Todo App

An interactive todo list app for ChatGPT, built with the [Apps SDK UI](https://github.com/openai/apps-sdk-ui) library and deployed as an MCP server on Vercel.

Users can ask ChatGPT to add, complete, or manage todo items. The app renders an interactive widget inline in the conversation where items can also be added, toggled, and deleted directly.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Vercel](https://vercel.com) account + [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
- A [ChatGPT](https://chatgpt.com) Plus, Team, or Enterprise account

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Preview the widget locally

```bash
npm run dev
```

Opens the widget UI at `http://localhost:5173`. The `window.openai` APIs aren't available outside ChatGPT, but you can interact with the UI to verify it renders correctly.

### 3. Build

```bash
npm run build
```

This bundles the React widget into a single self-contained `dist/index.html` (all JS/CSS inlined). The serverless function reads this file at runtime to serve it as an MCP resource.

## Deploy to Vercel

### 1. Link your project

```bash
vercel link
```

### 2. Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

After deploying, note your URL (e.g. `https://todo-chatgpt-app.vercel.app`). Your MCP endpoint is:

```
https://todo-chatgpt-app.vercel.app/api/mcp
```

### 3. Verify the endpoint

```bash
curl -X POST https://todo-chatgpt-app.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

You should see a JSON response containing the `manage-todos` tool.

## Connect to ChatGPT

### 1. Enable Developer Mode

Go to [platform.openai.com](https://platform.openai.com) and enable **Developer Mode** for your account. This unlocks the ability to add custom connectors.

### 2. Add a Connector

In ChatGPT, go to **Settings > Connectors** and add a new connector:

- **URL**: `https://todo-chatgpt-app.vercel.app/api/mcp` (your Vercel deployment URL)

### 3. Use the App in a Conversation

Start a new ChatGPT conversation. Select your app from the **"More" menu** (the `+` or tools icon) to add it to the conversation context.

Then try prompts like:

- *"Add buy groceries, walk the dog, and read a book to my todo list"*
- *"Show me my todo list"*
- *"Mark buy groceries as done"*

ChatGPT calls the `manage-todos` tool, and the interactive todo widget appears inline in the conversation.

### Local Testing with ngrok

To test before deploying to Vercel, you can expose your local dev server using [ngrok](https://ngrok.com/):

```bash
# In one terminal: run the build + a local server
npm run build

# In another terminal: expose it
ngrok http 5173
```

Then add the ngrok URL (e.g. `https://abc123.ngrok-free.app/api/mcp`) as a connector in ChatGPT Settings > Connectors.

## Project Structure

```
├── api/
│   └── mcp.ts              # Vercel serverless function — MCP server
├── src/
│   ├── App.tsx              # Todo widget using @openai/apps-sdk-ui components
│   ├── main.tsx             # Widget entry point
│   ├── index.css            # Tailwind v4 + apps-sdk-ui styles
│   ├── types.ts             # window.openai type definitions
│   ├── use-openai-global.ts # Hook for reading window.openai state
│   └── use-widget-state.ts  # Hook for persistent widget state
├── index.html               # Vite dev HTML template
├── package.json
├── tsconfig.json
├── vite.config.ts           # Vite + Tailwind + single-file plugin
└── vercel.json              # Vercel routing + function config
```

## How It Works

```
User ─── ChatGPT ─── MCP (JSON-RPC over HTTP) ─── Vercel Serverless Function
                              │
                              ├── initialize       → server capabilities
                              ├── tools/list       → manage-todos tool definition
                              ├── tools/call       → structured content + widget URI
                              ├── resources/list   → widget HTML resource listing
                              └── resources/read   → self-contained widget HTML
```

**MCP Server** (`api/mcp.ts`): Implements the [Model Context Protocol](https://modelcontextprotocol.io/) over stateless HTTP. Each POST request is an independent JSON-RPC 2.0 call — no session state is stored server-side.

**Widget** (`src/App.tsx`): A React app using `@openai/apps-sdk-ui` components (Checkbox, Input, Button, SegmentedControl, Badge, EmptyMessage). Built into a single self-contained HTML file via `vite-plugin-singlefile`.

**State persistence**: The server returns `openai/widgetSessionId` in tool response metadata. This links `widgetState` across conversation turns so todos persist even when ChatGPT calls the tool again. The widget merges new items from `toolOutput` with existing state from `widgetState`.

## Troubleshooting

**Widget doesn't appear in ChatGPT**
- Make sure Developer Mode is enabled at [platform.openai.com](https://platform.openai.com)
- Verify the connector URL is correct in Settings > Connectors
- Test the endpoint with `curl` (see "Verify the endpoint" above)

**CORS errors**
- Both `vercel.json` and the API handler set CORS headers. Redeploy if you've changed `vercel.json`.

**Build fails**
- Ensure all dependencies are installed (`npm install`) and `vite build` produces `dist/index.html`.

**State doesn't persist across conversation turns**
- The `openai/widgetSessionId` in tool response `_meta` links state across turns. Verify the server returns it.

**Chrome widget issues**
- Chrome 142+ may block local network access. Disable the `#local-network-access-check` flag at `chrome://flags/` and restart Chrome.
