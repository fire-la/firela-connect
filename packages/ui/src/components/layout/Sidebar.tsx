/**
 * Sidebar Component
 *
 * Navigation sidebar for configuration pages.
 */
import { NavLink } from "react-router-dom"
import {
  Link as LinkIcon,
  RefreshCw,
  Download,
  Key,
  Webhook,
  Settings,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { path: "/connect", label: "Connect", icon: <LinkIcon className="w-5 h-5" /> },
  { path: "/sync", label: "Sync", icon: <RefreshCw className="w-5 h-5" /> },
  { path: "/export", label: "Export", icon: <Download className="w-5 h-5" /> },
  { path: "/ign", label: "IGN", icon: <Key className="w-5 h-5" /> },
  { path: "/webhooks", label: "Webhooks", icon: <Webhook className="w-5 h-5" /> },
  { path: "/settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
]

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="mobile-menu-button"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h1 className="sidebar-logo">BillClaw</h1>
          <span className="sidebar-version">v0.5.5</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
              onClick={() => setMobileOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="text-xs text-gray-500">
            Financial Data Sovereignty
          </span>
        </div>
      </aside>
    </>
  )
}
