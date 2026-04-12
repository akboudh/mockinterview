import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { readDb, updateDb } from "@/lib/db";
import { logEvent } from "@/lib/logging";
import type { AuthSessionRecord, UserProfile, UserRole } from "@/lib/types";

const scrypt = promisify(nodeScrypt);

export const AUTH_COOKIE_NAME = "vantage_session";
const PASSWORD_PREFIX = "scrypt";
const PASSWORD_KEY_LENGTH = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseRoleList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function rolesFromEmail(email: string | null | undefined): UserRole[] {
  const normalized = normalizeEmail(email ?? "");
  if (!normalized) {
    return [];
  }

  const roles = new Set<UserRole>();
  const mentorEmails = new Set(parseRoleList(process.env.MENTOR_EMAILS));
  const adminEmails = new Set(parseRoleList(process.env.ADMIN_EMAILS));

  if (mentorEmails.has(normalized)) {
    roles.add("mentor");
  }

  if (adminEmails.has(normalized)) {
    roles.add("admin");
  }

  return Array.from(roles);
}

function mentorSignupCodeMatches(code: string | null | undefined) {
  const expected = process.env.MENTOR_SIGNUP_CODE?.trim();
  return Boolean(expected && code?.trim() && code.trim() === expected);
}

function canCreateMentorAccount(params: {
  email: string;
  mentorAccessCode?: string | null;
}) {
  const inferredRoles = new Set(rolesFromEmail(params.email));
  return (
    inferredRoles.has("mentor") ||
    inferredRoles.has("admin") ||
    mentorSignupCodeMatches(params.mentorAccessCode)
  );
}

export function getUserRoles(user: UserProfile | null | undefined): UserRole[] {
  if (!user) {
    return [];
  }

  return Array.from(new Set([...(user.roles ?? []), ...rolesFromEmail(user.email)]));
}

export function userHasRole(
  user: UserProfile | null | undefined,
  roles: UserRole | UserRole[]
) {
  const required = Array.isArray(roles) ? roles : [roles];
  const userRoles = new Set(getUserRoles(user));
  return required.some((role) => userRoles.has(role));
}

function createSessionToken() {
  return randomBytes(32).toString("hex");
}

function shouldUseSecureCookies(requestUrl?: string) {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  const candidate = requestUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  if (!candidate) {
    return true;
  }

  try {
    const { hostname } = new URL(candidate);
    return !["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return true;
  }
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function derivePasswordKey(password: string, salt: string) {
  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return derived.toString("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derivePasswordKey(password, salt);
  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
}

export async function verifyPassword(password: string, passwordHash: string | null | undefined) {
  if (!passwordHash) {
    return false;
  }

  const [prefix, salt, storedHash] = passwordHash.split("$");
  if (prefix !== PASSWORD_PREFIX || !salt || !storedHash) {
    return false;
  }

  const candidateHash = await derivePasswordKey(password, salt);
  const storedBuffer = Buffer.from(storedHash, "hex");
  const candidateBuffer = Buffer.from(candidateHash, "hex");

  if (storedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, candidateBuffer);
}

function activeSession(sessions: AuthSessionRecord[], token: string) {
  const now = Date.now();
  const hashed = hashSessionToken(token);

  return sessions.find(
    (session) =>
      session.session_token_hash === hashed &&
      new Date(session.expires_at).getTime() > now
  );
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const db = await readDb();
  const session = activeSession(db.authSessions, token);
  if (!session) {
    return null;
  }

  const user = db.users.find((entry) => entry.user_id === session.user_id) ?? null;
  return user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("You must be signed in to continue.", 401);
  }
  return user;
}

export async function requireMentorUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/mentor/login");
  }
  if (!userHasRole(user, ["mentor", "admin"])) {
    redirect("/");
  }
  return user;
}

