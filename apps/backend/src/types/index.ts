import type { Request } from "express";
import type { UserProfile } from "@kube-suite/shared";

export interface RequestUser extends UserProfile {
  sessionToken?: string;
}

export interface RequestWithUser extends Request {
  user?: RequestUser;
}

export interface LiveStreamClientInfo {
  userId: string;
  clusters: string[];
}
