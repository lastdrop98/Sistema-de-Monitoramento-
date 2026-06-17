import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { MeterReading, CategoryType } from "../types";
import { TrendingUp, RefreshCw, Calendar, Sparkles } from "lucide-react";

interface MonthlyTrendChartProps {
  readings: MeterReading[];
}

export default function MonthlyTrendChart({ readings }: MonthlyTrendChartProps) {
  const [period, setPeriod] = React.useState<"all" | "3months" | "6months" | "12months">("all");
  const [viewMode, setViewMode] = React.useState<"categories" | "trend">("categories");

  // Format month key for translation
  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const monthNames = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];
    const idx = parseInt(month, 10) - 1;
    return `${monthNames[idx] || month}/${year.slice(2)}`;
  };

  // Group readings by month and category
  const monthlyData = React.useMemo(() => {
    const dataByMonth: { [month: string]: { [cat: string]: number } } = {};

    readings.forEach((r) => {
      // Extract YYYY-MM
      const monthKey = r.readingDate.slice(0, 7);
      if (!dataByMonth[monthKey]) {
        dataByMonth[monthKey] = {
          energia: 0,
          agua: 0,
          combustivel: 0,
          internet: 0,
        };
      }
      dataByMonth[monthKey][r.category] += r.consumption;
    });

    // Convert to sorted array
    const sortedMonths = Object.keys(dataByMonth).sort();
    
    let result = sortedMonths.map((m) => {
      const monthLabel = formatMonthLabel(m);
      const values = dataByMonth[m];
      
      // Calculate normalized overall score for general trend (index of general consumption)
      // We normalize around estimated weights or simple totals: e.g. normal average water is 15, energy is 200, fuel is 80, internet is 100
      const overallTotal = values.energia + (values.agua * 10) + values.combustivel + values.internet;

      return {
        month: m,
        label: monthLabel,
        energia: parseFloat(values.energia.toFixed(1)),
        agua: parseFloat(values.agua.toFixed(1)),
        combustivel: parseFloat(values.combustivel.toFixed(1)),
        internet: parseFloat(values.internet.toFixed(1)),
        tendenciaGeral: parseFloat((overallTotal / 4).toFixed(1)), // Simple combined index
      };
    });

    // Filter by period
    if (period === "3months") {
      result = result.slice(-3);
    } else if (period === "6months") {
      result = result.slice(-6);
    } else if (period === "12months") {
      result = result.slice(-12);
    }

    return result;
  }, [readings, period]);

  // Check if we have data to showcase
  const hasNoData = monthlyData.length === 0;

  if (hasNoData) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-205 dark:border-zinc-850 p-6 rounded-2xl text-center">
        <TrendingUp size={24} className="mx-auto text-slate-350 dark:text-zinc-600 mb-2" />
        <h4 className="font-sans font-bold text-slate-800 dark:text-zinc-200 text-sm">Histórico por Categorias</h4>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
          Adicione registros em múltiplos meses para carregar a comparação de tendências de consumo ao longo do tempo.
        </p>
      </div>
    );
  }

  return (
    <div id="monthly-trend-section" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-5 rounded-2xl space-y-6">
      
      {/* Chart controls and header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-sans font-bold text-slate-900 dark:text-zinc-100 text-sm flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />
              Evolução e Comparativo Mensal
            </h4>
            <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles size={10} />
              Novo
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Análise agregada da variação do consumo de cada recurso ao longo dos meses.
          </p>
        </div>

        {/* Filters Panel */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* View selector: Individual vs Trend */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-950 p-1 border border-slate-200 dark:border-zinc-800 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode("categories")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "categories"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-50 shadow-xs"
                  : "text-slate-500 dark:text-zinc-400"
              }`}
            >
              Categorias
            </button>
            <button
              onClick={() => setViewMode("trend")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "trend"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-50 shadow-xs"
                  : "text-slate-500 dark:text-zinc-400"
              }`}
            >
              Tendência Geral
            </button>
          </div>

          {/* Period Selector */}
          <select
            id="monthly-trend-period-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">Todo Período</option>
            <option value="3months">Últimos 3 Meses</option>
            <option value="6months">Últimos 6 Meses</option>
            <option value="12months">Últimos 12 Meses</option>
          </select>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div className="w-full">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-800" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(30, 41, 59, 0.95)",
                borderColor: "#334155",
                borderRadius: "12px",
                color: "#f8fafc",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {viewMode === "categories" ? (
              <>
                <Line
                  type="monotone"
                  dataKey="energia"
                  name="Energia (kWh)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="agua"
                  name="Água (m³)"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="combustivel"
                  name="Combustível (L)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="internet"
                  name="Internet (GB)"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="tendenciaGeral"
                name="Média de Tendência Consolidada"
                stroke="#ec4899"
                strokeWidth={3}
                strokeDasharray="3 3"
                dot={{ r: 5 }}
                activeDot={{ r: 8 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Helpful Insights segment */}
      <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850/60 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-400 shrink-0" />
          <span>
            {monthlyData.length > 1 ? (
              <>
                Exibindo comportamento consolidado para um intervalo de{" "}
                <strong>{monthlyData.length} meses</strong> analisados.
              </>
            ) : (
              "Seu primeiro mês de monitoria está mapeado no gráfico acima."
            )}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg text-slate-650 dark:text-zinc-300 font-medium">
          <RefreshCw size={12} className="animate-spin text-slate-400" />
          Atualizado em tempo real
        </div>
      </div>
    </div>
  );
}
