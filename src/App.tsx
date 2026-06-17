import React from "react";
import api from "./lib/api";
import { User, MeterReading, Target } from "./types";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Registrar from "./pages/Registrar";
import Metas from "./pages/Metas";
import Assistente from "./pages/Assistente";
import Relatorios from "./pages/Relatorios";
import Perfil from "./pages/Perfil";
import Auth from "./pages/Auth";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";

export default function App() {
  // Shared States
  const [user, setUser] = React.useState<User | null>(null);
  const [readings, setReadings] = React.useState<MeterReading[]>([]);
  const [targets, setTargets] = React.useState<Target[]>([]);
  const [currentTab, setCurrentTab] = React.useState<string>("dashboard");
  const [appLoading, setAppLoading] = React.useState<boolean>(true);
  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("consumo_theme");
    return (saved === "dark" || saved === "light") ? saved : "light";
  });

  // Fetch initial system states
  const fetchAllData = async () => {
    try {
      const [readingsList, targetsList] = await Promise.all([
        api.readings.getAll(),
        api.targets.getAll(),
      ]);
      setReadings(readingsList);
      setTargets(targetsList);
    } catch (e) {
      console.error("Erro ao sincronizar dados do banco", e);
    }
  };

  // Re-verify login session token
  React.useEffect(() => {
    const initSession = async () => {
      const token = localStorage.getItem("consumo_token");
      if (!token) {
        setAppLoading(false);
        return;
      }

      try {
        const res = await api.auth.me();
        setUser(res.user);
        setTheme(res.user.theme || "light");
        
        // Sincronize user DB entries
        await fetchAllData();
      } catch (e) {
        console.warn("Sessão inválida, limpando token");
        api.auth.logout();
      } finally {
        setAppLoading(false);
      }
    };

    initSession();
  }, []);

  // Watch and apply theme selection
  React.useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("consumo_theme", theme);
  }, [theme]);

  // Auth callbacks
  const handleLoginSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setTheme(loggedInUser.theme || "light");
    setAppLoading(true);
    await fetchAllData();
    setCurrentTab("dashboard");
    setAppLoading(false);
  };

  const handleLogout = () => {
    api.auth.logout();
    setUser(null);
    setReadings([]);
    setTargets([]);
    setCurrentTab("dashboard");
  };

  // Profile Updates Callback
  const handleUpdateProfile = async (updates: Partial<User>) => {
    try {
      const res = await api.auth.updateProfile(updates);
      setUser(res.user);
      if (updates.theme) {
        setTheme(updates.theme as "light" | "dark");
      }
    } catch (e: any) {
      throw new Error(e.message || "Erro ao atualizar opções de perfil");
    }
  };

  const handleToggleTheme = async () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    if (user) {
      try {
        await handleUpdateProfile({ theme: nextTheme });
      } catch (e) {
        console.error("Falha ao salvar preferência de tema", e);
      }
    }
  };

  // Daily Readings Callbacks
  const handleAddReading = async (reading: Omit<MeterReading, "id" | "userId" | "consumption" | "createdAt">) => {
    try {
      await api.readings.create(reading);
      await fetchAllData(); // Reload whole list to sync re-indexed consumptions
    } catch (e: any) {
      throw new Error(e.message || "Falha ao registrar leitura");
    }
  };

  const handleEditReading = async (id: string, updates: Partial<Omit<MeterReading, "id" | "userId" | "createdAt">>) => {
    try {
      await api.readings.update(id, updates);
      await fetchAllData(); // Reload to sync
    } catch (e: any) {
      throw new Error(e.message || "Falha ao editar registro");
    }
  };

  const handleDeleteReading = async (id: string) => {
    try {
      await api.readings.delete(id);
      await fetchAllData(); // Reload to sync downstream diffs
    } catch (e: any) {
      throw new Error(e.message || "Falha ao excluir leitura");
    }
  };

  // Target Limits Callbacks
  const handleSaveTarget = async (target: Omit<Target, "id" | "userId" | "createdAt">) => {
    try {
      await api.targets.upsert(target);
      await fetchAllData();
    } catch (e: any) {
      throw new Error(e.message || "Falha ao gravar meta de consumo");
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await api.targets.delete(id);
      await fetchAllData();
    } catch (e: any) {
      throw new Error(e.message || "Falha ao excluir meta");
    }
  };

  // Universal SheetJS exporter helper for clicking TOP Excel buttons
  const handleExportExcelGlobal = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Tab 1: Resumo Diário
      const uniqueDates = (Array.from(new Set(readings.map(r => r.readingDate))) as string[])
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      const resumoDiarioData = uniqueDates.map(date => {
        const dateReadings = readings.filter(r => r.readingDate === date);
        const energia = dateReadings.filter(r => r.category === "energia").reduce((sum, r) => sum + r.consumption, 0);
        const agua = dateReadings.filter(r => r.category === "agua").reduce((sum, r) => sum + r.consumption, 0);
        const combustivel = dateReadings.filter(r => r.category === "combustivel").reduce((sum, r) => sum + r.consumption, 0);
        const internet = dateReadings.filter(r => r.category === "internet").reduce((sum, r) => sum + r.consumption, 0);

        return {
          "Data": new Date(date + "T00:00:00").toLocaleDateString("pt-BR"),
          "Energia (kWh)": energia || 0,
          "Água (m³)": agua || 0,
          "Combustível (L)": combustivel || 0,
          "Internet (GB)": internet || 0
        };
      });

      const wsResumo = XLSX.utils.json_to_sheet(resumoDiarioData);

      // Add SUM total formula to daily summary sheet
      if (resumoDiarioData.length > 0) {
        const totalRowIdx = resumoDiarioData.length + 2; // header (1) + rows + 1-based index
        const totalEnergia = resumoDiarioData.reduce((sum, r) => sum + Number(r["Energia (kWh)"]), 0);
        const totalAgua = resumoDiarioData.reduce((sum, r) => sum + Number(r["Água (m³)"]), 0);
        const totalCombustivel = resumoDiarioData.reduce((sum, r) => sum + Number(r["Combustível (L)"]), 0);
        const totalInternet = resumoDiarioData.reduce((sum, r) => sum + Number(r["Internet (GB)"]), 0);

        wsResumo[`A${totalRowIdx}`] = { t: "s", v: "TOTAL" };
        wsResumo[`B${totalRowIdx}`] = { t: "n", f: `SUM(B2:B${totalRowIdx - 1})`, v: totalEnergia };
        wsResumo[`C${totalRowIdx}`] = { t: "n", f: `SUM(C2:C${totalRowIdx - 1})`, v: totalAgua };
        wsResumo[`D${totalRowIdx}`] = { t: "n", f: `SUM(D2:D${totalRowIdx - 1})`, v: totalCombustivel };
        wsResumo[`E${totalRowIdx}`] = { t: "n", f: `SUM(E2:E${totalRowIdx - 1})`, v: totalInternet };

        const range = XLSX.utils.decode_range(wsResumo['!ref'] || 'A1:E1');
        range.e.r = totalRowIdx - 1;
        wsResumo['!ref'] = XLSX.utils.encode_range(range);
      }

      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Diário");

      // Tab 2: Detalhes dos Registros
      const sortedReadings = [...readings].sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());
      const detalhesData = sortedReadings.map(r => {
        let catText = r.category === "energia" ? "Energia" : r.category === "agua" ? "Água" : r.category === "combustivel" ? "Combustível" : "Internet";
        
        // Calculate Leitura Anterior dynamically for display
        const previousReadings = readings
          .filter(allR => allR.category === r.category && allR.id !== r.id)
          .sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());

        const targetTime = new Date(r.readingDate).getTime();
        const prev = previousReadings.reverse().find(allR => new Date(allR.readingDate).getTime() <= targetTime);
        const leituraAnterior = prev ? prev.readingValue : 0;

        let obsStr = r.notes || "";
        if (r.category === "energia" && r.readingValueOffpeak !== undefined) {
          obsStr = `[F. Pico: grav. ${r.readingValueOffpeak} kWh, cons. ${r.consumptionOffpeak} kWh] ${obsStr}`;
        } else if (r.category === "combustivel") {
          const distance = r.kmFinal !== undefined && r.kmInicial !== undefined ? r.kmFinal - r.kmInicial : 0;
          obsStr = `[KM Inicial: ${r.kmInicial ?? "?"}, KM Final: ${r.kmFinal ?? "?"}, Distância: ${distance} km, Destinos: ${r.destinos || "N/A"}${r.costMt !== undefined ? `, Custo: ${r.costMt} Mt` : ""}] ${obsStr}`;
        }

        return {
          "Data do Registro": new Date(r.readingDate + "T00:00:00").toLocaleDateString("pt-BR"),
          "Categoria": catText,
          "Leitura Anterior": leituraAnterior,
          "Leitura Atual": r.readingValue,
          "Consumo Calculado": r.consumption, // Placeholder
          "Unidade": r.unit,
          "Observações / Parâmetros": obsStr
        };
      });

      const wsDetalhes = XLSX.utils.json_to_sheet(detalhesData);

      // Inject formulas into Consumo Calculado column (Col E)
      sortedReadings.forEach((r, idx) => {
        const rowNumber = idx + 2; // header is Row 1
        wsDetalhes[`E${rowNumber}`] = {
          t: 'n',
          f: `D${rowNumber}-C${rowNumber}`, // Leitura Atual (D) - Leitura Anterior (C)
          v: r.consumption
        };
      });

      XLSX.utils.book_append_sheet(wb, wsDetalhes, "Detalhes dos Registros");

      // Tab 3: Metas vs Realizado
      const uniqueCategoryMonths = Array.from(new Set([
        ...readings.map(r => r.readingDate.slice(0, 7)),
        ...targets.map(t => t.month)
      ])).sort().reverse();

      const metasRealizadoRaw: any[] = [];
      uniqueCategoryMonths.forEach(mStr => {
        ["energia", "agua", "combustivel", "internet"].forEach(cat => {
          let catText = cat === "energia" ? "Energia" : cat === "agua" ? "Água" : cat === "combustivel" ? "Combustível" : "Internet";
          let unit = cat === "energia" ? "kWh" : cat === "agua" ? "m³" : cat === "combustivel" ? "L" : "GB";

          const matchedTarget = targets.find(t => t.category === cat && t.month === mStr);
          const targetValue = matchedTarget ? matchedTarget.targetValue : 0;

          const monthReadings = readings.filter(r => r.category === cat && r.readingDate.startsWith(mStr));
          const totalConsumido = monthReadings.reduce((sum, r) => sum + r.consumption, 0);

          let parsedMonthLabel = mStr;
          try {
            const [y, m] = mStr.split("-");
            parsedMonthLabel = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            parsedMonthLabel = parsedMonthLabel.charAt(0).toUpperCase() + parsedMonthLabel.slice(1);
          } catch(e){}

          if (targetValue > 0 || totalConsumido > 0) {
            metasRealizadoRaw.push({
              monthLabel: parsedMonthLabel,
              categoryText: catText,
              targetValue: targetValue,
              totalConsumido: totalConsumido,
              unit: unit
            });
          }
        });
      });

      const metasRealizadoJSON = metasRealizadoRaw.map(row => ({
        "Mês de Referência": row.monthLabel,
        "Categoria": row.categoryText,
        "Meta de Consumo Máxima": row.targetValue || 0,
        "Consumo Realizado": Number(row.totalConsumido.toFixed(1)),
        "Utilização (%)": 0, // Placeholder
        "Status / Teto": "", // Placeholder
        "Unidade": row.unit
      }));

      const wsMetas = XLSX.utils.json_to_sheet(metasRealizadoJSON);

      // Inject formulas into Utilização (%) and Status / Teto
      metasRealizadoRaw.forEach((row, idx) => {
        const rowNumber = idx + 2; // header is Row 1

        // Utilização (%): =IF(C{rowNumber}>0, D{rowNumber}/C{rowNumber}, 0)
        wsMetas[`E${rowNumber}`] = {
          t: 'n',
          f: `IF(C${rowNumber}>0, D${rowNumber}/C${rowNumber}, 0)`,
          v: row.targetValue > 0 ? row.totalConsumido / row.targetValue : 0,
          z: '0.0%'
        };

        // Status / Teto
        const statusVal = row.targetValue > 0 
          ? (row.totalConsumido <= row.targetValue ? "Dentro do Esperado" : "Acima do Limite Definido") 
          : "Sem Meta Definida";

        wsMetas[`F${rowNumber}`] = {
          t: 's',
          f: `IF(C${rowNumber}<=0, "Sem Meta Definida", IF(D${rowNumber}<=C${rowNumber}, "Dentro do Esperado", "Acima do Limite Definido"))`,
          v: statusVal
        };
      });

      XLSX.utils.book_append_sheet(wb, wsMetas, "Metas vs Realizado");

      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      XLSX.writeFile(wb, `relatorio_consumo_${dateTag}.xlsx`);
    } catch (e) {
      console.error("Falha ao exportar excel globalmente", e);
    }
  };

  // Loading Splash Screen
  if (appLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-600 dark:text-blue-500" size={32} />
        <span className="font-sans text-sm font-semibold text-slate-500 dark:text-slate-400">Sincronizando Consumos...</span>
      </div>
    );
  }

  // Auth Screen route Guard if not logged in
  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  // Tab router
  const renderCurrentPage = () => {
    switch (currentTab) {
      case "dashboard":
        return (
          <Dashboard
            user={user}
            readings={readings}
            targets={targets}
            onNavigateToTab={setCurrentTab}
            onExportExcel={handleExportExcelGlobal}
          />
        );
      case "registrar":
        return (
          <Registrar
            user={user}
            readings={readings}
            onAddReading={handleAddReading}
            onEditReading={handleEditReading}
            onDeleteReading={handleDeleteReading}
          />
        );
      case "metas":
        return (
          <Metas
            targets={targets}
            onSaveTarget={handleSaveTarget}
            onDeleteTarget={handleDeleteTarget}
          />
        );
      case "assistente":
        return <Assistente user={user} onAddReadingFromAI={handleAddReading} />;
      case "relatorios":
        return <Relatorios readings={readings} targets={targets} />;
      case "perfil":
        return (
          <Perfil 
            user={user} 
            onUpdateProfile={handleUpdateProfile} 
            onRefreshUser={async () => {
              const res = await api.auth.me();
              setUser(res.user);
            }}
          />
        );
      default:
        return <div className="text-zinc-500">Página em construção...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-200 font-sans">
      {/* Navigation sidebar */}
      <Sidebar
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        user={user}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main visual panel layout */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 max-w-7xl mx-auto w-full">
        {renderCurrentPage()}
      </main>
    </div>
  );
}
