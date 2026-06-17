import React from "react";
import { MeterReading, Target, CategoryType } from "../types";
import * as XLSX from "xlsx";
import { 
  FileSpreadsheet, 
  Calendar, 
  Check, 
  Download, 
  Search,
  AlertCircle,
  FileText
} from "lucide-react";

interface RelatoriosProps {
  readings: MeterReading[];
  targets: Target[];
}

export default function Relatorios({ readings, targets }: RelatoriosProps) {
  // Option to ignore filters and export all history by default
  const [exportAll, setExportAll] = React.useState<boolean>(true);

  // Filters State
  const [startDate, setStartDate] = React.useState<string>(() => {
    // Default to the first day of the current month
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  
  const [endDate, setEndDate] = React.useState<string>(() => {
    // Default to today
    return new Date().toISOString().slice(0, 10);
  });

  const [downloadSuccess, setDownloadSuccess] = React.useState(false);

  // Filter readings within range or export all-time history
  const filteredReadings = React.useMemo(() => {
    if (exportAll) {
      return readings;
    }
    const start = new Date(startDate + "T00:00:00").getTime();
    const end = new Date(endDate + "T23:59:59").getTime();

    return readings.filter(r => {
      const time = new Date(r.readingDate + "T00:00:00").getTime();
      return time >= start && time <= end;
    });
  }, [readings, startDate, endDate, exportAll]);

  // Generate Excel Handler with Automatic Formulas
  const handleExport = () => {
    setDownloadSuccess(false);

    try {
      const wb = XLSX.utils.book_new();

      // --- SHEET 1: "Resumo Diário" ---
      // We group consumptions by unique dates in chronological order
      const uniqueDates = (Array.from(new Set(filteredReadings.map(r => r.readingDate))) as string[])
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      const resumoDiarioData = uniqueDates.map(date => {
        const dateReadings = filteredReadings.filter(r => r.readingDate === date);
        
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

      // Add a SUM formula row at the end of Sheet 1
      if (resumoDiarioData.length > 0) {
        const totalRowIdx = resumoDiarioData.length + 2; // header (row 1) + rows + 1-based index
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

      // --- SHEET 2: "Detalhes dos Registros" ---
      const sortedReadings = [...filteredReadings].sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());
      
      const detalhesData = sortedReadings.map(r => {
        let catText = "";
        switch (r.category) {
          case "energia": catText = "Energia"; break;
          case "agua": catText = "Água"; break;
          case "combustivel": catText = "Combustível"; break;
          case "internet": catText = "Internet"; break;
        }

        // Calculate Leitura Anterior dynamically for display
        const previousReadings = readings
          .filter(allR => allR.category === r.category && allR.id !== r.id)
          .sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());

        const targetTime = new Date(r.readingDate).getTime();
        const prev = previousReadings.reverse().find(allR => new Date(allR.readingDate).getTime() <= targetTime);
        const leituraAnterior = prev ? prev.readingValue : 0;

        // Structured observations string with Peak details / Km / pricing
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
          "Consumo no Período": r.consumption, // Placeholder, will inject formula below
          "Unidade": r.unit,
          "Observações / Parâmetros Customizados": obsStr
        };
      });

      const wsDetalhes = XLSX.utils.json_to_sheet(detalhesData);
      
      // Inject formula into Consumo no Período column (Column E)
      sortedReadings.forEach((r, idx) => {
        const rowNumber = idx + 2; // header is Row 1
        wsDetalhes[`E${rowNumber}`] = {
          t: 'n',
          f: `D${rowNumber}-C${rowNumber}`, // Leitura Atual - Leitura Anterior
          v: r.consumption
        };
      });

      XLSX.utils.book_append_sheet(wb, wsDetalhes, "Detalhes dos Registros");

      // --- SHEET 3: "Metas vs Realizado" ---
      const uniqueCategoryMonths = Array.from(new Set([
        ...readings.map(r => r.readingDate.slice(0, 7)),
        ...targets.map(t => t.month)
      ])).sort().reverse();

      const categories: CategoryType[] = ["energia", "agua", "combustivel", "internet"];
      const metasRealizadoRaw: any[] = [];

      uniqueCategoryMonths.forEach(mStr => {
        categories.forEach(cat => {
          let catText = "";
          let unit = "";
          switch (cat) {
            case "energia": catText = "Energia"; unit = "kWh"; break;
            case "agua": catText = "Água"; unit = "m³"; break;
            case "combustivel": catText = "Combustível"; unit = "L"; break;
            case "internet": catText = "Internet"; unit = "GB"; break;
          }

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
        "Meta de Consumo Máximo": row.targetValue || 0,
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
          z: '0.0%' // percentage format in excel
        };

        // Status / Teto: =IF(C{rowNumber}<=0, "Sem Meta Definida", IF(D{rowNumber}<=C{rowNumber}, "Dentro do Esperado", "Acima do Limite Definido"))
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

      // --- DOWNLOAD TRIGGER ---
      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const fileName = `relatorio_consumo_${dateTag}.xlsx`;

      XLSX.writeFile(wb, fileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (e) {
      console.error("Falha ao gerar planilha Excel", e);
    }
  };

  return (
    <div id="relatorios-view" className="space-y-6">
      <div>
        <h2 className="font-sans font-bold text-2xl tracking-tight text-zinc-900 dark:text-zinc-50">Geração de Relatórios Oficiais</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Gere arquivos compatíveis com o Excel (.xlsx) para auditar leituras e validar comparativos de custos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters and Downloader widget */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 p-5 rounded-2xl shadow-xs space-y-5 h-fit">
          <h4 className="font-sans font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            Parâmetros do Arquivo
          </h4>

          {/* Export All History Checkbox */}
          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150 dark:border-zinc-850">
            <input
              id="report-export-all-checkbox"
              type="checkbox"
              checked={exportAll}
              onChange={(e) => setExportAll(e.target.checked)}
              className="w-4 h-4 text-emerald-600 bg-zinc-100 border-zinc-350 rounded-xs focus:ring-emerald-500 dark:focus:ring-emerald-600 dark:ring-offset-zinc-800 dark:bg-zinc-700 dark:border-zinc-650 cursor-pointer"
            />
            <label htmlFor="report-export-all-checkbox" className="text-xs font-bold text-zinc-700 dark:text-zinc-205 cursor-pointer select-none">
              Exportar Histórico Completo
              <span className="block text-[10px] text-zinc-450 font-normal mt-0.5">Ignora filtros e exporta todas as leituras</span>
            </label>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Data Inicial Cobertura
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-450">
                <Calendar size={18} />
              </span>
              <input
                id="report-start-date"
                type="date"
                value={startDate}
                disabled={exportAll}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white ${exportAll ? "opacity-50 cursor-not-allowed" : ""}`}
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Data Final Cobertura
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-450">
                <Calendar size={18} />
              </span>
              <input
                id="report-end-date"
                type="date"
                value={endDate}
                disabled={exportAll}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white ${exportAll ? "opacity-50 cursor-not-allowed" : ""}`}
              />
            </div>
          </div>

          <button
            id="report-generate-excel-btn"
            onClick={handleExport}
            disabled={filteredReadings.length === 0}
            className="w-full inline-flex items-center gap-2 justify-center py-3 px-4 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={16} />
            Gerar Relatório Excel (.xlsx)
          </button>

          {/* Download feedback messages */}
          {filteredReadings.length === 0 && (
            <p className="text-[11px] text-zinc-500 leading-normal flex items-start gap-1 p-2 bg-zinc-50 dark:bg-zinc-950 rounded-lg">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              Nenhum registro no intervalo selecionado. Filtre um período que possua consumos gravados.
            </p>
          )}

          {downloadSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-850 dark:text-emerald-450 rounded-xl text-xs flex items-center gap-2 border border-emerald-100 dark:border-emerald-900/30">
              <Check size={16} className="shrink-0" />
              <span>O download do seu .xlsx iniciou!</span>
            </div>
          )}
        </div>

        {/* Content Preview Details */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="font-sans font-bold text-zinc-900 dark:text-zinc-100 text-sm">Estruturação de Abas Configurada</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sheet 1 Preview */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 p-4 rounded-2xl shadow-xs space-y-2">
              <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2 rounded-xl h-fit w-fit">
                <FileText size={18} />
              </div>
              <h5 className="font-sans font-bold text-xs text-zinc-900 dark:text-zinc-100">Aba 1: Resumo Diário</h5>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                Compila os consumos totais agregados por dia das categorias: Energia kWh, Água m³, Combustível L e Internet GB em colunas limpas.
              </p>
            </div>

            {/* Sheet 2 Preview */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 p-4 rounded-2xl shadow-xs space-y-2">
              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2 rounded-xl h-fit w-fit">
                <FileText size={18} />
              </div>
              <h5 className="font-sans font-bold text-xs text-zinc-900 dark:text-zinc-100">Aba 2: Detalhes dos Registros</h5>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                Audita um a um os registros inseridos, expondo leitura anterior, leitura atual, valor diferencial com fórmula automática de cálculo, observações e Km de veículo.
              </p>
            </div>

            {/* Sheet 3 Preview */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 p-4 rounded-2xl shadow-xs space-y-2">
              <div className="bg-purple-500/10 text-purple-600 dark:text-purple-400 p-2 rounded-xl h-fit w-fit">
                <FileText size={18} />
              </div>
              <h5 className="font-sans font-bold text-xs text-zinc-900 dark:text-zinc-100">Aba 3: Metas vs Realizado</h5>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                Compara a meta de consumo do teto mensal contra o volume despendido, calculando dinamicamente com fórmula a utilização (%) e o status inteligente do teto.
              </p>
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-850">
            <h5 className="font-sans font-bold text-zinc-900 dark:text-zinc-100 text-xs mb-2">
              {exportAll ? "Dados de todo o Histórico do Banco" : `Dados no Intervalo Filtrado (${startDate} a ${endDate})`}
            </h5>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-850">
                <span className="text-zinc-450 block truncate">Registros de Consumo</span>
                <span className="text-lg font-extrabold text-zinc-950 dark:text-white mt-1 block font-mono">{filteredReadings.length}</span>
              </div>
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-850">
                <span className="text-zinc-450 block truncate font-medium">Metas ativas cadastradas</span>
                <span className="text-lg font-extrabold text-zinc-950 dark:text-white mt-1 block font-mono">{targets.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
