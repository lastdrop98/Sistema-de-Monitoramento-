import React from "react";
import { 
  LayoutDashboard, 
  FileEdit, 
  Target, 
  FileSpreadsheet, 
  User as UserIcon, 
  LogOut, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  Activity,
  Sparkles
} from "lucide-react";
import { User } from "../types";

interface SidebarProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export default function Sidebar({
  currentTab,
  onChangeTab,
  user,
  onLogout,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "registrar", label: "Registros de Leituras", icon: FileEdit },
    { id: "metas", label: "Metas Mensais", icon: Target },
    { id: "assistente", label: "Assistente IA (Visão)", icon: Sparkles },
    { id: "relatorios", label: "Relatórios & Exportar", icon: FileSpreadsheet },
    { id: "perfil", label: "Meu Perfil", icon: UserIcon },
  ];

  const handleTabClick = (tabId: string) => {
    onChangeTab(tabId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div id="mobile-topbar" className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-850 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <Activity size={20} />
          </div>
          <span className="font-sans font-semibold tracking-tight text-slate-900 dark:text-zinc-50">Consumo</span>
        </div>
        <button 
          id="mobile-menu-trigger" 
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-md hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300"
          aria-label="Alternar Menu"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity duration-300"
        ></div>
      )}

      {/* Main Sidebar Component */}
      <aside 
        id="app-sidebar"
        className={`fixed md:sticky top-0 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-850 h-screen w-64 z-50 transition-transform duration-300 transform md:transform-none flex flex-col justify-between
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="p-6">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              <span>M</span>
            </div>
            <div>
              <h1 className="font-sans font-bold text-slate-800 dark:text-white leading-tight">Monitoria.io</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Consumo Inteligente</p>
            </div>
          </div>

          {/* User Profile Info Mini Card */}
          {user && (
            <div className="mb-6 p-3 bg-slate-50/60 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Usuário Ativo</p>
              <p className="font-sans font-semibold text-slate-800 dark:text-zinc-100 truncate text-sm mt-0.5">{user.fullName}</p>
              {user.company && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.company}</p>
              )}
            </div>
          )}

          {/* Nav links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  id={`nav-link-${item.id}`}
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-semibold"
                      : "text-slate-650 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-850"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer actions block */}
        <div className="p-6 border-t border-slate-100 dark:border-zinc-850 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Modo visual</span>
            <button
              id="theme-toggle-button"
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-805 bg-slate-50/60 dark:bg-zinc-950 text-slate-600 dark:text-zinc-350 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
              title={theme === "light" ? "Mudar para Modo Escuro" : "Mudar para Modo Claro"}
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>

          <button
            id="auth-logout-button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-950/20 transition-colors duration-150 text-left"
          >
            <LogOut size={18} />
            Sair do Sistema
          </button>
        </div>
      </aside>
    </>
  );
}
