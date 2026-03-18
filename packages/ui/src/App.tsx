/**
 * BillClaw UI - Main App Component
 *
 * Router setup for OAuth and configuration pages.
 * Includes service toggle state management and route protection.
 */
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Link2, RefreshCw, Download, Cloud, Webhook, Settings } from "lucide-react"
import { ServiceStateProvider } from "@/contexts/ServiceStateContext"
import { ThemeProvider } from "@/context/Theme"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { PageLayout } from "@/components/layout/PageLayout"
import { ConnectPage } from "@/components/pages/ConnectPage"
import { SyncPage } from "@/components/pages/SyncPage"
import { ExportPage } from "@/components/pages/ExportPage"
import { IgnPage } from "@/components/pages/IgnPage"
import { WebhooksPage } from "@/components/pages/WebhooksPage"
import { SettingsPage } from "@/components/pages/SettingsPage"
import { PlaidConnectPage } from "@/components/pages/PlaidConnectPage"
import { GmailConnectPage } from "@/components/pages/GmailConnectPage"

/**
 * BillClaw sidebar menu configuration
 */
const billclawMenuItems = [
  {
    label: "Account",
    items: [
      { text: "Connect", itemKey: "connect", to: "/connect", icon: Link2 },
      { text: "Sync", itemKey: "sync", to: "/sync", icon: RefreshCw },
    ],
  },
  {
    label: "Export",
    items: [
      { text: "Beancount/Ledger", itemKey: "export", to: "/export", icon: Download },
      { text: "IGN Integration", itemKey: "ign", to: "/ign", icon: Cloud },
    ],
  },
  {
    label: "System",
    items: [
      { text: "Webhooks", itemKey: "webhooks", to: "/webhooks", icon: Webhook },
      { text: "Settings", itemKey: "settings", to: "/settings", icon: Settings },
    ],
  },
]

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ServiceStateProvider>
          <Routes>
          {/* Main configuration routes with layout */}
          <Route
            path="/"
            element={
              <PageLayout menuItems={billclawMenuItems} systemName="BillClaw">
                <HomePage />
              </PageLayout>
            }
          />
          <Route
            path="/connect"
            element={
              <ProtectedRoute serviceId="billclaw">
                <PageLayout menuItems={billclawMenuItems} systemName="BillClaw">
                  <ConnectPage />
                </PageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sync"
            element={
              <ProtectedRoute serviceId="billclaw">
                <PageLayout menuItems={billclawMenuItems} systemName="BillClaw">
                  <SyncPage />
                </PageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/export"
            element={
              <ProtectedRoute serviceId="billclaw">
                <PageLayout menuItems={billclawMenuItems} systemName="BillClaw">
                  <ExportPage />
                </PageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ign"
            element={
              <ProtectedRoute serviceId="billclaw">
                <PageLayout menuItems={billclawMenuItems} systemName="BillClaw">
                  <IgnPage />
                </PageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/webhooks"
            element={
              <ProtectedRoute serviceId="billclaw">
                <PageLayout menuItems={billclawMenuItems} systemName="BillClaw">
                  <WebhooksPage />
                </PageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PageLayout menuItems={billclawMenuItems} systemName="BillClaw">
                <SettingsPage />
              </PageLayout>
            }
          />

          {/* OAuth routes without layout (full-page OAuth flows) - UNPROTECTED */}
          <Route path="/connect/plaid" element={<PlaidConnectPage />} />
          <Route path="/connect/gmail" element={<GmailConnectPage />} />
          <Route path="/gmail-callback" element={<GmailConnectPage />} />
        </Routes>
        </ServiceStateProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

// Placeholder home page
function HomePage() {
  return (
    <div className="placeholder-page">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Welcome to BillClaw
      </h1>
      <p className="text-gray-600">
        Use the sidebar to navigate to configuration sections.
      </p>
    </div>
  )
}
