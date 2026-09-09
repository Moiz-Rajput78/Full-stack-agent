import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { resolve } from "node:path";

const isProduction = process.env.NODE_ENV === "production";

const localDbPath = resolve(process.cwd(), "mastra.db");

let memoryStore: LibSQLStore;

if (isProduction) {
  const tursoDatabaseUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoDatabaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not set in production");
  }

  if (!tursoAuthToken) {
    throw new Error("TURSO_AUTH_TOKEN is not set in production");
  }

  memoryStore = new LibSQLStore({
    id: "meeting-assistant-memory",
    url: tursoDatabaseUrl,
    authToken: tursoAuthToken,
  });

  console.log("Mastra memory: using Turso production database");
} else {
  memoryStore = new LibSQLStore({
    id: "meeting-assistant-memory",
    url: `file:${localDbPath}`,
  });

  console.log(`Mastra memory: using local database at ${localDbPath}`);
}

export function createAgentMemory() {
  return new Memory({
    storage: memoryStore,
    options: {
      lastMessages: 20,
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: `# Meeting preferences
- Timezone:
- Default meeting length (minutes):
- Preferred meeting hours:
- Usual invitees:
- Notes:
`,
      },
    },
  });
}