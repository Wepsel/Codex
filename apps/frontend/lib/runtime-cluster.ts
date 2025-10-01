export type RuntimeWithCluster = typeof globalThis & { selectedClusterId?: string };

export function getRuntimeClusterId(): string | undefined {
  const runtime = globalThis as RuntimeWithCluster;
  return runtime.selectedClusterId;
}

export function setRuntimeClusterId(id: string | undefined): void {
  const runtime = globalThis as RuntimeWithCluster;
  if (typeof id === "string" && id.length > 0) {
    runtime.selectedClusterId = id;
  } else {
    delete runtime.selectedClusterId;
  }
}
