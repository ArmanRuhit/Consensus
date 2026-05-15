const BASE = '';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Request failed');
  return body as T;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface PollOption {
  id: string;
  text: string;
  count?: number;
  percentage?: number;
}

export interface PollQuestion {
  id: string;
  text: string;
  isMandatory?: boolean;
  options: PollOption[];
  totalAnswered?: number;
}

export interface ActivePoll {
  shortId: string;
  state: 'active';
  title: string;
  description: string | null;
  responseMode: 'anonymous' | 'authenticated';
  expiresAt: string;
  questions: (PollQuestion & { isMandatory: boolean })[];
}

export interface ExpiredPoll {
  shortId: string;
  state: 'expired';
  title: string;
  description: string | null;
}

export interface PublishedPoll {
  shortId: string;
  state: 'published';
  title: string;
  description: string | null;
  totalResponses: number;
  questions: (PollQuestion & { totalAnswered: number })[];
}

export type PollResponse = ActivePoll | ExpiredPoll | PublishedPoll;

export const api = {
  signup(data: { email: string; password: string; name: string }) {
    return request<{ user: User }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  login(data: { email: string; password: string }) {
    return request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  me() {
    return request<{ user: User }>('/api/auth/me');
  },
  logout() {
    return request<{ message: string }>('/api/auth/logout', { method: 'POST' });
  },
  fetchPoll(shortId: string) {
    return request<PollResponse>(`/api/polls/${shortId}`);
  },
  submitResponse(shortId: string, data: { answers: { questionId: string; selectedOptionId: string }[] }) {
    return request<{ id: string; message: string }>(`/api/polls/${shortId}/responses`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  createPoll(data: {
    title: string;
    description?: string;
    responseMode: 'anonymous' | 'authenticated';
    expiresAt: string;
    questions: {
      text: string;
      isMandatory: boolean;
      options: { text: string }[];
    }[];
  }) {
    return request<{ id: string; shortId: string; url: string }>('/api/polls', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  publishPoll(shortId: string) {
    return request<{ message: string }>(`/api/polls/${shortId}/publish`, {
      method: 'POST',
    });
  },
  closePoll(shortId: string) {
    return request<{ message: string }>(`/api/polls/${shortId}/close`, {
      method: 'POST',
    });
  },
  getMyPolls() {
    return request<PollSummary[]>('/api/polls');
  },
  getPollAnalytics(shortId: string) {
    return request<PollAnalytics>(`/api/polls/${shortId}/analytics`);
  },
};

export interface PollSummary {
  shortId: string;
  title: string;
  state: 'active' | 'expired' | 'published';
  responseMode: 'anonymous' | 'authenticated';
  responseCount: number;
  expiresAt: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface AnalyticsOption {
  id: string;
  text: string;
  count: number;
  percentage: number;
}

export interface AnalyticsQuestion {
  id: string;
  text: string;
  isMandatory: boolean;
  orderIndex: number;
  totalAnswered: number;
  options: AnalyticsOption[];
}

export interface PollAnalytics {
  shortId: string;
  state: 'active' | 'expired' | 'published';
  title: string;
  description: string | null;
  responseMode: 'anonymous' | 'authenticated';
  expiresAt: string;
  createdAt: string;
  publishedAt: string | null;
  totalResponses: number;
  questions: AnalyticsQuestion[];
}

export interface AnalyticsOption {
  id: string;
  text: string;
  count: number;
  percentage: number;
}

export interface AnalyticsQuestion {
  id: string;
  text: string;
  isMandatory: boolean;
  orderIndex: number;
  totalAnswered: number;
  options: AnalyticsOption[];
}

export interface PollAnalytics {
  shortId: string;
  state: 'active' | 'expired' | 'published';
  title: string;
  description: string | null;
  responseMode: 'anonymous' | 'authenticated';
  expiresAt: string;
  createdAt: string;
  publishedAt: string | null;
  totalResponses: number;
  questions: AnalyticsQuestion[];
}
