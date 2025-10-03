"use client";

import { apiFetch } from "@/lib/api-client";
import { useEffect, useMemo, useState } from "react";
import { Search, Filter, Wand2, RefreshCw } from "lucide-react";
import type { LiveLogEntry } from "@kube-suite/shared";

export default function LogsPage() {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<string>("all");
  const [analysis, setAnalysis] = useState<string>("");
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState<string>("default");
  const [pods, setPods] = useState<Array<{ name: string; containers: string[] }>>([]);
  const [pod, setPod] = useState<string>("");
  const [container, setContainer] = useState<string>("");
  const [logs, setLogs] = useState<LiveLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<string[]>("/cluster/namespaces")
      .then(list => {
        setNamespaces(list);
        if (list.length > 0 && !list.includes(namespace)) {
          setNamespace(list[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!namespace) return;
    apiFetch<Array<{ name: string; containers: string[] }>>(`/cluster/namespaces/${namespace}/pods`)
      .then(list => {
        setPods(list);
        if (list.length > 0) {
          setPod(prev => (prev && list.some(p => p.name === prev) ? prev : list[0].name));
          const selected = list.find(p => p.name === (pod || list[0].name));
          if (selected) {
            setContainer(prev => (prev && selected.containers.includes(prev) ? prev : (selected.containers[0] ?? "")));
          }
        } else {
          setPod("");
          setContainer("");
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  async function loadLogs() {
    if (!namespace || !pod) {
      setLogs([]);
      return;
    }
    setLoading(true);
    try {
      const qs = container ? `?container=${encodeURIComponent(container)}` : "";
      const data = await apiFetch<LiveLogEntry[]>(`/cluster/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(pod)}/logs${qs}`);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pod, container]);

  const filtered = useMemo(() => {
    return logs.filter(
      log =>
        (level === "all" || log.level === level) &&
        `${log.pod} ${log.container} ${log.message}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [logs, query, level]);

  async function analyze() {
    const lines = filtered
      .slice(0, 50)
      .map(log => `${log.level.toUpperCase()} ${log.pod}/${log.container}: ${log.message}`);

    try {
      const response = await apiFetch<{ answer: string }>("/ai/analyze", {
        method: "POST",
        body: JSON.stringify({ lines })
      });
      setAnalysis(response.answer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAnalysis(`AI analyze failed: ${message}`);
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
            <span className="text-xs text-white/50">Namespace</span>
            <select value={namespace} onChange={e => setNamespace(e.target.value)} className="bg-transparent text-sm text-white/80 focus:outline-none">
              {namespaces.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-xs text-white/50">Pod</span>
            <select value={pod} onChange={e => setPod(e.target.value)} className="bg-transparent text-sm text-white/80 focus:outline-none">
              {pods.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-xs text-white/50">Container</span>
            <select value={container} onChange={e => setContainer(e.target.value)} className="bg-transparent text-sm text-white/80 focus:outline-none">
              {(pods.find(x => x.name === pod)?.containers ?? []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button onClick={loadLogs} disabled={loading} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-white/50" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Zoek pods/containers/tekst"
              className="bg-transparent text-sm text-white/80 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
            <Filter className="h-4 w-4 text-white/50" />
            <select
              value={level}
              onChange={event => setLevel(event.target.value)}
              className="bg-transparent text-sm text-white/80 focus:outline-none"
            >
              <option value="all">Alle</option>
              <option value="error">error</option>
              <option value="warn">warn</option>
              <option value="info">info</option>
              <option value="debug">debug</option>
            </select>
          </div>
          <button
            onClick={analyze}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black"
          >
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
            {filtered.slice(0, 200).map((log, index) => (
              <tr key={`${log.pod}-${log.timestamp}-${index}`} className="hover:bg-white/5">
                <td className="px-4 py-2 text-white/50">{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${
                      log.level === "error"
                        ? "bg-danger/20 text-danger"
                        : log.level === "warn"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-white/10 text-white/70"
                    }`}
                  >
                    {log.level}
                  </span>
                </td>
                <td className="px-4 py-2 text-white/70">{log.pod}</td>
                <td className="px-4 py-2 text-white/50">{log.container}</td>
                <td className="px-4 py-2 text-white/80">{log.message}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-xs text-white/40" colSpan={5}>
                  Geen logs gevonden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
