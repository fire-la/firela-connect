/**
 * Page Layout Component
 *
 * Main layout wrapper with sidebar and content area.
 */
import { ReactNode } from "react"
import { Sidebar } from "./Sidebar"

interface PageLayoutProps {
  children: ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
