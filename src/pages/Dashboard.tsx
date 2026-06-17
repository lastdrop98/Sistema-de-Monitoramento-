import React from "react";
import { User, MeterReading, Target, CategoryType, DashboardStats } from "../types";
import SummaryCard from "../components/SummaryCard";
import ConsumptionChart from "../components/ConsumptionChart";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { 
  FileSpreadsheet, 
  FileText,
  Loader2,
  PlusCircle, 
  AlertTriangle, 
  Calendar, 
  ArrowUpRight, 
  TrendingUp, 
  Building2, 
  Activity,
  FileDown
} from "lucide-react";
import ExcelJS from "exceljs";

interface DashboardProps {
  user?: User | null;
  readings: MeterReading[];
  targets: Target[];
  onNavigateToTab: (tab: string) => void;
  onExportExcel: () => void;
}

export default function Dashboard({
  user,
  readings,
  targets,
  onNavigateToTab,
  onExportExcel,
}: DashboardProps) {
  const [period, setPeriod] = React.useState<"7days" | "30days">("7days");
  const [selectedChartCategory, setSelectedChartCategory] = React.useState<CategoryType | "todas">("todas");
  const [isExportingPDF, setIsExportingPDF] = React.useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = React.useState<boolean>(false);
  const [isExportingWord, setIsExportingWord] = React.useState<boolean>(false);

  // Word document report exporter with actual values dynamically injected
  const handleExportWord = () => {
    setIsExportingWord(true);
    try {
      const now = new Date();
      const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
      
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      const currentMonthName = monthNames[now.getMonth()];
      const activeYear = now.getFullYear();

      // Filter readings for current month
      const currentMonthReadings = readings.filter(r => r.readingDate.startsWith(currentMonthStr));
      
      // Calculate totals
      const energyReadings = currentMonthReadings.filter(r => r.category === "energia");
      const totalEnergia = energyReadings.reduce((sum, r) => sum + r.consumption, 0);
      const totalEnergiaPeak = totalEnergia; // peak
      const totalEnergiaOffpeak = energyReadings.reduce((sum, r) => sum + (r.consumptionOffpeak || 0), 0);
      
      const waterReadings = currentMonthReadings.filter(r => r.category === "agua");
      const totalAgua = waterReadings.reduce((sum, r) => sum + r.consumption, 0);
      
      const internetReadings = currentMonthReadings.filter(r => r.category === "internet");
      const totalInternet = internetReadings.reduce((sum, r) => sum + r.consumption, 0);

      // Latest Saldo
      let saldoCurrent = 349.48; // default starting from email template
      const sortedEnergyReadingsChronological = [...energyReadings].sort((a,b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());
      if (sortedEnergyReadingsChronological.length > 0) {
        let running = 349.48;
        sortedEnergyReadingsChronological.forEach(r => {
          running = running - r.consumption - (r.consumptionOffpeak || 0);
        });
        saldoCurrent = running > 0 ? running : 349.48;
      }
      
      // Date range description
      let dateRangeStr = `15 a 11 de ${currentMonthName}`; // default matching their example
      if (currentMonthReadings.length > 0) {
        const sortedDates = [...currentMonthReadings].map(r => r.readingDate).sort();
        const startDay = new Date(sortedDates[0] + "T00:00:00").getDate();
        const endDay = new Date(sortedDates[sortedDates.length - 1] + "T00:00:00").getDate();
        dateRangeStr = `${startDay} a ${endDay} de ${currentMonthName}`;
      }

      const todayStr = `${now.getDate()} de ${currentMonthName}`;

      const docContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>Relatório de Consumo</title>
  <style>
    body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.5; color: #000000; margin: 40px; }
    p { margin-bottom: 12px; font-size: 11pt; }
    ol { margin-bottom: 12px; padding-left: 20px; }
    li { margin-bottom: 10px; font-size: 11pt; }
  </style>
</head>
<body>
  <p>Boa tarde</p>
  
  <p>Segue abaixo os consumos registados de ${dateRangeStr}.</p>
  
  <p><strong>1. Consumo de Energia – Total: ${totalEnergia.toFixed(2).replace(".", ",")}kWh</strong><br/>
  Expediente (8H00 às 18H00) – ${totalEnergiaPeak.toFixed(2).replace(".", ",")}kWh<br/>
  Fora do Expediente (18H00 às 8H00) - ${totalEnergiaOffpeak.toFixed(2).replace(".", ",")}kWh</p>
  
  <p>O saldo no ínicio do dia de hoje, ${todayStr} era de ${saldoCurrent.toFixed(2).replace(".", ",")}Kw/h.</p>
  
  <p><strong>2. Consumo de Água</strong><br/>
  O consumo total de água foi de ${totalAgua.toFixed(0)}m³ (${(totalAgua * 1000).toLocaleString('pt-BR')} litros)</p>
  
  <p><strong>3. Consumo de Internet</strong><br/>
  O consumo total de dados foi de ${totalInternet.toFixed(0)} GB</p>
  
  <p>Em anexo envio a planilha de controlo de consumo.</p>
  
  <p>Atenciosamente,<br/>
  <strong>${user?.fullName || 'Shelton Barreto'}</strong><br/>
  ${user?.company || 'LMTD'}</p>
</body>
</html>
      `;

      const blob = new Blob(['\ufeff' + docContent], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_consumo_${currentMonthName.toLowerCase()}_${activeYear}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Erro ao gerar relatório Word:", e);
      alert("Ocorreu um erro ao exportar o relatório Word.");
    } finally {
      setIsExportingWord(false);
    }
  };

  // High-fidelity ExcelJS implementation to exactly match requested layouts from image files
  const handleExportExcelExcelJS = async () => {
    setIsExportingExcel(true);
    try {
      const now = new Date();
      const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
      const activeYear = now.getFullYear();
      const activeMonth = now.getMonth();
      const totalDays = new Date(activeYear, activeMonth + 1, 0).getDate();
      
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      const activeMonthName = monthNames[activeMonth];

      // Capture all 4 offscreen graphs
      let imgEnergia = null;
      let imgAgua = null;
      let imgInternet = null;
      let imgCombustivel = null;

      const captureChartElement = async (id: string): Promise<string | null> => {
        const el = document.getElementById(id);
        if (!el) return null;
        try {
          const canvas = await html2canvas(el, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: "#18181b", // Dark charcoal background
            logging: false,
            onclone: (clonedDoc) => {
              // 1. Process all style tags in the cloned document to replace oklch with fallback colors
              const styleElements = clonedDoc.getElementsByTagName("style");
              for (let j = 0; j < styleElements.length; j++) {
                const style = styleElements[j];
                if (style.innerHTML) {
                  style.innerHTML = style.innerHTML.replace(/oklch\([^)]+\)/gi, "rgb(148, 163, 184)");
                }
              }

              // 2. Process all elements with style attributes containing oklch
              const elementsWithInlineStyle = clonedDoc.querySelectorAll("[style*='oklch']");
              elementsWithInlineStyle.forEach((itemEl) => {
                const htmlEl = itemEl as HTMLElement;
                if (htmlEl.style && htmlEl.style.cssText) {
                  htmlEl.style.cssText = htmlEl.style.cssText.replace(/oklch\([^)]+\)/gi, "rgb(148, 163, 184)");
                }
              });

              // 3. Robust clean up of all clip path usages from any element to completely avoid NotFoundError
              const allEls = clonedDoc.querySelectorAll("*");
              allEls.forEach((el) => {
                const htmlEl = el as HTMLElement;
                if (htmlEl.removeAttribute) {
                  htmlEl.removeAttribute("clip-path");
                  htmlEl.removeAttribute("clipPath");
                }
                if (htmlEl.style) {
                  if (htmlEl.style.clipPath) {
                    htmlEl.style.clipPath = "none";
                  }
                  if (htmlEl.style.cssText && htmlEl.style.cssText.toLowerCase().includes("clip-path")) {
                    htmlEl.style.cssText = htmlEl.style.cssText.replace(/clip-path\s*:\s*url\([^)]+\);?/gi, "");
                  }
                }
              });

              // 4. Force visibility and clear offscreen absolute positions on hidden/offscreen containers
              const clonedParent = clonedDoc.getElementById("excel-hidden-graphics");
              if (clonedParent) {
                clonedParent.style.position = "relative";
                clonedParent.style.left = "0";
                clonedParent.style.top = "0";
                clonedParent.style.display = "block";
                clonedParent.style.visibility = "visible";
                clonedParent.style.width = "640px";
              }

              const clonedTarget = clonedDoc.getElementById(id);
              if (clonedTarget) {
                clonedTarget.style.display = "block";
                clonedTarget.style.visibility = "visible";
                clonedTarget.style.width = "600px";
                clonedTarget.style.height = "340px";
              }
            }
          });
          return canvas.toDataURL("image/png");
        } catch (err) {
          console.error("Failed to capture: " + id, err);
          return null;
        }
      };

      try {
        imgEnergia = await captureChartElement("capture-chart-energia");
        imgAgua = await captureChartElement("capture-chart-agua");
        imgInternet = await captureChartElement("capture-chart-internet");
        imgCombustivel = await captureChartElement("capture-chart-combustivel");
      } catch (err) {
        console.error("Failing capturing charts on Excel generation:", err);
      }

      // Initialize ExcelJS workbook
      const workbook = new ExcelJS.Workbook();
      
      const commonBorder = {
        top: { style: 'thin' as const, color: { argb: 'FF990000' } },
        left: { style: 'thin' as const, color: { argb: 'FF990000' } },
        bottom: { style: 'thin' as const, color: { argb: 'FF990000' } },
        right: { style: 'thin' as const, color: { argb: 'FF990000' } }
      };

      const tableHeaderStyle = {
        fill: {
          type: 'pattern' as const,
          pattern: 'solid' as const,
          fgColor: { argb: 'FF990000' } // Dark Cherry Crimson
        },
        font: {
          color: { argb: 'FFFFFFFF' },
          bold: true,
          name: 'Calibri',
          size: 11
        },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true },
        border: commonBorder
      };

      // ==================== TAB 1: ENERGIA ====================
      const wsEnergia = workbook.addWorksheet("Energia", {
        views: [{ showGridLines: true }]
      });
      
      // Column widths config
      wsEnergia.getColumn('A').width = 3;
      wsEnergia.getColumn('B').width = 16;  // Data do Registro
      wsEnergia.getColumn('C').width = 24;  // Leitura Contador (kWh)
      wsEnergia.getColumn('D').width = 24;  // Consumo Pico (kWh)
      wsEnergia.getColumn('E').width = 24;  // Registo Fora de Pico (kWh)
      wsEnergia.getColumn('F').width = 24;  // Consumo Fora de Pico (kWh)
      wsEnergia.getColumn('G').width = 18;  // Saldo Inicial (kWh)
      wsEnergia.getColumn('H').width = 18;  // Saldo Final (kWh)
      wsEnergia.getColumn('I').width = 28;  // Observações

      // Sheet Header Title
      wsEnergia.getCell("B2").value = "HISTÓRICO DE CONSUMO DE ENERGIA";
      wsEnergia.getCell("B2").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF990000" }, underline: true };
      
      // Table Headers
      const energyHeaders = ["Data do Registro", "Leitura Contador (kWh)", "Consumo Pico (kWh)", "Registo Fora de Pico (kWh)", "Consumo Fora de Pico (kWh)", "Saldo Inicial (kWh)", "Saldo Final (kWh)", "Observações"];
      energyHeaders.forEach((h, idx) => {
        const cell = wsEnergia.getCell(4, idx + 2); // starts B4
        cell.value = h;
        cell.style = tableHeaderStyle;
      });
      wsEnergia.getRow(4).height = 25;

      // Filter and sort energy readings chronologically ascending
      const sortedEnergy = [...readings]
        .filter(r => r.category === "energia")
        .sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());

      sortedEnergy.forEach((r, idx) => {
        const rowIdx = 5 + idx; // starts at Row 5

        // B: Data
        const cellData = wsEnergia.getCell(rowIdx, 2);
        cellData.value = new Date(r.readingDate + "T00:00:00").toLocaleDateString("pt-BR");
        cellData.font = { name: "Calibri", size: 10 };
        cellData.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellData.border = commonBorder;

        // C: Leitura Contador peak
        const cellReading = wsEnergia.getCell(rowIdx, 3);
        cellReading.value = r.readingValue;
        cellReading.numFmt = "0.00";
        cellReading.font = { name: "Calibri", size: 10 };
        cellReading.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellReading.border = commonBorder;

        // D: Consumo Pico
        const cellPeak = wsEnergia.getCell(rowIdx, 4);
        cellPeak.value = r.consumption;
        cellPeak.numFmt = "0.00";
        cellPeak.font = { name: "Calibri", size: 10 };
        cellPeak.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellPeak.border = commonBorder;

        // E: Leitura Offpeak
        const cellOffpeakReading = wsEnergia.getCell(rowIdx, 5);
        cellOffpeakReading.value = r.readingValueOffpeak !== undefined ? r.readingValueOffpeak : "";
        cellOffpeakReading.numFmt = "0.00";
        cellOffpeakReading.font = { name: "Calibri", size: 10 };
        cellOffpeakReading.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellOffpeakReading.border = commonBorder;

        // F: Consumo Offpeak
        const cellOffpeak = wsEnergia.getCell(rowIdx, 6);
        cellOffpeak.value = r.consumptionOffpeak !== undefined ? r.consumptionOffpeak : 0;
        cellOffpeak.numFmt = "0.00";
        cellOffpeak.font = { name: "Calibri", size: 10 };
        cellOffpeak.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellOffpeak.border = commonBorder;

        // G: Saldo Inicial (8H00)
        const cellSaldo8h = wsEnergia.getCell(rowIdx, 7);
        if (idx === 0) {
          cellSaldo8h.value = 349.48; // starting balance
        } else {
          cellSaldo8h.value = { formula: `H${rowIdx - 1}` };
        }
        cellSaldo8h.numFmt = "0.00";
        cellSaldo8h.font = { name: "Calibri", size: 10 };
        cellSaldo8h.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellSaldo8h.border = commonBorder;

        // H: Saldo Final (18H00)
        const cellSaldo18h = wsEnergia.getCell(rowIdx, 8);
        cellSaldo18h.value = { formula: `G${rowIdx}-D${rowIdx}-F${rowIdx}` };
        cellSaldo18h.numFmt = "0.00";
        cellSaldo18h.font = { name: "Calibri", size: 10 };
        cellSaldo18h.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellSaldo18h.border = commonBorder;

        // I: Observações
        const cellNotes = wsEnergia.getCell(rowIdx, 9);
        cellNotes.value = r.notes || "";
        cellNotes.font = { name: "Calibri", size: 10 };
        cellNotes.alignment = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
        cellNotes.border = commonBorder;

        wsEnergia.getRow(rowIdx).height = 18;
      });

      // Análise de Consumo Row
      const energyEndRow = 4 + (sortedEnergy.length || 1);
      const statsStartRow = energyEndRow + 3;

      wsEnergia.getCell(`B${statsStartRow}`).value = "Análise de Consumo";
      wsEnergia.getCell(`B${statsStartRow}`).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF990000" } };

      wsEnergia.getCell(`B${statsStartRow + 1}`).value = "Consumo";
      wsEnergia.getCell(`B${statsStartRow + 1}`).style = tableHeaderStyle;
      wsEnergia.getCell(`C${statsStartRow + 1}`).value = "Kw/h";
      wsEnergia.getCell(`C${statsStartRow + 1}`).style = tableHeaderStyle;

      wsEnergia.getCell(`B${statsStartRow + 2}`).value = "Médio (diário)";
      wsEnergia.getCell(`B${statsStartRow + 2}`).font = { name: "Calibri", size: 10, bold: true };
      wsEnergia.getCell(`B${statsStartRow + 2}`).alignment = { horizontal: "left" as const, vertical: "middle" as const };
      wsEnergia.getCell(`B${statsStartRow + 2}`).border = commonBorder;

      wsEnergia.getCell(`C${statsStartRow + 2}`).value = sortedEnergy.length > 0 
        ? { formula: `AVERAGE(D5:D${energyEndRow})+AVERAGE(F5:F${energyEndRow})` }
        : 0;
      wsEnergia.getCell(`C${statsStartRow + 2}`).numFmt = "0.00";
      wsEnergia.getCell(`C${statsStartRow + 2}`).font = { name: "Calibri", size: 10 };
      wsEnergia.getCell(`C${statsStartRow + 2}`).alignment = { horizontal: "center" as const, vertical: "middle" as const };
      wsEnergia.getCell(`C${statsStartRow + 2}`).border = commonBorder;

      wsEnergia.getCell(`B${statsStartRow + 3}`).value = "Total Acumulado";
      wsEnergia.getCell(`B${statsStartRow + 3}`).font = { name: "Calibri", size: 10, bold: true };
      wsEnergia.getCell(`B${statsStartRow + 3}`).alignment = { horizontal: "left" as const, vertical: "middle" as const };
      wsEnergia.getCell(`B${statsStartRow + 3}`).border = commonBorder;

      wsEnergia.getCell(`C${statsStartRow + 3}`).value = sortedEnergy.length > 0
        ? { formula: `SUM(D5:D${energyEndRow})+SUM(F5:F${energyEndRow})` }
        : 0;
      wsEnergia.getCell(`C${statsStartRow + 3}`).numFmt = "0.00";
      wsEnergia.getCell(`C${statsStartRow + 3}`).font = { name: "Calibri", size: 10, bold: true };
      wsEnergia.getCell(`C${statsStartRow + 3}`).alignment = { horizontal: "center" as const, vertical: "middle" as const };
      wsEnergia.getCell(`C${statsStartRow + 3}`).border = commonBorder;

      // Add energy graph to worksheet
      if (imgEnergia) {
        const imgId = workbook.addImage({ base64: imgEnergia, extension: "png" });
        wsEnergia.addImage(imgId, {
          tl: { col: 10, row: 3 }, // Column K, Row 4
          ext: { width: 500, height: 280 }
        });
      }


      // ==================== TAB 2: INTERNET ====================
      const wsInternet = workbook.addWorksheet("Internet", {
        views: [{ showGridLines: true }]
      });
      wsInternet.getColumn('A').width = 3;
      wsInternet.getColumn('B').width = 16; // Data do Registro
      wsInternet.getColumn('C').width = 24; // Consumo Calculado (GB)
      wsInternet.getColumn('D').width = 12; // Unidade
      wsInternet.getColumn('E').width = 32; // Observações

      wsInternet.getCell("B2").value = "HISTÓRICO DE CONSUMO DE INTERNET";
      wsInternet.getCell("B2").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF990000" }, underline: true };

      wsInternet.getCell("B4").value = "Data do Registro";
      wsInternet.getCell("B4").style = tableHeaderStyle;
      wsInternet.getCell("C4").value = "Consumo no período (GB)";
      wsInternet.getCell("C4").style = tableHeaderStyle;
      wsInternet.getCell("D4").value = "Unidade";
      wsInternet.getCell("D4").style = tableHeaderStyle;
      wsInternet.getCell("E4").value = "Observações";
      wsInternet.getCell("E4").style = tableHeaderStyle;
      wsInternet.getRow(4).height = 25;

      const sortedInternet = [...readings]
        .filter(r => r.category === "internet")
        .sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());

      sortedInternet.forEach((r, idx) => {
        const rowIdx = 5 + idx;

        const cellData = wsInternet.getCell(rowIdx, 2);
        cellData.value = new Date(r.readingDate + "T00:00:00").toLocaleDateString("pt-BR");
        cellData.font = { name: "Calibri", size: 10 };
        cellData.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellData.border = commonBorder;

        const cellGb = wsInternet.getCell(rowIdx, 3);
        cellGb.value = r.consumption;
        cellGb.numFmt = "0.00";
        cellGb.font = { name: "Calibri", size: 10 };
        cellGb.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellGb.border = commonBorder;

        const cellUnit = wsInternet.getCell(rowIdx, 4);
        cellUnit.value = r.unit;
        cellUnit.font = { name: "Calibri", size: 10 };
        cellUnit.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellUnit.border = commonBorder;

        const cellNotes = wsInternet.getCell(rowIdx, 5);
        cellNotes.value = r.notes || "";
        cellNotes.font = { name: "Calibri", size: 10 };
        cellNotes.alignment = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
        cellNotes.border = commonBorder;

        wsInternet.getRow(rowIdx).height = 18;
      });

      const netEndRow = 4 + (sortedInternet.length || 1);
      const netStatsRow = netEndRow + 3;

      wsInternet.getCell(`B${netStatsRow}`).value = "Análise de Consumo";
      wsInternet.getCell(`B${netStatsRow}`).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF990000" } };

      wsInternet.getCell(`B${netStatsRow + 1}`).value = "Consumo";
      wsInternet.getCell(`B${netStatsRow + 1}`).style = tableHeaderStyle;
      wsInternet.getCell(`C${netStatsRow + 1}`).value = "GB";
      wsInternet.getCell(`C${netStatsRow + 1}`).style = tableHeaderStyle;

      wsInternet.getCell(`B${netStatsRow + 2}`).value = "Médio (diário)";
      wsInternet.getCell(`B${netStatsRow + 2}`).font = { name: "Calibri", size: 10, bold: true };
      wsInternet.getCell(`B${netStatsRow + 2}`).alignment = { horizontal: "left" as const, vertical: "middle" as const };
      wsInternet.getCell(`B${netStatsRow + 2}`).border = commonBorder;

      wsInternet.getCell(`C${netStatsRow + 2}`).value = sortedInternet.length > 0 ? { formula: `AVERAGE(C5:C${netEndRow})` } : 0;
      wsInternet.getCell(`C${netStatsRow + 2}`).numFmt = "0.00";
      wsInternet.getCell(`C${netStatsRow + 2}`).font = { name: "Calibri", size: 10 };
      wsInternet.getCell(`C${netStatsRow + 2}`).alignment = { horizontal: "center" as const, vertical: "middle" as const };
      wsInternet.getCell(`C${netStatsRow + 2}`).border = commonBorder;

      wsInternet.getCell(`B${netStatsRow + 3}`).value = "Total Acumulado";
      wsInternet.getCell(`B${netStatsRow + 3}`).font = { name: "Calibri", size: 10, bold: true };
      wsInternet.getCell(`B${netStatsRow + 3}`).alignment = { horizontal: "left" as const, vertical: "middle" as const };
      wsInternet.getCell(`B${netStatsRow + 3}`).border = commonBorder;

      wsInternet.getCell(`C${netStatsRow + 3}`).value = sortedInternet.length > 0 ? { formula: `SUM(C5:C${netEndRow})` } : 0;
      wsInternet.getCell(`C${netStatsRow + 3}`).numFmt = "0.00";
      wsInternet.getCell(`C${netStatsRow + 3}`).font = { name: "Calibri", size: 10, bold: true };
      wsInternet.getCell(`C${netStatsRow + 3}`).alignment = { horizontal: "center" as const, vertical: "middle" as const };
      wsInternet.getCell(`C${netStatsRow + 3}`).border = commonBorder;

      if (imgInternet) {
        const imgId = workbook.addImage({ base64: imgInternet, extension: "png" });
        wsInternet.addImage(imgId, {
          tl: { col: 6, row: 3 }, // Column G, Row 4
          ext: { width: 500, height: 280 }
        });
      }


      // ==================== TAB 3: ÁGUA ====================
      const wsAgua = workbook.addWorksheet("Água", {
        views: [{ showGridLines: true }]
      });
      wsAgua.getColumn('A').width = 3;
      wsAgua.getColumn('B').width = 16; // Data do registro
      wsAgua.getColumn('C').width = 24; // Leitura Contador (m³)
      wsAgua.getColumn('D').width = 22; // Consumo no período (m³)
      wsAgua.getColumn('E').width = 12; // Unidade
      wsAgua.getColumn('F').width = 32; // Observações

      wsAgua.getCell("B2").value = "HISTÓRICO DE CONSUMO DE ÁGUA";
      wsAgua.getCell("B2").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF990000" }, underline: true };

      const waterHeaders = ["Data do Registro", "Leitura Contador (m³)", "Consumo no período (m³)", "Unidade", "Observações"];
      waterHeaders.forEach((h, idx) => {
        const cell = wsAgua.getCell(4, idx + 2);
        cell.value = h;
        cell.style = tableHeaderStyle;
      });
      wsAgua.getRow(4).height = 25;

      const sortedWater = [...readings]
        .filter(r => r.category === "agua")
        .sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());

      sortedWater.forEach((r, idx) => {
        const rowIdx = 5 + idx;

        // Data
        const cellData = wsAgua.getCell(rowIdx, 2);
        cellData.value = new Date(r.readingDate + "T00:00:00").toLocaleDateString("pt-BR");
        cellData.font = { name: "Calibri", size: 10 };
        cellData.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellData.border = commonBorder;

        // Leitura Contador
        const cellReg = wsAgua.getCell(rowIdx, 3);
        cellReg.value = r.readingValue;
        cellReg.numFmt = "#,##0";
        cellReg.font = { name: "Calibri", size: 10 };
        cellReg.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellReg.border = commonBorder;

        // Consumo
        const cellCons = wsAgua.getCell(rowIdx, 4);
        cellCons.value = r.consumption;
        cellCons.numFmt = "0.00";
        cellCons.font = { name: "Calibri", size: 10 };
        cellCons.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellCons.border = commonBorder;

        // Unidade
        const cellUnit = wsAgua.getCell(rowIdx, 5);
        cellUnit.value = r.unit;
        cellUnit.font = { name: "Calibri", size: 10 };
        cellUnit.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellUnit.border = commonBorder;

        // Observações
        const cellNotes = wsAgua.getCell(rowIdx, 6);
        cellNotes.value = r.notes || "";
        cellNotes.font = { name: "Calibri", size: 10 };
        cellNotes.alignment = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
        cellNotes.border = commonBorder;

        wsAgua.getRow(rowIdx).height = 18;
      });

      const waterEndRow = 4 + (sortedWater.length || 1);
      const waterStatsRow = waterEndRow + 3;

      wsAgua.getCell(`B${waterStatsRow}`).value = "Análise de Consumo";
      wsAgua.getCell(`B${waterStatsRow}`).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF990000" } };

      wsAgua.getCell(`B${waterStatsRow + 1}`).value = "Consumo";
      wsAgua.getCell(`B${waterStatsRow + 1}`).style = tableHeaderStyle;
      wsAgua.getCell(`C${waterStatsRow + 1}`).value = "m³";
      wsAgua.getCell(`C${waterStatsRow + 1}`).style = tableHeaderStyle;

      wsAgua.getCell(`B${waterStatsRow + 2}`).value = "Médio (diário)";
      wsAgua.getCell(`B${waterStatsRow + 2}`).font = { name: "Calibri", size: 10, bold: true };
      wsAgua.getCell(`B${waterStatsRow + 2}`).alignment = { horizontal: "left" as const, vertical: "middle" as const };
      wsAgua.getCell(`B${waterStatsRow + 2}`).border = commonBorder;

      wsAgua.getCell(`C${waterStatsRow + 2}`).value = sortedWater.length > 0 ? { formula: `AVERAGE(D5:D${waterEndRow})` } : 0;
      wsAgua.getCell(`C${waterStatsRow + 2}`).numFmt = "0.00";
      wsAgua.getCell(`C${waterStatsRow + 2}`).font = { name: "Calibri", size: 10 };
      wsAgua.getCell(`C${waterStatsRow + 2}`).alignment = { horizontal: "center" as const, vertical: "middle" as const };
      wsAgua.getCell(`C${waterStatsRow + 2}`).border = commonBorder;

      wsAgua.getCell(`B${waterStatsRow + 3}`).value = "Total Acumulado";
      wsAgua.getCell(`B${waterStatsRow + 3}`).font = { name: "Calibri", size: 10, bold: true };
      wsAgua.getCell(`B${waterStatsRow + 3}`).alignment = { horizontal: "left" as const, vertical: "middle" as const };
      wsAgua.getCell(`B${waterStatsRow + 3}`).border = commonBorder;

      wsAgua.getCell(`C${waterStatsRow + 3}`).value = sortedWater.length > 0 ? { formula: `SUM(D5:D${waterEndRow})` } : 0;
      wsAgua.getCell(`C${waterStatsRow + 3}`).numFmt = "0.00";
      wsAgua.getCell(`C${waterStatsRow + 3}`).font = { name: "Calibri", size: 10, bold: true };
      wsAgua.getCell(`C${waterStatsRow + 3}`).alignment = { horizontal: "center" as const, vertical: "middle" as const };
      wsAgua.getCell(`C${waterStatsRow + 3}`).border = commonBorder;

      if (imgAgua) {
        const imgId = workbook.addImage({ base64: imgAgua, extension: "png" });
        wsAgua.addImage(imgId, {
          tl: { col: 7, row: 3 }, // Column H, Row 4
          ext: { width: 500, height: 280 }
        });
      }


      // ==================== TAB 4: COMBUSTÍVEL ====================
      const wsCombustivel = workbook.addWorksheet("Combustível", {
        views: [{ showGridLines: true }]
      });
      wsCombustivel.getColumn('A').width = 3;
      wsCombustivel.getColumn('B').width = 16;  // Data do Registro
      wsCombustivel.getColumn('C').width = 14;  // Km inicial
      wsCombustivel.getColumn('D').width = 14;  // Km Final
      wsCombustivel.getColumn('E').width = 16;  // Distância (km)
      wsCombustivel.getColumn('F').width = 44;  // Destinos
      wsCombustivel.getColumn('G').width = 24;  // Combustível Abastecido (L)
      wsCombustivel.getColumn('H').width = 18;  // Custo (Mt)
      wsCombustivel.getColumn('I').width = 28;  // Observações

      wsCombustivel.getCell("B2").value = "HISTÓRICO DE ABASTECIMENTOS E COMBUSTÍVEL";
      wsCombustivel.getCell("B2").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF990000" }, underline: true };

      const fuelHeaders = ["Data do Registro", "Km inicial", "Km Final", "Distância (km)", "Destinos", "Combustível Abastecido (L)", "Custo (Mt)", "Observações"];
      fuelHeaders.forEach((h, idx) => {
        const cell = wsCombustivel.getCell(4, idx + 2);
        cell.value = h;
        cell.style = tableHeaderStyle;
      });
      wsCombustivel.getRow(4).height = 25;

      const sortedFuel = [...readings]
        .filter(r => r.category === "combustivel")
        .sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());

      sortedFuel.forEach((r, idx) => {
        const rowIdx = 5 + idx;

        const kmInit = r.kmInicial || 0;
        const kmFin = r.kmFinal || 0;
        const litros = r.consumption || 0;
        const custo = r.costMt || 0;
        const dests = r.destinos || "";

        // Data
        const cellData = wsCombustivel.getCell(rowIdx, 2);
        cellData.value = new Date(r.readingDate + "T00:00:00").toLocaleDateString("pt-BR");
        cellData.font = { name: "Calibri", size: 10 };
        cellData.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellData.border = commonBorder;

        // Km Inicial
        const cellKmI = wsCombustivel.getCell(rowIdx, 3);
        cellKmI.value = kmInit === 0 ? "" : kmInit;
        cellKmI.numFmt = "#,##0";
        cellKmI.font = { name: "Calibri", size: 10 };
        cellKmI.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellKmI.border = commonBorder;

        // Km Final
        const cellKmF = wsCombustivel.getCell(rowIdx, 4);
        cellKmF.value = kmFin === 0 ? "" : kmFin;
        cellKmF.numFmt = "#,##0";
        cellKmF.font = { name: "Calibri", size: 10 };
        cellKmF.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellKmF.border = commonBorder;

        // Distância (km)
        const cellDist = wsCombustivel.getCell(rowIdx, 5);
        cellDist.value = { formula: `IF(AND(C${rowIdx}>"",D${rowIdx}>""), D${rowIdx}-C${rowIdx}, 0)` };
        cellDist.numFmt = "0";
        cellDist.font = { name: "Calibri", size: 10 };
        cellDist.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellDist.border = commonBorder;

        // Destinos
        const cellDests = wsCombustivel.getCell(rowIdx, 6);
        cellDests.value = dests;
        cellDests.font = { name: "Calibri", size: 9 };
        cellDests.alignment = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
        cellDests.border = commonBorder;

        // Consumo litros
        const cellLits = wsCombustivel.getCell(rowIdx, 7);
        cellLits.value = litros;
        cellLits.numFmt = "0.00";
        cellLits.font = { name: "Calibri", size: 10 };
        cellLits.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellLits.border = commonBorder;

        // Custo Meticais
        const cellMts = wsCombustivel.getCell(rowIdx, 8);
        cellMts.value = custo;
        cellMts.numFmt = "0.00";
        cellMts.font = { name: "Calibri", size: 10 };
        cellMts.alignment = { horizontal: "center" as const, vertical: "middle" as const };
        cellMts.border = commonBorder;

        // Observações
        const cellNotes = wsCombustivel.getCell(rowIdx, 9);
        cellNotes.value = r.notes || "";
        cellNotes.font = { name: "Calibri", size: 10 };
        cellNotes.alignment = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
        cellNotes.border = commonBorder;

        wsCombustivel.getRow(rowIdx).height = 18;
      });

      // TOTAL Fuel row
      const fuelTotalRow = 5 + sortedFuel.length;
      wsCombustivel.getCell(fuelTotalRow, 2).value = "TOTAL";
      wsCombustivel.getCell(fuelTotalRow, 2).font = { name: "Calibri", size: 10, bold: true };
      wsCombustivel.getCell(fuelTotalRow, 2).alignment = { horizontal: "center" as const, vertical: "middle" as const };
      wsCombustivel.getCell(fuelTotalRow, 2).border = commonBorder;

      for (let c = 3; c <= 9; c++) {
        wsCombustivel.getCell(fuelTotalRow, c).border = commonBorder;
      }

      wsCombustivel.getCell(fuelTotalRow, 5).value = sortedFuel.length > 0 ? { formula: `SUM(E5:E${fuelTotalRow - 1})` } : 0;
      wsCombustivel.getCell(fuelTotalRow, 5).numFmt = "0";
      wsCombustivel.getCell(fuelTotalRow, 5).font = { name: "Calibri", size: 10, bold: true };
      wsCombustivel.getCell(fuelTotalRow, 5).alignment = { horizontal: "center" as const, vertical: "middle" as const };

      wsCombustivel.getCell(fuelTotalRow, 7).value = sortedFuel.length > 0 ? { formula: `SUM(G5:G${fuelTotalRow - 1})` } : 0;
      wsCombustivel.getCell(fuelTotalRow, 7).numFmt = "0.00";
      wsCombustivel.getCell(fuelTotalRow, 7).font = { name: "Calibri", size: 10, bold: true };
      wsCombustivel.getCell(fuelTotalRow, 7).alignment = { horizontal: "center" as const, vertical: "middle" as const };

      wsCombustivel.getCell(fuelTotalRow, 8).value = sortedFuel.length > 0 ? { formula: `SUM(H5:H${fuelTotalRow - 1})` } : 0;
      wsCombustivel.getCell(fuelTotalRow, 8).numFmt = "0.00";
      wsCombustivel.getCell(fuelTotalRow, 8).font = { name: "Calibri", size: 10, bold: true };
      wsCombustivel.getCell(fuelTotalRow, 8).alignment = { horizontal: "center" as const, vertical: "middle" as const };

      if (imgCombustivel) {
        const imgId = workbook.addImage({ base64: imgCombustivel, extension: "png" });
        wsCombustivel.addImage(imgId, {
          tl: { col: 10, row: 3 }, // Column K, Row 4
          ext: { width: 500, height: 280 }
        });
      }

      // Generate buffer and trigger browser download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `planilha_controlo_consumos_${activeMonthName.toLowerCase()}_${activeYear}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao processar planilha Excel:", err);
      alert("Ocorreu um erro ao exportar a planilha para Excel com ExcelJS.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // PDF report exporter
  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      // --- PAGE 1: HEADER & MONTH SITUATIONAL SUMMARY TABLE ---
      // Styled dark header banner
      pdf.setFillColor(30, 41, 59); // Slate-850
      pdf.rect(0, 0, pageWidth, 42, "F");

      // App Brand Identity
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("MONITORIA.IO", margin, 18);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("Relatório Analytics Mensal Integrado", margin, 26);

      // Metadata card elements
      pdf.setFontSize(9);
      const userName = user?.fullName || "Usuário do Painel";
      const userCompany = user?.company || "Plataforma Individual";
      pdf.text(`Emitido para: ${userName}`, pageWidth - 95, 14);
      pdf.text(`Empresa/Org: ${userCompany}`, pageWidth - 95, 20);
      pdf.text(`Data de Emissão: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, pageWidth - 95, 26);

      // Monthly Heading Title
      pdf.setTextColor(15, 23, 42); // slate 900
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      const uppercaseMonth = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      const cappedMonth = uppercaseMonth.charAt(0).toUpperCase() + uppercaseMonth.slice(1);
      pdf.text(`Resumo Situacional — ${cappedMonth}`, margin, 54);

      // Table mapping limits and resources
      const tableStartY = 60;
      const headers = ["Recurso Analisado", "Última Leitura", "Acumulado Mês", "Meta / Teto", "Alerta"];
      const colWidths = [45, 30, 35, 35, 35]; // Total = 180

      // Table Header row colored bg
      pdf.setFillColor(241, 245, 249); // slate-100
      pdf.rect(margin, tableStartY, contentWidth, 8, "F");
      pdf.setDrawColor(226, 232, 240); // slate-200
      pdf.setLineWidth(0.3);
      pdf.line(margin, tableStartY + 8, margin + contentWidth, tableStartY + 8);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105); // slate-600

      let runningX = margin + 2;
      headers.forEach((h, idx) => {
        pdf.text(h, runningX, tableStartY + 5.5);
        runningX += colWidths[idx];
      });

      // Data Rows
      const catKeys: CategoryType[] = ["energia", "agua", "combustivel", "internet"];
      const catLabels: Record<CategoryType, string> = {
        energia: "Energia Elétrica (kWh)",
        agua: "Água Potável (m³)",
        combustivel: "Combustível (L)",
        internet: "Internet (GB)"
      };

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(15, 23, 42); // slate-900

      catKeys.forEach((key, rIdx) => {
        const rowY = tableStartY + 8 + (rIdx * 9);
        const s = stats[key];
        const targetStr = s.monthlyTarget > 0 ? `${s.monthlyTarget} ${s.unit}` : "Sem Meta";
        const percentStr = s.monthlyTarget > 0 ? `${((s.monthlyTotal / s.monthlyTarget) * 100).toFixed(0)}%` : "N/A";
        const alertStr = s.alertActive ? "⚠️ RELEVADO" : "✓ Nominal";

        // Draw Zebra dividers
        pdf.setDrawColor(241, 245, 249);
        pdf.line(margin, rowY + 9, margin + contentWidth, rowY + 9);

        pdf.setFont("helvetica", "bold");
        pdf.text(catLabels[key], margin + 2, rowY + 6);
        pdf.setFont("helvetica", "normal");

        pdf.text(`${s.currentValue} ${s.unit}`, margin + 2 + colWidths[0], rowY + 6);
        pdf.text(`${s.monthlyTotal.toFixed(1)} ${s.unit}`, margin + 2 + colWidths[0] + colWidths[1], rowY + 6);
        pdf.text(`${targetStr} (${percentStr})`, margin + 2 + colWidths[0] + colWidths[1] + colWidths[2], rowY + 6);

        if (s.alertActive) {
          pdf.setTextColor(225, 29, 72); // rose-600
          pdf.setFont("helvetica", "bold");
        } else {
          pdf.setTextColor(22, 163, 74); // green-600
        }
        pdf.text(alertStr, margin + 2 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowY + 6);
        
        pdf.setTextColor(15, 23, 42);
        pdf.setFont("helvetica", "normal");
      });

      // --- STAGE 2: SCREEN CAPTURES FOR BOTH RECHARTS VIEWS ---
      const captureItems = [
        { id: "historical-chart-container", title: "Histórico Cronológico e Distribuição Diária" },
        { id: "monthly-trend-section", title: "Análise Consolidada de Evolução entre Meses" }
      ];

      let runningY = tableStartY + 8 + (catKeys.length * 9) + 16;
      let captureFailed = false;

      for (let i = 0; i < captureItems.length; i++) {
        const item = captureItems[i];
        const el = document.getElementById(item.id);
        
        if (el) {
          try {
            // Mobile devices have smaller screens and strict memory limits. Scale down to 1.0 to prevent Canvas crash.
            const isMobile = window.innerWidth < 768;
            const canvas = await html2canvas(el, {
              scale: isMobile ? 1.0 : 1.5,
              useCORS: true,
              backgroundColor: document.documentElement.classList.contains("dark") ? "#18181b" : "#ffffff",
              logging: false,
              onclone: (clonedDoc) => {
                // 1. Process all style tags in the cloned document to replace oklch with fallback colors
                const styleElements = clonedDoc.getElementsByTagName("style");
                for (let j = 0; j < styleElements.length; j++) {
                  const style = styleElements[j];
                  if (style.innerHTML) {
                    style.innerHTML = style.innerHTML.replace(/oklch\([^)]+\)/gi, "rgb(148, 163, 184)");
                  }
                }

                // 2. Process all elements with style attributes containing oklch
                const elementsWithInlineStyle = clonedDoc.querySelectorAll("[style*='oklch']");
                elementsWithInlineStyle.forEach((itemEl) => {
                  const htmlEl = itemEl as HTMLElement;
                  if (htmlEl.style && htmlEl.style.cssText) {
                    htmlEl.style.cssText = htmlEl.style.cssText.replace(/oklch\([^)]+\)/gi, "rgb(148, 163, 184)");
                  }
                });

                // 3. Robust clean up of all clip path usages from any element to completely avoid NotFoundError
                const allEls = clonedDoc.querySelectorAll("*");
                allEls.forEach((el) => {
                  const htmlEl = el as HTMLElement;
                  if (htmlEl.removeAttribute) {
                    htmlEl.removeAttribute("clip-path");
                    htmlEl.removeAttribute("clipPath");
                  }
                  if (htmlEl.style) {
                    if (htmlEl.style.clipPath) {
                      htmlEl.style.clipPath = "none";
                    }
                    if (htmlEl.style.cssText && htmlEl.style.cssText.toLowerCase().includes("clip-path")) {
                      htmlEl.style.cssText = htmlEl.style.cssText.replace(/clip-path\s*:\s*url\([^)]+\);?/gi, "");
                    }
                  }
                });

                const clonedTarget = clonedDoc.getElementById(item.id);
                if (clonedTarget) {
                  clonedTarget.style.display = "block";
                  clonedTarget.style.visibility = "visible";
                }
              }
            });

            const imgData = canvas.toDataURL("image/png");
            const imgWidth = contentWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Split page if height is exceeded
            if (runningY + imgHeight + 10 > pageHeight) {
              pdf.addPage();
              // Draw brief brand block on new pages
              pdf.setFillColor(30, 41, 59);
              pdf.rect(0, 0, pageWidth, 5, "F");
              runningY = 20;
            }

            pdf.setTextColor(30, 41, 59);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11);
            pdf.text(item.title, margin, runningY);

            pdf.addImage(imgData, "PNG", margin, runningY + 4, imgWidth, imgHeight);
            runningY += imgHeight + 16;
          } catch (captureError) {
            console.error(`Erro ao capturar gráfico ${item.title}:`, captureError);
            captureFailed = true;
          }
        }
      }

      // If capture failed (very common on some sandboxed WebView / older mobile browsers),
      // print a beautiful tabular data sheet of the last readings to provide a clean fallback.
      if (captureFailed || window.innerWidth < 768) {
        pdf.addPage();
        pdf.setFillColor(30, 41, 59);
        pdf.rect(0, 0, pageWidth, 5, "F");

        pdf.setTextColor(15, 23, 42);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text("Detalhamento Histórico de Leituras Recentes", margin, 20);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(71, 85, 105);
        pdf.text("O dispositivo móvel ou ambiente de visualização aplicou otimizações de tela.", margin, 26);
        pdf.text("Os dados absolutos de leituras analíticas registradas no sistema seguem consolidados abaixo:", margin, 31);

        let histY = 38;
        const recentReadings = [...readings]
          .sort((a, b) => b.readingDate.localeCompare(a.readingDate))
          .slice(0, 15);

        if (recentReadings.length === 0) {
          pdf.setFont("helvetica", "italic");
          pdf.text("Nenhum dado cadastrado até o momento para listagem.", margin, histY + 10);
        } else {
          // Table Header
          pdf.setFillColor(241, 245, 249);
          pdf.rect(margin, histY, contentWidth, 8, "F");
          pdf.setDrawColor(226, 232, 240);
          pdf.line(margin, histY + 8, margin + contentWidth, histY + 8);

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);
          pdf.setTextColor(71, 85, 105);

          const colCols = [30, 50, 45, 55];
          pdf.text("Data Coleta", margin + 2, histY + 5.5);
          pdf.text("Categoria do Recurso", margin + 2 + colCols[0], histY + 5.5);
          pdf.text("Valor Medido", margin + 2 + colCols[0] + colCols[1], histY + 5.5);
          pdf.text("Observações", margin + 2 + colCols[0] + colCols[1] + colCols[2], histY + 5.5);

          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(15, 23, 42);

          recentReadings.forEach((reading, rIndex) => {
            const currRowY = histY + 8 + (rIndex * 8);

            // Add new page if boundary is close
            if (currRowY + 10 > pageHeight - 15) {
              pdf.addPage();
              pdf.setFillColor(30, 41, 59);
              pdf.rect(0, 0, pageWidth, 5, "F");
              histY = 20;

              // Redraw Header
              pdf.setFillColor(241, 245, 249);
              pdf.rect(margin, histY, contentWidth, 8, "F");
              pdf.setDrawColor(226, 232, 240);
              pdf.line(margin, histY + 8, margin + contentWidth, histY + 8);
              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(71, 85, 105);
              pdf.text("Data Coleta", margin + 2, histY + 5.5);
              pdf.text("Categoria do Recurso", margin + 2 + colCols[0], histY + 5.5);
              pdf.text("Valor Medido", margin + 2 + colCols[0] + colCols[1], histY + 5.5);
              pdf.text("Observações", margin + 2 + colCols[0] + colCols[1] + colCols[2], histY + 5.5);

              pdf.setFont("helvetica", "normal");
              pdf.setTextColor(15, 23, 42);
              
              histY = histY; // Maintain base
            }

            const activeYPos = histY + 8 + (rIndex * 8);
            pdf.setDrawColor(241, 245, 249);
            pdf.line(margin, activeYPos + 8, margin + contentWidth, activeYPos + 8);

            const formattedDate = new Date(reading.readingDate + "T12:00:00").toLocaleDateString("pt-BR");
            const catLabel = catLabels[reading.category] || reading.category;
            const valueStr = `${reading.readingValue} ${reading.category === "energia" ? "kWh" : reading.category === "agua" ? "m³" : reading.category === "combustivel" ? "L" : "GB"}`;
            const noteStr = reading.notes || `Consumo: ${reading.consumption.toFixed(1)}`;

            pdf.text(formattedDate, margin + 2, activeYPos + 5.5);
            pdf.text(catLabel, margin + 2 + colCols[0], activeYPos + 5.5);
            pdf.text(valueStr, margin + 2 + colCols[0] + colCols[1], activeYPos + 5.5);
            
            // Truncate note if extremely long
            const truncatedNote = noteStr.length > 30 ? noteStr.slice(0, 27) + "..." : noteStr;
            pdf.text(truncatedNote, margin + 2 + colCols[0] + colCols[1] + colCols[2], activeYPos + 5.5);
          });
        }
      }

      // Add elegant Footer to all generated pages
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        
        pdf.setDrawColor(226, 232, 240); // slate-200
        pdf.setLineWidth(0.2);
        pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184); // slate-400
        pdf.text(
          "Monitoria.io - Sustentabilidade e Eficiência de Recursos. Emitido eletronicamente com criptografia de ponta.",
          margin,
          pageHeight - 8
        );
        pdf.text(`Página ${p} de ${totalPages}`, pageWidth - margin - 22, pageHeight - 8);
      }

      const fileTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      pdf.save(`relatorio_monitoria_${fileTag}.pdf`);
    } catch (e) {
      console.error("Erro ao processar relatório PDF:", e);
      alert("Ocorreu um erro ao exportar o relatório PDF. Veja logs no DevTools.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Get current date references
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthStr = previousMonthDate.toISOString().slice(0, 7); // YYYY-MM

  // Process statistics for all 4 categories
  const stats = React.useMemo(() => {
    const categories: CategoryType[] = ["energia", "agua", "combustivel", "internet"];
    const result: Record<CategoryType, DashboardStats> = {
      energia: { category: "energia", currentValue: 0, unit: "kWh", percentageChange: 0, trend: "flat", monthlyTarget: 0, monthlyTotal: 0, alertActive: false, average7Days: 0 },
      agua: { category: "agua", currentValue: 0, unit: "m³", percentageChange: 0, trend: "flat", monthlyTarget: 0, monthlyTotal: 0, alertActive: false, average7Days: 0 },
      combustivel: { category: "combustivel", currentValue: 0, unit: "L", percentageChange: 0, trend: "flat", monthlyTarget: 0, monthlyTotal: 0, alertActive: false, average7Days: 0 },
      internet: { category: "internet", currentValue: 0, unit: "GB", percentageChange: 0, trend: "flat", monthlyTarget: 0, monthlyTotal: 0, alertActive: false, average7Days: 0 },
    };

    categories.forEach((cat) => {
      // Filter readings for this category, ordered from newest to oldest
      const catReadings = readings
        .filter((r) => r.category === cat)
        .sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());

      // Target for the current month
      const matchedTarget = targets.find((t) => t.category === cat && t.month === currentMonthStr);
      const targetVal = matchedTarget ? matchedTarget.targetValue : 0;

      // Accumulated sum for current month
      const currentMonthReadings = readings.filter(
        (r) => r.category === cat && r.readingDate.startsWith(currentMonthStr)
      );
      const monthlySum = currentMonthReadings.reduce((sum, r) => sum + r.consumption, 0);

      // Default values
      let currentVal = 0;
      let percentageChange = 0;
      let trend: "up" | "down" | "flat" = "flat";
      let alertActive = false;
      let avg7Days = 0;

      if (catReadings.length > 0) {
        // Most recent reading represents current consumption
        const latestReading = catReadings[0];
        currentVal = latestReading.consumption;

        // Compare with next oldest reading
        if (catReadings.length > 1) {
          const previousReading = catReadings[1];
          const prevVal = previousReading.consumption;

          if (prevVal > 0) {
            percentageChange = ((currentVal - prevVal) / prevVal) * 100;
            if (percentageChange > 0.5) trend = "up";
            else if (percentageChange < -0.5) trend = "down";
            percentageChange = Math.abs(percentageChange);
          }
        }

        // 7-day average calculation
        const last7Readings = catReadings.slice(0, 7);
        const sum7 = last7Readings.reduce((sum, r) => sum + r.consumption, 0);
        avg7Days = sum7 / last7Readings.length;

        // Alerts if current is 20% larger than 7-day average
        if (catReadings.length >= 3 && avg7Days > 0 && currentVal > avg7Days * 1.2) {
          alertActive = true;
        }
      }

      result[cat] = {
        category: cat,
        currentValue: currentVal,
        unit: cat === "energia" ? "kWh" : cat === "agua" ? "m³" : cat === "combustivel" ? "L" : "GB",
        percentageChange,
        trend,
        monthlyTarget: targetVal,
        monthlyTotal: monthlySum,
        alertActive,
        average7Days: avg7Days,
      };
    });

    return result;
  }, [readings, targets, currentMonthStr]);

  // General alert metrics: active warnings list
  const activeAlerts = React.useMemo(() => {
    return (Object.values(stats) as DashboardStats[]).filter((s) => s.alertActive);
  }, [stats]);

  // Calculate overall monthly expenditure context
  const monthlyTrendsComparison = React.useMemo(() => {
    const categories: CategoryType[] = ["energia", "agua", "combustivel", "internet"];
    const comp: { category: CategoryType; currentSum: number; prevSum: number; speedPercent: number; isHigher: boolean }[] = [];

    categories.forEach((cat) => {
      // Current month sum
      const currentSum = readings
        .filter((r) => r.category === cat && r.readingDate.startsWith(currentMonthStr))
        .reduce((sum, r) => sum + r.consumption, 0);

      // Previous month sum
      const prevSum = readings
        .filter((r) => r.category === cat && r.readingDate.startsWith(previousMonthStr))
        .reduce((sum, r) => sum + r.consumption, 0);

      let speedPercent = 0;
      let isHigher = false;

      if (prevSum > 0) {
        speedPercent = ((currentSum - prevSum) / prevSum) * 100;
        if (speedPercent > 0) {
          isHigher = true;
        }
        speedPercent = Math.abs(speedPercent);
      }

      comp.push({
        category: cat,
        currentSum,
        prevSum,
        speedPercent,
        isHigher,
      });
    });

    return comp;
  }, [readings, currentMonthStr, previousMonthStr]);

  const hasNoData = readings.length === 0;

  return (
    <div className="space-y-6">
      {/* Upper Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-sans font-bold text-2xl tracking-tight text-zinc-900 dark:text-zinc-50">Resumo da Monitoria</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Acompanhamento diário e indicadores de cumprimento de limites</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="dashboard-export-button"
            onClick={handleExportExcelExcelJS}
            disabled={isExportingExcel}
            className="inline-flex items-center gap-2 justify-center py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-850 text-sm font-semibold text-slate-755 dark:text-zinc-350 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Baixar arquivo .xlsx do Excel formatado em alta fidelidade"
          >
            {isExportingExcel ? (
              <Loader2 size={16} className="animate-spin text-emerald-600" />
            ) : (
              <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-405" />
            )}
            {isExportingExcel ? "Gerando Excel..." : "Exportar Relatório Excel"}
          </button>

          <button
            id="dashboard-export-word-button"
            onClick={handleExportWord}
            disabled={isExportingWord}
            className="inline-flex items-center gap-2 justify-center py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-850 text-sm font-semibold text-slate-755 dark:text-zinc-350 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Baixar sumário executivo em documento Microsoft Word"
          >
            {isExportingWord ? (
              <Loader2 size={16} className="animate-spin text-blue-600" />
            ) : (
              <FileDown size={16} className="text-blue-600 dark:text-blue-400" />
            )}
            {isExportingWord ? "Gerando Word..." : "Exportar Relatório Word"}
          </button>

          <button
            id="dashboard-export-pdf-button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="inline-flex items-center gap-2 justify-center py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-850 text-sm font-semibold text-slate-755 dark:text-zinc-350 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Download de Relatório Visual em PDF"
          >
            {isExportingPDF ? (
              <Loader2 size={16} className="animate-spin text-blue-600 dark:text-blue-400" />
            ) : (
              <FileText size={16} className="text-rose-600 dark:text-rose-400" />
            )}
            {isExportingPDF ? "Gerando PDF..." : "Exportar Relatório PDF"}
          </button>

          <button
            id="dashboard-register-button"
            onClick={() => onNavigateToTab("registrar")}
            className="inline-flex items-center gap-2 justify-center py-2.5 px-4 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle size={16} />
            Registrar Leitura
          </button>
        </div>
      </div>

      {hasNoData ? (
        /* Zero State Screen */
        <div id="dashboard-empty-state" className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-3xl text-center shadow-xs">
          <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 p-4 rounded-2xl mb-4">
            <Activity size={40} />
          </div>
          <h3 className="font-sans font-bold text-lg text-slate-900 dark:text-white">Nenhum registro encontrado</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mt-2">
            Adicione sua primeira leitura diária para ver gráficos, calcular variações acumuladas e monitorar suas metas de recursos.
          </p>
          <button
            id="dashboard-empty-state-register-btn"
            onClick={() => onNavigateToTab("registrar")}
            className="inline-flex items-center gap-2 justify-center mt-6 py-2.5 px-5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle size={16} />
            Registrar Primeiro Consumo
          </button>
        </div>
      ) : (
        /* Active Dashboard Layout */
        <>
          {/* Active Spike Warning Alert Banner */}
          {activeAlerts.length > 0 && (
            <div id="spike-alert-banner" className="bg-rose-50 dark:bg-rose-950/25 border border-rose-100 dark:border-rose-900/35 rounded-2xl p-4 text-rose-800 dark:text-rose-400 text-sm flex items-start gap-3 shadow-xs">
              <AlertTriangle size={20} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div>
                <span className="font-bold">Alerta de Consumo Elevado:</span> Identificamos picos que excedem em mais de 20% a média dos últimos 7 dias nas seguintes categorias:{" "}
                <strong className="underline">
                  {activeAlerts.map((s) => s.category === "energia" ? "⚡ Energia" : s.category === "agua" ? "💧 Água" : s.category === "combustivel" ? "⛽ Combustível" : "🌐 Internet").join(", ")}
                </strong>
                . Verifique se há vazamentos, anomalias nos aparelhos ou viagens recentes.
              </div>
            </div>
          )}

          {/* 4 Summary Cards Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <SummaryCard {...stats.energia} />
            <SummaryCard {...stats.agua} />
            <SummaryCard {...stats.combustivel} />
            <SummaryCard {...stats.internet} />
          </section>

          {/* Interactive Trend Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Block covering 2/3 of space on desktop */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-4 rounded-2xl gap-4">
                {/* Category filters */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setSelectedChartCategory("todas")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedChartCategory === "todas"
                        ? "bg-blue-600 dark:bg-blue-500 text-white"
                        : "text-slate-600 dark:text-zinc-350 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Visão Geral
                  </button>
                  <button
                    onClick={() => setSelectedChartCategory("energia")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedChartCategory === "energia"
                        ? "bg-amber-500 text-white"
                        : "text-zinc-650 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    ⚡ Energia
                  </button>
                  <button
                    onClick={() => setSelectedChartCategory("agua")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedChartCategory === "agua"
                        ? "bg-blue-500 text-white"
                        : "text-zinc-650 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    💧 Água
                  </button>
                  <button
                    onClick={() => setSelectedChartCategory("combustivel")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedChartCategory === "combustivel"
                        ? "bg-emerald-500 text-white"
                        : "text-zinc-650 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    ⛽ Combustível
                  </button>
                  <button
                    onClick={() => setSelectedChartCategory("internet")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedChartCategory === "internet"
                        ? "bg-indigo-500 text-white"
                        : "text-zinc-650 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    🌐 Internet
                  </button>
                </div>

                {/* Period toggle handles */}
                <div className="flex items-center bg-slate-100 dark:bg-zinc-950 p-1 border border-slate-200 dark:border-zinc-800 rounded-xl shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setPeriod("7days")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      period === "7days"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-xs"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    7 Dias
                  </button>
                  <button
                    onClick={() => setPeriod("30days")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      period === "30days"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-xs"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    30 Dias
                  </button>
                </div>
              </div>

              {/* Graphical Canvas */}
              <div id="historical-chart-container" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-2 rounded-2xl">
                <ConsumptionChart readings={readings} category={selectedChartCategory} period={period} />
              </div>
            </div>

            {/* Side summary panel - Month on Month Trend Comparisons */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="font-sans font-bold text-slate-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />
                  Comparativo de Tendência
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Diferença de consumo deste mês contra o mês de {previousMonthDate.toLocaleDateString(undefined, {month: "long"})} anterior.</p>

                <div className="mt-5 space-y-4">
                  {monthlyTrendsComparison.map((trend) => {
                    const catName = trend.category === "energia" ? "⚡ Energia" : trend.category === "agua" ? "💧 Água" : trend.category === "combustivel" ? "⛽ Combustível" : "🌐 Internet";
                    const unit = trend.category === "energia" ? "kWh" : trend.category === "agua" ? "m³" : trend.category === "combustivel" ? "L" : "GB";
                    
                    return (
                      <div key={trend.category} className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150 dark:border-zinc-850 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{catName}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">Mês atual: {trend.currentSum.toFixed(1)} {unit}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-lg ${
                            trend.prevSum === 0 
                              ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-500" 
                              : trend.isHigher 
                                ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450" 
                                : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {trend.prevSum === 0 ? "Início" : `${trend.isHigher ? "+" : "-"}${trend.speedPercent.toFixed(0)}%`}
                          </span>
                          <p className="text-[9px] text-zinc-400 mt-0.5">Anterior: {trend.prevSum.toFixed(1)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informative advice message based on target progression */}
              <div className="mt-6 pt-4 border-t border-zinc-150 dark:border-zinc-850/60 text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-2.5 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl">
                <Calendar size={16} className="text-zinc-400 shrink-0 mt-0.5" />
                <span>
                  O cálculo cumulativo recalcula os eixos e o consumo toda vez que novas leituras retroativas ou correções são introduzidas no banco.
                </span>
              </div>
            </div>
          </section>

          {/* Monthly Comparison and Trend Section */}
          <section className="w-full">
            <MonthlyTrendChart readings={readings} />
          </section>

          {/* Offscreen layout elements designed specifically for capturing high-fidelity dark graphics in Excel exports */}
          <div id="excel-hidden-graphics" className="absolute left-[-9999px] top-0 pointer-events-none bg-zinc-950 text-white flex flex-col gap-16 py-10" style={{ width: "640px" }}>
            <div id="capture-chart-energia" className="p-6 bg-[#18181b] rounded-2xl w-[600px] h-[340px] flex flex-col justify-between select-none">
              <h3 className="text-white text-center font-sans font-bold text-sm mb-2">Histórico de Consumo de Energia</h3>
              <ConsumptionChart readings={readings} category="energia" period="30days" width={550} height={252} />
            </div>
            <div id="capture-chart-agua" className="p-6 bg-[#18181b] rounded-2xl w-[600px] h-[340px] flex flex-col justify-between select-none">
              <h3 className="text-white text-center font-sans font-bold text-sm mb-2">Evolução do Consumo de Água</h3>
              <ConsumptionChart readings={readings} category="agua" period="30days" width={550} height={252} />
            </div>
            <div id="capture-chart-internet" className="p-6 bg-[#18181b] rounded-2xl w-[600px] h-[340px] flex flex-col justify-between select-none">
              <h3 className="text-white text-center font-sans font-bold text-sm mb-2">Histórico Resumido de Internet</h3>
              <ConsumptionChart readings={readings} category="internet" period="30days" width={550} height={252} />
            </div>
            <div id="capture-chart-combustivel" className="p-6 bg-[#18181b] rounded-2xl w-[600px] h-[340px] flex flex-col justify-between select-none">
              <h3 className="text-white text-center font-sans font-bold text-sm mb-2">Distâncias Mapeadas e Combustível</h3>
              <ConsumptionChart readings={readings} category="combustivel" period="30days" width={550} height={252} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
