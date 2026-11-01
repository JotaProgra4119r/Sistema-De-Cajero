import axios from "axios";

export const RENDER_CLOUD_URL = "https://sistema-de-cajero.onrender.com";
export const LOCAL_API_URL = "http://127.0.0.1:8000";

export const getTerminalSessionId = (): string => {
  if (typeof window === "undefined") return "term-srv";
  let sId = localStorage.getItem("atm_terminal_session_id");
  if (!sId) {
    sId = "term-" + Math.random().toString(36).substring(2, 10) + "-" + Date.now().toString(36);
    localStorage.setItem("atm_terminal_session_id", sId);
  }
  return sId;
};

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
  const activeAtm = localStorage.getItem("active_atm_id") || "ATM-001";
  if (config.headers) {
    config.headers["X-ATM-ID"] = activeAtm;
  }
  return config;
});

export const authService = {
  login: async (cardNumber: string, pin: string, token: string, isAdmin: boolean, idCajero?: string) => {
    const res = await apiClient.post("/api/auth/login", {
      card_number: cardNumber,
      pin,
      token,
      is_admin: isAdmin,
      id_cajero: idCajero || localStorage.getItem("active_atm_id") || "ATM-001",
    });
    return res.data;
  },
  getAtms: async () => {
    const res = await apiClient.get("/api/auth/atms");
    return res.data;
  },
  getTokenPreview: async (idCajero?: string) => {
    const active = idCajero || localStorage.getItem("active_atm_id") || "ATM-001";
    const res = await apiClient.get(`/api/auth/token-preview?id_cajero=${active}`);
    return res.data;
  },
  getAtmStatus: async (idCajero?: string) => {
    const active = idCajero || localStorage.getItem("active_atm_id") || "ATM-001";
    const res = await apiClient.get(`/api/auth/atm-status?id_cajero=${active}`);
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
  registerAtm: async (nombre: string, codigoCajero: string, ubicacion?: string, sessionId?: string) => {
    const sId = sessionId || getTerminalSessionId();
    const res = await apiClient.post("/api/auth/atm/register", {
      nombre,
      codigo_cajero: codigoCajero,
      ubicacion: ubicacion || "Sucursal General",
      session_id: sId,
    });
    return res.data;
  },
  connectAtm: async (idCajero: string, codigoCajero: string, sessionId?: string, force: boolean = false) => {
    const sId = sessionId || getTerminalSessionId();
    const res = await apiClient.post("/api/auth/atm/connect", {
      id_cajero: idCajero,
      codigo_cajero: codigoCajero,
      session_id: sId,
      force,
    });
    return res.data;
  },
  heartbeatAtm: async (idCajero: string, sessionId?: string) => {
    const sId = sessionId || getTerminalSessionId();
    try {
      const res = await apiClient.post("/api/auth/atm/heartbeat", {
        id_cajero: idCajero,
        session_id: sId,
      });
      return res.data;
    } catch {
      return null;
    }
  },
  disconnectAtm: async (idCajero: string, sessionId?: string) => {
    const sId = sessionId || getTerminalSessionId();
    const res = await apiClient.post("/api/auth/atm/disconnect", {
      id_cajero: idCajero,
      session_id: sId,
    });
    return res.data;
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
  lookupAccount: async (accountId: string) => {
    const res = await apiClient.get(`/api/user/lookup-account?account_id=${encodeURIComponent(accountId)}`);
    return res.data;
  },
  depositToAccount: async (accountId: string, bills: Record<string, number>) => {
    const res = await apiClient.post("/api/user/deposit-to-account", {
      id_cuenta_destino: accountId,
      bills,
    });
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
  checkPendingTransaction: async (reference: string) => {
    const res = await apiClient.get(`/api/user/transactions/status?reference=${encodeURIComponent(reference)}`);
    return res.data;
  },
  calculateBreakdown: async (amount: number) => {
    const res = await apiClient.post("/api/user/calculate-breakdown", { amount });
    return res.data;
  },
};

export const adminService = {
  getMetrics: async () => {
    const res = await apiClient.get("/api/admin/metrics");
    return res.data;
  },
  getSuperMetrics: async () => {
    const res = await apiClient.get("/api/admin/super/metrics");
    return res.data;
  },
  getSuperCajeroDetails: async (idCajero: string) => {
    const res = await apiClient.get(`/api/admin/super/cajero/${idCajero}/detalles`);
    return res.data;
  },
  getSuperConsolidatedReport: async () => {
    const res = await apiClient.get("/api/admin/super/reporte-consolidado");
    return res.data;
  },
  initializeVault: async (bills: Record<string, number>, idCajero?: string) => {
    const res = await apiClient.post("/api/admin/vault/initialize", { bills, id_cajero: idCajero });
    return res.data;
  },
  initializeAllVaults: async (bills?: Record<string, number>) => {
    const res = await apiClient.post("/api/admin/vault/initialize-all", { bills });
    return res.data;
  },
  addCashVault: async (bills: Record<string, number>, idCajero?: string) => {
    const res = await apiClient.post("/api/admin/vault/add-cash", { bills, id_cajero: idCajero });
    return res.data;
  },
  resetVault: async (idCajero?: string) => {
    const q = idCajero ? `?id_cajero=${idCajero}` : "";
    const res = await apiClient.post(`/api/admin/vault/reset${q}`);
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

export const interbankService = {
  getStatus: async () => {
    const res = await apiClient.get("/api/interbank/status");
    return res.data;
  },
  getBanks: async () => {
    const res = await apiClient.get("/api/interbank/banks");
    return res.data;
  },
  scanNetwork: async () => {
    const res = await apiClient.post("/api/interbank/scan");
    return res.data;
  },
  verifyAccount: async (bankCode: string, accountNumber: string) => {
    const res = await apiClient.post("/api/interbank/verify", {
      bank_code: bankCode,
      account_number: accountNumber,
    });
    return res.data;
  },
  transfer: async (targetBankCode: string, targetAccount: string, amount: number, concepto?: string, cajeroId?: string) => {
    const res = await apiClient.post("/api/interbank/transfer", {
      target_bank_code: targetBankCode,
      target_account: targetAccount,
      amount,
      concepto,
      cajero_id: cajeroId || localStorage.getItem("active_atm_id") || "ATM-001",
    });
    return res.data;
  },
  getTransfersHistory: async () => {
    const res = await apiClient.get("/api/interbank/transfers");
    return res.data;
  },
  upsertBank: async (bankData: { codigo_banco: string; nombre_banco: string; ip: string; puerto: number; limite_diario: number }) => {
    const res = await apiClient.post("/api/interbank/banks/upsert", bankData);
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
  getStatus: async () => {
    const res = await apiClient.get("/api/sync/status");
    return res.data;
  },
  executeSync: async () => {
    const res = await apiClient.post("/api/sync/execute");
    return res.data;
  },
  exportSnapshot: async () => {
    const res = await apiClient.get("/api/sync/export");
    return res.data;
  },
  importSnapshot: async (data: any) => {
    const res = await apiClient.post("/api/sync/import", data);
    return res.data;
  },
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