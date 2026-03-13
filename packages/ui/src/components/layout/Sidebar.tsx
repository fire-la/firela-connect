/**
 * Sidebar Component
 *
 * Navigation sidebar for configuration pages.
 * Dynamically filters navigation items based on service toggle state.
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
  Loader2,
} from "lucide-react"
import { useState, useMemo } from "react"
import { useServiceState } from "@/contexts/ServiceStateContext"
import { type ServiceId } from "@/types/services"

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
  /** Service ID this nav item belongs to. null = always visible */
  serviceId: ServiceId | null
}

/**
 * Navigation items mapped to their service IDs
 * - billclaw: /connect, /sync, /export, /ign, /webhooks
 * - null: /settings (always visible)
 */
const NAV_ITEMS: NavItem[] = [
  { path: "/connect", label: "Connect", icon: <LinkIcon className="w-5 h-5" />, serviceId: "billclaw" },
  { path: "/sync", label: "Sync", icon: <RefreshCw className="w-5 h-5" />, serviceId: "billclaw" },
  { path: "/export", label: "Export", icon: <Download className="w-5 h-5" />, serviceId: "billclaw" },
  { path: "/ign", label: "IGN", icon: <Key className="w-5 h-5" />, serviceId: "billclaw" },
  { path: "/webhooks", label: "Webhooks", icon: <Webhook className="w-5 h-5" />, serviceId: "billclaw" },
  { path: "/settings", label: "Settings", icon: <Settings className="w-5 h-5" />, serviceId: null },
]

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { state, loading } = useServiceState()

  /**
   * Filter navigation items based on service state
   * - Show all items while loading (graceful degradation)
   * - Hide items for disabled services
   * - Always show items with serviceId: null
   */
  const visibleNavItems = useMemo(() => {
    // While loading, show all items (graceful degradation)
    if (loading || !state) {
      return NAV_ITEMS
    }

    // Filter based on service state
    return NAV_ITEMS.filter((item) => {
      // Always show items without a serviceId (e.g., Settings)
      if (item.serviceId === null) {
        return true
      }
      // Show items for enabled services
      return state[item.serviceId] === true
    })
  }, [state, loading])

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
          {loading && (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-2" />
          )}
        </div>

        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => (
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
