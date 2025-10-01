import { createHash, randomUUID } from "crypto";
import type {
  CompanyAdminOverview,
  CompanyDirectoryEntry,
  CompanyInvite,
  CompanyInviteStatus,
  CompanyJoinRequest,
  CompanyJoinRequestStatus,
  CompanyMember,
  CompanyMembershipStatus,
  CompanyProfile,
  CompanyRole,
  UserProfile
} from "@kube-suite/shared";
import type { PoolClient, QueryResultRow } from "pg";
import { initDatabase, query, withTransaction } from "../lib/db";
import type { RequestUser } from "../types";

interface UserProfileRow {
  id: string;
  username: string;
  email: string;
  name: string;
  password_hash: string;
  roles: string[] | string;
  company_id: string;
  company_role: CompanyRole;
  membership_status: CompanyMembershipStatus;
  created_at: Date;
  last_seen_at: Date | null;
  pending_request_id: string | null;
  pending_invite_id: string | null;
  company_name: string;
  company_slug: string;
}

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  invite_only: boolean;
  created_at: Date;
}

interface JoinRequestRow {
  id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  status: CompanyJoinRequestStatus;
  submitted_at: Date;
  decided_at: Date | null;
  decided_by: string | null;
  company_name: string;
  company_slug: string;
}

interface InviteRow {
  id: string;
  company_id: string;
  email: string;
  role: CompanyRole;
  status: CompanyInviteStatus;
  invited_by: string;
  created_at: Date;
  expires_at: Date | null;
  company_name: string;
  company_slug: string;
}

type RegisterCompanyPayload =
  | { mode: "create"; name: string; description?: string; inviteOnly?: boolean }
  | { mode: "join"; companyId: string };

export interface RegisterUserPayload {
  username: string;
  email: string;
  name: string;
  password: string;
  company: RegisterCompanyPayload;
}

const DEFAULT_PREFERENCES: UserProfile["preferences"] = {
  theme: "dark",
  notifications: true
};

const DEFAULT_COMPANY_NAME = "Nebula Control Center";

const ready = (async () => {
  await initDatabase();
  await ensureDefaultAdmin();
})();

async function ensureReady(): Promise<void> {
  await ready;
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function generateTemporaryPassword(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : `company-${randomUUID().slice(0, 8)}`;
}

function normalizeRoles(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map(role => role.toString());
  }
  if (typeof value === "string" && value.startsWith("{")) {
    return value
      .slice(1, -1)
      .split(",")
      .map(part => part.replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
  return [];
}

function ensureRolePresence(roles: string[], role: string): string[] {
  if (!roles.includes(role)) {
    roles.push(role);
  }
  return roles;
}

function removeRole(roles: string[], role: string): string[] {
  return roles.filter(entry => entry !== role);
}

async function exec<T extends QueryResultRow>(sql: string, params: any[], client?: PoolClient) {
  if (client) {
    return client.query<T>(sql, params);
  }
  return query<T>(sql, params);
}

async function ensureUniqueSlug(name: string, client?: PoolClient): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await exec<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM companies WHERE slug = $1) AS exists",
      [candidate],
      client
    );
    if (!result.rows[0]?.exists) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function toRequestUser(row: UserProfileRow, sessionToken?: string): RequestUser {
  const roles = ensureRolePresence(normalizeRoles(row.roles), "viewer");
  const profile: RequestUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    roles,
    company: {
      id: row.company_id,
      name: row.company_name,
      slug: row.company_slug,
      role: row.company_role,
      status: row.membership_status
    },
    preferences: { ...DEFAULT_PREFERENCES }
  };

  if (row.pending_request_id) {
    profile.company.pendingRequestId = row.pending_request_id;
  }
  if (row.pending_invite_id) {
    profile.company.pendingInviteId = row.pending_invite_id;
  }
  if (sessionToken) {
    profile.sessionToken = sessionToken;
  }
  return profile;
}

