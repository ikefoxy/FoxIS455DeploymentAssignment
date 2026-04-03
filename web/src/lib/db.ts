import path from "node:path";
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

/** Local: `web/data/shop.db`. Production on Vercel: set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (Turso / libSQL). */
export function getDb(): Client {
  if (client) return client;

  const remote = process.env.TURSO_DATABASE_URL;
  if (remote) {
    client = createClient({
      url: remote,
      authToken: process.env.TURSO_AUTH_TOKEN ?? "",
    });
    return client;
  }

  const file = path.join(process.cwd(), "data", "shop.db");
  client = createClient({ url: `file:${file}` });
  return client;
}
