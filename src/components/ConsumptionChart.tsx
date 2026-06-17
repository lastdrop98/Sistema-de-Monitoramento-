import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import { MeterReading, CategoryType } from "../types";

interface ConsumptionChartProps {
  readings: MeterReading[];
  category: CategoryType | "todas";
  period: "7days" | "30days";
  width?: number;
  height?: number;
}

export default function ConsumptionChart({ readings, category, period, width, height }: ConsumptionChartProps) {
  // 1. Filter and prepare data by period
  const filterByPeriod = (data: MeterReading[]) => {
    const daysLimit = period === "7days" ? 7 : 30;
    const sorted = [...data].sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());
    
    // Grab only readings from the past N days, or simply the last scale of recordings
    if (sorted.length <= daysLimit) return sorted;
    return sorted.slice(sorted.length - daysLimit);
  };

  // Group readings by date
  const categoryReadings = category === "todas" 
    ? readings 
    : readings.filter(r => r.category === category);

  const filteredReadings = filterByPeriod(categoryReadings);

  // Group and format for charting
  const formattedData = React.useMemo(() => {
    // Generate dates mapping
    const map: { [date: string]: any } = {};

    filteredReadings.forEach(r => {
      const dateLabel = new Date(r.readingDate + "T00:00:00").toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });

      if (!map[r.readingDate]) {
        map[r.readingDate] = {
          date: r.readingDate,
          dateLabel,
          energia: 0,
          energiaOffpeak: 0,
          agua: 0,
          combustivel: 0,
          combustivelLitros: 0,
          combustivelDistancia: 0,
          internet: 0,
        };
      }

      const item = map[r.readingDate];
      if (r.category === "energia") {
        item.energia = r.consumption;
        item.energiaOffpeak = r.consumptionOffpeak || 0;
      } else if (r.category === "agua") {
        item.agua = r.consumption;
      } else if (r.category === "combustivel") {
        item.combustivel = r.consumption; // stored liters
        item.combustivelLitros = r.consumption; // fuel liters
        // calculate distance if KMs are filled
        if (r.kmFinal !== undefined && r.kmInicial !== undefined) {
          item.combustivelDistancia = Math.max(0, r.kmFinal - r.kmInicial);
        }
      } else if (r.category === "internet") {
        item.internet = r.consumption;
      }
    });

    // Return chronological sorted values
    return Object.values(map).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredReadings]);

  if (formattedData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950/20 text-center">
        <p className="font-sans text-sm text-slate-500 dark:text-zinc-400">Nenhum dado registrado para este período.</p>
        <p className="text-xs text-zinc-400 mt-1">Insira leituras na tela de registros para visualizar os gráficos.</p>
      </div>
    );
  }

  // Draw chart based on selected category view
  const renderChart = () => {
    if (category === "todas") {
      // General overview comparing categories on area chart
      return (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEnergia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAgua" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-800" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "rgba(39, 39, 42, 0.95)", 
                borderColor: "#3f3f46",
                borderRadius: "12px",
                color: "#f4f4f5",
                fontSize: "12px"
              }} 
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="energia" name="Energia (kWh)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorEnergia)" strokeWidth={2} />
            <Area type="monotone" dataKey="agua" name="Água (m³)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAgua)" strokeWidth={2} />
            <Area type="monotone" dataKey="combustivel" name="Combustível (L)" stroke="#10b981" fillOpacity={0} strokeWidth={2} />
            <Area type="monotone" dataKey="internet" name="Internet (GB)" stroke="#6366f1" fillOpacity={0} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (category === "energia") {
      // Dual graph showing stacked peak & offpeak, mirroring their Excel sheet!
      return (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-800" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "rgba(39, 39, 42, 0.95)", 
                borderColor: "#3f3f46",
                borderRadius: "12px",
                color: "#f4f4f5",
                fontSize: "12px"
              }} 
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="energia" stackId="a" name="Consumo Pico (8h-18h)" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="energiaOffpeak" stackId="a" name="Consumo Fora de Pico (18h-8h)" fill="#d97706" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (category === "combustivel") {
      // Grouped chart showing Distância (km) vs Consumo (litros)
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-800" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis yAxisId="left" orientation="left" stroke="#10b981" tick={{ fontSize: 10 }} name="Consumo (L)" />
            <YAxis yAxisId="right" orientation="right" stroke="#ec4899" tick={{ fontSize: 10 }} name="Km" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "rgba(39, 39, 42, 0.95)", 
                borderColor: "#3f3f46",
                borderRadius: "12px",
                color: "#f4f4f5",
                fontSize: "12px"
              }} 
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="left" type="monotone" dataKey="combustivelLitros" name="Combustível (Litros)" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} />
            <Line yAxisId="right" type="monotone" dataKey="combustivelDistancia" name="Distância Percorrida (Km)" stroke="#ec4899" strokeWidth={2} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (category === "agua") {
      // Bar track for water in blue
      return (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-800" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "rgba(39, 39, 42, 0.95)", 
                borderColor: "#3f3f46",
                borderRadius: "12px",
                color: "#f4f4f5",
                fontSize: "12px"
              }} 
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="agua" name="Consumo de Água (m³)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (category === "internet") {
      // High-contrast bar track for internet, echoing Dia vs GB bars in Excel
      return (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-800" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "rgba(39, 39, 42, 0.95)", 
                borderColor: "#3f3f46",
                borderRadius: "12px",
                color: "#f4f4f5",
                fontSize: "12px"
              }} 
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="internet" name="Consumo de Internet (GB)" fill="#4f46e5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  const renderChartOrExport = () => {
    const chartContainer = renderChart();
    if (!chartContainer) return null;
    if (width && height && chartContainer.props && chartContainer.props.children) {
      return React.cloneElement(chartContainer.props.children as React.ReactElement, { width, height });
    }
    return chartContainer;
  };

  if (width && height) {
    return (
      <div style={{ width: width, height: height }}>
        {renderChartOrExport()}
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="font-sans font-bold text-slate-905 dark:text-zinc-100 text-sm">Histórico de Tendência</h4>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Visão cronológica dos registros selecionados</p>
        </div>
        <div id="chart-legend-badge" className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 font-mono bg-slate-50 dark:bg-zinc-950 px-2 py-0.5 border border-slate-200 dark:border-zinc-800 rounded-md">
          {filteredReadings.length} Registros Mapeados
        </div>
      </div>
      {renderChartOrExport()}
    </div>
  );
}
