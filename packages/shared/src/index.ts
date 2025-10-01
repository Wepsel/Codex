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

export type CompanyRole = "admin" | "member";

export type CompanyMembershipStatus = "active" | "pending" | "invited" | "rejected";

export interface CompanyDescriptor {
  id: string;
  name: string;
  slug: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  roles: string[];
  company: {
    id: string;
    name: string;
    slug: string;
    role: CompanyRole;
    status: CompanyMembershipStatus;
    pendingRequestId?: string;
    pendingInviteId?: string;
  };
  preferences: {
    theme: "dark" | "light";
    notifications: boolean;
  };
}

export interface CompanyProfile extends CompanyDescriptor {
  description?: string;
  createdAt: string;
  adminCount: number;
  memberCount: number;
  pendingRequests: number;
  pendingInvites: number;
}

export interface CompanyMember {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  status: CompanyMembershipStatus;
  createdAt: string;
  lastSeenAt?: string;
}

export interface CompanyAdminOverview {
  profile: CompanyProfile;
  members: CompanyMember[];
  invites: CompanyInvite[];
  joinRequests: CompanyJoinRequest[];
}



export type CompanyInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface CompanyInvite {
  id: string;
  company: CompanyDescriptor;
  email: string;
  role: CompanyRole;
  status: CompanyInviteStatus;
  invitedBy: string;
  createdAt: string;
  expiresAt?: string;
}

export type CompanyJoinRequestStatus = "pending" | "approved" | "rejected";

export interface CompanyJoinRequest {
  id: string;
  company: CompanyDescriptor;
  userId: string;
  userName: string;
  status: CompanyJoinRequestStatus;
  submittedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface CompanyDirectoryEntry extends CompanyDescriptor {
  memberCount: number;
  inviteOnly: boolean;
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

export type DeploymentStage = "plan" | "build" | "ship" | "rollout" | "complete";

export interface DeploymentPlanStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "complete";
}

export interface DeploymentPlanResponse {
  id: string;
  manifestName: string;
  namespace: string;
  steps: DeploymentPlanStep[];
  diff: string;
  warnings: string[];
}

export interface DeploymentProgressEvent {
  id: string;
  stage: DeploymentStage;
  status: "pending" | "running" | "success" | "error";
  percentage: number;
  message: string;
  timestamp: string;
}

export interface CopilotChatMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  createdAt: string;
}

export interface CopilotCommandSuggestion {
  id: string;
  title: string;
  description: string;
  kubectl: string;
}

export interface CopilotResponse {
  messages: CopilotChatMessage[];
  suggestions: CopilotCommandSuggestion[];
  actions: Array<{ label: string; value: string }>;
}

export interface ComplianceSummary {
  generatedAt: string;
  rbac: {
    highRiskRoles: Array<{
      name: string;
      members: number;
      privileges: string[];
      lastReviewed: string;
    }>;
    orphanedBindings: number;
    serviceAccountsWithoutTokens: number;
  };
  secrets: {
    expiring: Array<{
      name: string;
      namespace: string;
      type: string;
      daysRemaining: number;
    }>;
    unencrypted: Array<{
      name: string;
      namespace: string;
      provider: string;
    }>;
  };
  policies: {
    lastScan: string;
    passing: number;
    failing: number;
    critical: number;
    failedPolicies: Array<{
      id: string;
      name: string;
      severity: "critical" | "high" | "medium" | "low";
      description: string;
      resource: string;
    }>;
  };
  recommendations: string[];
}

export interface IncidentWarRoomData {
  incidentId: string;
  title: string;
  status: "investigating" | "mitigated" | "resolved";
  commander: string;
  severity: "critical" | "high" | "medium";
  startedAt: string;
  videoRooms: Array<{
    name: string;
    url: string;
    participants: number;
  }>;
  notes: Array<{
    id: string;
    author: string;
    timestamp: string;
    content: string;
  }>;
  metrics: Array<{
    id: string;
    label: string;
    unit: string;
    value: number;
    trend: "up" | "down" | "flat";
  }>;
  postmortemDraft: {
    summary: string;
    timeline: Array<{
      timestamp: string;
      description: string;
      owner?: string;
    }>;
    actionItems: Array<{
      id: string;
      owner: string;
      description: string;
      dueDate: string;
    }>;
  };
}

export interface IncidentNoteInput {
  author?: string;
  content: string;
}

export interface ComplianceReport {
  format: "json";
  generatedAt: string;
  preparedBy: string;
  range: {
    from: string;
    to: string;
  };
  summary: ComplianceSummary;
  incident: IncidentWarRoomData;
}





