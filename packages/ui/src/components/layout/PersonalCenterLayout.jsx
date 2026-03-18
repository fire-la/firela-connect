/**
 * PersonalCenterLayout - Personal Center layout
 *
 * NOTE: This layout now just renders children directly.
 * The sidebar is provided by PageLayout.jsx using Shadcn official Sidebar.
 * This component is kept for backward compatibility but no longer renders its own sidebar.
 */

export function PersonalCenterLayout({ children }) {
  // Just render children - sidebar is provided by PageLayout.jsx
  return <>{children}</>;
}
