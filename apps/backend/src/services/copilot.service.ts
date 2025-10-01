import { randomUUID } from "crypto";
import type { CopilotCommandSuggestion, CopilotResponse } from "@kube-suite/shared";

const commandLibrary: CopilotCommandSuggestion[] = [
  {
    id: "scale-deployment",
    title: "Scale deployment",
    description: "Scale a deployment to the desired replica count",
    kubectl: "kubectl scale deployment <name> --replicas=<n> -n <namespace>"
  },
  {
    id: "tail-logs",
    title: "Tail logs",
    description: "Stream logs for a specific pod",
    kubectl: "kubectl logs <pod> -n <namespace> -f"
  },
  {
    id: "describe-pod",
    title: "Describe pod",
    description: "Inspect pod status and recent events",
    kubectl: "kubectl describe pod <pod> -n <namespace>"
  }
];

export function interpretCopilotPrompt(prompt: string): CopilotResponse {
  const normalized = prompt.toLowerCase();
  const matches = commandLibrary.filter(entry => normalized.includes(entry.title.split(" ")[0]));

  const suggestions = matches.length > 0 ? matches : commandLibrary.slice(0, 2);

  const assistantMessage = buildAssistantMessage(prompt, suggestions);

  return {
    messages: [
      {
        id: randomUUID(),
        role: "user",
        content: prompt,
        createdAt: new Date().toISOString()
      },
      assistantMessage
    ],
    suggestions,
    actions: buildActionList(normalized)
  };
}

function buildAssistantMessage(prompt: string, suggestions: CopilotCommandSuggestion[]) {
  const summary = `Ik heb ${suggestions.length} actie(s) gevonden die passen bij je verzoek.`;
  return {
    id: randomUUID(),
    role: "assistant" as const,
    content: `${summary}\nLaat me weten als je er een wilt uitvoeren of aanpassen.`,
    createdAt: new Date().toISOString()
  };
}

function buildActionList(normalizedPrompt: string) {
  const actions = [] as Array<{ label: string; value: string }>;

  if (normalizedPrompt.includes("scale")) {
    actions.push({ label: "Scale deployment", value: "scale" });
  }

  if (normalizedPrompt.includes("log") || normalizedPrompt.includes("error")) {
    actions.push({ label: "Bekijk logs", value: "logs" });
  }

  if (normalizedPrompt.includes("event") || normalizedPrompt.includes("status")) {
    actions.push({ label: "Check events", value: "events" });
  }

  return actions;
}
