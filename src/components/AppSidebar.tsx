import { Router, Network, Home } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
const menuItems = [{
  title: "Dashboard",
  url: "/",
  icon: Home
}, {
  title: "Connexion SSH aux Équipements",
  url: "/connection",
  icon: Network
}, {
  title: "Juniper Configuration Tool",
  url: "/juniper-config",
  icon: Router
}];
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  return <Sidebar className={state === "collapsed" ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-semibold text-primary">
            Network Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={({
                  isActive: navIsActive
                }) => navIsActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted/50"}>
                      <item.icon className="h-4 w-4" />
                      {state !== "collapsed" && <span className="text-base font-extralight text-slate-950">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>;
}