export async function requireMentorApiUser() {
  const user = await requireApiUser();
  if (!userHasRole(user, ["mentor", "admin"])) {
    throw new AuthError("Mentor access is required for this action.", 403);
  }
  return user;
}

function cookieOptions(expiresAt: Date, requestUrl?: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(requestUrl),
    path: "/",
    expires: expiresAt
  };
}

export async function createUserAccount(params: {
  email: string;
  password: string;
  displayName?: string | null;
  requestedRole?: "student" | "mentor";
  mentorAccessCode?: string | null;
}) {
  const email = normalizeEmail(params.email);
  const passwordHash = await hashPassword(params.password);
  const now = new Date().toISOString();
  const inferredRoles = rolesFromEmail(email);
  const roles = new Set<UserRole>(["student", ...inferredRoles]);

  if (params.requestedRole === "mentor") {
    if (!canCreateMentorAccount({ email, mentorAccessCode: params.mentorAccessCode })) {
      throw new AuthError("Mentor signup requires an approved mentor email or access code.", 403);
    }

    roles.add("mentor");
  }

  const user: UserProfile = {
    user_id: crypto.randomUUID(),
    display_name: params.displayName?.trim() || email.split("@")[0],
    email,
    password_hash: passwordHash,
    roles: Array.from(roles),
    resume_text: null,
    resume_file_name: null,
    target_roles: [],
    preferred_modes: [],
    known_weak_skills: [],
    created_at: now,
    updated_at: now
  };

  await updateDb((db) => {
    if (db.users.some((entry) => entry.email?.toLowerCase() === email)) {
      throw new AuthError("An account with that email already exists.", 409);
    }

    return {
      ...db,
      users: [...db.users, user]
    };
  });

  logEvent("auth.signup.success", {
    email,
    requested_role: params.requestedRole ?? "student",
    granted_roles: user.roles ?? []
  });

  return user;
}

export async function authenticateUser(params: { email: string; password: string }) {
  const email = normalizeEmail(params.email);
  const db = await readDb();
  const user = db.users.find((entry) => entry.email?.toLowerCase() === email) ?? null;

  if (!user) {
    logEvent("auth.login.failed", { email, reason: "user_not_found" }, "warn");
    throw new AuthError("Invalid email or password.", 401);
  }

  const passwordIsValid = await verifyPassword(params.password, user.password_hash);
  if (!passwordIsValid) {
    logEvent("auth.login.failed", { email, reason: "invalid_password" }, "warn");
    throw new AuthError("Invalid email or password.", 401);
  }

  logEvent("auth.login.success", {
    email,
    roles: getUserRoles(user)
  });

  return user;
}

export async function createAuthSession(userId: string) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const record: AuthSessionRecord = {
    auth_session_id: crypto.randomUUID(),
    user_id: userId,
    session_token_hash: hashSessionToken(token),
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString()
  };

  await updateDb((db) => ({
    ...db,
    authSessions: [
      ...db.authSessions.filter((session) => new Date(session.expires_at).getTime() > Date.now()),
      record
    ]
  }));

  return {
    token,
    expiresAt
  };
}

export async function invalidateCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return;
  }

  const hashed = hashSessionToken(token);
  await updateDb((db) => ({
    ...db,
    authSessions: db.authSessions.filter((session) => session.session_token_hash !== hashed)
  }));
}

export function applySessionCookie(
  response: NextResponse,
  session: { token: string; expiresAt: Date },
  requestUrl?: string
) {
  response.cookies.set(AUTH_COOKIE_NAME, session.token, cookieOptions(session.expiresAt, requestUrl));
  return response;
}

export function clearSessionCookie(response: NextResponse, requestUrl?: string) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(requestUrl),
    path: "/",
    expires: new Date(0)
  });
  return response;
}

export function authJsonError(error: unknown, fallbackMessage: string) {
  const status = error instanceof AuthError ? error.status : 400;
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : fallbackMessage
    },
    { status }
  );
}
