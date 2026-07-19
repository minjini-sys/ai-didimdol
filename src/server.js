import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config.js";
import { runDidimdolPipeline } from "./pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const config = getConfig();

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/route") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");
      if (!payload.input || typeof payload.input !== "string") {
        return sendJson(res, 400, { error: "input is required" });
      }
      const result = await runDidimdolPipeline(payload.input, config, {
        answers: payload.answers || {},
        approvedSkillIds: payload.approvedSkillIds || [],
        rejectedSkillIds: payload.rejectedSkillIds || [],
        skillConsent: payload.skillConsent || ""
      });
      return sendJson(res, 200, result);
    }

    if (req.method === "GET") {
      return serveStatic(req, res);
    }

    sendJson(res, 405, { error: "method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(config.port, "127.0.0.1", () => {
  console.log(`AI Didimdol running at http://127.0.0.1:${config.port}`);
});

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${config.port}`);
  const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const target = path.normalize(path.join(publicDir, relative));
  if (!target.startsWith(publicDir)) return sendText(res, 403, "forbidden");

  const data = await fs.readFile(target).catch(() => null);
  if (!data) return sendText(res, 404, "not found");

  const type = contentType(target);
  res.writeHead(200, { "Content-Type": type });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function contentType(filePath) {
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/html; charset=utf-8";
}

