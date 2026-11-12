import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "public");
const port = Number(process.env.PORT || 3000);
const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const systemPrompt = process.env.SYSTEM_PROMPT || "You are Orbit, a concise, friendly AI assistant. Give practical answers and use clear formatting.";
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

export function safeMessages(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-20).filter(m => ["user", "assistant"].includes(m?.role) && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function chat(req, res) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200_000) return json(res, 413, { error: "Request is too large." });
  }
  let body;
  try { body = JSON.parse(raw); } catch { return json(res, 400, { error: "Invalid JSON." }); }
  const messages = safeMessages(body.messages);
  if (!messages.length || messages.at(-1).role !== "user") return json(res, 400, { error: "A user message is required." });

  while (messages[0]?.role === "assistant") messages.shift(); // Claude requires the first turn to be the user's
  if (!client) {
    const prompt = messages.at(-1).content;
    return json(res, 200, { demo: true, message: `Demo mode is working. You asked: “${prompt}”\n\nAdd an ANTHROPIC_API_KEY to receive a live AI response.` });
  }
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: systemPrompt,
      messages,
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default"
    });
    if (response.stop_reason === "refusal") return json(res, 200, { message: "Sorry, I can't help with that request." });
    const message = response.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    return json(res, 200, { message: message || "The model returned no text." });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json(res, 401, { error: "The Anthropic API key was rejected. Check the ANTHROPIC_API_KEY secret." });
    if (error instanceof Anthropic.RateLimitError) return json(res, 429, { error: "Rate limited by the AI provider. Try again shortly." });
    if (error instanceof Anthropic.APIError && error.status) return json(res, error.status >= 500 ? 502 : error.status, { error: error.message });
    console.error(error);
    return json(res, 502, { error: "Could not reach the AI provider." });
  }
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/healthz") return json(res, 200, { status: "ok" });
  if (url.pathname === "/api/chat" && req.method === "POST") return chat(req, res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = normalize(join(root, requested));
  if (!file.startsWith(root)) return json(res, 403, { error: "Forbidden." });
  try {
    const content = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "x-content-type-options": "nosniff" });
    res.end(content);
  } catch { json(res, 404, { error: "Not found." }); }
});

if (process.env.NODE_ENV !== "test") server.listen(port, "0.0.0.0", () => console.log(`Orbit listening on :${port}`));