function toCompanyMember(row: {
  id: string;
  name: string;
  email: string;
  company_role: CompanyRole;
  membership_status: CompanyMembershipStatus;
  created_at: Date;
  last_seen_at: Date | null;
}): CompanyMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.company_role,
    status: row.membership_status,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : undefined
  };
}

function toCompanyInvite(row: InviteRow): CompanyInvite {
  return {
    id: row.id,
    company: {
      id: row.company_id,
      name: row.company_name,
      slug: row.company_slug
    },
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at ? row.expires_at.toISOString() : undefined
  };
}

function toCompanyJoinRequest(row: JoinRequestRow): CompanyJoinRequest {
  return {
    id: row.id,
    company: {
      id: row.company_id,
      name: row.company_name,
      slug: row.company_slug
    },
    userId: row.user_id,
    userName: row.user_name,
    status: row.status,
    submittedAt: row.submitted_at.toISOString(),
    decidedAt: row.decided_at ? row.decided_at.toISOString() : undefined,
    decidedBy: row.decided_by ?? undefined
  };
}

async function loadUserProfileById(userId: string, client?: PoolClient): Promise<UserProfileRow | null> {
  const result = await exec<UserProfileRow>(
    `SELECT
      u.id,
      u.username,
      u.email,
      u.name,
      u.password_hash,
      u.roles,
      u.company_id,
      u.company_role,
      u.membership_status,
      u.created_at,
      u.last_seen_at,
      u.pending_request_id,
      u.pending_invite_id,
      c.name AS company_name,
      c.slug AS company_slug
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.id = $1`,
    [userId],
    client
  );
  return result.rows[0] ?? null;
}

async function loadUserProfileByUsername(username: string, client?: PoolClient): Promise<UserProfileRow | null> {
  const result = await exec<UserProfileRow>(
    `SELECT
      u.id,
      u.username,
      u.email,
      u.name,
      u.password_hash,
      u.roles,
      u.company_id,
      u.company_role,
      u.membership_status,
      u.created_at,
      u.last_seen_at,
      u.pending_request_id,
      u.pending_invite_id,
      c.name AS company_name,
      c.slug AS company_slug
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE LOWER(u.username) = LOWER($1)
    LIMIT 1`,
    [username],
    client
  );
  return result.rows[0] ?? null;
}

async function loadCompanyById(companyId: string, client?: PoolClient): Promise<CompanyRow | null> {
  const result = await exec<CompanyRow>(
    `SELECT id, name, slug, description, invite_only, created_at
     FROM companies
     WHERE id = $1`,
    [companyId],
    client
  );
  return result.rows[0] ?? null;
}

async function destroyUserSessions(userId: string, client?: PoolClient): Promise<void> {
  await exec("DELETE FROM sessions WHERE user_id = $1", [userId], client);
}

async function loadCompanyProfile(companyId: string, client?: PoolClient): Promise<CompanyProfile | null> {
  const companyResult = await exec<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    invite_only: boolean;
    created_at: Date;
  }>(
    `SELECT id, name, slug, description, invite_only, created_at FROM companies WHERE id = $1`,
    [companyId],
    client
  );

  const company = companyResult.rows[0];
  if (!company) {
    return null;
  }

  const metricsResult = await exec<{
    admin_count: string | number;
    member_count: string | number;
    pending_requests: string | number;
    pending_invites: string | number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE company_id = $1 AND company_role = 'admin' AND membership_status = 'active') AS admin_count,
       (SELECT COUNT(*) FROM users WHERE company_id = $1 AND membership_status = 'active') AS member_count,
       (SELECT COUNT(*) FROM company_join_requests WHERE company_id = $1 AND status = 'pending') AS pending_requests,
       (SELECT COUNT(*) FROM company_invites WHERE company_id = $1 AND status = 'pending') AS pending_invites`,
    [companyId],
    client
  );

  const metrics = metricsResult.rows[0] ?? {
    admin_count: 0,
    member_count: 0,
    pending_requests: 0,
    pending_invites: 0
  };

  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    description: company.description ?? undefined,
    createdAt: company.created_at.toISOString(),
    adminCount: Number(metrics.admin_count ?? 0),
    memberCount: Number(metrics.member_count ?? 0),
    pendingRequests: Number(metrics.pending_requests ?? 0),
    pendingInvites: Number(metrics.pending_invites ?? 0)
  };
}

async function ensureDefaultAdmin(): Promise<void> {
  const existing = await query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)) AS exists",
    ["admin"]
  );
  if (existing.rows[0]?.exists) {
    return;
  }

  const adminId = randomUUID();
  const companyId = randomUUID();
  await withTransaction(async client => {
    const slug = await ensureUniqueSlug(DEFAULT_COMPANY_NAME, client);
    await client.query(
      `INSERT INTO companies (id, name, slug, invite_only, created_at)
       VALUES ($1, $2, $3, FALSE, NOW())`,
      [companyId, DEFAULT_COMPANY_NAME, slug]
    );
    const roles = ["admin", "viewer"];
    await client.query(
      `INSERT INTO users (
        id,
        username,
        email,
        name,
        password_hash,
        roles,
        company_id,
        company_role,
        membership_status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', 'active', NOW())`,
      [
        adminId,
        "admin",
        "admin@example.com",
        "Nebula Admin",
        hashPassword("admin"),
        roles,
        companyId
      ]
    );
  });
}

