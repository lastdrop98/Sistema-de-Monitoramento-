import React from "react";
import { User } from "../types";
import { 
  User as UserIcon, 
  Building2, 
  Mail, 
  MailWarning, 
  CheckCircle2, 
  AlertCircle, 
  Settings,
  BellRing,
  Smartphone,
  Share2,
  DollarSign
} from "lucide-react";
import { api } from "../lib/api";
import { sendDailyReport } from "../lib/emailjs";
import { useToast } from "../components/Toast";

interface PerfilProps {
  user: User | null;
  onUpdateProfile: (updates: Partial<User>) => Promise<void>;
  onRefreshUser?: () => Promise<void>;
}

export default function Perfil({ user, onUpdateProfile, onRefreshUser }: PerfilProps) {
  const { showToast } = useToast();

  const [fullName, setFullName] = React.useState(user?.fullName || "");
  const [company, setCompany] = React.useState(user?.company || "");
  const [emailReportsEnabled, setEmailReportsEnabled] = React.useState(user?.emailReportsEnabled || false);

  // New Fuel config and WhatsApp sharing states
  const [precoPorLitro, setPrecoPorLitro] = React.useState<string>(user?.precoPorLitro !== undefined ? user.precoPorLitro.toString() : "75.0");
  const [whatsappReportsEnabled, setWhatsappReportsEnabled] = React.useState(user?.whatsappReportsEnabled || false);
  const [whatsappPhone, setWhatsappPhone] = React.useState(user?.whatsappPhone || "");
  const [whatsappLink, setWhatsappLink] = React.useState("");
  const [whatsappMessage, setWhatsappMessage] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [gmailConnecting, setGmailConnecting] = React.useState(false);
  const [gmailDisconnecting, setGmailDisconnecting] = React.useState(false);
  const [sendingReport, setSendingReport] = React.useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = React.useState(false);

  // Find report data
  const getTodayReportData = async () => {
    try {
      const readings = await api.readings.getAll();
      const latestDate = readings.length > 0 ? readings[0].readingDate : new Date().toISOString().slice(0, 10);
      
      const dayReadings = readings.filter(r => r.readingDate === latestDate);
      const energia = dayReadings.filter(r => r.category === "energia").reduce((sum, r) => sum + r.consumption, 0);
      const agua = dayReadings.filter(r => r.category === "agua").reduce((sum, r) => sum + r.consumption, 0);
      const combustivel = dayReadings.filter(r => r.category === "combustivel").reduce((sum, r) => sum + (r.consumoLitros || r.consumption), 0);
      const internet = dayReadings.filter(r => r.category === "internet").reduce((sum, r) => sum + r.consumption, 0);
      const combustivelMt = dayReadings.filter(r => r.category === "combustivel").reduce((sum, r) => sum + (r.consumoMt || 0), 0);

      return {
        date: new Date(latestDate).toLocaleDateString("pt-PT"),
        rawDate: latestDate,
        energia,
        agua,
        combustivel,
        internet,
        combustivelMt
      };
    } catch (e) {
      return {
        date: new Date().toLocaleDateString("pt-PT"),
        rawDate: new Date().toISOString().slice(0, 10),
        energia: 0,
        agua: 0,
        combustivel: 0,
        internet: 0,
        combustivelMt: 0
      };
    }
  };

  const handleSendReportNow = async () => {
    setError("");
    setSuccess("");
    setSendingReport(true);
    try {
      if (!user) return;
      
      // Perform frontend checklist for environment variables before sending
      const serviceId = (import.meta as any).env.VITE_EMAILJS_SERVICE_ID;
      const templateId = (import.meta as any).env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = (import.meta as any).env.VITE_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        throw new Error("As credenciais EmailJS não estão configuradas nas variáveis de ambiente. Defina as variáveis no painel para realizar disparos com sucesso.");
      }

      const reportData = await getTodayReportData();
      await sendDailyReport(user.email, user.fullName, reportData);
      setSuccess("Excelente! O seu relatório de monitoria diário com o EmailJS foi gerado e enviado com sucesso!");
      showToast("Relatorio diário enviado com sucesso por e-mail!", "success");
    } catch (err: any) {
      const errMsg = err.message || "Erro desconhecido ao solicitar envio do relatório com EmailJS.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setSendingReport(false);
    }
  };

  const handleSendWhatsappNow = async () => {
    setError("");
    setSuccess("");
    setSendingWhatsapp(true);
    try {
      if (!whatsappPhone) {
        throw new Error("Adicione um número de telefone com indicativo internacional válido (ex: 258841234567) para a partilha rápido.");
      }
      
      const reportData = await getTodayReportData();
      const compLabel = company || user?.company || fullName || user?.fullName || "Empresa";
      
      const message = `Resumo Diário - ${compLabel}
📅 ${reportData.date}
⚡ Energia: ${reportData.energia.toFixed(2)} kWh
💧 Água: ${reportData.agua.toFixed(2)} m³
⛽ Combustível: ${reportData.combustivel.toFixed(2)} Litros (${reportData.combustivelMt.toFixed(2)} MZN/Meticais)
🌐 Internet: ${reportData.internet.toFixed(2)} GB`;

      const encodedMsg = encodeURIComponent(message);
      const cleanPhone = whatsappPhone.replace(/\D/g, "");
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
      
      setWhatsappLink(whatsappUrl);
      setWhatsappMessage(message);
      
      showToast("Mensagem gerada! O relatório está pronto para envio abaixo.", "success");
      
      try {
        window.open(whatsappUrl, "_blank");
      } catch (browserErr) {
        console.warn("Could not automatically redirect via window.open due to browser/sandbox policy.", browserErr);
      }
      
      setSuccess("Relatório de hoje pronto para envio! Utilize os botões abaixo para enviar de forma segura.");
    } catch (err: any) {
      const errMsg = err.message || "Erro desconhecido ao enviar resumo para WhatsApp.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleCopyWhatsappMessage = () => {
    if (!whatsappMessage) return;
    navigator.clipboard.writeText(whatsappMessage);
    setCopied(true);
    showToast("Mensagem copiada para a área de transferência!", "success");
    setTimeout(() => setCopied(false), 2500);
  };

  const [gmailAuthUrl, setGmailAuthUrl] = React.useState<string>("");

  React.useEffect(() => {
    const fetchGmailAuthUrl = async () => {
      if (user && !user.gmailConnected) {
        try {
          const res = await api.gmail.getAuthUrl();
          if (res && res.url) {
            setGmailAuthUrl(res.url);
          }
        } catch (err) {
          console.error("Erro ao carregar link Google de antemão:", err);
        }
      }
    };
    fetchGmailAuthUrl();
  }, [user?.id, user?.gmailConnected]);

  // Sync state if user changes/loads later
  React.useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setCompany(user.company);
      setEmailReportsEnabled(user.emailReportsEnabled);
      setPrecoPorLitro(user.precoPorLitro !== undefined ? user.precoPorLitro.toString() : "75.0");
      setWhatsappReportsEnabled(user.whatsappReportsEnabled || false);
      setWhatsappPhone(user.whatsappPhone || "");
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!fullName) {
      setError("O nome completo é obrigatório");
      setLoading(false);
      return;
    }

    try {
      await onUpdateProfile({
        fullName,
        company,
        emailReportsEnabled,
        precoPorLitro: parseFloat(precoPorLitro) || 75.0,
        whatsappReportsEnabled,
        whatsappPhone,
      });
      setSuccess("Perfil editado com sucesso!");
      showToast("Configurações atualizadas com sucesso!", "success");
    } catch (err: any) {
      const errMsg = err.message || "Falha ao gravar perfil";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = () => {
    setError("");
    setSuccess("");
    setGmailConnecting(true);

    let authUrlToUse = gmailAuthUrl;
    if (!authUrlToUse) {
      // Lazy-load url in case it wasn't pre-loaded
      api.gmail.getAuthUrl().then(res => {
        if (res && res.url) {
          setGmailAuthUrl(res.url);
          setError("O link de autenticação está pronto! Por favor, clique novamente no botão abaixo.");
        }
      }).catch(err => {
        setError("Erro ao carregar link de login. Verifique sua conexão.");
      }).finally(() => {
        setGmailConnecting(false);
      });
      return;
    }

    // Since they are clicking an anchor tag, the browser opens the tab natively.
    // We just poll the backend to see when the connection succeeds.
    let elapsedSeconds = 0;
    const checkPopup = setInterval(async () => {
      elapsedSeconds += 2;

      try {
        const profile = await api.auth.me();
        if (profile.user && profile.user.gmailConnected) {
          clearInterval(checkPopup);
          setSuccess(`Gmail conectado com sucesso: ${profile.user.gmailEmail}`);
          if (onRefreshUser) {
            await onRefreshUser();
          }
          setGmailConnecting(false);
          return;
        }
      } catch (err) {
        console.error("Erro no polling de conexao do Gmail:", err);
      }

      if (elapsedSeconds > 180) { // 3 minutes timeout
        clearInterval(checkPopup);
        setGmailConnecting(false);
      }
    }, 2000);
  };

  const handleDisconnectGmail = async () => {
    if (!window.confirm("Deseja realmente desconectar a sua conta do Gmail?")) {
      return;
    }
    setError("");
    setSuccess("");
    setGmailDisconnecting(true);
    try {
      await api.gmail.disconnect();
      setSuccess("Conta do Gmail desconectada com sucesso!");
      if (onRefreshUser) {
        await onRefreshUser();
      }
    } catch (e: any) {
      setError(e.message || "Erro ao desconectar Gmail");
    } finally {
      setGmailDisconnecting(false);
    }
  };

  if (!user) {
    return (
      <div className="py-12 text-center text-zinc-500">
        Carregando dados do perfil...
      </div>
    );
  }

  return (
    <div id="perfil-view" className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-sans font-bold text-2xl tracking-tight text-zinc-900 dark:text-zinc-50 font-sans">Opções do Usuário</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Gerencie suas configurações cadastrais, residenciais e preferências de informativos de consumo</p>
      </div>

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

      <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl overflow-hidden shadow-xs divide-y divide-zinc-150 dark:divide-zinc-850">
        {/* Core details */}
        <div className="p-5 sm:p-6 space-y-4">
          <h4 className="font-sans font-bold text-slate-800 dark:text-zinc-100 text-sm flex items-center gap-2 mb-2">
            <Settings size={18} className="text-blue-600 dark:text-blue-400" />
            Dados Cadastrais
          </h4>

          {/* Email block - ReadOnly */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Email Registrado
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Mail size={18} />
              </span>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-500 dark:text-zinc-450 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <UserIcon size={18} />
                </span>
                <input
                  id="profile-fullname-input"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            {/* Enterprise Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Empresa / Residência
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Building2 size={18} />
                </span>
                <input
                  id="profile-company-input"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Email report scheduling options (EmailJS Integration) */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl h-fit border border-blue-100/10">
                <Mail size={18} />
              </div>
              <div className="space-y-1">
                <h4 className="font-sans font-bold text-slate-800 dark:text-zinc-100 text-sm">Disparos de Alertas de Consumo (via EmailJS)</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-normal max-w-sm">
                  Se ativado, envia um resumo consolidado do consumo diário usando o serviço robusto do e-mail client EmailJS.
                </p>
                <div className="pt-2.5 flex flex-col gap-2">
                  <button
                    id="btn-send-report-now"
                    type="button"
                    disabled={sendingReport}
                    onClick={handleSendReportNow}
                    className="w-fit px-4 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-white dark:text-blue-400 border border-blue-600 dark:border-blue-900/30 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
                  >
                    {sendingReport ? "Enviando..." : "Enviar relatório de hoje agora"}
                  </button>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic max-w-xs">
                    Para activar o envio automático, cria uma conta gratuita em <a href="https://emailjs.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">emailjs.com</a> e liga o teu Gmail ou Outlook.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Interactive Switch */}
            <button
              id="email-reports-toggle"
              type="button"
              onClick={() => setEmailReportsEnabled(!emailReportsEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                emailReportsEnabled ? "bg-blue-600" : "bg-slate-200 dark:bg-zinc-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  emailReportsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* WhatsApp Reports Configuration */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl h-fit border border-emerald-100/10">
                <Share2 size={18} />
              </div>
              <div className="space-y-1.5 w-full">
                <h4 className="font-sans font-bold text-slate-800 dark:text-zinc-100 text-sm">Resumos Diários via WhatsApp</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-normal max-w-sm">
                  Ative o controle de compartilhamento ágil para enviar relatórios diários de consumo pelo WhatsApp em 1 clique.
                </p>

                <div className="space-y-3 pt-2">
                  {/* Phone input */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                      Telemóvel para Envio (com indicativo)
                    </label>
                    <div className="relative max-w-xs">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-405">
                        <Smartphone size={16} />
                      </span>
                      <input
                        id="profile-whatsappphone-input"
                        type="text"
                        placeholder="Ex: 258841234567"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Trigger now */}
                  <div className="flex flex-col gap-3">
                    <button
                      id="btn-send-whatsapp-now"
                      type="button"
                      disabled={sendingWhatsapp}
                      onClick={handleSendWhatsappNow}
                      className="w-fit px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-white rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Gerar Relatório de WhatsApp</span>
                    </button>

                    {whatsappLink && (
                      <div className="mt-2 p-4 bg-zinc-100/60 dark:bg-zinc-900/70 border border-slate-200/50 dark:border-zinc-800/80 rounded-xl space-y-3 max-w-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Conteúdo do Relatório</span>
                          <button
                            type="button"
                            onClick={handleCopyWhatsappMessage}
                            className="text-[11px] px-2.5 py-1 bg-white dark:bg-zinc-850 hover:bg-slate-50 dark:hover:bg-zinc-805 text-zinc-700 dark:text-zinc-200 rounded-md font-bold transition border border-zinc-200 dark:border-zinc-800"
                          >
                            {copied ? "Copiado!" : "Copiar Texto"}
                          </button>
                        </div>
                        <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-350 whitespace-pre-wrap leading-relaxed select-all bg-white dark:bg-black/30 p-3 rounded-lg border border-slate-200/30 dark:border-zinc-800/40">
                          {whatsappMessage}
                        </pre>
                        <div className="pt-1">
                          <a
                            id="link-whatsapp-direct"
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full text-center px-4 py-2 bg-emerald-600 hover:bg-emerald-705 text-white rounded-lg text-xs font-bold transition uppercase tracking-wider block cursor-pointer shadow-xs"
                          >
                            Abrir WhatsApp (Conversa Direta)
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Interactive Switch */}
            <button
              id="whatsapp-reports-toggle"
              type="button"
              onClick={() => setWhatsappReportsEnabled(!whatsappReportsEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                whatsappReportsEnabled ? "bg-emerald-600" : "bg-slate-200 dark:bg-zinc-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  whatsappReportsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Save segment */}
        <div className="p-5 sm:p-6 bg-slate-50/50 dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-850 flex justify-end">
          <button
            id="save-profile-btn"
            type="submit"
            disabled={loading}
            className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer active:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Gravando..." : "Salvar Configurações"}
          </button>
        </div>
      </form>

      {/* Gmail Integration Section */}
      <div id="gmail-integration-card" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <div className="p-2.5 bg-red-55/10 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100/10">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-sans font-bold text-slate-800 dark:text-zinc-100 text-sm">Sincronização Integrada de E-faturas (Gmail)</h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-normal max-w-md mt-1">
                Conecte a sua conta Google de forma segura para fazer varredura de faturas de eletricidade Credelec/EDM, água, combustíveis e Internet faturadas em Moçambique diretamente pela caixa de entrada.
              </p>
            </div>
          </div>

          <div className="flex items-center">
            {user.gmailConnected ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900/30">
                Ativo
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Inativo
              </span>
            )}
          </div>
        </div>

        {user.gmailConnected ? (
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/60 p-4 border border-zinc-150 dark:border-zinc-855 space-y-3">
            <div className="flex items-center justify-between text-sm flex-wrap gap-2">
              <span className="text-zinc-600 dark:text-zinc-400">E-mail conectado:</span>
              <span className="font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/25 px-2.5 py-1 rounded-lg">
                {user.gmailEmail}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-450 leading-normal">
              A sua conta técnica está ligada. Agora, você pode verificar de forma simples suas e-faturas localizadas nas mensagens clicando no botão de sincronização disponível no topo do seu Assistente de Leitura.
            </p>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={gmailDisconnecting}
                onClick={handleDisconnectGmail}
                className="py-2 px-4 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 dark:border-red-900/40 dark:hover:bg-red-950/20 dark:text-red-400 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {gmailDisconnecting ? "Desconectando..." : "Desconectar Conta Google"}
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-2 flex justify-end">
            <a
              href={gmailAuthUrl || "#"}
              target={gmailAuthUrl ? "_blank" : undefined}
              rel={gmailAuthUrl ? "noopener noreferrer" : undefined}
              onClick={handleConnectGmail}
              className={`inline-flex items-center gap-2.5 py-2.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer active:bg-red-800 ${gmailConnecting ? "opacity-50 pointer-events-none" : ""}`}
            >
              {gmailConnecting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" width="24" height="24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Conectar com Google Gmail</span>
                </>
              )}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
