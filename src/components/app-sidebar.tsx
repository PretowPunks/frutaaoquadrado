import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ShoppingCart,
  Users,
  LogOut,
  Wallet,
  UserCog,
  MapPin,
  Truck,
  MapPinned,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/fruta2-logo.png.asset.json";

const adminOperationItems = [
  { title: "Painel", url: "/", icon: LayoutDashboard },
  { title: "Meu Expediente", url: "/campo", icon: MapPin },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Repasses", url: "/repasses", icon: Wallet },
  { title: "Clientes", url: "/clientes", icon: Users },
];

const representativeItems = [
  { title: "Expediente", url: "/campo", icon: MapPin },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Clientes", url: "/clientes", icon: Users },
];

const entradasItem = { title: "Entradas", url: "/entradas", icon: ArrowDownToLine };

const adminItems = [
  { title: "Representantes", url: "/representantes", icon: UserCog },
  { title: "Transferências", url: "/transferencias", icon: Truck },
  { title: "Mapa de Rotas", url: "/rotas", icon: MapPinned },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, isAdmin, signOut } = useAuth();
  const items = isAdmin
    ? [...adminOperationItems.slice(0, 3), entradasItem, ...adminOperationItems.slice(3)]
    : representativeItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <img
          src={logoAsset.url}
          alt="Fruta² — muito mais polpa"
          className="h-auto w-36 max-w-full"
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Matriz</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={path === item.url}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2">
        <div className="text-xs text-sidebar-foreground/80 truncate">
          {user?.email}
          {isAdmin && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-sidebar-primary text-sidebar-primary-foreground text-[10px]">
              ADMIN
            </span>
          )}
        </div>
        <Button size="sm" variant="secondary" className="w-full justify-start" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
