import { User, MeterReading, Target, ChatMessage } from "../types";

const API_URL = ""; // Relative paths will request to our Express server

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem("consumo_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Erro de rede: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // Auth methods
  public auth = {
    login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
      const res = await this.request<{ user: User; token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("consumo_token", res.token);
      return res;
    },

    register: async (email: string, password: string, fullName: string, company: string): Promise<{ user: User; token: string }> => {
      const res = await this.request<{ user: User; token: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName, company }),
      });
      localStorage.setItem("consumo_token", res.token);
      return res;
    },

    me: async (): Promise<{ user: User }> => {
      return this.request<{ user: User }>("/api/auth/me");
    },

    updateProfile: async (updates: Partial<Pick<User, "fullName" | "company" | "emailReportsEnabled" | "theme">>): Promise<{ user: User }> => {
      return this.request<{ user: User }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },

    logout: () => {
      localStorage.removeItem("consumo_token");
    }
  };

  // Meter Readings methods
  public readings = {
    getAll: async (): Promise<MeterReading[]> => {
      return this.request<MeterReading[]>("/api/readings");
    },

    create: async (reading: Omit<MeterReading, "id" | "userId" | "consumption" | "createdAt">): Promise<MeterReading> => {
      return this.request<MeterReading>("/api/readings", {
        method: "POST",
        body: JSON.stringify(reading),
      });
    },

    update: async (id: string, updates: Partial<Omit<MeterReading, "id" | "userId" | "createdAt">>): Promise<MeterReading> => {
      return this.request<MeterReading>(`/api/readings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },

    delete: async (id: string): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>(`/api/readings/${id}`, {
        method: "DELETE",
      });
    },

    clearAll: async (): Promise<{ success: boolean; message: string }> => {
      return this.request<{ success: boolean; message: string }>("/api/readings", {
        method: "DELETE",
      });
    }
  };

  // Targets methods
  public targets = {
    getAll: async (): Promise<Target[]> => {
      return this.request<Target[]>("/api/targets");
    },

    upsert: async (target: Omit<Target, "id" | "userId" | "createdAt">): Promise<Target> => {
      return this.request<Target>("/api/targets", {
        method: "POST",
        body: JSON.stringify(target),
      });
    },

    delete: async (id: string): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>(`/api/targets/${id}`, {
        method: "DELETE",
      });
    }
  };

  // Chat methods linked with Gemini
  public chat = {
    getHistory: async (): Promise<ChatMessage[]> => {
      return this.request<ChatMessage[]>("/api/chat/history");
    },

    clearHistory: async (): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>("/api/chat/history", {
        method: "DELETE",
      });
    },

    sendMessage: async (message: string, image?: { mimeType: string; data: string }): Promise<ChatMessage> => {
      return this.request<ChatMessage>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, image }),
      });
    }
  };

  // Gmail methods
  public gmail = {
    getAuthUrl: async (): Promise<{ url: string }> => {
      return this.request<{ url: string }>("/api/auth/google/url");
    },
    disconnect: async (): Promise<{ success: boolean; message: string }> => {
      return this.request<{ success: boolean; message: string }>("/api/auth/google/disconnect", {
        method: "DELETE",
      });
    },
    syncInvoices: async (): Promise<{ faturas: Array<{ gmailId: string; subject: string; date: string; category: "energia" | "agua" | "combustivel" | "internet"; value: number; unit: string; costMt: number | null; notes: string }> }> => {
      return this.request<{ faturas: Array<{ gmailId: string; subject: string; date: string; category: "energia" | "agua" | "combustivel" | "internet"; value: number; unit: string; costMt: number | null; notes: string }> }>("/api/gmail/sync-invoices");
    },
    sendReport: async (): Promise<{ success: boolean; message: string }> => {
      return this.request<{ success: boolean; message: string }>("/api/gmail/send-report", {
        method: "POST",
      });
    }
  };
}

export const api = new ApiClient();
export default api;
