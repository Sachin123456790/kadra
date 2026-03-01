import { AgentKit } from "@coinbase/agentkit";
import { getMcpTools } from "@coinbase/agentkit-model-context-protocol";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";

dotenv.config();

function readRequiredEnv() {
  const cdpApiKeyName =
    process.env.CDP_API_KEY_NAME || process.env.COINBASE_API_KEY_NAME;
  const cdpApiKeyPrivateKey =
    process.env.CDP_API_KEY_PRIVATE_KEY || process.env.COINBASE_API_KEY_SECRET;

  if (!cdpApiKeyName || !cdpApiKeyPrivateKey) {
    throw new Error(
      "Missing credentials. Set CDP_API_KEY_NAME/CDP_API_KEY_PRIVATE_KEY or COINBASE_API_KEY_NAME/COINBASE_API_KEY_SECRET in .env."
    );
  }

  return { cdpApiKeyName, cdpApiKeyPrivateKey };
}

async function main() {
  const creds = readRequiredEnv();

  const agentKit = await AgentKit.from({
    cdpApiKeyName: creds.cdpApiKeyName,
    cdpApiKeyPrivateKey: creds.cdpApiKeyPrivateKey,
  });

  const { tools, toolHandler } = await getMcpTools(agentKit);

  const server = new Server(
    {
      name: "coinbase-agentkit",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    try {
      return await toolHandler(name, toolArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool ${name} failed: ${message}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
