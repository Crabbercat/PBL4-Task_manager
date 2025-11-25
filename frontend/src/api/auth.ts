export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_API_BASE_URL;

type JsonValue = Record<string, unknown> | null;

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: JsonValue | string = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let message = typeof payload === "string" ? payload : "Request failed";
    if (payload && typeof payload === "object") {
      if (typeof payload.detail === "string") {
        message = payload.detail;
      } else if (Array.isArray(payload.detail) && payload.detail.length > 0) {
        const firstDetail = payload.detail[0];
        if (typeof firstDetail === "object" && firstDetail !== null && "msg" in firstDetail) {
          message = String(firstDetail.msg);
        }
      }
    }
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, init);
  return handleResponse<T>(response);
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  role?: "user" | "manager" | "admin";
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
}

export async function registerUser(payload: RegisterPayload) {
  return request<UserProfile>("/api/v1/register/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: LoginPayload) {
  const form = new URLSearchParams();
  form.set("username", payload.username);
  form.set("password", payload.password);

  return request<LoginResponse>("/api/v1/login/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
}
