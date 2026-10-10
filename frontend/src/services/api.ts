import axios from "axios";

export const RENDER_CLOUD_URL = "https://sistema-de-cajero.onrender.com";
export const LOCAL_API_URL = "http://127.0.0.1:8000";

export const getServerMode = (): "cloud" | "local" => {
  if (typeof window === "undefined") return "local";
  const custom = localStorage.getItem("atm_api_url");
  if (custom) {
    return custom.includes("onrender.com") ? "cloud" : "local";
  }
  if (window.location.origin.includes("onrender.com")) {
    return "cloud";
  }
  return "local";
};

export const switchServerMode = (mode: "cloud" | "local") => {
  if (mode === "cloud") {
    localStorage.setItem("atm_api_url", RENDER_CLOUD_URL);
  } else {
    localStorage.setItem("atm_api_url", LOCAL_API_URL);
  }
  window.location.reload();
};

export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("atm_api_url");
    if (custom) return custom;

    // Si se corre en la nube (ej. https://sistema-de-cajero.onrender.com) o en el mismo servidor web que sirve el frontend
    const origin = window.location.origin;
    const protocol = window.location.protocol;
    const host = window.location.hostname;

    // Si está en Render o dominio web HTTPS/HTTP sin puerto de desarrollo Vite (5173) y no es archivo local Electron
    if (origin && !origin.startsWith("file:") && !origin.includes(":5173") && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return origin;
    }

    // Si es modo desarrollo o Electron apuntando a IP LAN específica
    if (host && host !== "localhost" && host !== "127.0.0.1" && !host.startsWith("file")) {
      return `${protocol}//${host}:8000`;
    }
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  return LOCAL_API_URL;
};

export const getWsBaseUrl = (): string => {
  const httpUrl = getApiBaseUrl();
  if (httpUrl.startsWith("https://")) {
    return httpUrl.replace(/^https:\/\//, "wss://") + "/ws";
  }
  return httpUrl.replace(/^http:\/\//, "ws://") + "/ws";
};

export const apiClient = axios.create({
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
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

export const syncService = {
  saveOfflineSnapshot: (key: string, data: any) => {
    try {
      localStorage.setItem(`atm_cache_${key}`, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch {
      // quota or private mode
    }
  },
  getOfflineSnapshot: (key: string) => {
    try {
      const item = localStorage.getItem(`atm_cache_${key}`);
      return item ? JSON.parse(item).data : null;
    } catch {
      return null;
    }
  },
  isCloudOnline: async (): Promise<boolean> => {
    try {
      const res = await apiClient.get("/health", { timeout: 3000 });
      return res.status === 200;
    } catch {
      return false;
    }
  }
};