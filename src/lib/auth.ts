// Hard-coded users with roles.
export type Role = "admin" | "staff";

interface UserRecord {
  password: string;
  role: Role;
}

export const STAFF_USERS: Record<string, UserRecord> = {
  admin: { password: "meter@123", role: "admin" },
  staff: { password: "staff@123", role: "staff" },
};

const KEY = "nmia_meter_session";

export interface Session {
  username: string;
  role: Role;
  loginAt: string;
}

export function login(username: string, password: string): Session | null {
  const u = username.trim().toLowerCase();
  const rec = STAFF_USERS[u];
  if (rec && rec.password === password) {
    const session: Session = { username: u, role: rec.role, loginAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(session));
    return session;
  }
  return null;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    // Backward compat: old sessions without role default to admin
    if (!s.role) s.role = s.username === "staff" ? "staff" : "admin";
    return s;
  } catch {
    return null;
  }
}

export function isAdmin(): boolean {
  return getSession()?.role === "admin";
}

export function logout() {
  localStorage.removeItem(KEY);
}
