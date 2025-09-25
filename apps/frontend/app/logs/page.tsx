"use client";

import { useLiveFeed } from "@/hooks/use-live-feed";
import { apiFetch } from "@/lib/api-client";
import { useMemo, useState } from "react";
import { Search, Filter, Wand2 } from "lucide-react";

export default function LogsPage() {
  const feed = useLiveFeed();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<string>("all");
  const [analysis, setAnalysis] = useState<string>("");

  const allLogs = useMemo(() => feed.logs, [feed.logs]);

  const filtered = useMemo(() => {
    return allLogs.filter(l => (level === "all" || l.level === level) && `${l.pod} ${l.container} ${l.message}`.toLowerCase().includes(query.toLowerCase()));
  }, [allLogs, query, level]);

  async function analyze() {
    const lines = filtered.slice(0, 50).map(l => `${l.level.toUpperCase()} ${l.pod}/${l.container}: ${l.message}`);
    try {
      const resp = await apiFetch<{ answer: string }>("/ai/analyze", { method: "POST", body: JSON.stringify({ lines }) });
      setAnalysis(resp.answer);
    } catch (e: any) {
      setAnalysis("AI analyze failed: " + (e?.message ?? e));
    }
  }

  return (
    <div className="space-y-8 px-8 pb-16">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Logs</p>
          <h1 className="text-3xl font-semibold text-white">Live cluster logs</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-white/50" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Zoek pods/containers/tekst"
              className="bg-transparent text-sm text-white/80 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
            <Filter className="h-4 w-4 text-white/50" />
            <select value={level} onChange={e => setLevel(e.target.value)} className="bg-transparent text-sm text-white/80 focus:outline-none">
              <option value="all">Alle</option>
              <option value="error">error</option>
              <option value="warn">warn</option>
              <option value="info">info</option>
              <option value="debug">debug</option>
            </select>
          </div>
          <button onClick={analyze} className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black">
            <Wand2 className="h-4 w-4" /> Analyze
          </button>
        </div>
      </header>

      {analysis && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">AI hints</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-white/80">{analysis}</pre>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-black/30">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/5 text-xs uppercase tracking-[0.35em] text-white/40">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Pod</th>
              <th className="px-4 py-3">Container</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.slice(0, 200).map((l, i) => (
              <tr key={`${l.pod}-${l.timestamp}-${i}`} className="hover:bg-white/5">
                <td className="px-4 py-2 text-white/50">{new Date(l.timestamp).toLocaleTimeString()}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${
                    l.level === "error" ? "bg-danger/20 text-danger" : l.level === "warn" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/70"
                  }`}>{l.level}</span>
                </td>
                <td className="px-4 py-2 text-white/70">{l.pod}</td>
                <td className="px-4 py-2 text-white/50">{l.container}</td>
                <td className="px-4 py-2 text-white/80">{l.message}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-xs text-white/40" colSpan={5}>Geen logs gevonden</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


