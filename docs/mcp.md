# MCP Integration Guide
Last reviewed: 2025-02-21  
Applies to: ax-cli/ax-glm/ax-grok v4.4.x

Model Context Protocol (MCP) lets the CLI call external tools/services through a standard interface. This guide covers the current, supported usage.

## What MCP is (in this CLI)
- The CLI acts as an MCP client. You register MCP servers and the agent can call their tools.
- Supported transports: stdio, HTTP, SSE (per the MCP SDK we ship).
- Token/output limits and health checks are configurable (see `config-defaults/settings.yaml` under `mcp`).

## Where configuration lives
- User scope (per provider): `~/.ax-<provider>/.mcp.json`
- Project scope (per provider): `./.ax-<provider>/.mcp.json`
- Provider directories are isolated (`.ax-glm`, `.ax-grok`, `.ax-cli`).

## Minimal stdio server config example
```json
{
  "servers": [
    {
      "name": "local-tools",
      "transport": {
        "type": "stdio",
        "command": "node",
        "args": ["./scripts/mcp-server.js"],
        "env": {}
      }
    }
  ]
}
```

## Minimal HTTP/SSE server config example
```json
{
  "servers": [
    {
      "name": "remote-api",
      "transport": {
        "type": "http",
        "url": "https://example.com/mcp",
        "headers": {
          "Authorization": "Bearer <token>"
        }
      }
    }
  ]
}
```

## Adding a server (workflow)
1) Create/update the `.mcp.json` under the provider you’re using.  
2) Restart the CLI session so it reloads MCP configs.  
3) List/discover tools (the agent surfaces them once connected).

## Best practices
- Keep secrets in env vars; reference them in the MCP config via the process environment when launching the server.
- Use separate MCP configs per provider to avoid cross-talk (GLM vs Grok vs local).
- Set output limits to prevent flooding context (`mcp.token` limits in `config-defaults/settings.yaml`).
- Prefer stdio for local dev, HTTP/SSE for hosted services.

## Troubleshooting MCP
- Connection errors: confirm the transport type and URL/command exist on your system.
- Long outputs truncated: adjust `token_warning_threshold` / `token_hard_limit` in settings.
- Server crashes: run the MCP server manually with the same command to inspect logs.
- If MCP should be disabled for a repo, remove or rename `./.ax-<provider>/.mcp.json`.

For MCP-specific templates and advanced setups, consult the MCP SDK docs shipped with the CLI; the examples above reflect what the current agent supports.***
