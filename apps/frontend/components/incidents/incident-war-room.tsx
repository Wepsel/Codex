"use client";

import { useEffect, useMemo, useState } from "react";
import type { IncidentWarRoomData } from "@kube-suite/shared";
import {
  Activity,
  ArrowUpRight,
  Clock3,
  Flame,
  NotebookPen,
  PlayCircle,
  Send,
  Siren,
  UserRound,
  Video,
  X
} from "lucide-react";

interface IncidentWarRoomProps {
  warRoom: IncidentWarRoomData;
}

export function IncidentWarRoom({ warRoom }: IncidentWarRoomProps) {
  const [open, setOpen] = useState(true);
  const [notes, setNotes] = useState(warRoom.notes);
  const [noteDraft, setNoteDraft] = useState("");
  const [metrics, setMetrics] = useState(warRoom.metrics);
  const [duration, setDuration] = useState(getDuration(warRoom.startedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev =>
        prev.map(metric => {
          const jitter = metric.trend === "down" ? -Math.random() * 2 : Math.random() * 2;
          const next = Number((metric.value + jitter).toFixed(1));
          return { ...metric, value: Math.max(0, next) };
        })
      );
      setDuration(getDuration(warRoom.startedAt));
    }, 10_000);
    return () => clearInterval(interval);
  }, [warRoom.startedAt]);

  const severityAccent = useMemo(() => {
    switch (warRoom.severity) {
      case "critical":
        return "from-danger via-danger/70 to-danger/40";
      case "high":
        return "from-warning via-warning/70 to-warning/40";
      default:
        return "from-accent via-accent/70 to-accent/40";
    }
  }, [warRoom.severity]);

  function handleAddNote() {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    const newNote = {
      id: cryptoId(),
      author: "Jij",
      timestamp: new Date().toISOString(),
      content: trimmed
    };
    setNotes(prev => [newNote, ...prev]);
    setNoteDraft("");
  }

  return (
    <div className="relative space-y-10 px-8 pb-20">
      <div className="absolute inset-0 bg-grid-glow opacity-20" aria-hidden />
      <header className="relative z-10 flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-white/40">Incident command</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">War room - {warRoom.title}</h1>
          <p className="mt-2 text-sm text-white/60">
            Volg bridges, notities, metrics en het postmortem concept in een cinematic noodmodus.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/80">
            Status: <span className="ml-2 uppercase tracking-[0.35em] text-danger">{warRoom.status}</span>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-danger via-primary-500 to-accent px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-background shadow-glow transition hover:shadow-[0_0_35px_rgba(255,60,80,0.45)]"
          >
            <Flame className="h-4 w-4" /> Launch war room
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur" />
          <div className="relative z-10 h-full w-full max-w-6xl rounded-3xl border border-danger/40 bg-[#0b0b16] shadow-[0_0_60px_rgba(255,0,0,0.25)]">
            <div className="flex h-full flex-col">
              <header className="flex items-start justify-between gap-4 border-b border-danger/20 bg-gradient-to-r from-black via-black/60 to-danger/20 px-8 py-6">
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/40">
                    <span>Incident {warRoom.incidentId.slice(0, 8)}</span>
                    <span className="hidden sm:block">Commander {warRoom.commander}</span>
                    <span className="hidden sm:block">Looptijd {duration}</span>
                  </div>
                  <h2 className="mt-3 flex items-center gap-3 text-2xl font-semibold text-white">
                    <Siren className="h-6 w-6 text-danger" /> {warRoom.title}
                  </h2>
                  <p className="mt-2 text-sm text-white/60">Severity {warRoom.severity.toUpperCase()} - gestart {new Date(warRoom.startedAt).toLocaleTimeString()}</p>
                </div>
                <div className="flex flex-col items-end gap-4">
                  <span className={`rounded-full border border-white/10 bg-gradient-to-r ${severityAccent} px-4 py-2 text-xs uppercase tracking-[0.35em] text-white`}>Live bridge</span>
                  <button
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/60 transition hover:text-white"
                  >
                    <X className="h-4 w-4" /> Sluit overlay
                  </button>
                </div>
              </header>

              <div className="flex flex-1 gap-6 overflow-hidden p-6">
                <div className="flex w-full flex-col gap-6 overflow-hidden lg:w-2/3">
                  <section className="rounded-3xl border border-white/10 bg-black/40 p-5 shadow-glow">
                    <header className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Video bridges</p>
                        <h3 className="text-lg font-semibold text-white">Live command links</h3>
                      </div>
                      <Video className="h-5 w-5 text-accent" />
                    </header>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {warRoom.videoRooms.map(room => (
                        <button
                          key={room.url}
                          onClick={() => window.open(room.url, "_blank")}
                          className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/80 transition hover:border-accent/40 hover:bg-black/60"
                        >
                          <div className="flex items-center justify-between text-white">
                            <span className="font-semibold">{room.name}</span>
                            <ArrowUpRight className="h-4 w-4 text-accent transition group-hover:translate-x-1 group-hover:-translate-y-1" />
                          </div>
                          <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/40">
                            <span>{room.participants} deelnemers</span>
                            <span>SECURE</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="flex flex-1 flex-col rounded-3xl border border-white/10 bg-black/40 p-5 shadow-glow">
                    <header className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Notes</p>
                        <h3 className="text-lg font-semibold text-white">Live triage log</h3>
                      </div>
                      <NotebookPen className="h-5 w-5 text-primary-200" />
                    </header>
                    <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-2">
                      {notes.map(entry => (
                        <article key={entry.id} className="rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-white/80">
                          <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/40">
                            <span>{entry.author}</span>
                            <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="mt-2 text-white/80">{entry.content}</p>
                        </article>
                      ))}
                      {notes.length === 0 && (
                        <div className="rounded-xl border border-white/10 bg-black/60 p-4 text-xs text-white/50">
                          Nog geen notities toegevoegd.
                        </div>
                      )}
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/60 p-3">
                      <textarea
                        value={noteDraft}
                        onChange={event => setNoteDraft(event.target.value)}
                        className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                        placeholder="Vat onderzoek samen..."
                      />
                      <div className="mt-3 flex items-center justify-between text-xs text-white/40">
                        <span>Shift enter om te sturen</span>
                        <button
                          onClick={handleAddNote}
                          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-background"
                        >
                          <Send className="h-4 w-4" /> Voeg note toe
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-black/40 p-5 shadow-glow">
                    <header className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Postmortem draft</p>
                        <h3 className="text-lg font-semibold text-white">Automatisch gegenereerd overzicht</h3>
                      </div>
                      <Activity className="h-5 w-5 text-success" />
                    </header>
                    <p className="mt-4 text-sm text-white/70">{warRoom.postmortemDraft.summary}</p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="text-xs uppercase tracking-[0.35em] text-white/40">Timeline</h4>
                        <ul className="mt-3 space-y-3 text-sm text-white/80">
                          {warRoom.postmortemDraft.timeline.map(point => (
                            <li key={point.timestamp} className="rounded-xl border border-white/10 bg-black/60 p-3">
                              <div className="text-xs uppercase tracking-[0.35em] text-white/40">{new Date(point.timestamp).toLocaleTimeString()}</div>
                              <p className="mt-1 text-white/80">{point.description}</p>
                              {point.owner && <p className="text-xs text-white/40">Owner {point.owner}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs uppercase tracking-[0.35em] text-white/40">Action items</h4>
                        <ul className="mt-3 space-y-3 text-sm text-white/80">
                          {warRoom.postmortemDraft.actionItems.map(item => (
                            <li key={item.id} className="rounded-xl border border-white/10 bg-black/60 p-3">
                              <p className="font-semibold text-white">{item.description}</p>
                              <p className="text-xs text-white/50">Owner {item.owner}</p>
                              <p className="text-xs text-white/40">Due {new Date(item.dueDate).toLocaleDateString()}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="hidden w-full flex-col gap-6 overflow-y-auto pr-1 lg:flex lg:w-1/3">
                  <section className="rounded-3xl border border-white/10 bg-black/40 p-5 shadow-glow">
                    <header className="flex items-center justify-between text-white">
                      <h3 className="text-lg font-semibold">Incident vitals</h3>
                      <Clock3 className="h-5 w-5 text-accent" />
                    </header>
                    <ul className="mt-4 space-y-3 text-sm text-white/70">
                      <li className="flex items-center justify-between rounded-xl border border-white/10 bg-black/60 p-3">
                        <span>Commander</span>
                        <span className="text-white/90">{warRoom.commander}</span>
                      </li>
                      <li className="flex items-center justify-between rounded-xl border border-white/10 bg-black/60 p-3">
                        <span>Severity</span>
                        <span className="uppercase tracking-[0.35em] text-danger">{warRoom.severity}</span>
                      </li>
                      <li className="flex items-center justify-between rounded-xl border border-white/10 bg-black/60 p-3">
                        <span>Looptijd</span>
                        <span className="text-white/90">{duration}</span>
                      </li>
                    </ul>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-black/40 p-5 shadow-glow">
                    <header className="flex items-center justify-between text-white">
                      <h3 className="text-lg font-semibold">Realtime metrics</h3>
                      <UserRound className="h-5 w-5 text-primary-200" />
                    </header>
                    <div className="mt-4 space-y-3">
                      {metrics.map(metric => (
                        <div key={metric.id} className="rounded-xl border border-white/10 bg-black/60 p-4 text-sm text-white/80">
                          <div className="flex items-center justify-between text-white">
                            <span className="text-sm font-semibold">{metric.label}</span>
                            <span className="text-xs uppercase tracking-[0.35em] text-white/40">{metric.trend}</span>
                          </div>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-semibold text-white">{metric.value}</span>
                            <span className="text-xs text-white/40">{metric.unit}</span>
                          </div>
                          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-danger via-primary-500 to-accent" style={{ width: `${Math.min(100, Math.max(10, metric.value))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-black/40 p-5 shadow-glow">
                    <header className="flex items-center justify-between text-white">
                      <h3 className="text-lg font-semibold">Snelle acties</h3>
                      <PlayCircle className="h-5 w-5 text-success" />
                    </header>
                    <div className="mt-4 space-y-3 text-sm text-white/80">
                      <button className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-left transition hover:border-accent/40 hover:text-white">
                        <span>Ping incident channel</span>
                        <Send className="h-4 w-4" />
                      </button>
                      <button className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-left transition hover:border-accent/40 hover:text-white">
                        <span>Freeze deploy pipelines</span>
                        <Flame className="h-4 w-4" />
                      </button>
                      <button className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-left transition hover:border-accent/40 hover:text-white">
                        <span>Share war room link</span>
                        <Video className="h-4 w-4" />
                      </button>
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDuration(start: string) {
  const diff = Date.now() - new Date(start).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const minPart = minutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minPart}m`;
}

function cryptoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