export async function registerUser(payload: RegisterUserPayload): Promise<RequestUser> {
  await ensureReady();

  const username = payload.username.trim().toLowerCase();
  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();

  if (!name) {
    throw new Error("Naam is verplicht");
  }

  const userId = randomUUID();

  return withTransaction(async client => {
    const usernameExists = await exec<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)) AS exists",
      [username],
      client
    );
    if (usernameExists.rows[0]?.exists) {
      throw new Error("Username already exists");
    }

    const emailExists = await exec<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)) AS exists",
      [email],
      client
    );
    if (emailExists.rows[0]?.exists) {
      throw new Error("Email already exists");
    }

    let companyId: string;
    let companyRole: CompanyRole = "member";
    let membershipStatus: CompanyMembershipStatus = "pending";
    let pendingRequestId: string | null = null;
    let pendingInviteId: string | null = null;
    let roles = ensureRolePresence([], "viewer");
    let joinRequestId: string | null = null;

    if (payload.company.mode === "create") {
      companyId = randomUUID();
      const slug = await ensureUniqueSlug(payload.company.name, client);
      await client.query(
        `INSERT INTO companies (id, name, slug, description, invite_only, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          companyId,
          payload.company.name.trim(),
          slug,
          payload.company.description ?? null,
          Boolean(payload.company.inviteOnly)
        ]
      );
      companyRole = "admin";
      membershipStatus = "active";
      roles = ensureRolePresence(roles, "admin");
    } else {
      const company = await loadCompanyById(payload.company.companyId, client);
      if (!company) {
        throw new Error("Company not found");
      }
      companyId = company.id;

      const existingUser = await exec<{ id: string; company_id: string; membership_status: CompanyMembershipStatus }>(
        `SELECT id, company_id, membership_status
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [email],
        client
      );
      const existingRow = existingUser.rows[0];
      if (existingRow && existingRow.company_id === companyId && existingRow.membership_status === "active") {
        throw new Error("User is already part of this company");
      }

      const inviteResult = await exec<InviteRow>(
        `SELECT
          ci.id,
          ci.company_id,
          ci.email,
          ci.role,
          ci.status,
          ci.invited_by,
          ci.created_at,
          ci.expires_at,
          c.name AS company_name,
          c.slug AS company_slug
        FROM company_invites ci
        JOIN companies c ON c.id = ci.company_id
        WHERE ci.company_id = $1
          AND ci.status = 'pending'
          AND LOWER(ci.email) = LOWER($2)
        ORDER BY ci.created_at DESC
        LIMIT 1`,
        [companyId, email],
        client
      );
      const invite = inviteResult.rows[0];
      if (invite) {
        await client.query("UPDATE company_invites SET status = 'accepted' WHERE id = $1", [invite.id]);
        companyRole = invite.role;
        membershipStatus = "active";
        roles = ensureRolePresence(roles, invite.role === "admin" ? "admin" : "viewer");
        pendingInviteId = null;
      } else {
        joinRequestId = randomUUID();
        pendingRequestId = joinRequestId;
        membershipStatus = "pending";
        companyRole = "member";
      }
    }

    const passwordHash = hashPassword(payload.password);
    await client.query(
      `INSERT INTO users (
        id,
        username,
        email,
        name,
        password_hash,
        roles,
        company_id,
        company_role,
        membership_status,
        created_at,
        pending_request_id,
        pending_invite_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11)`,
      [
        userId,
        username,
        email,
        name,
        passwordHash,
        roles,
        companyId,
        companyRole,
        membershipStatus,
        pendingRequestId,
        pendingInviteId
      ]
    );

    if (joinRequestId) {
      await client.query(
        `INSERT INTO company_join_requests (
          id,
          company_id,
          user_id,
          user_name,
          status,
          submitted_at
        ) VALUES ($1, $2, $3, $4, 'pending', NOW())`,
        [joinRequestId, companyId, userId, name]
      );
    }

    const created = await loadUserProfileById(userId, client);
    if (!created) {
      throw new Error("Failed to load user profile");
    }
    return toRequestUser(created);
  });
}

