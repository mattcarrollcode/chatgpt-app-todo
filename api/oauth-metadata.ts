export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  const resourceUrl = process.env.RESOURCE_SERVER_URL || "";
  const authServerUrl = process.env.AUTHORIZATION_SERVER_URL || "";

  if (!resourceUrl || !authServerUrl) {
    return res.status(503).json({ error: "OAuth not configured" });
  }

  return res.json({
    resource: resourceUrl,
    authorization_servers: [authServerUrl],
    scopes_supported: [],
  });
}
