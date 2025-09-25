import type { Response } from "express";
import type { DeploymentWizardPayload } from "@kube-suite/shared";
import type { RequestWithUser } from "../types";
import kubernetesService from "../services/kubernetes.service";
import { interpretCopilotPrompt } from "../services/copilot.service";

export async function fetchClusterSummary(req: RequestWithUser, res: Response) {
  const summary = await kubernetesService.getClusterSummary();
  res.json({ ok: true, data: summary });
}

export async function listNamespaces(req: RequestWithUser, res: Response) {
  const namespaces = await kubernetesService.getNamespaces();
  res.json({ ok: true, data: namespaces });
}

export async function listWorkloads(req: RequestWithUser, res: Response) {
  const workloads = await kubernetesService.getWorkloads();
  res.json({ ok: true, data: workloads });
}

export async function fetchAlerts(req: RequestWithUser, res: Response) {
  const alerts = await kubernetesService.getAlerts();
  res.json({ ok: true, data: alerts });
}

export async function fetchAuditLog(req: RequestWithUser, res: Response) {
  const logs = await kubernetesService.getAuditLog();
  res.json({ ok: true, data: logs });
}

export async function fetchEvents(req: RequestWithUser, res: Response) {
  const events = await kubernetesService.getEvents();
  res.json({ ok: true, data: events });
}

export async function fetchPodLogs(req: RequestWithUser, res: Response) {
  const namespace = req.params.namespace;
  const pod = req.params.pod;
  const { container } = req.query as { container?: string };
  const logs = await kubernetesService.getPodLogs(namespace, pod, container);
  res.json({ ok: true, data: logs });
}

export async function deployManifest(req: RequestWithUser, res: Response) {
  const { manifestYaml } = req.body as { manifestYaml: string };
  const result = await kubernetesService.applyManifest(manifestYaml);
  res.status(202).json({ ok: true, data: result });
}

export async function planDeployment(req: RequestWithUser, res: Response) {
  const payload = req.body as DeploymentWizardPayload;
  const plan = await kubernetesService.planDeployment(payload);
  res.json({ ok: true, data: plan });
}

export async function copilotInterpret(req: RequestWithUser, res: Response) {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt) {
    res.status(400).json({ ok: false, error: "Prompt is required" });
    return;
  }
  const response = interpretCopilotPrompt(prompt);
  res.json({ ok: true, data: response });
}
