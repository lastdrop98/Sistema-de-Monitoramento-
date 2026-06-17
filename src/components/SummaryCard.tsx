import React from "react";
import { 
  Zap, 
  Droplet, 
  Fuel, 
  Globe, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle 
} from "lucide-react";
import { CategoryType } from "../types";

interface SummaryCardProps {
  category: CategoryType;
  currentValue: number; // Consumption of yesterday or most recent day
  unit: string;
  percentageChange: number; // relative to previous day
  trend: "up" | "down" | "flat";
  monthlyTarget: number; // from the targets table
  monthlyTotal: number; // accumulated sum for current month
  alertActive: boolean; // if current consumption > peak indicator
  average7Days: number;
}

const config = {
  energia: {
    label: "Energia Elétrica",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    progressColor: "bg-amber-500",
  },
  agua: {
    label: "Água Potável",
    icon: Droplet,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    progressColor: "bg-blue-500",
  },
  combustivel: {
    label: "Combustível",
    icon: Fuel,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    progressColor: "bg-emerald-500",
  },
  internet: {
    label: "Internet",
    icon: Globe,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    progressColor: "bg-indigo-500",
  },
};

export default function SummaryCard({
  category,
  currentValue,
  unit,
  percentageChange,
  trend,
  monthlyTarget,
  monthlyTotal,
  alertActive,
  average7Days,
}: SummaryCardProps) {
  const cfg = config[category];
  const Icon = cfg.icon;

  // Progress percentage of monthly target
  const progressPercent = monthlyTarget > 0 
    ? Math.min(100, Math.round((monthlyTotal / monthlyTarget) * 100)) 
    : 0;

  // For resources, less consumption is green (favorable), more consumption is red (unfavorable)
  const isUp = trend === "up";
  const isDown = trend === "down";
  
  // Decide badge styling
  let badgeClass = "text-slate-500 bg-slate-100 dark:bg-zinc-805";
  let changeText = "estável";
  
  if (isUp) {
    // Red indicator: consumed more
    badgeClass = "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20";
    changeText = `+${percentageChange.toFixed(1)}%`;
  } else if (isDown) {
    // Green indicator: saved consumption!
    badgeClass = "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20";
    changeText = `-${percentageChange.toFixed(1)}%`;
  }

  return (
    <div 
      id={`summary-card-${category}`}
      className={`relative border rounded-2xl p-5 hover:shadow-md transition-all duration-200 ${
        alertActive
          ? "border-amber-500 dark:border-amber-400 bg-gradient-to-br from-amber-50/20 to-rose-50/30 dark:from-amber-950/10 dark:to-rose-950/20 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/20"
          : "border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-900"
      }`}
    >
      {/* Alert Header if spikes are active */}
      {alertActive && (
        <div className="absolute -top-3 right-4 flex items-center gap-1 bg-rose-600 text-white text-[10px] uppercase font-bold py-1 px-2.5 rounded-full shadow-xs animate-pulse">
          <AlertTriangle size={11} />
          <span>Variação &gt; 20%</span>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`${cfg.color} ${cfg.bg} p-2.5 rounded-xl`}>
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-sans font-medium text-slate-500 dark:text-zinc-400 text-xs uppercase leading-tight tracking-wider">{cfg.label}</h3>
            <p className="font-sans font-bold text-slate-900 dark:text-zinc-50 text-2xl mt-1">
              {currentValue.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-slate-400">{unit}</span>
            </p>
          </div>
        </div>

        {/* Change indicator badge */}
        <div className={`flex items-center gap-1 text-xs font-semibold py-1 px-2 rounded-lg ${badgeClass}`}>
          {isUp && <TrendingUp size={13} />}
          {isDown && <TrendingDown size={13} />}
          <span>{changeText}</span>
        </div>
      </div>

      {/* Target and progress description */}
      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-850/60">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-500 dark:text-zinc-400 font-medium">Meta do Mês</span>
          <span className="text-slate-800 dark:text-zinc-100 font-semibold font-mono">
            {monthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })} / {monthlyTarget > 0 ? `${monthlyTarget.toLocaleString()} ${unit}` : "Não Def."}
          </span>
        </div>

        {/* Outer progress track */}
        <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${cfg.progressColor}`} 
            style={{ width: `${monthlyTarget > 0 ? progressPercent : 0}%` }}
          />
        </div>

        {/* Progress percent details */}
        <div className="flex items-center justify-between mt-2 text-[11px]">
          <span className="text-slate-400 dark:text-zinc-500">Acumulado mensal</span>
          <span className={`font-semibold ${progressPercent > 90 ? "text-rose-605 dark:text-rose-400" : "text-slate-650 dark:text-zinc-350"}`}>
            {monthlyTarget > 0 ? `${progressPercent}% atingido` : "Fixe uma meta"}
          </span>
        </div>
      </div>

      {/* Spike Alert Sub-panel under the card if alert is on */}
      {alertActive && (
        <div className="mt-3 bg-red-50 dark:bg-red-950/20 text-rose-700 dark:text-red-405 rounded-lg p-2 flex items-start gap-1.5 text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Consumo diário de <strong>{currentValue} {unit}</strong> de hoje está <strong>{(((currentValue - average7Days)/average7Days) * 100).toFixed(0)}% maior</strong> que a média móvel de 7 dias ({average7Days.toFixed(1)} {unit}).
          </span>
        </div>
      )}
    </div>
  );
}
