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

## OAuth Authentication (Optional)

Add user authentication so each person gets their own todo list. Uses [Auth0](https://auth0.com/) (free tier, up to 25,000 MAU).

Without OAuth configured, the app works for everyone without sign-in.

### 1. Create an Auth0 Tenant

Sign up at [auth0.com](https://auth0.com/) and create a new tenant.

### 2. Create an API

- Auth0 Dashboard → **Applications** → **APIs** → **Create API**
- Name: `chatgpt-todo-app`
- Identifier: `https://your-vercel-url.vercel.app/api/mcp`
- Signing Algorithm: RS256

### 3. Set Default Audience

- **Settings** → **General** → **API Authorization Settings** → **Default Audience**
- Set it to the API identifier from step 2

This ensures Auth0 issues unencrypted RS256 JWTs.

### 4. Enable Dynamic Client Registration

- **Settings** → **Advanced** → enable **OIDC Dynamic Application Registration**

ChatGPT uses this to automatically register as an OAuth client.

### 5. Add a Login Method

- **Authentication** → **Social** → enable **google-oauth2**
- Click the connection → **Advanced** → **Promote Connection to Domain Level**

### 6. Set Environment Variables

In Vercel (Settings → Environment Variables), add:

| Variable | Value |
|---|---|
| `AUTHORIZATION_SERVER_URL` | `https://YOUR-TENANT.auth0.com` |
| `RESOURCE_SERVER_URL` | `https://your-vercel-url.vercel.app/api/mcp` |

Then redeploy:

```bash
vercel --prod
```

### 7. Verify OAuth Metadata

```bash
curl https://your-vercel-url.vercel.app/.well-known/oauth-protected-resource/api/mcp
```

Should return JSON with `resource`, `authorization_servers`, and `scopes_supported`.

When OAuth is configured, ChatGPT will prompt users to sign in before using the todo tool. Each user gets a unique session ID based on their identity.

## Project Structure

```
├── api/
│   ├── mcp.ts              # Vercel serverless function — MCP server
│   └── oauth-metadata.ts   # OAuth protected resource metadata endpoint
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

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           ChatGPT                                   │
│                                                                     │
│  ┌──────────────┐     ┌──────────────────────────────────────────┐  │
│  │              │     │          Conversation UI                  │  │
│  │   LLM        │     │                                          │  │
│  │              │     │  ┌────────────────────────────────────┐   │  │
│  │  Decides to  │     │  │     Widget (sandboxed iframe)      │   │  │
│  │  call tools  │     │  │                                    │   │  │
│  │  based on    │     │  │  React app built with              │   │  │
│  │  user input  │     │  │  @openai/apps-sdk-ui               │   │  │
│  │              │     │  │                                    │   │  │
│  │              │     │  │  Reads: toolOutput, widgetState    │   │  │
│  │              │     │  │  Writes: setWidgetState, callTool  │   │  │
│  │              │     │  │                                    │   │  │
│  └──────┬───────┘     │  └──────────┬─────────────────────────┘   │  │
│         │             │             │                              │  │
│         │             └─────────────┼──────────────────────────────┘  │
│         │                           │                                 │
│         │  window.openai            │  window.openai                  │
│         │  (host bridge)            │  (host bridge)                  │
└─────────┼───────────────────────────┼─────────────────────────────────┘
          │                           │
          │ MCP (JSON-RPC 2.0        │ widgetState persisted
          │ over HTTPS)              │ via widgetSessionId
          │                           │
          ▼                           │
┌─────────────────────────────────────┼─────────────────────────────────┐
│           Vercel Serverless Function (api/mcp.ts)                     │
│                                                                       │
│  Handles MCP methods:                                                 │
│                                                                       │
│  initialize ──────────► server capabilities + protocol version        │
│  tools/list ──────────► manage-todos tool definition + widget URI     │
│  tools/call ──────────► structured todo data + widget session ID      │
│  resources/read ──────► self-contained widget HTML (single file)      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Build artifact: dist/index.html                                 │  │
│  │ (React + Tailwind + apps-sdk-ui inlined into one HTML file)     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

### Request flow

```
User: "Add buy groceries to my todo list"
  │
  ▼
ChatGPT LLM interprets the message
  │
  ├──► MCP POST tools/call { name: "manage-todos", arguments: { items: [...] } }
  │      │
  │      ▼
  │    Vercel function returns:
  │      ├── content: [{ text: "Added 1 item to your todo list." }]
  │      ├── structuredContent: { items: [{ title: "buy groceries", completed: false }] }
  │      └── _meta: { "openai/outputTemplate": "ui://widget/todo.html",
  │                    "openai/widgetSessionId": "todo-default" }
  │
  ├──► MCP POST resources/read { uri: "ui://widget/todo.html" }
  │      │
  │      ▼
  │    Vercel function returns the self-contained widget HTML
  │
  ▼
ChatGPT renders the widget in a sandboxed iframe
  │
  ▼
Widget reads structuredContent via window.openai.toolOutput
Widget displays the interactive todo list
User can add/toggle/delete items directly in the widget
Widget persists changes via window.openai.setWidgetState()
```

### OAuth flow (when configured)

```
User asks to use todos (first time)
  │
  ▼
ChatGPT calls tools/call without a Bearer token
  │
  ▼
Server returns error with _meta: { "mcp/www_authenticate": ["Bearer ..."] }
  │
  ▼
ChatGPT fetches /.well-known/oauth-protected-resource/api/mcp
  │    Returns: { authorization_servers: ["https://tenant.auth0.com"] }
  │
  ▼
ChatGPT registers as OAuth client via Auth0 Dynamic Client Registration
  │
  ▼
User is prompted to sign in (e.g. Google login via Auth0)
  │
  ▼
ChatGPT receives access token (JWT)
  │
  ▼
ChatGPT retries tools/call with Authorization: Bearer <token>
  │
  ▼
Server decodes JWT, extracts user ID (sub claim)
Uses "todo-{userId}" as widgetSessionId for per-user state
```

### Key concepts

**MCP Server** (`api/mcp.ts`): Implements the [Model Context Protocol](https://modelcontextprotocol.io/) over stateless HTTP. Each POST request is an independent JSON-RPC 2.0 call — no session state is stored server-side.

**Widget** (`src/App.tsx`): A React app rendered in a sandboxed iframe inside the ChatGPT conversation. Built with `@openai/apps-sdk-ui` components (Checkbox, Input, Button, SegmentedControl, Badge, EmptyMessage) and compiled into a single self-contained HTML file via `vite-plugin-singlefile`.

**`window.openai` bridge**: The host (ChatGPT) exposes a `window.openai` object inside the widget iframe. The widget reads `toolOutput` (structured data from the MCP tool call) and `widgetState` (persisted state from previous turns), and writes back via `setWidgetState()` and `callTool()`.

**State persistence**: The server returns `openai/widgetSessionId` in tool response metadata. This links `widgetState` across conversation turns so todos persist even when ChatGPT calls the tool again. The widget merges new items from `toolOutput` with existing state from `widgetState`.

**OAuth** (optional): When `AUTHORIZATION_SERVER_URL` and `RESOURCE_SERVER_URL` env vars are set, the server requires authentication. It advertises `securitySchemes` on the tool, returns `mcp/www_authenticate` errors to trigger ChatGPT's sign-in UI, and decodes the JWT to create per-user widget sessions.

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