export async function validateCredentials(username: string, password: string): Promise<RequestUser> {
  await ensureReady();
  const user = await loadUserProfileByUsername(username.trim(), undefined);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error("Invalid credentials");
  }
  const now = new Date();
  await query("UPDATE users SET last_seen_at = NOW() WHERE id = $1", [user.id]);
  user.last_seen_at = now;
  return toRequestUser(user);
}

export async function createSession(userId: string): Promise<string> {
  await ensureReady();
  const token = randomUUID();
  await query("INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, NOW())", [token, userId]);
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await ensureReady();
  await query("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function getUserBySession(token: string | undefined | null): Promise<RequestUser | null> {
  await ensureReady();
  if (!token) {
    return null;
  }
  const session = await query<{ user_id: string }>("SELECT user_id FROM sessions WHERE token = $1", [token]);
  const record = session.rows[0];
  if (!record) {
    return null;
  }
  const user = await loadUserProfileById(record.user_id);
  if (!user) {
    await query("DELETE FROM sessions WHERE token = $1", [token]);
    return null;
  }
  return toRequestUser(user, token);
}

export async function getProfileById(userId: string): Promise<RequestUser | null> {
  await ensureReady();
  const user = await loadUserProfileById(userId);
  if (!user) {
    return null;
  }
  return toRequestUser(user);
}

export async function searchCompanies(queryText: string): Promise<CompanyDirectoryEntry[]> {
  await ensureReady();
  const normalized = queryText.trim().toLowerCase();
  const like = normalized ? `%${normalized}%` : "%";

  const companyRows = await query<{
    id: string;
    name: string;
    slug: string;
    invite_only: boolean;
  }>(
    `SELECT id, name, slug, invite_only
     FROM companies
     WHERE $1 = '' OR LOWER(name) LIKE $2 OR LOWER(slug) LIKE $2
     ORDER BY name ASC`,
    [normalized, like]
  );

  const companies = companyRows.rows;
  if (companies.length === 0) {
    return [];
  }

  const countsResult = await query<{
    company_id: string;
    active_count: string | number;
  }>(
    `SELECT company_id, COUNT(*) AS active_count
     FROM users
     WHERE company_id = ANY($1) AND membership_status = 'active'
     GROUP BY company_id`,
    [companies.map(row => row.id)]
  );

  const counts = new Map<string, number>();
  for (const row of countsResult.rows) {
    counts.set(row.company_id, Number(row.active_count ?? 0));
  }

  return companies.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    memberCount: counts.get(row.id) ?? 0,
    inviteOnly: row.invite_only
  }));
}

