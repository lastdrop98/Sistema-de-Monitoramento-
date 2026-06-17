import emailjs from '@emailjs/browser';

export const sendDailyReport = async (
  toEmail: string,
  userName: string,
  reportData: {
    date: string;
    energia: number;
    agua: number;
    combustivel: number;
    internet: number;
    combustivelMt: number;
  }
) => {
  const templateParams = {
    to_email: toEmail,
    to_name: userName,
    report_date: reportData.date,
    energia_kwh: reportData.energia.toFixed(2),
    agua_m3: reportData.agua.toFixed(2),
    combustivel_litros: reportData.combustivel.toFixed(2),
    combustivel_mt: reportData.combustivelMt.toFixed(2),
    internet_gb: reportData.internet.toFixed(2),
  };

  return emailjs.send(
    (import.meta as any).env.VITE_EMAILJS_SERVICE_ID || '',
    (import.meta as any).env.VITE_EMAILJS_TEMPLATE_ID || '',
    templateParams,
    (import.meta as any).env.VITE_EMAILJS_PUBLIC_KEY || ''
  );
};
