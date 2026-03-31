import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIDGET_HTML = readFileSync(
  join(__dirname, "..", "dist", "index.html"),
  "utf-8"
);

const WIDGET_URI = "ui://widget/todo.html";
const MIME_TYPE = "text/html+skybridge";

const AUTH_SERVER_URL = process.env.AUTHORIZATION_SERVER_URL || "";
const RESOURCE_SERVER_URL = process.env.RESOURCE_SERVER_URL || "";
const AUTH_ENABLED = !!(AUTH_SERVER_URL && RESOURCE_SERVER_URL);

let PROTECTED_RESOURCE_METADATA_URL = "";
if (AUTH_ENABLED) {
  const parsed = new URL(RESOURCE_SERVER_URL);
  PROTECTED_RESOURCE_METADATA_URL = `${parsed.origin}/.well-known/oauth-protected-resource${parsed.pathname}`;
}

const SERVER_INFO = {
  name: "chatgpt-todo-app",
  version: "1.0.0",
};

const SECURITY_SCHEMES = [{ type: "oauth2", scopes: [] as string[] }];

function widgetMeta(sessionId?: string) {
  const meta: Record<string, unknown> = {
    "openai/outputTemplate": WIDGET_URI,
    "openai/toolInvocation/invoking": "Preparing your todo list",
    "openai/toolInvocation/invoked": "Todo list ready",
    "openai/widgetAccessible": true,
  };
  if (AUTH_ENABLED) {
    meta.securitySchemes = SECURITY_SCHEMES;
  }
  if (sessionId) {
    meta["openai/widgetSessionId"] = sessionId;
  }
  return meta;
}

const TOOL_INPUT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description: "List of todo items to add or display.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The todo item text.",
          },
          completed: {
            type: "boolean",
            description: "Whether the item is completed.",
          },
        },
        required: ["title"],
      },
    },
  },
  required: ["items"],
} as const;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string };
};

function getBearerToken(req: any): string | null {
  const auth = req.headers?.authorization;
  if (!auth || typeof auth !== "string") return null;
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function getUserId(req: any): string | null {
  const token = getBearerToken(req);
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return (payload.sub as string) || null;
}

function oauthErrorResult() {
  return {
    content: [
      {
        type: "text",
        text: "Authentication required. Please sign in to use your todo list.",
      },
    ],
    isError: true,
    _meta: {
      "mcp/www_authenticate": [
        `Bearer error="invalid_request", error_description="No access token was provided", resource_metadata="${PROTECTED_RESOURCE_METADATA_URL}"`,
      ],
    },
  };
}

function handleMethod(
  method: string,
  params: Record<string, unknown> = {},
  userId: string | null = null
): unknown | null {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: SERVER_INFO,
      };

    case "notifications/initialized":
      return null;

    case "tools/list":
      return {
        tools: [
          {
            name: "manage-todos",
            title: "Manage todo list",
            description:
              "Add, display, or update todo items in an interactive widget. Pass items to add them to the list.",
            inputSchema: TOOL_INPUT_SCHEMA,
            _meta: widgetMeta(),
            ...(AUTH_ENABLED ? { securitySchemes: SECURITY_SCHEMES } : {}),
            annotations: {
              destructiveHint: false,
              openWorldHint: false,
              readOnlyHint: false,
            },
          },
        ],
      };

    case "tools/call": {
      const toolName = params.name as string;
      if (toolName !== "manage-todos") {
        throw { code: -32602, message: `Unknown tool: ${toolName}` };
      }

      if (AUTH_ENABLED && !userId) {
        return oauthErrorResult();
      }

      const args = (params.arguments ?? {}) as {
        items?: Array<{ title: string; completed?: boolean }>;
      };
      const items = (args.items ?? []).map((item) => ({
        title: item.title,
        completed: item.completed ?? false,
      }));
      const count = items.length;

      const sessionId = userId ? `todo-${userId}` : "todo-default";

      return {
        content: [
          {
            type: "text",
            text:
              count > 0
                ? `Added ${count} item${count !== 1 ? "s" : ""} to your todo list.`
                : "Here is your todo list.",
          },
        ],
        structuredContent: { items },
        _meta: widgetMeta(sessionId),
      };
    }

    case "resources/list":
      return {
        resources: [
          {
            name: "Todo widget",
            uri: WIDGET_URI,
            description: "Interactive todo list widget",
            mimeType: MIME_TYPE,
            _meta: widgetMeta(),
          },
        ],
      };

    case "resources/read":
      return {
        contents: [
          {
            uri: WIDGET_URI,
            mimeType: MIME_TYPE,
            text: WIDGET_HTML,
            _meta: widgetMeta(),
          },
        ],
      };

    case "resources/templates/list":
      return { resourceTemplates: [] };

    default:
      throw { code: -32601, message: `Method not found: ${method}` };
  }
}

function processRequest(
  req: JsonRpcRequest,
  userId: string | null
): JsonRpcResponse | null {
  try {
    const result = handleMethod(req.method, req.params, userId);
    if (result === null) return null; // notification
    return { jsonrpc: "2.0", id: req.id, result };
  } catch (err: unknown) {
    const error =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number; message: string })
        : { code: -32603, message: String(err) };
    return { jsonrpc: "2.0", id: req.id, error };
  }
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, mcp-session-id, authorization"
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "DELETE") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    // Server-sent events endpoint (not needed for stateless mode)
    return res.status(405).json({ error: "SSE not supported; use POST" });
  }

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const userId = AUTH_ENABLED ? getUserId(req) : null;
  const body = req.body;

  // Batch request
  if (Array.isArray(body)) {
    const responses = body
      .map((item: JsonRpcRequest) => processRequest(item, userId))
      .filter(Boolean);

    if (responses.length === 0) return res.status(202).end();

    // Include session ID header on initialize
    if (body.some((r: JsonRpcRequest) => r.method === "initialize")) {
      res.setHeader("mcp-session-id", "stateless");
    }

    return res.json(responses);
  }

  // Single request
  const response = processRequest(body, userId);
  if (response === null) return res.status(202).end();

  if (body.method === "initialize") {
    res.setHeader("mcp-session-id", "stateless");
  }

  return res.json(response);
}