export async function listCompanyInvites(companyId: string): Promise<CompanyInvite[]> {
  await ensureReady();
  const result = await query<InviteRow>(
    `SELECT
       ci.id,
       ci.company_id,
       ci.email,
       ci.role,
       ci.status,
       ci.invited_by,
       ci.created_at,
       ci.expires_at,
       c.name AS company_name,
       c.slug AS company_slug
     FROM company_invites ci
     JOIN companies c ON c.id = ci.company_id
     WHERE ci.company_id = $1
     ORDER BY ci.created_at DESC`,
    [companyId]
  );
  return result.rows.map(toCompanyInvite);
}

export async function createCompanyInvite(params: {
  companyId: string;
  invitedBy: string;
  email: string;
  role: CompanyRole;
  expiresAt?: string;
}): Promise<CompanyInvite> {
  await ensureReady();

  const normalizedEmail = params.email.trim().toLowerCase();

  return withTransaction(async client => {
    const company = await loadCompanyById(params.companyId, client);
    if (!company) {
      throw new Error("Company not found");
    }

    const existingInvite = await exec<InviteRow>(
      `SELECT
         ci.id,
         ci.company_id,
         ci.email,
         ci.role,
         ci.status,
         ci.invited_by,
         ci.created_at,
         ci.expires_at,
         c.name AS company_name,
         c.slug AS company_slug
       FROM company_invites ci
       JOIN companies c ON c.id = ci.company_id
       WHERE ci.company_id = $1
         AND ci.status = 'pending'
         AND LOWER(ci.email) = LOWER($2)
       ORDER BY ci.created_at DESC
       LIMIT 1`,
      [params.companyId, normalizedEmail],
      client
    );

    if (existingInvite.rows[0]) {
      return toCompanyInvite(existingInvite.rows[0]);
    }

    const existingUser = await exec<{ id: string; company_id: string; membership_status: CompanyMembershipStatus }>(
      `SELECT id, company_id, membership_status
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [normalizedEmail],
      client
    );
    const existing = existingUser.rows[0];
    if (existing && existing.company_id === params.companyId && existing.membership_status === "active") {
      throw new Error("User is already part of this company");
    }

    const inviteId = randomUUID();
    await client.query(
      `INSERT INTO company_invites (
        id,
        company_id,
        email,
        role,
        status,
        invited_by,
        created_at,
        expires_at
      ) VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), $6)`,
      [inviteId, params.companyId, normalizedEmail, params.role, params.invitedBy, params.expiresAt ? new Date(params.expiresAt) : null]
    );

    const created = await exec<InviteRow>(
      `SELECT
         ci.id,
         ci.company_id,
         ci.email,
         ci.role,
         ci.status,
         ci.invited_by,
         ci.created_at,
         ci.expires_at,
         c.name AS company_name,
         c.slug AS company_slug
       FROM company_invites ci
       JOIN companies c ON c.id = ci.company_id
       WHERE ci.id = $1`,
      [inviteId],
      client
    );

    const row = created.rows[0];
    if (!row) {
      throw new Error("Failed to create invite");
    }
    return toCompanyInvite(row);
  });
}

export async function listCompanyMembers(companyId: string): Promise<CompanyMember[]> {
  await ensureReady();
  const result = await query<{
    id: string;
    name: string;
    email: string;
    company_role: CompanyRole;
    membership_status: CompanyMembershipStatus;
    created_at: Date;
    last_seen_at: Date | null;
  }>(
    `SELECT id, name, email, company_role, membership_status, created_at, last_seen_at
     FROM users
     WHERE company_id = $1 AND membership_status = 'active'
     ORDER BY name ASC`,
    [companyId]
  );
  return result.rows.map(toCompanyMember);
}

export async function listCompanyJoinRequests(companyId: string): Promise<CompanyJoinRequest[]> {
  await ensureReady();
  const result = await query<JoinRequestRow>(
    `SELECT
       jr.id,
       jr.company_id,
       jr.user_id,
       jr.user_name,
       jr.status,
       jr.submitted_at,
       jr.decided_at,
       jr.decided_by,
       c.name AS company_name,
       c.slug AS company_slug
     FROM company_join_requests jr
     JOIN companies c ON c.id = jr.company_id
     WHERE jr.company_id = $1
     ORDER BY
       CASE WHEN jr.status = 'pending' THEN 0 ELSE 1 END,
       jr.submitted_at DESC`,
    [companyId]
  );
  return result.rows.map(toCompanyJoinRequest);
}

export async function getCompanyAdminOverview(companyId: string): Promise<CompanyAdminOverview> {
  await ensureReady();
  const profile = await loadCompanyProfile(companyId);
  if (!profile) {
    throw new Error("Company not found");
  }
  const [members, invites, joinRequests] = await Promise.all([
    listCompanyMembers(companyId),
    listCompanyInvites(companyId),
    listCompanyJoinRequests(companyId)
  ]);

  return {
    profile,
    members,
    invites,
    joinRequests
  };
}

export async function updateCompanyMemberRole(params: {
  companyId: string;
  targetUserId: string;
  role: CompanyRole;
  actorId: string;
}): Promise<CompanyMember> {
  await ensureReady();

  return withTransaction(async client => {
    const user = await loadUserProfileById(params.targetUserId, client);
    if (!user || user.company_id !== params.companyId) {
      throw new Error("User not found");
    }
    if (user.membership_status !== "active") {
      throw new Error("User is not active in this company");
    }
    if (user.company_role === params.role) {
      const refreshed = await client.query<{
        id: string;
        name: string;
        email: string;
        company_role: CompanyRole;
        membership_status: CompanyMembershipStatus;
        created_at: Date;
        last_seen_at: Date | null;
      }>(
        `SELECT id, name, email, company_role, membership_status, created_at, last_seen_at
         FROM users
         WHERE id = $1`,
        [params.targetUserId]
      );
      const row = refreshed.rows[0];
      if (!row) {
        throw new Error("User not found");
      }
      return toCompanyMember(row);
    }

    if (params.role === "member") {
      const adminCount = await exec<{ count: string | number }>(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE company_id = $1 AND company_role = 'admin' AND membership_status = 'active'`,
        [params.companyId],
        client
      );
      if (Number(adminCount.rows[0]?.count ?? 0) <= 1 && user.company_role === "admin") {
        throw new Error("Je kunt niet de laatste admin verwijderen");
      }
    }

    let roles = ensureRolePresence(normalizeRoles(user.roles), "viewer");
    if (params.role === "admin") {
      roles = ensureRolePresence(roles, "admin");
    } else {
      roles = ensureRolePresence(removeRole(roles, "admin"), "viewer");
    }

    await client.query(
      `UPDATE users
       SET company_role = $1,
           roles = $2
       WHERE id = $3`,
      [params.role, roles, params.targetUserId]
    );

    const updated = await client.query<{
      id: string;
      name: string;
      email: string;
      company_role: CompanyRole;
      membership_status: CompanyMembershipStatus;
      created_at: Date;
      last_seen_at: Date | null;
    }>(
      `SELECT id, name, email, company_role, membership_status, created_at, last_seen_at
       FROM users
       WHERE id = $1`,
      [params.targetUserId]
    );
    const row = updated.rows[0];
    if (!row) {
      throw new Error("User not found");
    }
    return toCompanyMember(row);
  });
}

