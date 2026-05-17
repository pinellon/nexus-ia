import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAgentStatus, orchestrate, type AgentName } from "./nexus-orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");
const port = Number(process.env.PORT || 4000);

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.ANTHROPIC_API_KEY ? "live-ready" : "mock-ready",
    agents: getAgentStatus()
  });
});

app.post("/api/orchestrate", async (req, res) => {
  const { prompt, context, language, agents } = req.body as {
    prompt?: string;
    context?: string;
    language?: string;
    agents?: AgentName[];
  };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "prompt e obrigatorio" });
  }

  try {
    const result = await orchestrate({
      prompt: prompt.trim(),
      context: context?.trim(),
      language: language?.trim(),
      agents: Array.isArray(agents) ? agents : undefined
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Falha interna no orquestrador"
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Nexus MVP rodando em http://localhost:${port}`);
});
