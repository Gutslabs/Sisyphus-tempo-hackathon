"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ChatPanel } from "@/components/chat/chat-panel";
import { PaymentsView } from "@/components/payments/payments-view";
import { TxView } from "@/components/tx/tx-view";

export type View = "dashboard" | "chat" | "payments" | "tx";

const VIEW_HASH: Record<View, string> = {
  dashboard: "dashboard",
  chat: "chat",
  payments: "payments",
  tx: "tx",
};
const HASH_VIEW: Record<string, View> = {
  dashboard: "dashboard",
  chat: "chat",
  payments: "payments",
  tx: "tx",
};

function viewFromHash(): View {
  if (typeof window === "undefined") return "dashboard";
  const raw = window.location.hash.slice(1) || "dashboard";
  const segment = raw.split("/")[0]?.toLowerCase() ?? "dashboard";
  return HASH_VIEW[segment] ?? "dashboard";
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

  // After hydration, sync view from URL hash and keep it in sync on hash changes
  useEffect(() => {
    const updateFromHash = () => setView(viewFromHash());
    updateFromHash();
    const onHashChange = () => updateFromHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleViewChange = useCallback((next: View) => {
    setView(next);
    window.location.hash = VIEW_HASH[next];
  }, []);

  // Optionally auto-collapse when first entering chat; keep user toggle afterwards
  useEffect(() => {
    if (view === "chat") {
      setDesktopSidebarCollapsed(true);
    }
  }, [view]);

  return (
    <div className="flex h-screen max-h-screen overflow-hidden">
      <Sidebar
        activeView={view}
        onViewChange={handleViewChange}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        desktopCollapsed={desktopSidebarCollapsed}
        onDesktopToggle={() => setDesktopSidebarCollapsed((v) => !v)}
      />
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden flex flex-col">
          {view === "dashboard" && <Dashboard />}
          {view === "chat" && <ChatPanel />}
          {view === "payments" && <PaymentsView />}
          {view === "tx" && <TxView />}
        </main>
      </div>
    </div>
  );
}
