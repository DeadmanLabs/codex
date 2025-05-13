#!/usr/bin/env node
import "dotenv/config";
import http from "node:http";
import { WebSocketServer } from "ws";
// Use fs/promises for async methods and fs for sync methods
import * as fsp from "fs/promises";
import * as fsSync from "fs";
import path from "path";
// __dirname replacement for ES modules
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import chokidar from "chokidar";
import { MongoClient } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { OpenAI } from "openai";
import { loadConfig } from "./utils/config";
import { createInputItem } from "./utils/input-utils";
import { AgentLoop } from "./utils/agent/agent-loop";
import { ReviewDecision } from "./utils/agent/review";

// Ensure API key is set
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OpenAI API key (set OPENAI_API_KEY)");
  process.exit(1);
}

(async () => {
  // Load configuration
  let config = loadConfig(undefined, undefined, { cwd: process.cwd() });
  config = { apiKey, ...config };

  // Initialize MongoDB client
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MongoDB URI (set MONGODB_URI)");
    process.exit(1);
  }
  const mongoDbName = process.env.MONGODB_DB || "codex";
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db(mongoDbName);
  const chatsCol = db.collection("chats");
  const messagesCol = db.collection("messages");

  // OpenAI client for title generation
  const titleClient = new OpenAI({ apiKey });

  // Track current chat session
  let currentChatId: string | null = null;

  // History of items
  const items: Array<any> = [];

  // WebSocket server for streaming updates
  const wss = new WebSocketServer({ noServer: true });

  // Dynamically load all tool definitions from src/tools directory
  const toolsDir = path.join(__dirname, 'tools');
  const availableTools: any[] = [];
  if (fsSync.existsSync(toolsDir)) {
    for (const file of fsSync.readdirSync(toolsDir)) {
      if (file.endsWith('.js')) {
        try {
          const mod = require(path.join(toolsDir, file));
          const defs = mod.tools || mod.default;
          if (Array.isArray(defs)) availableTools.push(...defs);
        } catch (e) {
          console.error('Failed to load tool:', file, e);
        }
      }
    }
  }

  // Broadcast helper
  function broadcast(message: any) {
    const data = JSON.stringify(message);
    wss.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });
  }

  // Watch filesystem for directory changes, emit incremental fs_event messages via chokidar
  const watchDir = process.cwd();
  try {
    const watcher = chokidar.watch(watchDir, { ignoreInitial: true, persistent: true });
    // File added
    watcher.on('add', (fullPath) => {
      const relPath = path.relative(watchDir, fullPath);
      broadcast({ type: 'fs_event', event: 'add', path: relPath, nodeType: 'file' });
    });
    // Directory added
    watcher.on('addDir', (fullPath) => {
      const relPath = path.relative(watchDir, fullPath);
      broadcast({ type: 'fs_event', event: 'add', path: relPath, nodeType: 'folder' });
    });
    // File removed
    watcher.on('unlink', (fullPath) => {
      const relPath = path.relative(watchDir, fullPath);
      broadcast({ type: 'fs_event', event: 'unlink', path: relPath });
    });
    // Directory removed
    watcher.on('unlinkDir', (fullPath) => {
      const relPath = path.relative(watchDir, fullPath);
      broadcast({ type: 'fs_event', event: 'unlink', path: relPath });
    });
    watcher.on('error', (error) => {
      console.error('Filesystem watch error:', error);
    });
  } catch (e) {
    console.error('Failed to watch directory for changes', e);
  }

  // Initialize AgentLoop with full-auto approval
  let agent = new AgentLoop({
    model: config.model,
    config,
    instructions: config.instructions,
    approvalPolicy: "full-auto",
    additionalWritableRoots: [],
    // Handle each new item: broadcast and persist in MongoDB
    onItem: async (item) => {
      items.push(item);
      broadcast({ type: "item", item });
      if (currentChatId) {
        const ts = new Date();
        const dir = process.cwd();
        if (item.type === "function_call") {
          // Record tool use without contents
          await messagesCol.insertOne({
            chatId: currentChatId,
            role: "assistant",
            type: "tool",
            text: `Tool Use: ${item.name}`,
            timestamp: ts,
            directory: dir
          });
        } else if (item.type === "message") {
          // Record chat messages
          const text = (item.content || []).map((c: any) => c.text).join("");
          await messagesCol.insertOne({
            chatId: currentChatId,
            role: item.role,
            type: "message",
            text,
            timestamp: ts,
            directory: dir
          });
        }
      }
    },
    onLoading: (loading) => broadcast({ type: "loading", loading }),
    getCommandConfirmation: async (_cmd, patch) => ({ review: ReviewDecision.YES, applyPatch: patch }),
    onLastResponseId: (id) => broadcast({ type: "lastResponseId", id }),
  });

  // HTTP server
  const server = http.createServer(async (req, res) => {
    // Route to voice-management handlers
    try {
      const vm = await import('./voice-management');
      if (await vm.handleVoiceRequest(req, res)) return;
    } catch {}
    // Route to knowledge-management handlers
    try {
      const km = await import('./knowledge-management');
      if (await km.handleKnowledgeRequest(req, res)) return;
    } catch {}
    const { method = "", url = "" } = req;
    const reqUrl = new URL(url, `http://${req.headers.host}`);
    // GET /tools to list available function tools
    if (method === "GET" && reqUrl.pathname === "/tools") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tools: availableTools }));
      return;
    }
    // WebSocket upgrade path
    if (reqUrl.pathname === "/ws") {
      res.writeHead(426);
      res.end("Upgrade Required");
      return;
    }
    // POST /prompt to submit a new prompt
    if (method === "POST" && reqUrl.pathname === "/prompt") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const { prompt } = JSON.parse(body);
          if (typeof prompt !== "string" || prompt.trim() === "") {
            throw new Error("Invalid prompt");
          }
          // On first prompt, create new chat session
          if (!currentChatId) {
            currentChatId = uuidv4();
            // Generate chat title using OpenAI
            const titleRes = await titleClient.chat.completions.create({
              model: config.model,
              messages: [
                { role: "system", content: "Generate a concise, descriptive title for this chat session." },
                { role: "user", content: prompt }
              ]
            });
            const title = titleRes.choices?.[0]?.message?.content.trim() || "New Chat";
            // Persist chat metadata
            await chatsCol.insertOne({
              chatId: currentChatId,
              title,
              initialPrompt: prompt,
              createdAt: new Date(),
              directory: process.cwd(),
              tokenUsage: { input: 0, output: 0, cached: 0 }
            });
          }
          // Record user prompt message
          if (currentChatId) {
            await messagesCol.insertOne({
              chatId: currentChatId,
              role: "user",
              type: "message",
              text: prompt,
              timestamp: new Date(),
              directory: process.cwd()
            });
          }
          // Run agent on new prompt
          const inputItem = await createInputItem(prompt, []);
          agent.run([inputItem]);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err: any) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    // GET /state to retrieve current history and status
    if (method === "GET" && reqUrl.pathname === "/state") {
      // Build directory tree of current working directory
      let tree: Array<any> = [];
      const cwd = process.cwd();
      async function buildTree(dir: string): Promise<any[]> {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        const nodes = await Promise.all(entries.map(async (entry) => {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(cwd, fullPath) || entry.name;
          if (entry.isDirectory()) {
            const children = await buildTree(fullPath);
            return { id: relPath, label: entry.name, type: 'folder', defaultExpanded: false, children };
          } else {
            return { id: relPath, label: entry.name, type: 'file' };
          }
        }));
        return nodes;
      }
      try {
        tree = await buildTree(cwd);
      } catch (e) {
        console.error('Failed to build directory tree', e);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          items,
          cwd,
          model: config.model,
          tree,
        }),
      );
      return;
    }
    // Query all chats
    if (method === "GET" && reqUrl.pathname === "/chats") {
      const chats = await chatsCol
        .find({})
        .project({ _id: 0, chatId: 1, title: 1, createdAt: 1, directory: 1 })
        .toArray();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ chats }));
      return;
    }
    // Query chat metadata by chatId
    {
      const m = reqUrl.pathname.match(/^\/chats\/([^\/]+)$/);
      if (method === "GET" && m) {
        const chatId = m[1];
        const chat = await chatsCol.findOne({ chatId });
        if (!chat) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Chat not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(chat));
        return;
      }
    }
    // Query messages for a chat
    {
      const m2 = reqUrl.pathname.match(/^\/chats\/([^\/]+)\/messages$/);
      if (method === "GET" && m2) {
        const chatId = m2[1];
        const messages = await messagesCol
          .find({ chatId })
          .sort({ timestamp: 1 })
          .toArray();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ messages }));
        return;
      }
    }
    // Fallback
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  // Handle WebSocket upgrades for Codex streaming (support both /ws and /codex-ws)
  server.on("upgrade", (req, socket, head) => {
    const { url = "" } = req;
    const reqUrl = new URL(url, `http://${req.headers.host}`);
    if (reqUrl.pathname === "/ws" || reqUrl.pathname === "/codex-ws") {
      // Upgrade to WebSocket
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // Start listening
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Codex server listening on http://localhost:${port}`);
    console.log(`WebSocket endpoints: ws://localhost:${port}/ws and ws://localhost:${port}/codex-ws`);
  });
})();