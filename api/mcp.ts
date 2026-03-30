import { readFileSync } from "fs";
import { join } from "path";

const WIDGET_HTML = readFileSync(
  join(__dirname, "..", "dist", "index.html"),
  "utf-8"
);

const WIDGET_URI = "ui://widget/todo.html";
const MIME_TYPE = "text/html+skybridge";

const SERVER_INFO = {
  name: "chatgpt-todo-app",
  version: "1.0.0",
};

function widgetMeta(sessionId?: string) {
  const meta: Record<string, unknown> = {
    "openai/outputTemplate": WIDGET_URI,
    "openai/toolInvocation/invoking": "Preparing your todo list",
    "openai/toolInvocation/invoked": "Todo list ready",
    "openai/widgetAccessible": true,
  };
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

function handleMethod(
  method: string,
  params: Record<string, unknown> = {}
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
      const args = (params.arguments ?? {}) as {
        items?: Array<{ title: string; completed?: boolean }>;
      };
      const items = (args.items ?? []).map((item) => ({
        title: item.title,
        completed: item.completed ?? false,
      }));
      const count = items.length;
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
        _meta: widgetMeta("todo-default"),
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

function processRequest(req: JsonRpcRequest): JsonRpcResponse | null {
  try {
    const result = handleMethod(req.method, req.params);
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
    "content-type, mcp-session-id"
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

  const body = req.body;

  // Batch request
  if (Array.isArray(body)) {
    const responses = body
      .map((item: JsonRpcRequest) => processRequest(item))
      .filter(Boolean);

    if (responses.length === 0) return res.status(202).end();

    // Include session ID header on initialize
    if (body.some((r: JsonRpcRequest) => r.method === "initialize")) {
      res.setHeader("mcp-session-id", "stateless");
    }

    return res.json(responses);
  }

  // Single request
  const response = processRequest(body);
  if (response === null) return res.status(202).end();

  if (body.method === "initialize") {
    res.setHeader("mcp-session-id", "stateless");
  }

  return res.json(response);
}
