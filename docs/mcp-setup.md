# Coinbase AgentKit MCP Server Setup

This repo now includes an MCP server at:

- `scripts/mcp-agentkit-server.mjs`

Run it with:

```bash
npm run mcp:server
```

## Environment Variables

The server supports either env naming:

- `CDP_API_KEY_NAME` + `CDP_API_KEY_PRIVATE_KEY`
- `COINBASE_API_KEY_NAME` + `COINBASE_API_KEY_SECRET`

## Claude Code / Claude Desktop MCP Config

Add this server entry in your Claude MCP config:

```json
{
  "mcpServers": {
    "coinbase-agentkit": {
      "command": "node",
      "args": [
        "/Users/chinmay_shringi/Desktop/markus/scripts/mcp-agentkit-server.mjs"
      ],
      "cwd": "/Users/chinmay_shringi/Desktop/markus"
    }
  }
}
```

## Codex MCP Config

If your Codex setup accepts MCP server JSON entries, use:

```json
{
  "mcpServers": {
    "coinbase-agentkit": {
      "command": "node",
      "args": [
        "/Users/chinmay_shringi/Desktop/markus/scripts/mcp-agentkit-server.mjs"
      ],
      "cwd": "/Users/chinmay_shringi/Desktop/markus"
    }
  }
}
```

If your Codex config format differs, keep the same command/args/cwd values and map them to the equivalent keys.
