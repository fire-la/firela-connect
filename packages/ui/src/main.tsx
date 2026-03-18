/**
 * BillClaw UI - React Entry Point
 */
import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App"
import { StatusProvider } from "./context/Status"
import { UserProvider } from "./context/User"
import "./i18n" // Initialize i18n before App
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StatusProvider>
      <UserProvider>
        <App />
      </UserProvider>
    </StatusProvider>
  </React.StrictMode>,
)
