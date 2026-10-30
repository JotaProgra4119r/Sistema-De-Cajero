import { useState, useEffect } from "react";
import { WelcomeAuthView } from "./views/WelcomeAuthView";
import { UserDashboardView } from "./views/UserDashboardView";
import { AdminConsoleView } from "./views/AdminConsoleView";
import { WindowBar } from "./components/WindowBar";
import { AtmIdentificationModal } from "./components/AtmIdentificationModal";
import { authService, getWsBaseUrl } from "./services/api";

export function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAdminSession, setIsAdminSession] = useState<boolean>(false);
  const [wsNotification, setWsNotification] = useState<string | null>(null);
  const [lastRfidCard, setLastRfidCard] = useState<string | null>(null);
  const [showAtmModal, setShowAtmModal] = useState<boolean>(() => {
    return !localStorage.getItem("active_atm_id") || localStorage.getItem("active_atm_session_started") !== "true";
  });

  // Escuchar apertura manual o automática del modal de identificación de cajero
  useEffect(() => {
    const handleOpenModal = () => setShowAtmModal(true);
    window.addEventListener("open_atm_identification_modal", handleOpenModal);
    return () => window.removeEventListener("open_atm_identification_modal", handleOpenModal);
  }, []);

  // Connect to WebSocket for live hardware events
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(getWsBaseUrl());
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "HARDWARE_DISPENSING_STARTED") {
            setWsNotification(`Dispensando Q${data.total}...`);
          } else if (data.type === "HARDWARE_DISPENSING_FINISHED") {
            if (data.response?.status === "SUCCESS") {
              setWsNotification(`Dispensación física completada (Q${data.response.dispensed}).`);
            } else {
              setWsNotification(`Atasco mecánico detectado en cartuchos.`);
            }
            setTimeout(() => setWsNotification(null), 4000);
          } else if (data.type === "RFID_CARD_DETECTED") {
            setLastRfidCard(data.card_number);
            setWsNotification(`💳 Tarjeta RFID Detectada: ${data.formatted_card || data.card_number} (UID: ${data.uid})`);
            setTimeout(() => setWsNotification(null), 5000);
          }
        } catch {
          // ignore
        }
      };
    } catch (e) {
      console.warn("WebSocket not reachable:", e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleLoginSuccess = (user: any, isAdmin: boolean) => {
    setCurrentUser(user);
    setIsAdminSession(isAdmin);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem("atm_token");
    setCurrentUser(null);
    setIsAdminSession(false);
  };

  const handleAtmSelected = (atm: any) => {
    localStorage.setItem("active_atm_session_started", "true");
    setShowAtmModal(false);
    setWsNotification(`🏧 Cajero enlazado: ${atm.nombre} (${atm.id_cajero})`);
    setTimeout(() => setWsNotification(null), 4000);
  };

  return (
    <div className="w-full min-h-screen min-h-[100dvh] bg-discord-base overflow-x-hidden overflow-y-auto relative flex flex-col">
      {/* Modal de Identificación y Enlace de Cajero al Iniciar */}
      <AtmIdentificationModal
        isOpen={showAtmModal}
        onClose={() => setShowAtmModal(false)}
        onAtmSelected={handleAtmSelected}
      />

      {/* Top Window Bar: Modo Ventana / Pantalla Completa & Controls */}
      <WindowBar />

      {/* Main Content Area */}
      <div className="flex-1 w-full min-h-0 overflow-y-auto relative flex flex-col">
        {/* Toast notification for hardware events */}
        {wsNotification && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-discord-surface border border-discord-blurple text-white font-bold text-sm shadow-kiosk flex items-center gap-3 animate-bounce">
            <div className="w-2.5 h-2.5 rounded-full bg-discord-green animate-ping" />
            <span>{wsNotification}</span>
          </div>
        )}

        {!currentUser ? (
          <WelcomeAuthView onLoginSuccess={handleLoginSuccess} lastRfidCard={lastRfidCard} />
        ) : isAdminSession ? (
          <AdminConsoleView adminUser={currentUser} onLogout={handleLogout} />
        ) : (
          <UserDashboardView user={currentUser} onLogout={handleLogout} />
        )}
      </div>
    </div>
  );
}

export default App;
