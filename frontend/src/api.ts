import type { Agent, Message, Suggestion, Ticket, TicketDetail } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function messageFrom(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

type Token = string;

async function request<T>(path: string, token: Token | null, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as { error?: { code?: string; message?: string } }) : {};
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error?.code ?? "request_failed",
      data.error?.message ?? response.statusText
    );
  }
  return data as T;
}

export const api = {
  login(email: string, password: string) {
    return request<{ token: string; agent: Agent }>("/api/auth/login", null, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  me(token: string) {
    return request<{ agent: Agent }>("/api/auth/me", token);
  },
  tickets(token: string) {
    return request<{ tickets: Ticket[] }>("/api/tickets", token);
  },
  ticket(token: string, id: string) {
    return request<TicketDetail>(`/api/tickets/${id}`, token);
  },
  agents(token: string) {
    return request<{ agents: Agent[] }>("/api/agents", token);
  },
  updateTicket(
    token: string,
    id: string,
    patch: { status?: Ticket["status"]; priority?: Ticket["priority"]; assigneeId?: string | null }
  ) {
    return request<{ ticket: Ticket }>(`/api/tickets/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  send(token: string, id: string, body: string) {
    return request<{ message: Message; customerReplies: Message[]; ticket: Ticket }>(
      `/api/tickets/${id}/messages`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ body }),
      }
    );
  },
  draft(token: string, id: string) {
    return request<{ body: string; updatedAt: string | null }>(`/api/tickets/${id}/draft`, token);
  },
  saveDraft(token: string, id: string, body: string) {
    return request<{ body: string; updatedAt: string | null }>(`/api/tickets/${id}/draft`, token, {
      method: "PUT",
      body: JSON.stringify({ body }),
    });
  },
  suggestion(token: string, id: string) {
    return request<Suggestion>(`/api/tickets/${id}/suggestion`, token);
  },
};
