const TOKEN_KEY = "finly_token";
const USER_KEY = "finly_user";

export interface AuthUser {
  nome: string;
  email: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const doFetch = () => fetch(`${API}${path}`, { ...options, headers });

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    // Backend pode estar acordando (Render free tier) — aguarda 8s e tenta de novo
    await new Promise(r => setTimeout(r, 8000));
    res = await doFetch();
  }

  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
  }

  return res;
}
