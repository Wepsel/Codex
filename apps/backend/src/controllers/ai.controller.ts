import type { Response } from "express";
import type { RequestWithUser } from "../types";
import env from "../config/env";
import fetch from "node-fetch";

export async function analyzeLogs(req: RequestWithUser, res: Response) {
  if (!env.openAiApiKey) {
    res.status(400).json({ ok: false, error: "OPENAI_API_KEY not configured" });
    return;
  }
  const { lines } = req.body as { lines: string[] };
  const content = `You are a Kubernetes SRE assistant. Analyze these recent pod logs and output: 1) Root cause hypotheses; 2) Probable component; 3) Concrete next actions (kubectl or config changes). Keep it brief.\n\nLogs:\n${(lines || []).slice(0, 200).join("\n")}`;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openAiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        temperature: 0.2,
        max_tokens: 300
      })
    });
    if (!resp.ok) {
      const t = await resp.text();
      res.status(500).json({ ok: false, error: t });
      return;
    }
    const json = (await resp.json()) as any;
    const answer = json.choices?.[0]?.message?.content ?? "No answer";
    res.json({ ok: true, data: { answer } });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}


