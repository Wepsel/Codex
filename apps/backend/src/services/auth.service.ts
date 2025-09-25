import { createHash, randomUUID } from "crypto";
import type { UserProfile } from "@kube-suite/shared";
import type { RequestUser } from "../types";

interface StoredUser {
  id: string;
  username: string;
  email: string;
  name: string;
  passwordHash: string;
  roles: string[];
}

const users = new Map<string, StoredUser>();
const usernameIndex = new Map<string, string>();
const emailIndex = new Map<string, string>();
const sessions = new Map<string, { userId: string; createdAt: number }>();

const DEFAULT_PREFERENCES: UserProfile["preferences"] = {
  theme: "dark",
  notifications: true
};

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function addDefaultAdmin() {
  if (usernameIndex.has("admin")) {
    return;
  }
  const admin: StoredUser = {
    id: "admin",
    username: "admin",
    email: "admin@example.com",
    name: "Nebula Admin",
    passwordHash: hashPassword("admin"),
    roles: ["admin"]
  };
  users.set(admin.id, admin);
  usernameIndex.set(admin.username.toLowerCase(), admin.id);
  emailIndex.set(admin.email.toLowerCase(), admin.id);
}

addDefaultAdmin();

function toProfile(user: StoredUser, sessionToken?: string): RequestUser {
  const profile: RequestUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    preferences: { ...DEFAULT_PREFERENCES }
  };
  if (sessionToken) {
    profile.sessionToken = sessionToken;
  }
  return profile;
}

export function toUserProfile(user: StoredUser, sessionToken = ""): RequestUser {
  return toProfile(user, sessionToken);
}

export function registerUser(payload: { username: string; email: string; name: string; password: string }): StoredUser {
  const username = payload.username.trim().toLowerCase();
  const email = payload.email.trim().toLowerCase();

  if (usernameIndex.has(username)) {
    throw new Error("Username already exists");
  }
  if (emailIndex.has(email)) {
    throw new Error("Email already exists");
  }

  const record: StoredUser = {
    id: randomUUID(),
    username,
    email,
    name: payload.name.trim(),
    passwordHash: hashPassword(payload.password),
    roles: ["viewer"]
  };

  users.set(record.id, record);
  usernameIndex.set(username, record.id);
  emailIndex.set(email, record.id);
  return record;
}

export function validateCredentials(username: string, password: string): StoredUser {
  const userId = usernameIndex.get(username.trim().toLowerCase());
  if (!userId) {
    throw new Error("Invalid credentials");
  }
  const user = users.get(userId);
  if (!user || user.passwordHash !== hashPassword(password)) {
    throw new Error("Invalid credentials");
  }
  return user;
}

export function createSession(userId: string): string {
  const token = randomUUID();
  sessions.set(token, { userId, createdAt: Date.now() });
  return token;
}

export function destroySession(token: string) {
  sessions.delete(token);
}

export function getUserBySession(token: string | undefined | null): RequestUser | null {
  if (!token) {
    return null;
  }
  const session = sessions.get(token);
  if (!session) {
    return null;
  }
  const user = users.get(session.userId);
  if (!user) {
    sessions.delete(token);
    return null;
  }
  return toProfile(user, token);
}

export function getProfileById(userId: string): RequestUser | null {
  const user = users.get(userId);
  if (!user) {
    return null;
  }
  return toProfile(user);
}



