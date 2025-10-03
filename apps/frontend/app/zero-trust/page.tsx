"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { ZeroTrustSnapshot } from "@kube-suite/shared";
import { AlertTriangle, KeyRound, Network, RefreshCcw, ShieldCheck, Users } from "lucide-react";

interface ClusterOption {
  id: string;
  name: string;
}

function riskLabel(score: number): { label: string; tone: string } {
  if (score >= 75) {
    return { label: "Hoog risico", tone: "text-danger" };
  }
  if (score >= 45) {
    return { label: "Gemiddeld risico", tone: "text-warning" };
  }
  return { label: "Laag risico", tone: "text-success" };
}

export default function ZeroTrustPage() {
  const [clusters, setClusters] = useState<ClusterOption[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(
    typeof window !== "undefined" ? window.localStorage.getItem("clusterId") ?? undefined : undefined
  );
  const [snapshot, setSnapshot] = useState<ZeroTrustSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(
    async (clusterId?: string) => {
      const target = clusterId ?? activeId;
      if (!target) {
        setSnapshot(null);
        setError("Selecteer een cluster om Zero Trust-data op te halen.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<ZeroTrustSnapshot>("/compliance/zero-trust", {}, target);
        setSnapshot(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kon Zero Trust-data niet laden");
      } finally {
        setLoading(false);
      }
    },
    [activeId]
  );

  useEffect(() => {
    apiFetch<ClusterOption[]>("/clusters")
      .then(items => {
        setClusters(items);
        if (!activeId && items.length > 0) {
          const firstId = items[0].id;
          setActiveId(firstId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("clusterId", firstId);
            document.cookie = `clusterId=${firstId}; path=/`;
          }
          loadSnapshot(firstId);
        }
      })
      .catch(() => setError("Kon clusters niet laden"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) {
      return;
    }
    loadSnapshot(activeId);
  }, [activeId, loadSnapshot]);

  const coverageDisplay = useMemo(() => {
    if (!snapshot) return { label: "-", percentage: 0 };
    const pct = snapshot.network.coverage;
    return { label: `${pct}% coverage`, percentage: pct };
  }, [snapshot]);

  const currentRisk = useMemo(() => {
    if (!snapshot) return null;
    return riskLabel(snapshot.riskScore);
  }, [snapshot]);

  return (
    <div className="space-y-8 px-8 pb-20">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Zero Trust posture</p>
          <h1 className="text-3xl font-semibold text-white">Identity & access hardening</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Bekijk in één oogopslag hoe veilig je cluster is op het gebied van identiteit, secrets en netwerk-segmentatie. Selecteer een cluster om live statistieken te laden.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeId ?? ""}
            onChange={event => {
              const value = event.target.value || undefined;
              setActiveId(value);
              if (value && typeof window !== "undefined") {
                window.localStorage.setItem("clusterId", value);
                document.cookie = `clusterId=${value}; path=/`;
              }
            }}
            className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/80"
          >
            <option value="" disabled>
              Selecteer cluster
            </option>
            {clusters.map(cluster => (
              <option key={cluster.id} value={cluster.id} className="text-black">
                {cluster.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadSnapshot(activeId)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:text-white"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary-500/10 via-emerald-500/10 to-transparent p-6 shadow-glow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Risk score</p>
              <h2 className="mt-2 text-4xl font-semibold text-white">
                {snapshot ? snapshot.riskScore : "--"}
              </h2>
              <p className={`mt-2 text-sm ${currentRisk?.tone ?? "text-white/50"}`}>
                {snapshot ? currentRisk?.label : "Nog geen data"}
              </p>
            </div>
            <ShieldCheck className="h-12 w-12 text-accent" />
          </div>
          <div className="mt-6">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-primary-400 to-warning"
                style={{ width: `${Math.min(100, snapshot?.riskScore ?? 0)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/40">
              Risicoscore is gewogen op identity, secrets en netwerkbeleid. Lager is beter.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <Users className="h-5 w-5 text-primary-200" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Identity surface</p>
              <p className="text-2xl font-semibold">{snapshot?.identity.privilegedRoles ?? "--"}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li>{snapshot?.identity.orphanBindings ?? 0} orphan role bindings</li>
            <li>{snapshot?.identity.serviceAccountsWithoutTokens ?? 0} service accounts zonder tokenbeheer</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <KeyRound className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Secrets posture</p>
              <p className="text-2xl font-semibold">{snapshot?.secrets.expiring ?? "--"}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li>{snapshot?.secrets.unencrypted ?? 0} unencrypted secrets</li>
            <li>{snapshot ? `${snapshot.secrets.expiring} expiring binnen 30 dagen` : "Geen data"}</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <Network className="h-5 w-5 text-primary-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Netwerksegmentatie</p>
              <p className="text-2xl font-semibold">{snapshot?.network.policies ?? "--"} policies</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>{snapshot?.network.namespacesCovered ?? 0} namespaces gedekt</span>
              <span>{snapshot?.network.totalNamespaces ?? 0} namespaces totaal</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                style={{ width: `${coverageDisplay.percentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/40">{coverageDisplay.label}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Aanbevolen maatregelen</p>
              <p className="text-2xl font-semibold">{snapshot?.recommendations.length ?? 0}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            {snapshot?.recommendations.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full bg-primary-400" />
                <span>{item}</span>
              </li>
            ))}
            {!snapshot && <li className="text-white/40">Nog geen aanbevelingen beschikbaar.</li>}
          </ul>
        </div>
      </section>

      {loading && (
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Zero Trust-data verversen...</p>
      )}
    </div>
  );
}
