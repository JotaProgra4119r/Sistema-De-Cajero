import { useState, useEffect } from "react";
import { WelcomeAuthView } from "./views/WelcomeAuthView";
import { UserDashboardView } from "./views/UserDashboardView";
import { AdminConsoleView } from "./views/AdminConsoleView";
import { WindowBar } from "./components/WindowBar";

export function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAdminSession, setIsAdminSession] = useState<boolean>(false);
  const [wsNotification, setWsNotification] = useState<string | null>(null);

  // Connect to WebSocket for live hardware events
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket("ws://127.0.0.1:8000/ws");
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

  const handleLogout = () => {
    localStorage.removeItem("atm_token");
    setCurrentUser(null);
    setIsAdminSession(false);
  };

  return (
    <div className="w-screen h-screen bg-discord-base overflow-hidden relative flex flex-col">
      {/* Top Window Bar: Modo Ventana / Pantalla Completa & Controls */}
      <WindowBar />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Toast notification for hardware events */}
        {wsNotification && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-discord-surface border border-discord-blurple text-white font-bold text-sm shadow-kiosk flex items-center gap-3 animate-bounce">
            <div className="w-2.5 h-2.5 rounded-full bg-discord-green animate-ping" />
            <span>{wsNotification}</span>
          </div>
        )}

        {!currentUser ? (
          <WelcomeAuthView onLoginSuccess={handleLoginSuccess} />
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
