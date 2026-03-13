/**
 * BillClaw UI - Main App Component
 *
 * Router setup for OAuth and configuration pages.
 */
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { ConnectPage } from "@/components/pages/ConnectPage"
import { SyncPage } from "@/components/pages/SyncPage"
import { ExportPage } from "@/components/pages/ExportPage"
import { IgnPage } from "@/components/pages/IgnPage"
import { WebhooksPage } from "@/components/pages/WebhooksPage"
import { SettingsPage } from "@/components/pages/SettingsPage"
import { PlaidConnectPage } from "@/components/pages/PlaidConnectPage"
import { GmailConnectPage } from "@/components/pages/GmailConnectPage"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main configuration routes with layout */}
        <Route
          path="/"
          element={
            <PageLayout>
              <HomePage />
            </PageLayout>
          }
        />
        <Route
          path="/connect"
          element={
            <PageLayout>
              <ConnectPage />
            </PageLayout>
          }
        />
        <Route
          path="/sync"
          element={
            <PageLayout>
              <SyncPage />
            </PageLayout>
          }
        />
        <Route
          path="/export"
          element={
            <PageLayout>
              <ExportPage />
            </PageLayout>
          }
        />
        <Route
          path="/ign"
          element={
            <PageLayout>
              <IgnPage />
            </PageLayout>
          }
        />
        <Route
          path="/webhooks"
          element={
            <PageLayout>
              <WebhooksPage />
            </PageLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <PageLayout>
              <SettingsPage />
            </PageLayout>
          }
        />

        {/* OAuth routes without layout (full-page OAuth flows) */}
        <Route path="/connect/plaid" element={<PlaidConnectPage />} />
        <Route path="/connect/gmail" element={<GmailConnectPage />} />
        <Route path="/gmail-callback" element={<GmailConnectPage />} />
      </Routes>
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
