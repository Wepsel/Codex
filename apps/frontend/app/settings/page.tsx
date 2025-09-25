"use client";
import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

const toggles = [
  { label: "Auto-sync workloads", description: "Refresh workloads every 30s", enabled: true },
  { label: "Deploy preview protection", description: "Ask confirmation before apply", enabled: true },
  { label: "Email alerts", description: "Send critical alerts to email", enabled: false }
];

export default function SettingsPage() {
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const [caCert, setCaCert] = useState("");
  const [insecure, setInsecure] = useState(false);

  useEffect(() => {
    apiFetch<{ id: string; name: string }[]>("/clusters").then(setList).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const created = await apiFetch<{ id: string; name: string }>("/clusters", {
      method: "POST",
      body: JSON.stringify({ name, apiUrl, caCert: caCert || undefined, insecureTLS: insecure, auth: { bearerToken: token || undefined } })
    });
    setList(prev => [created, ...prev]);
    setName(""); setApiUrl(""); setToken(""); setCaCert(""); setInsecure(false);
  }
  return (
    <div className="space-y-10 px-8 pb-16">
      <header className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-accent" />
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Instellingen</p>
          <h1 className="text-3xl font-semibold text-white">Personaliseer je command center</h1>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {toggles.map(toggle => (
          <article key={toggle.label} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{toggle.label}</h2>
                <p className="text-sm text-white/50">{toggle.description}</p>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full border border-white/10 bg-white/10 p-1 ${
                  toggle.enabled ? "justify-end" : "justify-start"
                }`}
              >
                <span className="h-4 w-4 rounded-full bg-gradient-to-r from-primary-500 to-accent shadow" />
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <h2 className="mb-4 text-lg font-semibold text-white">Cluster toevoegen</h2>
          <div className="grid gap-3">
            <input className="rounded-md bg-black/30 p-2 text-sm text-white/90 border border-white/10" placeholder="Naam" value={name} onChange={e => setName(e.target.value)} />
            <input className="rounded-md bg-black/30 p-2 text-sm text-white/90 border border-white/10" placeholder="API URL (https://host:6443)" value={apiUrl} onChange={e => setApiUrl(e.target.value)} />
            <textarea className="rounded-md bg-black/30 p-2 text-sm text-white/90 border border-white/10" placeholder="Bearer token (optioneel als je certs gebruikt)" value={token} onChange={e => setToken(e.target.value)} />
            <textarea className="rounded-md bg-black/30 p-2 text-sm text-white/90 border border-white/10" placeholder="CA cert PEM (optioneel)" value={caCert} onChange={e => setCaCert(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={insecure} onChange={e => setInsecure(e.target.checked)} />
              Skip TLS verify (alleen lab)
            </label>
            <button type="submit" className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black">Opslaan</button>
          </div>
        </form>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <h2 className="mb-4 text-lg font-semibold text-white">Jouw clusters</h2>
          <ul className="space-y-2">
            {list.map(c => (
              <li key={c.id} className="flex items-center justify-between rounded-md bg-black/30 p-3 text-sm text-white/80">
                <span>{c.name}</span>
                <button onClick={async () => {
                  await apiFetch(`/clusters/${c.id}`, { method: "DELETE" });
                  setList(prev => prev.filter(x => x.id !== c.id));
                  if (localStorage.getItem("clusterId") === c.id) localStorage.removeItem("clusterId");
                }} className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10">Verwijderen</button>
              </li>
            ))}
            {list.length === 0 && <li className="text-xs text-white/40">Nog geen clusters toegevoegd</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