export async function removeCompanyMember(params: {
  companyId: string;
  targetUserId: string;
  actorId: string;
}): Promise<void> {
  await ensureReady();

  await withTransaction(async client => {
    const user = await loadUserProfileById(params.targetUserId, client);
    if (!user || user.company_id !== params.companyId) {
      throw new Error("User not found");
    }

    if (user.company_role === "admin" && user.membership_status === "active") {
      const adminCount = await exec<{ count: string | number }>(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE company_id = $1 AND company_role = 'admin' AND membership_status = 'active'`,
        [params.companyId],
        client
      );
      if (Number(adminCount.rows[0]?.count ?? 0) <= 1) {
        throw new Error("Je kunt niet de laatste admin verwijderen");
      }
    }

    await client.query("DELETE FROM company_join_requests WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM users WHERE id = $1", [user.id]);
    await destroyUserSessions(user.id, client);
  });
}

export async function resetCompanyMemberPassword(params: {
  companyId: string;
  targetUserId: string;
  actorId: string;
}): Promise<{ userId: string; temporaryPassword: string }> {
  await ensureReady();

  return withTransaction(async client => {
    const user = await loadUserProfileById(params.targetUserId, client);
    if (!user || user.company_id !== params.companyId) {
      throw new Error("User not found");
    }
    if (user.membership_status !== "active") {
      throw new Error("User is not active in this company");
    }

    const temporaryPassword = generateTemporaryPassword();
    await client.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hashPassword(temporaryPassword), params.targetUserId]
    );
    await destroyUserSessions(params.targetUserId, client);

    return { userId: params.targetUserId, temporaryPassword };
  });
}

export async function decideJoinRequest(params: {
  requestId: string;
  approverId: string;
  decision: "approve" | "reject";
}): Promise<CompanyJoinRequest> {
  await ensureReady();

  return withTransaction(async client => {
    const requestResult = await exec<JoinRequestRow>(
      `SELECT
         jr.id,
         jr.company_id,
         jr.user_id,
         jr.user_name,
         jr.status,
         jr.submitted_at,
         jr.decided_at,
         jr.decided_by,
         c.name AS company_name,
         c.slug AS company_slug
       FROM company_join_requests jr
       JOIN companies c ON c.id = jr.company_id
       WHERE jr.id = $1`,
      [params.requestId],
      client
    );
    const record = requestResult.rows[0];
    if (!record) {
      throw new Error("Join request not found");
    }

    const approver = await exec<{ company_role: CompanyRole; membership_status: CompanyMembershipStatus }>(
      `SELECT company_role, membership_status
       FROM users
       WHERE id = $1 AND company_id = $2`,
      [params.approverId, record.company_id],
      client
    );
    const approverRow = approver.rows[0];
    if (!approverRow || approverRow.company_role !== "admin" || approverRow.membership_status !== "active") {
      throw new Error("Forbidden");
    }

    if (record.status !== "pending") {
      return toCompanyJoinRequest(record);
    }

    const now = new Date();

    if (params.decision === "approve") {
      await client.query(
        `UPDATE company_join_requests
         SET status = 'approved', decided_at = $1, decided_by = $2
         WHERE id = $3`,
        [now, params.approverId, record.id]
      );

      const user = await loadUserProfileById(record.user_id, client);
      if (user) {
        let roles = ensureRolePresence(normalizeRoles(user.roles), "viewer");
        roles = removeRole(roles, "admin");
        await client.query(
          `UPDATE users
           SET membership_status = 'active',
               company_role = 'member',
               roles = $1,
               pending_request_id = NULL
           WHERE id = $2`,
          [roles, record.user_id]
        );
      }
    } else {
      await client.query(
        `UPDATE company_join_requests
         SET status = 'rejected', decided_at = $1, decided_by = $2
         WHERE id = $3`,
        [now, params.approverId, record.id]
      );
      await client.query(
        `UPDATE users
         SET membership_status = 'rejected',
             pending_request_id = $1
         WHERE id = $2`,
        [record.id, record.user_id]
      );
    }

    const refreshed = await exec<JoinRequestRow>(
      `SELECT
         jr.id,
         jr.company_id,
         jr.user_id,
         jr.user_name,
         jr.status,
         jr.submitted_at,
         jr.decided_at,
         jr.decided_by,
         c.name AS company_name,
         c.slug AS company_slug
       FROM company_join_requests jr
       JOIN companies c ON c.id = jr.company_id
       WHERE jr.id = $1`,
      [record.id],
      client
    );

    const updated = refreshed.rows[0];
    if (!updated) {
      throw new Error("Join request not found");
    }
    return toCompanyJoinRequest(updated);
  });
}

export async function getCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
  await ensureReady();
  return loadCompanyProfile(companyId);
}










