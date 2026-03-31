import { Redis } from "@upstash/redis";

type TodoItem = { id: string; title: string; completed: boolean };

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const STORAGE_ENABLED = !!(REDIS_URL && REDIS_TOKEN);

let redis: Redis | null = null;
if (STORAGE_ENABLED) {
  redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
}

function key(userId: string): string {
  return `todos:${userId}`;
}

export async function loadTodos(userId: string): Promise<TodoItem[]> {
  if (!redis) return [];
  const data = await redis.get<TodoItem[]>(key(userId));
  return data ?? [];
}

export async function saveTodos(
  userId: string,
  items: TodoItem[]
): Promise<void> {
  if (!redis) return;
  await redis.set(key(userId), items);
}

export async function deleteTodos(userId: string): Promise<void> {
  if (!redis) return;
  await redis.del(key(userId));
}
