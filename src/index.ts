#!/usr/bin/env node
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// Dynamic import ensures .env is loaded before configuration modules evaluate.
config({path:fileURLToPath(new URL("../.env",import.meta.url)),quiet:true});
const { createServer }=await import("./server.js");
try {
  await createServer().connect(new StdioServerTransport());
  console.error("[bricksmaven] MCP server running over stdio");
} catch { console.error("[bricksmaven] Server startup failed");process.exitCode=1; }
