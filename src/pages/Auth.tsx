import React from "react";
import { api } from "../lib/api";
import { User } from "../types";
import { Activity, Mail, Lock, User as UserIcon, Building2, AlertCircle, Eye, EyeOff } from "lucide-react";

interface AuthProps {
  onLoginSuccess: (user: User) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  
  const [fullName, setFullName] = React.useState("");
  const [company, setCompany] = React.useState("");
  
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password || (!isLogin && !fullName)) {
      setError("Por favor, preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError("As senhas informadas não coincidem");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const res = await api.auth.login(email, password);
        onLoginSuccess(res.user);
      } else {
        const res = await api.auth.register(email, password, fullName, company);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-page" className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Core Icon Branding */}
        <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md">
          <Activity size={26} />
        </div>
        <h2 className="mt-6 font-sans font-bold text-3xl tracking-tight text-zinc-900 dark:text-white">
          {isLogin ? "Entrar no Sistema" : "Criar uma Conta"}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {isLogin ? "Gerencie seus consumos e exporte planilhas Excel" : "Comece a rastrear seus gastos de forma profissional"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-sm border border-zinc-250/60 dark:border-zinc-850/60 sm:rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Error alerts */}
            {error && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 p-4 border border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-300 text-sm flex items-start gap-2.5 animate-bounce-in">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Name Input - SignUp Only */}
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <UserIcon size={18} />
                  </div>
                  <input
                    id="auth-register-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>
            )}

            {/* Company Input - SignUp Only */}
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Empresa / Residência <span className="text-zinc-400 font-normal">(Opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Building2 size={18} />
                  </div>
                  <input
                    id="auth-register-company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Ex: Minha Empresa Ltda"
                    className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Endereço de E-mail <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Mail size={18} />
                </div>
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-zinc-905 dark:text-white placeholder-zinc-405 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Senha de Acesso <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Lock size={18} />
                </div>
                <input
                  id="auth-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha de segurança"
                  className="block w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-zinc-905 dark:text-white placeholder-zinc-405 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
                />
                <button
                  id="auth-toggle-password-visibility"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-450 hover:text-zinc-650 dark:hover:text-zinc-300 cursor-pointer"
                  title={showPassword ? "Ocultar Senha" : "Mostrar Senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input - SignUp Only */}
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Confirmar Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock size={18} />
                  </div>
                  <input
                    id="auth-confirm-password-input"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a mesma senha"
                    className="block w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-zinc-905 dark:text-white placeholder-zinc-405 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
                  />
                  <button
                    id="auth-toggle-confirm-password-visibility"
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-450 hover:text-zinc-650 dark:hover:text-zinc-300 cursor-pointer"
                    title={showConfirmPassword ? "Ocultar Senha" : "Mostrar Senha"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                id="auth-submit-button"
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-4 focus:ring-blue-500/20 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? "Processando..." : (isLogin ? "Acessar Painel" : "Cadastrar Conta")}
              </button>
            </div>
          </form>

          {/* Toggle mode links */}
          <div className="mt-6 pt-5 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-center text-sm">
            <button
              id="auth-switch-mode-button"
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setPassword("");
                setConfirmPassword("");
                setShowPassword(false);
                setShowConfirmPassword(false);
              }}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              {isLogin ? "Não tem uma conta? Registre-se" : "Já tem registro? Fazer Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
