import React from "react";
import { api } from "../lib/api";
import { MeterReading, CategoryType, User } from "../types";
import { 
  Zap, 
  Droplet, 
  Fuel, 
  Globe, 
  Search, 
  Calendar, 
  Trash2, 
  Edit3, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  Car,
  Share2,
  Copy
} from "lucide-react";
import { useToast } from "../components/Toast";

interface RegistrarProps {
  user: User;
  readings: MeterReading[];
  onAddReading: (reading: Omit<MeterReading, "id" | "userId" | "consumption" | "createdAt">) => Promise<void>;
  onEditReading: (id: string, updates: Partial<Omit<MeterReading, "id" | "userId" | "createdAt">>) => Promise<void>;
  onDeleteReading: (id: string) => Promise<void>;
}

export default function Registrar({
  user,
  readings,
  onAddReading,
  onEditReading,
  onDeleteReading,
}: RegistrarProps) {
  const { showToast } = useToast();

  // Form State
  const [category, setCategory] = React.useState<CategoryType>("energia");
  const [readingDate, setReadingDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [readingValue, setReadingValue] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");

  // Custom Category States
  const [kmInicial, setKmInicial] = React.useState<string>("");
  const [kmFinal, setKmFinal] = React.useState<string>("");
  const [destinos, setDestinos] = React.useState("");
  const [costMt, setCostMt] = React.useState<string>("");
  const [readingValueOffpeak, setReadingValueOffpeak] = React.useState<string>("");
  const [readingValuePeak, setReadingValuePeak] = React.useState<string>("");
  const [saldoInicioDia, setSaldoInicioDia] = React.useState<string>("");

  // Custom Combustivel Calculations (automatizados mas editáveis)
  const [consumoLitros, setConsumoLitros] = React.useState<string>("");
  const [consumoMt, setConsumoMt] = React.useState<string>("");

  // Track if these values was manually modified to prevent overriding user inputs
  const [litrosModified, setLitrosModified] = React.useState(false);
  const [mtModified, setMtModified] = React.useState(false);

  // Table & Action States
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState<CategoryType | "todas">("todas");
  const [selectedReport, setSelectedReport] = React.useState<{ text: string; link: string; date: string; phone: string } | null>(null);
  const [reportCopySuccess, setReportCopySuccess] = React.useState(false);
  const [editingReading, setEditingReading] = React.useState<MeterReading | null>(null);
  
  // Feedback States
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleClearAllReadings = async () => {
    if (!window.confirm("Deseja realmente apagar todos os registros de consumo? Todos os seus dados de leitura acumulada serão excluídos permanentemente.")) {
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.readings.clearAll();
      setSuccess("Histórico de monitorias limpo com sucesso!");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Erro ao apagar registros de consumo.");
    } finally {
      setLoading(false);
    }
  };

  const getPortugueseMonth = (dateStr: string) => {
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const date = new Date(dateStr + "T00:00:00");
    return months[date.getMonth()];
  };

  const getPortugueseDay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.getDate().toString();
  };

  const getPortugueseYear = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.getFullYear().toString();
  };

  const handleWhatsappReport = (targetReading: MeterReading) => {
    setError("");
    setSelectedReport(null);
    try {
      const dateLimit = targetReading.readingDate;
      
      const getClosest = (cat: CategoryType) => {
        const matches = readings
          .filter(r => r.category === cat && r.readingDate <= dateLimit)
          .sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());
        return matches[0] || null;
      };

      const energia = getClosest("energia");
      const agua = getClosest("agua");
      const internet = getClosest("internet");

      const sameCatReadings = readings
        .filter(r => r.category === targetReading.category)
        .sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());
      
      const currentIndex = sameCatReadings.findIndex(r => r.id === targetReading.id);
      const prevReadingOfSameCat = currentIndex !== -1 && currentIndex + 1 < sameCatReadings.length
        ? sameCatReadings[currentIndex + 1]
        : null;

      const startDateStr = prevReadingOfSameCat ? prevReadingOfSameCat.readingDate : targetReading.readingDate;
      const endDateStr = targetReading.readingDate;

      const startDay = getPortugueseDay(startDateStr);
      const endDay = getPortugueseDay(endDateStr);
      const monthStr = getPortugueseMonth(endDateStr);
      const yearStr = getPortugueseYear(endDateStr);

      const energiaTotal = energia ? (energia.consumption || 0) : 0;
      const energiaExpediente = energia ? (energia.consumptionPeak || 0) : 0;
      const energiaFora = energia ? (energia.consumptionOffpeak || 0) : 0;
      const energiaSaldo = energia ? (energia.saldoInicioDia || 0) : 0;

      const aguaM3 = agua ? (agua.consumption || 0) : 0;
      const aguaLitros = Math.round(aguaM3 * 1000);

      const internetGB = internet ? (internet.consumption || 0) : 0;

      const text = `RELATÓRIO DE CONSUMO
 
Segue abaixo os consumos registados de ${startDay} a ${endDay} de ${monthStr} de ${yearStr}.

1. Consumo de Energia – Total: ${energiaTotal} kWh
Expediente (8H00 às 18H00) – ${energiaExpediente} kWh
Fora do Expediente (18H00 às 8H00) - ${energiaFora} kWh

O saldo no ínicio do dia de hoje, ${endDay} de ${monthStr} era de ${energiaSaldo} Kw/h.

2. Consumo de Água

O consumo total de água foi de ${aguaM3} m³ (${aguaLitros} litros)

3. Consumo de Internet
O consumo total de dados foi de ${internetGB} GB

Em anexo envio a planilha de controlo de consumo.

Atenciosamente,
${user.fullName || user.email}`;

      const phone = user.whatsappPhone || "";
      const cleanPhone = phone.replace(/\D/g, "");
      
      const encodedMsg = encodeURIComponent(text);
      const link = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

      setSelectedReport({
        text,
        link,
        date: endDateStr,
        phone
      });

      showToast("Relatório WhatsApp elaborado com sucesso!", "success");

      // Envia diretamente se houver número cadastrado
      if (cleanPhone) {
        try {
          window.open(link, "_blank");
        } catch (err) {
          console.warn("window.open blocked by popup blocker or security policy.", err);
        }
      } else {
        showToast("Configure um número de WhatsApp no seu Perfil para envio automático.", "info");
      }
    } catch (err: any) {
      setError("Erro ao elaborar o relatório de WhatsApp: " + err.message);
    }
  };

  const handleCopyReportText = () => {
    if (!selectedReport) return;
    navigator.clipboard.writeText(selectedReport.text);
    setReportCopySuccess(true);
    showToast("Texto do relatório copiado com sucesso!", "success");
    setTimeout(() => setReportCopySuccess(false), 2000);
  };

  const getUnit = (cat: CategoryType) => {
    switch (cat) {
      case "energia": return "kWh";
      case "agua": return "m³";
      case "combustivel": return "L";
      case "internet": return "GB";
    }
  };

  // Find the closest previous reading in DB chronologically before current readingDate
  const previousReading = React.useMemo(() => {
    // Look up readings in the target category prior to the selected readingDate
    const matching = readings
      .filter(r => r.category === category && (editingReading ? r.id !== editingReading.id : true))
      .sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());

    // Find the newest reading that is chronologically before/equal to current input date
    const targetTime = new Date(readingDate).getTime();
    return matching.find(r => new Date(r.readingDate).getTime() <= targetTime) || null;
  }, [readings, category, readingDate, editingReading]);

  // Forecast on-the-fly consumption calculation
  const predictedValue = React.useMemo(() => {
    const parsed = parseFloat(readingValue);
    if (isNaN(parsed)) return null;

    if (!previousReading) return 0; // Leitura inicial
    return Math.max(0, parsed - previousReading.readingValue);
  }, [readingValue, previousReading]);

  // Force categories defaults when switcher is called
  const handleCategoryChange = (cat: CategoryType) => {
    setCategory(cat);
    setReadingValue("");
    setKmInicial("");
    setKmFinal("");
    setDestinos("");
    setCostMt("");
    setReadingValueOffpeak("");
    setReadingValuePeak("");
    setSaldoInicioDia("");
    setConsumoLitros("");
    setConsumoMt("");
    setLitrosModified(false);
    setMtModified(false);
    setError("");
  };

  // Dynamically calculate consumption based on KM inputs for combustible
  const precoPorLitro = user?.precoPorLitro || 75;
  React.useEffect(() => {
    if (category === "combustivel") {
      const kmi = parseFloat(kmInicial);
      const kmf = parseFloat(kmFinal);
      if (!isNaN(kmi) && !isNaN(kmf) && kmf >= kmi) {
        const dist = kmf - kmi;
        const calculatedLitros = (dist * 0.082).toFixed(2);
        const calculatedMt = (parseFloat(calculatedLitros) * precoPorLitro).toFixed(2);

        if (!litrosModified) {
          setConsumoLitros(calculatedLitros);
          setReadingValue(calculatedLitros);
        }
        if (!mtModified) {
          setConsumoMt(calculatedMt);
        }
      }
    }
  }, [kmInicial, kmFinal, precoPorLitro, category, litrosModified, mtModified]);

  // Populate Edit Mode
  const startEdit = (reading: MeterReading) => {
    setEditingReading(reading);
    setCategory(reading.category);
    setReadingDate(reading.readingDate);
    setReadingValue(reading.readingValue.toString());
    setNotes(reading.notes || "");
    
    // Populate custom variables
    setKmInicial(reading.kmInicial !== undefined ? reading.kmInicial.toString() : "");
    setKmFinal(reading.kmFinal !== undefined ? reading.kmFinal.toString() : "");
    setDestinos(reading.destinos || "");
    setCostMt(reading.costMt !== undefined ? reading.costMt.toString() : "");
    setReadingValueOffpeak(reading.readingValueOffpeak !== undefined ? reading.readingValueOffpeak.toString() : "");
    setReadingValuePeak(reading.readingValuePeak !== undefined ? reading.readingValuePeak.toString() : "");
    setSaldoInicioDia(reading.saldoInicioDia !== undefined ? reading.saldoInicioDia.toString() : "");
    setConsumoLitros(reading.consumoLitros !== undefined ? reading.consumoLitros.toString() : "");
    setConsumoMt(reading.consumoMt !== undefined ? reading.consumoMt.toString() : "");
    setLitrosModified(false);
    setMtModified(false);
    
    // Jump UI focus to top form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingReading(null);
    setReadingValue("");
    setNotes("");
    setKmInicial("");
    setKmFinal("");
    setDestinos("");
    setCostMt("");
    setReadingValueOffpeak("");
    setReadingValuePeak("");
    setSaldoInicioDia("");
    setConsumoLitros("");
    setConsumoMt("");
    setLitrosModified(false);
    setMtModified(false);
  };

  // Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const valNumeric = parseFloat(readingValue);
    if (isNaN(valNumeric) || valNumeric < 0) {
      setError("Insira um valor de leitura válido maior ou igual a zero");
      setLoading(false);
      return;
    }

    // Capture extra category fields
    const payload: any = {
      category,
      readingDate,
      readingValue: valNumeric,
      unit: getUnit(category),
      notes,
    };

    if (category === "energia") {
      if (readingValueOffpeak) {
        const offpeakVal = parseFloat(readingValueOffpeak);
        if (!isNaN(offpeakVal)) {
          payload.readingValueOffpeak = offpeakVal;
        }
      }
      if (readingValuePeak) {
        const peakVal = parseFloat(readingValuePeak);
        if (!isNaN(peakVal)) {
          payload.readingValuePeak = peakVal;
        }
      }
      if (saldoInicioDia) {
        const saldoVal = parseFloat(saldoInicioDia);
        if (!isNaN(saldoVal)) {
          payload.saldoInicioDia = saldoVal;
        }
      }
    }

    if (category === "combustivel") {
      if (kmInicial) payload.kmInicial = parseFloat(kmInicial);
      if (kmFinal) payload.kmFinal = parseFloat(kmFinal);
      if (destinos) payload.destinos = destinos;
      
      const parsedLitros = parseFloat(consumoLitros);
      payload.consumoLitros = isNaN(parsedLitros) ? valNumeric : parsedLitros;
      
      const parsedMt = parseFloat(consumoMt);
      payload.consumoMt = isNaN(parsedMt) ? undefined : parsedMt;
      
      payload.precoPorLitro = precoPorLitro;
      payload.readingValue = payload.consumoLitros;
    }

    try {
      if (editingReading) {
        await onEditReading(editingReading.id, payload);
        setSuccess("Registro atualizado com sucesso!");
        showToast("Registro atualizado com sucesso!", "success");
        setEditingReading(null);
      } else {
        await onAddReading(payload);
        setSuccess("Leitura salva com sucesso!");
        showToast("Leitura salva com sucesso!", "success");
      }

      // Reset form variables
      setReadingValue("");
      setNotes("");
      setKmInicial("");
      setKmFinal("");
      setDestinos("");
      setCostMt("");
      setReadingValueOffpeak("");
      setReadingValuePeak("");
      setSaldoInicioDia("");
      setConsumoLitros("");
      setConsumoMt("");
      setLitrosModified(false);
      setMtModified(false);
    } catch (err: any) {
      const errMsg = err.message || "Erro ao salvar leitura. Revise os campos.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta leitura? Esta operação é irreversível e recalculará os consumos posteriores.")) {
      try {
        await onDeleteReading(id);
        setSuccess("Leitura excluída com sucesso!");
        showToast("Leitura excluída com sucesso!", "success");
      } catch (err: any) {
        const errMsg = err.message || "Erro ao excluir leitura";
        setError(errMsg);
        showToast(errMsg, "error");
      }
    }
  };

  // Filter & Search table list
  const filteredReadingsList = React.useMemo(() => {
    return readings.filter(r => {
      const matchesCategory = filterCategory === "todas" || r.category === filterCategory;
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        r.notes?.toLowerCase().includes(term) ||
        r.destinos?.toLowerCase().includes(term) ||
        r.readingDate.includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [readings, filterCategory, searchTerm]);

  return (
    <div id="registrar-view" className="space-y-6">
      <div>
        <h2 className="font-sans font-bold text-2xl tracking-tight text-slate-900 dark:text-zinc-50">
          {editingReading ? "Editar Registro" : "Registrar Consumos Diários"}
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          {editingReading ? `Editando o registro gravado em ${editingReading.readingDate}` : "Insira uma leitura acumulada de medidor para gerar as estatísticas diferenciais"}
        </p>
      </div>

      {/* Global alert feedback banners */}
      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 p-4 border border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-300 text-sm flex items-start gap-2.5">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-sm flex items-start gap-2.5">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Form and Quick Reference Column */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Form Element */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-205 dark:border-zinc-850 p-5 sm:p-6 rounded-2xl shadow-xs">
          <form onSubmit={handleSave} className="space-y-5">
            {/* Category Selector Buttons */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">
                Categoria de Consumo <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "energia", name: "Energia", icon: Zap, color: "hover:border-amber-500 active:bg-amber-500/10", activeColor: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold" },
                  { id: "agua", name: "Água", icon: Droplet, color: "hover:border-blue-500 active:bg-blue-500/10", activeColor: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold" },
                  { id: "combustivel", name: "Combustível", icon: Fuel, color: "hover:border-emerald-500 active:bg-emerald-500/10", activeColor: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold" },
                  { id: "internet", name: "Internet", icon: Globe, color: "hover:border-indigo-500 active:bg-indigo-500/10", activeColor: "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold" },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSel = category === item.id;
                  return (
                    <button
                      id={`form-category-btn-${item.id}`}
                      key={item.id}
                      type="button"
                      disabled={editingReading !== null}
                      onClick={() => handleCategoryChange(item.id as CategoryType)}
                      className={`flex flex-col items-center justify-center p-3.5 border rounded-xl gap-2 text-sm transition-all text-zinc-650 dark:text-zinc-350 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-zinc-200 dark:border-zinc-800 ${
                        isSel ? item.activeColor : item.color
                      }`}
                    >
                      <Icon size={20} className={isSel ? "" : "text-zinc-450"} />
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inputs Block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date Input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Data da Leitura <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-450">
                    <Calendar size={18} />
                  </div>
                  <input
                    id="reading-date-input"
                    type="date"
                    required
                    value={readingDate}
                    onChange={(e) => setReadingDate(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>

              {/* Main Reading Value (KwH, m3, Liters, GB) */}
              {category !== "combustivel" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Leitura Acumulada ({getUnit(category)}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reading-value-input"
                    type="number"
                    step="any"
                    required
                    placeholder="Digite o valor atual do medidor"
                    value={readingValue}
                    onChange={(e) => setReadingValue(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
                  />
                </div>
              )}
            </div>

            {/* Custom Fields: Energy Peak/Offpeak details */}
            {category === "energia" && (
              <div className="p-4 bg-amber-50/20 dark:bg-amber-950/10 border border-amber-200/40 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <h5 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Configuração de Alta/Baixa Tarifa (Parâmetros Excel)</h5>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Permite calcular o consumo acumulado no horário de Expediente e Fora de Expediente, bem como saldo diário</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Medidor em Expediente (Peak 8h-18h kWh)
                  </label>
                  <input
                    id="reading-peak-input"
                    type="number"
                    step="any"
                    placeholder="Opcional: medidor alta tarifa"
                    value={readingValuePeak}
                    onChange={(e) => setReadingValuePeak(e.target.value)}
                    className="block w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Medidor Fora de Expediente (Off-Peak 18h-8h kWh)
                  </label>
                  <input
                    id="reading-offpeak-input"
                    type="number"
                    step="any"
                    placeholder="Opcional: medidor baixa tarifa"
                    value={readingValueOffpeak}
                    onChange={(e) => setReadingValueOffpeak(e.target.value)}
                    className="block w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Saldo no Início do Dia de Hoje (Kw/h)
                  </label>
                  <input
                    id="saldo-inicio-input"
                    type="number"
                    step="any"
                    placeholder="Ex: 50"
                    value={saldoInicioDia}
                    onChange={(e) => setSaldoInicioDia(e.target.value)}
                    className="block w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            )}

            {/* Custom Fields: Combustível Details */}
            {category === "combustivel" && (
              <div className="p-5 bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-250/30 rounded-2xl space-y-4">
                <div>
                  <h5 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Ficha de Controlo de Deslocamento e Combustível</h5>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Preencha os quilómetros para automatizar a estimativa de consumo baseada na taxa padrão de 0.082 L/Km.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Km Inicial */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Km Inicial <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="km-inicial-input"
                      type="number"
                      required
                      placeholder="Ex: 147310"
                      value={kmInicial}
                      onChange={(e) => setKmInicial(e.target.value)}
                      className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white text-sm"
                    />
                  </div>

                  {/* Km Final */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Km Final <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="km-final-input"
                      type="number"
                      required
                      placeholder="Ex: 147329"
                      value={kmFinal}
                      onChange={(e) => setKmFinal(e.target.value)}
                      className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white text-sm"
                    />
                  </div>

                  {/* Distância (calculated) */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Distância (Km)
                    </label>
                    <div className="px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 rounded-xl text-zinc-600 dark:text-zinc-300 text-sm font-bold font-mono">
                      {(() => {
                        const kmi = parseFloat(kmInicial);
                        const kmf = parseFloat(kmFinal);
                        return !isNaN(kmi) && !isNaN(kmf) ? (kmf - kmi).toLocaleString() : 0;
                      })()} Km
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Consumo Litros */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Consumo (Litros) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="consumo-litros-input"
                      type="number"
                      step="any"
                      required
                      placeholder="Quantidade em Litros"
                      value={consumoLitros}
                      onChange={(e) => {
                        setConsumoLitros(e.target.value);
                        setReadingValue(e.target.value);
                        setLitrosModified(true);
                      }}
                      className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white text-sm font-semibold"
                    />
                  </div>

                  {/* Consumo MZN */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Consumo (MZN) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="consumo-mzn-input"
                      type="number"
                      step="any"
                      required
                      placeholder="Preço Total em Meticais"
                      value={consumoMt}
                      onChange={(e) => {
                        setConsumoMt(e.target.value);
                        setMtModified(true);
                      }}
                      className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white text-sm font-semibold"
                    />
                  </div>
                </div>

                {/* Destinos */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Destinos Percorridos <span className="text-zinc-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    id="destinos-input"
                    type="text"
                    placeholder="Ex: HEINEKEN, ATM, Mica e Banco Mais..."
                    value={destinos}
                    onChange={(e) => setDestinos(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            )}

            {/* General Notes */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Observações Adicionais <span className="text-zinc-400 font-normal">(Opcional)</span>
              </label>
              <textarea
                id="reading-notes-textarea"
                rows={3}
                placeholder="Insira notas explicativas como: manutenção preventiva, reparos de rede, viagens, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all resize-none"
              />
            </div>

            {/* Buttons Row */}
            <div className="flex gap-3 justify-end pt-2">
              {editingReading && (
                <button
                  id="cancel-edit-btn"
                  type="button"
                  onClick={cancelEdit}
                  className="py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-850 cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                id="save-reading-btn"
                type="submit"
                disabled={loading}
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white shadow-xs cursor-pointer active:bg-blue-800 disabled:opacity-50"
              >
                {loading ? "Salvando..." : (editingReading ? "Atualizar Registro" : "Salvar Leitura")}
              </button>
            </div>
          </form>
        </div>

        {/* Realtime Calc Gauge Side Panel */}
        <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 space-y-5 h-fit">
          <h4 className="font-sans font-bold text-zinc-900 dark:text-zinc-100 text-sm">Calculadora Auxiliar</h4>
          
          <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-850">
            <h5 className="text-[11px] text-zinc-450 uppercase font-semibold">Último Consumo de Referência</h5>
            {previousReading ? (
              <div className="mt-2 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-450">Data gravada:</span>
                  <span className="font-semibold">{new Date(previousReading.readingDate + "T00:00:00").toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-450">Valor acumulado:</span>
                  <span className="font-bold">{previousReading.readingValue} {getUnit(category)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-500 mt-2 font-medium flex items-center gap-1">
                <Info size={13} />
                Nenhum registro anterior encontrado.
              </p>
            )}
          </div>

          <div id="realtime-result-panel" className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-50 dark:border-zinc-800 text-center">
            <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400">Consumo Calculado para o Registro</h4>
            {predictedValue !== null ? (
              <div className="mt-3">
                <p className="font-sans font-extrabold text-3xl text-zinc-900 dark:text-zinc-50">
                  {predictedValue.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-zinc-500">{getUnit(category)}</span>
                </p>
                {previousReading ? (
                  <p className="text-[10px] text-zinc-500 mt-1.5">Representa a diferença em relação à leitura de {new Date(previousReading.readingDate + "T00:00:00").toLocaleDateString()}</p>
                ) : (
                  <span className="inline-block bg-orange-100 text-orange-850 text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 uppercase">Leitura Inicial</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-450 mt-3">Preencha o campo de "Leitura Acumulada" para simular o diferencial.</p>
            )}
          </div>

          {/* Subtitle list of custom outputs if applicable */}
          {category === "combustivel" && kmInicial && kmFinal && (
            <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-850 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <Car size={14} />
                <span>Simulação de Milhagem</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-zinc-100 dark:border-zinc-900">
                <span className="text-zinc-450">Distância Calculada:</span>
                <span className="font-extrabold text-zinc-900 dark:text-white">{(parseFloat(kmFinal) - parseFloat(kmInicial)).toLocaleString()} Km</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* HISTORIC LISTING TABLE SECTION */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-2xl overflow-hidden p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-sans font-bold text-zinc-900 dark:text-zinc-100 text-sm">Histórico Detalhado</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Listagem cronológica com recursos de edição ou descarte</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search inputs */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Search size={15} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por descrição/data..."
                className="pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-lg text-xs w-full sm:w-48 text-zinc-800 dark:text-zinc-200"
              />
            </div>

            {/* Category filter select dropdown */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 font-medium"
            >
              <option value="todas">Todas Categorias</option>
              <option value="energia">⚡ Energia</option>
              <option value="agua">💧 Água</option>
              <option value="combustivel">⛽ Combustível</option>
              <option value="internet">🌐 Internet</option>
            </select>

            {/* Clear All Registries Button */}
            <button
              id="btn-clear-readings-history"
              type="button"
              onClick={handleClearAllReadings}
              disabled={readings.length === 0}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:hover:bg-rose-50 dark:bg-rose-950/20 border border-rose-200 hover:border-rose-300 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Apagar todo o histórico de leituras de consumo"
            >
              <Trash2 size={13} />
              <span>Limpar Tudo</span>
            </button>
          </div>
        </div>

        {/* Selected Report Preview Panel */}
        {selectedReport && (
          <div className="p-4 bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-250/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block p-1.5 bg-emerald-100 dark:bg-emerald-950 rounded-lg text-emerald-700 dark:text-emerald-400">
                  <Share2 size={16} />
                </span>
                <div>
                  <h5 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">
                    Relatório de WhatsApp Elaborado
                  </h5>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Sincronizado com os registros de/até {new Date(selectedReport.date + "T00:00:00").toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReportText}
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-805 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-lg font-bold transition cursor-pointer"
                >
                  <Copy size={13} />
                  <span>{reportCopySuccess ? "Copiado!" : "Copiar Texto"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-1 text-xs cursor-pointer font-bold"
                >
                  Fechar
                </button>
              </div>
            </div>

            <textarea
              value={selectedReport.text}
              onChange={(e) => setSelectedReport({ ...selectedReport, text: e.target.value })}
              rows={10}
              className="w-full text-xs font-mono text-zinc-800 dark:text-zinc-300 bg-white/60 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 p-3.5 rounded-xl font-semibold resize-y focus:outline-hidden focus:ring-1 focus:ring-emerald-500 leading-relaxed"
            />

            <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
              <div className="text-xs text-zinc-500">
                {selectedReport.phone ? (
                  <span>
                    Destinatário: <strong className="text-zinc-700 dark:text-zinc-300">{selectedReport.phone}</strong>
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    ⚠️ Configure um número de WhatsApp no Perfil para envio direto.
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const cleanPhone = selectedReport.phone.replace(/\D/g, "");
                  const newLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(selectedReport.text)}`;
                  window.open(newLink, "_blank");
                }}
                className="w-full sm:w-auto text-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition uppercase tracking-wider block cursor-pointer shadow-xs active:bg-emerald-800 border-none"
              >
                Mandar Direto pelo WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* Table representation */}
        {filteredReadingsList.length === 0 ? (
          <div className="py-12 border border-dashed border-zinc-150 dark:border-zinc-850 rounded-xl bg-zinc-50 dark:bg-zinc-950/20 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma leitura corresponde aos filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-150 dark:border-zinc-850">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-850">
              <thead className="bg-zinc-50 dark:bg-zinc-950 text-left font-sans font-bold text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Data</th>
                  <th scope="col" className="px-4 py-3">Categoria</th>
                  <th scope="col" className="px-4 py-3">Valor Acumulado</th>
                  <th scope="col" className="px-4 py-3">Consumo</th>
                  <th scope="col" className="px-4 py-3">Detalhes Adicionais</th>
                  <th scope="col" className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-850 text-xs text-zinc-750 dark:text-zinc-300">
                {filteredReadingsList.map((row) => {
                  const catName = row.category === "energia" ? "Energia" : row.category === "agua" ? "Água" : row.category === "combustivel" ? "Combustível" : "Internet";
                  const catIcon = row.category === "energia" ? "⚡" : row.category === "agua" ? "💧" : row.category === "combustivel" ? "⛽" : "🌐";
                  
                  return (
                    <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/40">
                      {/* Date */}
                      <td className="px-4 py-3.5 font-mono whitespace-nowrap">
                        {new Date(row.readingDate + "T00:00:00").toLocaleDateString(undefined, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      {/* Category Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-100">
                        <span className="inline-flex items-center gap-1">
                          <span>{catIcon}</span>
                          <span>{catName}</span>
                        </span>
                      </td>

                      {/* Reading Value */}
                      <td className="px-4 py-3.5 font-mono">
                        {row.readingValue.toLocaleString()} {row.unit}
                        {row.readingValueOffpeak !== undefined && (
                          <div className="text-[10px] text-zinc-450">B.T: {row.readingValueOffpeak.toLocaleString()}</div>
                        )}
                      </td>

                      {/* Consumption */}
                      <td className="px-4 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                        {row.consumption === 0 ? (
                          <span className="text-[10px] text-orange-650 bg-orange-50 dark:bg-orange-950/20 px-1.5 py-0.5 rounded-sm">Inic.</span>
                        ) : (
                          `${row.consumption.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${row.unit}`
                        )}
                        {row.consumptionOffpeak !== undefined && (
                          <div className="text-[10px] text-zinc-550 font-normal">B.T: {row.consumptionOffpeak.toLocaleString()}</div>
                        )}
                      </td>

                      {/* Notes / Custom data representation */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5 max-w-xs">
                          {row.category === "combustivel" && (row.kmInicial !== undefined || row.kmFinal !== undefined) && (
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                              📍 KM: {row.kmInicial ?? "?"} → {row.kmFinal ?? "?"} ({row.kmFinal && row.kmInicial ? row.kmFinal - row.kmInicial : 0} km)
                              {row.destinos && <span className="block italic text-zinc-500 font-sans mt-0.5">{row.destinos}</span>}
                              {row.costMt !== undefined && <span className="block mt-0.5 font-sans font-bold">Custo: {row.costMt.toLocaleString()} Mt</span>}
                            </div>
                          )}
                          {row.notes && <p className="truncate text-zinc-500 dark:text-zinc-405">{row.notes}</p>}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            id={`edit-reading-idx-${row.id}`}
                            onClick={() => startEdit(row)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg cursor-pointer"
                            title="Editar Leitura"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            id={`whatsapp-reading-idx-${row.id}`}
                            onClick={() => handleWhatsappReport(row)}
                            className="p-1.5 text-emerald-600 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-950/40 bg-emerald-50 dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900 rounded-lg cursor-pointer"
                            title="Gerar Relatório WhatsApp"
                          >
                            <Share2 size={14} />
                          </button>
                          <button
                            id={`delete-reading-idx-${row.id}`}
                            onClick={() => handleDelete(row.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg cursor-pointer"
                            title="Excluir Leitura"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
