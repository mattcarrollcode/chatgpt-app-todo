import { useState, useEffect, useRef } from "react";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Input } from "@openai/apps-sdk-ui/components/Input";
import { Checkbox } from "@openai/apps-sdk-ui/components/Checkbox";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { EmptyMessage } from "@openai/apps-sdk-ui/components/EmptyMessage";
import { SegmentedControl } from "@openai/apps-sdk-ui/components/SegmentedControl";
import { applyDocumentTheme } from "@openai/apps-sdk-ui/theme";
import { useOpenAiGlobal } from "./use-openai-global";
import { useWidgetState } from "./use-widget-state";

type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  [key: string]: unknown;
};

type TodoState = {
  items: TodoItem[];
  [key: string]: unknown;
};

function uid(): string {
  return (
    crypto.randomUUID?.() ??
    Date.now().toString(36) + Math.random().toString(36).slice(2)
  );
}

type Filter = "all" | "active" | "completed";

export function App() {
  const theme = useOpenAiGlobal("theme");
  const toolOutput = useOpenAiGlobal("toolOutput");

  const [state, setState] = useWidgetState<TodoState>({ items: [] });
  const [newTodo, setNewTodo] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Apply ChatGPT theme
  useEffect(() => {
    if (theme) applyDocumentTheme(theme);
  }, [theme]);

  // Merge incoming items from tool calls
  const lastToolOutputRef = useRef<string>("");
  useEffect(() => {
    if (!toolOutput) return;
    const serialized = JSON.stringify(toolOutput);
    if (serialized === lastToolOutputRef.current) return;
    lastToolOutputRef.current = serialized;

    const incoming = (toolOutput as { items?: TodoItem[] })?.items;
    if (!incoming?.length) return;

    setState((prev) => {
      const existing = prev?.items ?? [];
      const byTitle = new Map(
        existing.map((item) => [item.title.toLowerCase(), item])
      );
      for (const item of incoming) {
        const key = item.title.toLowerCase();
        if (!byTitle.has(key)) {
          byTitle.set(key, {
            id: item.id ?? uid(),
            title: item.title,
            completed: item.completed ?? false,
          });
        }
      }
      return { ...prev, items: Array.from(byTitle.values()) };
    });
  }, [toolOutput]);

  const items = state?.items ?? [];
  const activeCount = items.filter((i) => !i.completed).length;
  const completedCount = items.filter((i) => i.completed).length;

  const filteredItems = items.filter((item) => {
    if (filter === "active") return !item.completed;
    if (filter === "completed") return item.completed;
    return true;
  });

  const addTodo = () => {
    const title = newTodo.trim();
    if (!title) return;
    setState((prev) => ({
      ...prev,
      items: [
        { id: uid(), title, completed: false },
        ...(prev?.items ?? []),
      ],
    }));
    setNewTodo("");
    inputRef.current?.focus();
  };

  const toggleTodo = (id: string) => {
    setState((prev) => ({
      ...prev,
      items: (prev?.items ?? []).map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ),
    }));
  };

  const deleteTodo = (id: string) => {
    setState((prev) => ({
      ...prev,
      items: (prev?.items ?? []).filter((item) => item.id !== id),
    }));
  };

  const clearCompleted = () => {
    setState((prev) => ({
      ...prev,
      items: (prev?.items ?? []).filter((item) => !item.completed),
    }));
  };

  return (
    <div className="min-h-screen w-full p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Todo List</h1>
          <Badge color="secondary" variant="soft">
            {activeCount} remaining
          </Badge>
        </div>

        {/* Add todo */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTodo();
            }}
            placeholder="What needs to be done?"
            size="lg"
            className="flex-1"
          />
          <Button
            onClick={addTodo}
            color="primary"
            variant="solid"
            size="lg"
            disabled={!newTodo.trim()}
          >
            Add
          </Button>
        </div>

        {/* Filter */}
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          aria-label="Filter todos"
          size="sm"
          block
        >
          <SegmentedControl.Option value="all">All</SegmentedControl.Option>
          <SegmentedControl.Option value="active">
            Active
          </SegmentedControl.Option>
          <SegmentedControl.Option value="completed">
            Completed
          </SegmentedControl.Option>
        </SegmentedControl>

        {/* Todo list */}
        {filteredItems.length === 0 ? (
          <EmptyMessage>
            <EmptyMessage.Title>
              {filter === "all"
                ? "No todos yet"
                : filter === "active"
                  ? "All done!"
                  : "Nothing completed"}
            </EmptyMessage.Title>
            <EmptyMessage.Description>
              {filter === "all"
                ? "Add your first todo above, or ask ChatGPT to add items for you."
                : filter === "active"
                  ? "All your todos are completed."
                  : "Complete some todos to see them here."}
            </EmptyMessage.Description>
          </EmptyMessage>
        ) : (
          <ul className="flex flex-col gap-1">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border-secondary)] px-3 py-2.5"
              >
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => toggleTodo(item.id)}
                />
                <span
                  className={`flex-1 text-sm ${
                    item.completed
                      ? "text-[var(--text-tertiary)] line-through"
                      : ""
                  }`}
                >
                  {item.title}
                </span>
                <Button
                  variant="ghost"
                  color="danger"
                  size="2xs"
                  onClick={() => deleteTodo(item.id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        {completedCount > 0 && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              color="secondary"
              size="sm"
              onClick={clearCompleted}
            >
              Clear completed ({completedCount})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
