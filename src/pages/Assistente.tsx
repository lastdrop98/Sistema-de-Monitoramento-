import React from "react";
import { api } from "../lib/api";
import { User, MeterReading, ChatMessage, CategoryType } from "../types";
import { 
  Send, 
  Image as ImageIcon, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Sparkles, 
  FileText, 
  Calendar, 
  HelpCircle, 
  Activity, 
  User as UserIcon,
  X,
  Gauge,
  MapPin,
  Coins,
  Mail
} from "lucide-react";

interface AssistenteProps {
  user: User;
  onAddReadingFromAI: (reading: Omit<MeterReading, "id" | "userId" | "consumption" | "createdAt">) => Promise<void>;
}

export default function Assistente({ user, onAddReadingFromAI }: AssistenteProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = React.useState("");
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [chatLoading, setChatLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [successToast, setSuccessToast] = React.useState<string | null>(null);

  // Gmail states
  const [faturas, setFaturas] = React.useState<any[]>([]);
  const [scanningGmail, setScanningGmail] = React.useState(false);
  const [importedGmailIds, setImportedGmailIds] = React.useState<Record<string, boolean>>({});

  // States to manage multiple pending confirm cards states after component re-renders
  const [confirmedCardIds, setConfirmedCardIds] = React.useState<Record<string, boolean>>({});
  const [cardFormStates, setCardFormStates] = React.useState<Record<string, {
    category: CategoryType;
    unit: string;
    value: number;
    date: string;
    notes: string;
    kmInicial?: string;
    kmFinal?: string;
    destinos?: string;
    costMt?: string;
  }>>({});

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load chat logs on mouth
  React.useEffect(() => {
    const loadLogs = async () => {
      try {
        const history = await api.chat.getHistory();
        setMessages(history);
        
        // Initialize editable form states for any detection logs
        const initialFormStates: typeof cardFormStates = {};
        history.forEach(msg => {
          if (msg.detectedData) {
            initialFormStates[msg.id] = {
              category: msg.detectedData.category,
              unit: msg.detectedData.unit,
              value: msg.detectedData.value,
              date: msg.detectedData.date,
              notes: "Registrado automaticamente via Assistente de Visão IA"
            };
          }
        });
        setCardFormStates(initialFormStates);
      } catch (err: any) {
        console.error("Erro ao carregar histórico de conversas do assistente", err);
        setError("Não foi possível carregar o histórico de conversação.");
      } finally {
        setChatLoading(false);
      }
    };
    loadLogs();
  }, []);

  // Recalculate auto-scroll on change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const convertFileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(",");
        const mimeType = result.slice(5, result.indexOf(";"));
        const base64Data = result.slice(comma + 1);
        resolve({ mimeType, data: base64Data });
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drag and Drop Handling
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
        setError(null);
      } else {
        setError("Por favor, envie apenas arquivos de imagem.");
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() && !selectedImage) return;

    setLoading(true);
    setError(null);

    const textPayload = inputMessage;
    const hasImage = !!selectedImage;
    setInputMessage(""); // Clear text field immediately for responsiveness

    // Prepare optimistic variables
    let imagePayload: { mimeType: string; data: string } | undefined = undefined;
    const optimisticUserMessageId = "optimistic-user-" + Date.now();

    try {
      if (selectedImage) {
        imagePayload = await convertFileToBase64(selectedImage);
        clearSelectedImage(); // clear preview
      }

      // Optimistically insert user message so the prompt shows instantly
      const optimisticMsg: ChatMessage = {
        id: optimisticUserMessageId,
        userId: user.id,
        role: "user",
        content: textPayload || (hasImage ? "[Upload de Imagem]" : ""),
        image: imagePayload ? { mimeType: imagePayload.mimeType, data: imagePayload.data } : undefined,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, optimisticMsg]);

      // API Post
      const modelResponse = await api.chat.sendMessage(textPayload, imagePayload);

      // Save modelResponse and exclude raw optimism ID to let DB-defined details sync up
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== optimisticUserMessageId);
        return [...filtered, modelResponse];
      });

      // If detection arrived, initialize form value
      if (modelResponse.detectedData) {
        setCardFormStates(prev => ({
          ...prev,
          [modelResponse.id]: {
            category: modelResponse.detectedData!.category,
            unit: modelResponse.detectedData!.unit,
            value: modelResponse.detectedData!.value,
            date: modelResponse.detectedData!.date,
            notes: "Registrado de forma autônoma via Assistente de Visão IA"
          }
        }));
      }

      // Reload history logs to synchronize client representation and fetch complete context
      const history = await api.chat.getHistory();
      setMessages(history);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Falha ao enviar mensagem de chat.");
      
      // Rollback optimistic state by loading actual database logs
      try {
        const history = await api.chat.getHistory();
        setMessages(history);
      } catch (historyErr) {
        // Fallback to manual subtraction
        setMessages(prev => prev.filter(m => m.id !== optimisticUserMessageId));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Deseja realmente limpar toda a conversa com o assistente? Esta ação é irreversível.")) {
      return;
    }
    try {
      await api.chat.clearHistory();
      setMessages([]);
      setCardFormStates({});
      setConfirmedCardIds({});
      setSuccessToast("O histórico de conversas foi excluído.");
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      setError("Não foi possível excluir o histórico.");
    }
  };

  const handleSyncGmail = async () => {
    setScanningGmail(true);
    setError(null);
    setFaturas([]);
    try {
      const res = await api.gmail.syncInvoices();
      setFaturas(res.faturas);
      if (res.faturas.length === 0) {
        setSuccessToast("Nenhuma fatura de consumo recente foi encontrada na sua caixa de entrada.");
        setTimeout(() => setSuccessToast(null), 3500);
      } else {
        setSuccessToast(`Parabéns! Encontramos ${res.faturas.length} faturas recentes prontas para registrar.`);
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao fazer varredura de faturas no Gmail. Verifique se a sua conta de Gmail está vinculada.");
    } finally {
      setScanningGmail(false);
    }
  };

  const handleImportInvoice = async (invoice: any) => {
    try {
      const finalReading: Omit<MeterReading, "id" | "userId" | "consumption" | "createdAt"> = {
        category: invoice.category,
        readingDate: invoice.date,
        readingValue: Number(invoice.value),
        unit: invoice.unit,
        notes: (invoice.notes || "Importado do Gmail").trim() + " [Fonte: Gmail Sync]",
        costMt: invoice.costMt ? Number(invoice.costMt) : undefined,
        gmailId: invoice.gmailId
      };

      await onAddReadingFromAI(finalReading);

      setImportedGmailIds(prev => ({ ...prev, [invoice.gmailId]: true }));
      setSuccessToast("Fatura consolidada do Gmail adicionada com sucesso!");
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (e: any) {
      alert("Falha ao registrar fatura: " + e.message);
    }
  };

  // Editable card handlers
  const handleCardFieldChange = (msgId: string, field: string, value: any) => {
    setCardFormStates(prev => {
      const current = prev[msgId] || {
        category: "energia",
        unit: "kWh",
        value: 0,
        date: new Date().toISOString().slice(0, 10),
        notes: ""
      };
      return {
        ...prev,
        [msgId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const handleRegisterFromCard = async (msgId: string) => {
    const form = cardFormStates[msgId];
    if (!form) return;

    try {
      // Gather inputs and convert parameters safely
      const finalReading: Omit<MeterReading, "id" | "userId" | "consumption" | "createdAt"> = {
        category: form.category,
        readingDate: form.date,
        readingValue: Number(form.value),
        unit: form.unit,
        notes: (form.notes || "Leitura confirmada via Visão IA").trim() + " [Fonte: ai_image]",
        kmInicial: form.kmInicial ? Number(form.kmInicial) : undefined,
        kmFinal: form.kmFinal ? Number(form.kmFinal) : undefined,
        destinos: form.destinos || undefined,
        costMt: form.costMt ? Number(form.costMt) : undefined
      };

      await onAddReadingFromAI(finalReading);

      // Lock form input
      setConfirmedCardIds(prev => ({ ...prev, [msgId]: true }));
      setSuccessToast("Consumo registrado com sucesso!");
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      alert("Falha ao registrar consumo: " + err.message);
    }
  };

  return (
    <div id="assistente-dashboard" className="space-y-6 max-w-5xl mx-auto flex flex-col h-calc">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 px-6 py-5 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-850">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="text-xl font-sans font-bold text-slate-800 dark:text-white">Assistente de Consumo inteligente</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Envie faturas, fotos de contadores de luz/água ou faça perguntas analíticas de consumo.</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {user.gmailConnected && (
            <button
              id="btn-sync-gmail"
              onClick={handleSyncGmail}
              disabled={scanningGmail}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 dark:bg-red-950/20 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50"
            >
              {scanningGmail ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-red-600 dark:text-red-405" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <Mail size={16} />
                  <span>Sincronizar Gmail</span>
                </>
              )}
            </button>
          )}
          <button
            id="btn-limpar-conversas"
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 dark:bg-zinc-950 dark:border-zinc-800 dark:hover:bg-rose-950/20 text-slate-700 hover:text-rose-600 dark:text-zinc-300 dark:hover:text-rose-400 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50 disabled:hover:border-slate-200 disabled:hover:text-slate-700"
            title="Apagar todo histórico de conversa"
          >
            <Trash2 size={16} />
            <span>Limpar Histórico</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successToast && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 px-4 py-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-sm flex items-center gap-2 shadow-xs transition-all duration-200 animate-pulse">
          <CheckCircle size={16} className="shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Error Box */}
      {error && (
        <div className={`px-5 py-4 rounded-xl border text-sm flex flex-col md:flex-row items-start md:items-center gap-3.5 shrink-0 transition-all duration-200 ${
          error.includes("GEMINI_API_KEY") || error.includes("chave API") || error.includes("KEY_NOT")
            ? "bg-amber-50/85 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-900/30"
            : "bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 border-rose-100 dark:border-rose-900/30"
        }`}>
          <div className="flex items-start gap-2.5 flex-1 select-text">
            {error.includes("GEMINI_API_KEY") || error.includes("chave API") || error.includes("KEY_NOT") ? (
              <Sparkles size={20} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-bold">
                {error.includes("GEMINI_API_KEY") || error.includes("chave API") || error.includes("KEY_NOT")
                  ? "Configuração Necessária: Chave API Ausente"
                  : "Erro de Operação"}
              </p>
              <p className="text-xs text-slate-705 dark:text-zinc-400 leading-relaxed font-sans">{error}</p>
            </div>
          </div>
          <div className="flex gap-2.5 shrink-0 self-end md:self-center">
            {(error.includes("GEMINI_API_KEY") || error.includes("chave API") || error.includes("KEY_NOT")) && (
              <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/45 text-amber-800 dark:text-amber-400 px-2.5 py-1 rounded-md border border-amber-250 dark:border-amber-900/40 uppercase tracking-widest font-mono">
                Definições &gt; Segredos
              </span>
            )}
            <button 
              onClick={() => setError(null)} 
              className={`p-1.5 rounded-lg hover:bg-slate-200/40 dark:hover:bg-zinc-800/40 cursor-pointer ${
                error.includes("GEMINI_API_KEY") || error.includes("chave API") ? "text-amber-700 hover:text-amber-900" : "text-rose-500 hover:text-rose-700"
              }`}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Gmail Scanned Invoices panel */}
      {faturas.length > 0 && (
        <div id="gmail-scanned-panel" className="bg-red-50/10 dark:bg-zinc-900/40 border border-red-100 dark:border-red-900/10 rounded-2xl p-4 sm:p-5 space-y-3.5 shrink-0 animate-fadeIn shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-red-500 animate-pulse shrink-0" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                Faturas Identificadas no seu Gmail ({faturas.length})
              </span>
            </div>
            <button 
              onClick={() => setFaturas([])} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-100 p-1 cursor-pointer"
              title="Ocultar resultados"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-72 overflow-y-auto pr-1">
            {faturas.map((fat) => {
              const isImported = importedGmailIds[fat.gmailId];
              const catColors = 
                fat.category === "energia" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" :
                fat.category === "agua" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400" :
                fat.category === "combustivel" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" :
                "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400";

              return (
                <div key={fat.gmailId} className="bg-white dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800/80 p-3.5 rounded-xl flex flex-col justify-between space-y-3 shadow-xs">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${catColors}`}>
                        {fat.category}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                        {new Date(fat.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <h5 className="font-sans font-bold text-xs text-slate-800 dark:text-zinc-200 leading-snug truncate" title={fat.subject}>
                      {fat.subject}
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic leading-snug line-clamp-2">
                      "{fat.notes}"
                    </p>
                    <div className="flex gap-4 pt-1 font-mono text-[11px] flex-wrap">
                      <div>
                        <span className="text-slate-400">Leitura:</span>{" "}
                        <strong className="text-slate-800 dark:text-zinc-200">{fat.value} {fat.unit}</strong>
                      </div>
                      {fat.costMt !== undefined && fat.costMt !== null && (
                        <div>
                          <span className="text-slate-400">Custo:</span>{" "}
                          <strong className="text-slate-800 dark:text-zinc-200">{fat.costMt} Meticais</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 shrink-0">
                    {isImported ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider py-1.5">
                        <CheckCircle size={14} />
                        <span>Registrado</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleImportInvoice(fat)}
                        className="py-1.5 px-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-xs transition-all duration-150 cursor-pointer"
                      >
                        Registrar Consumo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Chat Display Window */}
      <div 
        id="chat-scroller-box"
        className={`flex-1 min-h-[400px] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-850 p-4 sm:p-6 space-y-6 flex flex-col justify-between transition-colors duration-200 ${
          dragActive ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/10" : ""
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        {chatLoading ? (
          <div className="flex flex-col justify-center items-center h-full py-20 gap-3">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <span className="text-sm font-semibold text-slate-500">Buscando histórico...</span>
          </div>
        ) : messages.length === 0 ? (
          // Welcome Placeholder
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto my-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-zinc-950 border border-blue-100 dark:border-zinc-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs mb-2">
              <Sparkles size={32} className="animate-pulse" />
            </div>
            <h3 className="font-sans font-bold text-lg text-slate-800 dark:text-zinc-100">Bate-papo Assistente Consumo IA</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Eu sou o seu monitor automatizado. Pode arrastar e soltar fotos de faturas, recibos de combustível ou contadores para ler e registrar leituras de forma instantânea.
            </p>
            <div className="bg-slate-50 dark:bg-zinc-950/70 p-4 rounded-xl border border-slate-100 dark:border-zinc-855 text-xs text-left space-y-2 text-slate-600 dark:text-zinc-350">
              <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400">Exemplos de perguntas:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>"Tive algum consumo anormal de água este mês?"</li>
                <li>"Qual é o consumo médio de energia registrado?"</li>
                <li>"Compare meus limites de internet com o consumo real."</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6 flex-1">
            {messages.map((msg) => {
              const mimeType = msg.image?.mimeType || "image/png";
              const isUser = msg.role === "user";
              
              // Render Form state values
              const form = cardFormStates[msg.id];
              const isConfirmed = confirmedCardIds[msg.id];

              return (
                <div 
                  key={msg.id} 
                  id={`chat-message-${msg.id}`} 
                  className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fadeIn`}
                >
                  <div className={`flex items-start gap-3 max-w-[85%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    {/* User / IA Avatar Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 mt-1 shadow-xs font-bold text-xs ${
                      isUser ? "bg-slate-700" : "bg-blue-600"
                    }`}>
                      {isUser ? <UserIcon size={14} /> : <span>IA</span>}
                    </div>

                    <div className="space-y-2">
                      {/* Message Bubble box */}
                      <div className={`p-4 rounded-2xl shadow-xs text-sm leading-relaxed whitespace-pre-wrap font-sans ${
                        isUser 
                          ? "bg-slate-800 text-white rounded-tr-xs" 
                          : "bg-slate-100 dark:bg-zinc-800 dark:text-zinc-100 text-slate-850 rounded-tl-xs"
                      }`}>
                        {/* Display User Base64 Image Thumbnail inside bubble */}
                        {msg.image && (
                          <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                            <img 
                              src={`data:${mimeType};base64,${msg.image.data}`} 
                              alt="Análise pelo assistente" 
                              className="max-h-48 object-contain mx-auto" 
                            />
                          </div>
                        )}
                        <span>{msg.content}</span>
                      </div>

                      {/* EXTRACTION / CONFIRMATION FORM CARD */}
                      {msg.detectedData && form && (
                        <div id={`extract-card-${msg.id}`} className="mt-4 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-805 rounded-2xl overflow-hidden shadow-md max-w-md">
                          {/* Card header banner */}
                          <div className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-150 dark:border-zinc-805 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Sparkles size={16} className="text-blue-500 animate-pulse" />
                              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                                Diagnóstico de Medição IA
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              msg.detectedData.confidence === "alta" 
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400" 
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                            }`}>
                              Confiança: {msg.detectedData.confidence === "alta" ? "Alta" : "Incompleta / Baixa"}
                            </span>
                          </div>

                          {/* Warning Banner for Low Confidence */}
                          {msg.detectedData.confidence !== "alta" && (
                            <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-b border-amber-100 dark:border-amber-950/30 px-4 py-2.5 text-xs flex items-start gap-1.5">
                              <AlertCircle size={15} className="shrink-0 mt-0.5" />
                              <span>
                                <strong>Visibilidade limitada detectada.</strong> Por favor, verifique rigorosamente os dados colhidos do visor e ajuste abaixo caso necessário.
                              </span>
                            </div>
                          )}

                          <div className="p-4 space-y-3.5">
                            {/* Category selector */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                Categoria de Monitoria
                              </label>
                              <select
                                value={form.category ?? "energia"}
                                disabled={isConfirmed}
                                onChange={(e) => handleCardFieldChange(msg.id, "category", e.target.value as CategoryType)}
                                className="block w-full py-1.5 px-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm disabled:opacity-75 focus:outline-hidden"
                              >
                                <option value="energia">Energia (kWh)</option>
                                <option value="agua">Água (m³)</option>
                                <option value="combustivel">Combustível (L)</option>
                                <option value="internet">Internet (GB)</option>
                              </select>
                            </div>

                            {/* Dual Row: Value & Date */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                  Leitura Acumulada
                                </label>
                                <input
                                  type="number"
                                  value={form.value ?? ""}
                                  disabled={isConfirmed}
                                  onChange={(e) => handleCardFieldChange(msg.id, "value", e.target.value)}
                                  className="block w-full py-1.5 px-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-semibold disabled:opacity-75 focus:outline-hidden"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                  Unidade Medidora
                                </label>
                                <input
                                  type="text"
                                  value={form.unit ?? ""}
                                  disabled={isConfirmed}
                                  onChange={(e) => handleCardFieldChange(msg.id, "unit", e.target.value)}
                                  className="block w-full py-1.5 px-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm disabled:opacity-75 focus:outline-hidden"
                                />
                              </div>
                            </div>

                            {/* Reference Date input */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                Data da Medição
                              </label>
                              <input
                                type="date"
                                value={form.date ?? ""}
                                disabled={isConfirmed}
                                onChange={(e) => handleCardFieldChange(msg.id, "date", e.target.value)}
                                className="block w-full py-1.5 px-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm disabled:opacity-75 focus:outline-hidden"
                              />
                            </div>

                            {/* Combustivel Specific fields: kmInicial, kmFinal, destinos, costMt */}
                            {form.category === "combustivel" && (
                              <div className="p-3 bg-blue-50/40 dark:bg-zinc-900/60 rounded-xl border border-blue-50 dark:border-zinc-800/50 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                                      <Gauge size={10} /> KM Inicial
                                    </label>
                                    <input
                                      type="number"
                                      placeholder="Ex: 144500"
                                      value={form.kmInicial ?? ""}
                                      disabled={isConfirmed}
                                      onChange={(e) => handleCardFieldChange(msg.id, "kmInicial", e.target.value)}
                                      className="block w-full py-1 px-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                                      <Gauge size={10} /> KM Final
                                    </label>
                                    <input
                                      type="number"
                                      placeholder="Ex: 144600"
                                      value={form.kmFinal ?? ""}
                                      disabled={isConfirmed}
                                      onChange={(e) => handleCardFieldChange(msg.id, "kmFinal", e.target.value)}
                                      className="block w-full py-1 px-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                                      <MapPin size={10} /> Destinos
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Ex: Maputo-Coop"
                                      value={form.destinos ?? ""}
                                      disabled={isConfirmed}
                                      onChange={(e) => handleCardFieldChange(msg.id, "destinos", e.target.value)}
                                      className="block w-full py-1 px-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                                      <Coins size={10} /> Custo (Meticais)
                                    </label>
                                    <input
                                      type="number"
                                      placeholder="Ex: 1200"
                                      value={form.costMt ?? ""}
                                      disabled={isConfirmed}
                                      onChange={(e) => handleCardFieldChange(msg.id, "costMt", e.target.value)}
                                      className="block w-full py-1 px-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Notes description input */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                Notas de Auditoria
                              </label>
                              <input
                                type="text"
                                value={form.notes ?? ""}
                                disabled={isConfirmed}
                                onChange={(e) => handleCardFieldChange(msg.id, "notes", e.target.value)}
                                className="block w-full py-1.5 px-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm disabled:opacity-75 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          {/* Confirm action drawer footer */}
                          <div className="bg-slate-50 dark:bg-zinc-900/60 px-4 py-3.5 border-t border-slate-150 dark:border-zinc-805 flex justify-end gap-2.5">
                            {isConfirmed ? (
                              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 py-1 font-bold text-xs uppercase tracking-wider">
                                <CheckCircle size={15} />
                                <span>Gravado no Monitor</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRegisterFromCard(msg.id)}
                                className="flex items-center justify-center gap-1.5 px-4.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-all duration-150"
                              >
                                <CheckCircle size={14} />
                                <span>Confirmar e Registrar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dynamic active loading bubble */}
        {loading && (
          <div className="flex justify-start animate-pulse py-3">
            <div className="flex items-start gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 mt-1 shadow-xs bg-blue-600">
                <Loader2 size={15} className="animate-spin" />
              </div>
              <div className="space-y-2">
                <div className="p-4 rounded-2xl shadow-xs text-sm bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-tl-xs flex flex-col gap-2.5 border border-slate-150 dark:border-zinc-750">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="animate-bounce text-blue-650 dark:text-blue-400" />
                    <span className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400">O Assistente IA está a processar...</span>
                  </div>
                  <div className="space-y-2 w-64 pt-1.5">
                    <div className="h-2 bg-slate-205 dark:bg-zinc-700 rounded-full w-full"></div>
                    <div className="h-2 bg-slate-205 dark:bg-zinc-700 rounded-full w-5/6"></div>
                    <div className="h-2 bg-slate-205 dark:bg-zinc-700 rounded-full w-3/4"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scroll downstream checkpoint anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Persistent bottom input box form panel */}
      <form onSubmit={handleSendMessage} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-850 p-4 shadow-sm space-y-3.5 shrink-0 transition-colors duration-200">
        
        {/* Thumbnail preview block of selected image */}
        {imagePreview && (
          <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-805 rounded-xl max-w-sm shrink-0 animate-fadeIn relative">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 relative">
              <img src={imagePreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate">
                {selectedImage?.name}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {selectedImage ? (selectedImage.size / 1024 / 1024).toFixed(2) + " MB" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelectedImage}
              className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 dark:bg-rose-950/40 text-red-600 dark:text-rose-400 border border-red-200 dark:border-rose-900/30 rounded-lg transition-colors"
              title="Remover foto selecionada"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Core Input box container layout */}
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-150 dark:hover:bg-zinc-850 rounded-xl border transition-colors outline-none shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedImage ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600" : "border-slate-200 dark:border-zinc-800"
            }`}
            title="Selecionar foto da fatura ou medidor"
          >
            <ImageIcon size={20} />
          </button>

          <input
            type="text"
            disabled={loading}
            required={!selectedImage}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              loading
                ? "O Assistente Inteligente está a processar o seu pedido..."
                : selectedImage 
                  ? "Adicione uma instrução opcional (ex: 'registrar luz de hoje') ou envie..." 
                  : "Escreva uma dúvida analítica ou pergunte sobre faturas..."
            }
            className="flex-1 py-3 px-4 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-450 dark:placeholder-zinc-500 text-sm focus:outline-hidden focus:ring-1.5 focus:ring-blue-600 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          />

          <button
            type="submit"
            disabled={loading || (!inputMessage.trim() && !selectedImage)}
            className="p-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:scale-100 text-white rounded-xl shadow-xs transition-all outline-none shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Enviar mensagem"
          >
            {loading ? <Loader2 className="animate-spin text-white" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </form>
    </div>
  );
}
