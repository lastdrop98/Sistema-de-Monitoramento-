import React from "react";
import { Target, CategoryType } from "../types";
import { 
  PlusCircle, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Target as TargetIcon,
  Zap,
  Droplet,
  Fuel,
  Globe,
  Calendar
} from "lucide-react";
import { useToast } from "../components/Toast";

interface MetasProps {
  targets: Target[];
  onSaveTarget: (target: Omit<Target, "id" | "userId" | "createdAt">) => Promise<void>;
  onDeleteTarget: (id: string) => Promise<void>;
}

export default function Metas({
  targets,
  onSaveTarget,
  onDeleteTarget,
}: MetasProps) {
  const { showToast } = useToast();
  // Form State
  const [category, setCategory] = React.useState<CategoryType>("energia");
  const [month, setMonth] = React.useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [targetValue, setTargetValue] = React.useState<string>("");

  // Feedback states
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [loading, setLoading] = React.useState(false);


  const getUnit = (cat: CategoryType) => {
    switch (cat) {
      case "energia": return "kWh";
      case "agua": return "m³";
      case "combustivel": return "L";
      case "internet": return "GB";
    }
  };

  const getCategoryConfig = (cat: CategoryType) => {
    switch (cat) {
      case "energia":
        return { name: "Energia Elétrica", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" };
      case "agua":
        return { name: "Água Potável", icon: Droplet, color: "text-blue-500", bg: "bg-blue-500/10" };
      case "combustivel":
        return { name: "Combustível", icon: Fuel, color: "text-emerald-500", bg: "bg-emerald-500/10" };
      case "internet":
        return { name: "Internet", icon: Globe, color: "text-indigo-500", bg: "bg-indigo-500/10" };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const valNumeric = parseFloat(targetValue);
    if (isNaN(valNumeric) || valNumeric <= 0) {
      setError("Por favor, insira um valor de meta válido e maior que zero");
      setLoading(false);
      return;
    }

    if (!month) {
      setError("Por favor, selecione um mês de referência");
      setLoading(false);
      return;
    }

    try {
      await onSaveTarget({
        category,
        month,
        targetValue: valNumeric,
      });
      setSuccess("Meta salva com sucesso!");
      showToast("Meta salva com sucesso!", "success");
      setTargetValue("");
    } catch (err: any) {
      const errMsg = err.message || "Erro ao salvar meta";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja realmente excluir esta meta mensal?")) {
      try {
        await onDeleteTarget(id);
        setSuccess("Meta excluída com sucesso!");
        showToast("Meta excluída com sucesso!", "success");
      } catch (err: any) {
        const errMsg = err.message || "Erro ao excluir meta";
        setError(errMsg);
        showToast(errMsg, "error");
      }
    }
  };

  // Convert "2026-06" to "Junho de 2026"
  const formatMonthLabel = (mStr: string) => {
    try {
      const [year, month] = mStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    } catch (e) {
      return mStr;
    }
  };

  return (
    <div id="metas-view" className="space-y-6">
      <div>
        <h2 className="font-sans font-bold text-2xl tracking-tight text-zinc-900 dark:text-zinc-50">Definição de Metas de Limites</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Estipule limites mensais por tipo de recurso para guiar as taxas de alerta do dashboard</p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 p-4 border border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-300 text-sm flex items-start gap-2.5 animate-fade-in">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-sm flex items-start gap-2.5 animate-fade-in">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form panel */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-5 rounded-2xl shadow-xs">
          <h4 className="font-sans font-bold text-slate-800 dark:text-zinc-100 text-sm flex items-center gap-2 mb-4">
            <TargetIcon size={18} className="text-blue-600 dark:text-blue-400" />
            Nova Meta Mensal
          </h4>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Select */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Categoria de Recurso <span className="text-red-500">*</span>
              </label>
              <select
                id="target-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white"
              >
                <option value="energia">⚡ Energia Elétrica</option>
                <option value="agua">💧 Água Potável</option>
                <option value="combustivel">⛽ Combustível</option>
                <option value="internet">🌐 Internet</option>
              </select>
            </div>

            {/* Reference Month picker ("YYYY-MM") */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Mês de Referência <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-450">
                  <Calendar size={18} />
                </span>
                <input
                  id="target-month-input"
                  type="month"
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            {/* Target Value Numeric */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Meta de Consumo Máximo ({getUnit(category)}) <span className="text-red-500">*</span>
              </label>
              <input
                id="target-value-input"
                type="number"
                step="any"
                required
                placeholder={`Ex: 500 para ${getUnit(category)}`}
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white"
              />
            </div>

            <button
              id="save-target-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center gap-2 justify-center py-2.5 px-4 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
            >
              <PlusCircle size={16} />
              {loading ? "Gravando..." : "Salvar Meta de Consumo"}
            </button>
          </form>
        </div>

        {/* Dynamic target cards listing */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-sans font-bold text-slate-800 dark:text-zinc-100 text-sm">Metas de Limites Definidas</h4>
            <span className="text-[10px] font-mono font-bold bg-slate-50 dark:bg-zinc-950 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-805 text-slate-500 dark:text-zinc-400">
              {targets.length} Limites Configurados
            </span>
          </div>

          {targets.length === 0 ? (
            <div id="targets-empty-state" className="py-12 px-4 border border-dashed border-zinc-150 dark:border-zinc-850 rounded-2xl bg-zinc-50 dark:bg-zinc-950/20 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma meta mensal cadastrada.</p>
              <p className="text-xs text-zinc-400 mt-1">Insira valores no formulário lateral para planejar tetos de gastos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {targets
                .sort((a, b) => b.month.localeCompare(a.month) || a.category.localeCompare(b.category))
                .map((t) => {
                  const cfg = getCategoryConfig(t.category);
                  const Icon = cfg.icon;
                  const unit = getUnit(t.category);

                  return (
                    <div 
                      key={t.id} 
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-4 rounded-2xl shadow-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`${cfg.color} ${cfg.bg} p-2 rounded-xl`}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50 truncate max-w-[140px]">{cfg.name}</p>
                          <p className="text-[10px] text-zinc-450 uppercase font-semibold mt-0.5">{formatMonthLabel(t.month)}</p>
                          <p className="text-sm font-extrabold text-zinc-950 dark:text-zinc-100 font-mono mt-1">
                            {t.targetValue.toLocaleString()} <span className="text-xs font-normal text-zinc-500">{unit}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        id={`delete-target-idx-${t.id}`}
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-rose-600 dark:hover:text-rose-400 text-slate-500 dark:text-zinc-500"
                        title="Remover Meta"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
