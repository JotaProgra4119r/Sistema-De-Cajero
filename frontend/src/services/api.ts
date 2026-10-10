import axios from "axios";

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("atm_api_url");
    if (custom) return custom;

    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1" && !host.startsWith("file")) {
      return `http://${host}:8000`;
    }
  }
  return "http://127.0.0.1:8000";
};

export const getWsBaseUrl = (): string => {
  const httpUrl = getApiBaseUrl();
  return httpUrl.replace(/^http/, "ws") + "/ws";
};

export const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("atm_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: async (cardNumber: string, pin: string, token: string, isAdmin: boolean) => {
    const res = await apiClient.post("/api/auth/login", {
      card_number: cardNumber,
      pin,
      token,
      is_admin: isAdmin,
    });
    return res.data;
  },
  getTokenPreview: async () => {
    const res = await apiClient.get("/api/auth/token-preview");
    return res.data;
  },
  getAtmStatus: async () => {
    const res = await apiClient.get("/api/auth/atm-status");
    return res.data;
  },
  logout: async (token?: string) => {
    try {
      const res = await apiClient.post("/api/auth/logout", { token: token || undefined });
      return res.data;
    } catch {
      return null;
    }
  },
};

export const userService = {
  getSummary: async () => {
    const res = await apiClient.get("/api/user/summary");
    return res.data;
  },
  withdraw: async (amount: number, bills: Record<string, number>) => {
    const res = await apiClient.post("/api/user/withdraw", { amount, bills });
    return res.data;
  },
  deposit: async (bills: Record<string, number>) => {
    const res = await apiClient.post("/api/user/deposit", { bills });
    return res.data;
  },
  getTransactions: async () => {
    const res = await apiClient.get("/api/user/transactions");
    return res.data;
  },
  changePin: async (cardNumber: string, currentPin: string, newPin: string, token: string = "") => {
    const res = await apiClient.post("/api/user/change-pin", {
      card_number: cardNumber,
      current_pin: currentPin,
      token,
      new_pin: newPin,
    });
    return res.data;
  },
  getDeletedRecords: async () => {
    const res = await apiClient.get("/api/user/audit/deleted-records");
    return res.data;
  },
};

export const adminService = {
  getMetrics: async () => {
    const res = await apiClient.get("/api/admin/metrics");
    return res.data;
  },
  initializeVault: async (bills: Record<string, number>) => {
    const res = await apiClient.post("/api/admin/vault/initialize", { bills });
    return res.data;
  },
  addCashVault: async (bills: Record<string, number>) => {
    const res = await apiClient.post("/api/admin/vault/add-cash", { bills });
    return res.data;
  },
  resetVault: async () => {
    const res = await apiClient.post("/api/admin/vault/reset");
    return res.data;
  },
  registerEmployee: async (data: {
    nombre_completo: string;
    numero_tarjeta: string;
    pin: string;
    saldo_inicial: number;
    monto_max_diario: number;
  }) => {
    const res = await apiClient.post("/api/admin/users/register", data);
    return res.data;
  },
  reassignCard: async (userId: number, newCard: string) => {
    const res = await apiClient.post("/api/admin/users/reassign-card", {
      id_usuario: userId,
      nueva_tarjeta: newCard,
    });
    return res.data;
  },
  adjustLimit: async (userId: number, newLimit: number) => {
    const res = await apiClient.post("/api/admin/users/adjust-limit", {
      id_usuario: userId,
      nuevo_limite_diario: newLimit,
    });
    return res.data;
  },
  changeUserPin: async (userId: number, newPin: string) => {
    const res = await apiClient.post("/api/admin/users/change-pin", {
      id_usuario: userId,
      nuevo_pin: newPin,
    });
    return res.data;
  },
  softDeleteUser: async (userId: number, motivo: string) => {
    const res = await apiClient.post("/api/admin/users/soft-delete", {
      id_usuario: userId,
      motivo,
    });
    return res.data;
  },
  getDeletedRecords: async () => {
    const res = await apiClient.get("/api/admin/audit/deleted-records");
    return res.data;
  },
};

export const hardwareService = {
  getStatus: async () => {
    const res = await apiClient.get("/api/hardware/status");
    return res.data;
  },
  toggleJam: async (enable: boolean) => {
    const res = await apiClient.post("/api/hardware/simulate-jam", { simulate_jam: enable });
    return res.data;
  },
  simulateRfidTap: async (cardNumber: string, uid?: string) => {
    const res = await apiClient.post("/api/hardware/rfid/simulate-tap", {
      card_number: cardNumber,
      uid,
    });
    return res.data;
  },
  toggleRfidDebug: async (active: boolean) => {
    const res = await apiClient.post("/api/hardware/rfid/debug-mode", { active });
    return res.data;
  },
};