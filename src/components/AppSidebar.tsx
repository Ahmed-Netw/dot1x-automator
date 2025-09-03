import { Router, Network, Home, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  
  return (
    <TooltipProvider>
      <Sidebar className={state === "collapsed" ? "w-14" : "w-64"} collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-lg font-semibold text-primary">
              Network Tools
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={({
                        isActive: navIsActive
                      }) => navIsActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted/50"}>
                        <item.icon className="h-4 w-4" />
                        {state !== "collapsed" && <span className="text-base font-extralight text-slate-950">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter className="border-t border-border/50 p-4">
          {state === "collapsed" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  AE
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="w-64">
                <div className="space-y-1">
                  <p className="font-semibold">Ahmed EL MAGHRAOUI</p>
                  <p className="text-sm text-muted-foreground">Ingénieur d'Exploitation Client</p>
                  <p className="text-xs text-muted-foreground break-all">ahmed.elmaghraoui.ext@orange.com</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">Ahmed EL MAGHRAOUI</p>
              </div>
              <p className="text-xs text-muted-foreground ml-6">Ingénieur d'Exploitation Client</p>
              <p className="text-xs text-muted-foreground ml-6 break-all">ahmed.elmaghraoui.ext@orange.com</p>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}