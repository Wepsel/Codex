"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Bot,
  Command,
  CornerUpRight,
  Loader2,
  Send,
  Sparkles,
  X
} from "lucide-react";
import type {
  CopilotChatMessage,
  CopilotCommandSuggestion,
  CopilotResponse
} from "@kube-suite/shared";
import { apiFetch } from "@/lib/api-client";

interface CopilotPanelProps {
  open: boolean;
  onClose: () => void;
  onExecuteAction?: (value: string) => void;
}

const createId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const welcomeMessage: CopilotChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey commander! Stel je vragen in mensentaal � ik vertaal ze naar kubectl en highlight risico''s voor je.",
  createdAt: new Date().toISOString()
};

export function CopilotPanel({ open, onClose, onExecuteAction }: CopilotPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<CopilotChatMessage[]>([
    { ...welcomeMessage, id: createId() }
  ]);
  const [suggestions, setSuggestions] = useState<CopilotCommandSuggestion[]>([]);
  const [actions, setActions] = useState<Array<{ label: string; value: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setInput("");
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }

    const userMessage: CopilotChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await apiFetch<CopilotResponse>("/cluster/copilot/interpret", {
        method: "POST",
        body: JSON.stringify({ prompt: userMessage.content })
      });
      const assistantMessages = response.messages.filter(msg => msg.role === "assistant");
      setMessages(prev => [...prev, ...assistantMessages]);
      setSuggestions(response.suggestions);
      setActions(response.actions);
    } catch (error) {
      const message: CopilotChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Ik kon het verzoek niet verwerken: ${(error as Error).message}`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, message]);
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestionClick(suggestion: CopilotCommandSuggestion) {
    setInput(suggestion.kubectl);
    navigator.clipboard.writeText(suggestion.kubectl).then(() => {
      setCopiedId(suggestion.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleQuickAction(action: { label: string; value: string }) {
    if (onExecuteAction) {
      onExecuteAction(action.value);
    }
    if (action.value === "logs") {
      router.push("/events");
    }
    if (action.value === "scale") {
      setInput(prev => prev || "kubectl scale deployment checkout --replicas=6 -n production");
    }
  }

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="fixed inset-y-0 right-0 z-30 flex w-[380px] flex-col border-l border-white/10 bg-[#0b0c21]/95 backdrop-blur-xl"
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 25 }}
        >
          <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">AI Ops Copilot</p>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
                <Sparkles className="h-4 w-4 text-accent" /> Nebula Copilot
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition hover:text-white"
              aria-label="Sluit copilot"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm">
            {orderedMessages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/30 text-primary-200">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={`max-w-[70%] rounded-2xl border border-white/10 px-4 py-3 backdrop-blur ${
                    message.role === "user"
                      ? "bg-primary-500/10 text-white"
                      : "bg-white/5 text-white/80"
                  }`}
                >
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/40">
                <Loader2 className="h-4 w-4 animate-spin" /> Copilot denkt na...
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-white/10 px-6 py-4">
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Command suggestions</p>
                <div className="space-y-2">
                  {suggestions.map(suggestion => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs text-white/70 transition hover:border-accent/40 hover:text-white"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-semibold text-white">
                          <Command className="h-4 w-4 text-accent" />
                          {suggestion.title}
                        </span>
                        {copiedId === suggestion.id && <span className="text-[10px] uppercase tracking-[0.35em] text-accent">gekopieerd</span>}
                      </div>
                      <p className="mt-1 text-white/50">{suggestion.description}</p>
                      <code className="mt-2 block overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-white/60">
                        {suggestion.kubectl}
                      </code>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {actions.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Quick actions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {actions.map(action => (
                    <button
                      key={action.value}
                      onClick={() => handleQuickAction(action)}
                      className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/60 transition hover:border-accent/40 hover:text-white"
                    >
                      <CornerUpRight className="h-3 w-3" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="Vraag iets zoals �scale checkout naar 6�"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-gradient-to-r from-primary-500 to-accent p-2 text-background transition disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}


