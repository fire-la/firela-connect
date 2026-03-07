/**
 * BillClaw UI - Main App Component
 *
 * Router setup for OAuth and configuration pages.
 */
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { ConnectPage } from "@/components/pages/ConnectPage"
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
              <PlaceholderPage title="Sync Settings" />
            </PageLayout>
          }
        />
        <Route
          path="/export"
          element={
            <PageLayout>
              <PlaceholderPage title="Export Settings" />
            </PageLayout>
          }
        />
        <Route
          path="/ign"
          element={
            <PageLayout>
              <PlaceholderPage title="IGN Integration" />
            </PageLayout>
          }
        />
        <Route
          path="/webhooks"
          element={
            <PageLayout>
              <PlaceholderPage title="Webhook Configuration" />
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

// Placeholder page for routes not yet implemented
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder-page">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{title}</h1>
      <p className="text-gray-600">This section is coming soon.</p>
    </div>
  )
}
