import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  Settings,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

/**
 * MenuItem type definition
 */
interface MenuItem {
  text: string;
  itemKey: string;
  to?: string;
  icon?: LucideIcon;
  className?: string;
  items?: MenuItem[];
}

/**
 * MenuSection type definition
 */
interface MenuSection {
  label: string;
  items: MenuItem[];
}

interface AppSidebarProps {
  menuItems?: MenuSection[];
  user?: {
    username?: string;
    email?: string;
  };
  onLogout?: () => void;
  systemName?: string;
  logo?: string;
  onNavigate?: () => void;
}

/**
 * AppSidebar - Responsive sidebar with collapsible menu groups
 *
 * Design goals:
 * - Props-based menu configuration (no context dependency)
 * - Collapsible groups with sub-items
 * - User profile dropdown in footer
 * - Responsive with mobile close behavior
 *
 * Usage:
 * <AppSidebar
 *   menuItems={[
 *     { label: 'Console', items: [{ text: 'Dashboard', itemKey: 'dashboard', to: '/console' }] }
 *   ]}
 *   user={{ username: 'user', email: 'user@example.com' }}
 *   onLogout={() => console.log('logout')}
 * />
 */
export function AppSidebar({
  menuItems = [],
  user,
  onLogout,
  systemName = 'firela',
  logo,
  onNavigate = () => {},
}: AppSidebarProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const [openedKeys, setOpenedKeys] = useState<string[]>([]);
  const location = useLocation();

  // Close mobile sidebar when navigating
  const handleNavigate = () => {
    onNavigate();
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // User info for footer
  const userName = user?.username || 'User';
  const userEmail = user?.email || '';
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : 'U';

  const handleToggleOpen = (itemKey: string) => {
    if (openedKeys.includes(itemKey)) {
      setOpenedKeys(openedKeys.filter((k) => k !== itemKey));
    } else {
      setOpenedKeys([...openedKeys, itemKey]);
    }
  };

  const currentPath = location.pathname;
  const isItemSelected = (itemKey: string, to?: string) => {
    if (to === currentPath) return true;
    return false;
  };

  const renderNavItem = (item: MenuItem) => {
    if (item.className === 'tableHiddle') return null;

    const isActive = isItemSelected(item.itemKey, item.to);
    const Icon = item.icon;

    const content = (
      <SidebarMenuButton
        isActive={isActive}
        tooltip={!collapsed ? undefined : item.text}
        onClick={() => {
          if (item.to) handleNavigate();
        }}
      >
        {Icon && <Icon className='h-4 w-4' />}
        {!collapsed && <span>{item.text}</span>}
      </SidebarMenuButton>
    );

    if (!item.to) return content;

    return (
      <Link
        to={item.to}
        onClick={handleNavigate}
        className='block no-underline text-inherit'
      >
        {content}
      </Link>
    );
  };

  const renderSubItem = (item: MenuItem) => {
    if (item.className === 'tableHiddle') return null;

    const hasSubItems = item.items && item.items.length > 0;
    const isOpen = openedKeys.includes(item.itemKey);

    if (!hasSubItems) {
      return renderNavItem(item);
    }

    const Icon = item.icon;

    return (
      <SidebarMenuItem>
        <Collapsible
          open={isOpen}
          onOpenChange={() => handleToggleOpen(item.itemKey)}
        >
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={!collapsed ? undefined : item.text}>
              {Icon && <Icon className='h-4 w-4' />}
              {!collapsed && <span>{item.text}</span>}
              {!collapsed && (
                <ChevronDown
                  size={14}
                  className={cn(
                    'ml-auto transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                />
              )}
            </SidebarMenuButton>
          </CollapsibleTrigger>
          {!collapsed && (
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.items?.map((subItem) => {
                  if (subItem.className === 'tableHiddle') return null;
                  const isSubActive = isItemSelected(subItem.itemKey, subItem.to);

                  const subContent = (
                    <SidebarMenuSubButton isActive={isSubActive}>
                      <span>{subItem.text}</span>
                    </SidebarMenuSubButton>
                  );

                  if (!subItem.to) return subContent;

                  return (
                    <SidebarMenuSubItem key={subItem.itemKey}>
                      <Link
                        to={subItem.to}
                        onClick={handleNavigate}
                        className='block no-underline text-inherit'
                      >
                        {subContent}
                      </Link>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          )}
        </Collapsible>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible='icon'>
      {/* Sidebar Header - Brand */}
      <SidebarHeader className='flex flex-row items-center justify-between h-[57px] px-2 border-b border-border'>
        <div className='flex items-center gap-2'>
          <div className='h-8 w-8 rounded-[10px] bg-sidebar-accent flex items-center justify-center overflow-hidden'>
            {logo ? (
              <img
                src={logo}
                alt={systemName}
                className='h-5 w-5 object-contain'
              />
            ) : (
              <span className='text-sm font-semibold text-sidebar-foreground'>
                {systemName.charAt(0)}
              </span>
            )}
          </div>
          {!collapsed && (
            <span className='text-sm font-normal text-sidebar-foreground'>
              {systemName}
            </span>
          )}
        </div>
      </SidebarHeader>

      {/* Sidebar Content - Menu */}
      <SidebarContent className='gap-0.5'>
        {menuItems.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && (
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <React.Fragment key={item.itemKey}>
                    {renderSubItem(item)}
                  </React.Fragment>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Sidebar Footer - User */}
      {user && (
        <SidebarFooter className='p-2'>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size='lg'
                    className={cn(
                      'flex items-center gap-2',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    <Avatar className='h-10 w-10 rounded-full'>
                      <AvatarFallback className='bg-sidebar-accent text-sidebar-foreground text-sm font-semibold'>
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    {!collapsed && (
                      <div className='flex flex-col items-start flex-1 min-w-0'>
                        <span className='text-sm font-medium text-sidebar-foreground truncate'>
                          {userName}
                        </span>
                        <span className='text-xs text-muted-foreground truncate'>
                          {userEmail}
                        </span>
                      </div>
                    )}
                    {!collapsed && (
                      <ChevronsUpDown className='h-4 w-4 text-muted-foreground flex-shrink-0' />
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start' side='top' className='w-56'>
                  <DropdownMenuItem
                    className='text-[13px] text-sidebar-foreground focus:text-sidebar-accent-foreground'
                  >
                    <Settings className='mr-2 h-4 w-4' />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onLogout}
                    className='text-[13px] text-sidebar-foreground focus:text-sidebar-accent-foreground'
                  >
                    <LogOut className='mr-2 h-4 w-4' />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

export default AppSidebar;
