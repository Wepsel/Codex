export type ClusterPhase = "Healthy" | "Degraded" | "Critical";
export interface MetricPoint {
    timestamp: string;
    value: number;
}
export interface NodeStatus {
    name: string;
    roles: string[];
    cpu: number;
    memory: number;
    pods: number;
    age: string;
    status: "Ready" | "NotReady" | "Unknown";
    kubeletVersion: string;
}
export interface NamespaceSummary {
    name: string;
    workloads: number;
    pods: number;
    activeAlerts: number;
}
export interface CapacityNodeSnapshot {
    name: string;
    cpuCapacity: number;
    cpuAllocatable: number;
    cpuRequested: number;
    cpuUtilization: number;
    memoryCapacity: number;
    memoryAllocatable: number;
    memoryRequested: number;
    memoryUtilization: number;
    pods: number;
    conditions: Array<{ type: string; status: string }>;
}
export interface CapacityNamespaceSnapshot {
    name: string;
    cpuRequested: number;
    memoryRequested: number;
    workloads: number;
}
export interface CapacitySnapshot {
    totals: {
        cpuCapacity: number;
        cpuAllocatable: number;
        cpuRequested: number;
        memoryCapacity: number;
        memoryAllocatable: number;
        memoryRequested: number;
        pods: number;
    };
    nodes: CapacityNodeSnapshot[];
    namespaces: CapacityNamespaceSnapshot[];
}
export interface WorkloadSummary {
    name: string;
    type: "Deployment" | "StatefulSet" | "DaemonSet" | "Job" | "CronJob";
    namespace: string;
    replicasDesired: number;
    replicasReady: number;
    updatedAt: string;
    image: string;
}
export interface ClusterSummary {
    id: string;
    name: string;
    context: string;
    distribution: string;
    version: string;
    nodes: number;
    workloads: number;
    pods: number;
    phase: ClusterPhase;
    lastSync: string;
    cpuUsage: number;
    memoryUsage: number;
    namespaces: NamespaceSummary[];
}
export interface AlertItem {
    id: string;
    severity: "critical" | "warning" | "info";
    message: string;
    source: string;
    createdAt: string;
}
export interface EventEnvelope<T> {
    type: string;
    payload: T;
}
export interface ApiResponse<T> {
    ok: boolean;
    data: T;
    error?: string;
}
export interface LiveLogEntry {
    pod: string;
    namespace: string;
    container: string;
    timestamp: string;
    message: string;
    level: "info" | "warn" | "error" | "debug";
}
export interface DeploymentWizardPayload {
    name: string;
    namespace: string;
    image: string;
    replicas: number;
    valuesYaml?: string;
    manifestYaml?: string;
    strategy: "RollingUpdate" | "Recreate";
}
export interface UserProfile {
    id: string;
    email: string;
    name: string;
    roles: string[];
    preferences: {
        theme: "dark" | "light";
        notifications: boolean;
    };
}
export interface AuditLogEntry {
    id: string;
    userId: string;
    action: string;
    target: string;
    status: "success" | "failure";
    createdAt: string;
    metadata?: Record<string, unknown>;
}
export interface ClusterEvent {
    id: string;
    reason: string;
    type: "Normal" | "Warning" | "Error";
    message: string;
    involvedObject: {
        kind: string;
        name: string;
        namespace?: string;
    };
    timestamp: string;
}
//# sourceMappingURL=index.d.ts.mapexport interface ZeroTrustSnapshot {
    generatedAt: string;
    riskScore: number;
    identity: {
        privilegedRoles: number;
        orphanBindings: number;
        serviceAccountsWithoutTokens: number;
    };
    secrets: {
        expiring: number;
        unencrypted: number;
    };
    network: {
        policies: number;
        namespacesCovered: number;
        totalNamespaces: number;
        coverage: number;
    };
    recommendations: string[];
}


export type EfficiencySeverity = "low" | "medium" | "high";
export interface EfficiencyInsight {
    id: string;
    severity: EfficiencySeverity;
    title: string;
    description: string;
    recommendation?: string;
}
export interface NodeEfficiencySnapshot {
    name: string;
    cpuUtilization: number;
    memoryUtilization: number;
    pods: number;
}
export interface NamespaceEfficiencySnapshot {
    name: string;
    cpuShare: number;
    memoryShare: number;
    workloads: number;
    pressure: boolean;
}
export interface WorkloadAttentionItem {
    name: string;
    namespace: string;
    replicasDesired: number;
    replicasReady: number;
    reason: string;
    severity: EfficiencySeverity;
}
export interface ClusterEfficiencyReport {
    generatedAt: string;
    cpu: {
        requested: number;
        allocatable: number;
        utilization: number;
        waste: number;
    };
    memory: {
        requested: number;
        allocatable: number;
        utilization: number;
        waste: number;
    };
    costEstimate: {
        monthly: number;
        potentialSavings: number;
    };
    hotNodes: NodeEfficiencySnapshot[];
    coldNodes: NodeEfficiencySnapshot[];
    namespaces: NamespaceEfficiencySnapshot[];
    workloadsNeedingAttention: WorkloadAttentionItem[];
    insights: EfficiencyInsight[];
}

