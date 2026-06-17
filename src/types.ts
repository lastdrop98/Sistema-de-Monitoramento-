export type CategoryType = "energia" | "agua" | "combustivel" | "internet";

export interface User {
  id: string;
  email: string;
  fullName: string;
  company: string;
  emailReportsEnabled: boolean;
  theme: "light" | "dark";
  createdAt: string;
  gmailEmail?: string;
  gmailConnected?: boolean;
  precoPorLitro?: number; // Fuel price in Meticais per Liter
  whatsappReportsEnabled?: boolean; // WhatsApp reports toggle
  whatsappPhone?: string; // WhatsApp mobile phone number
}

export interface MeterReading {
  id: string;
  userId: string;
  category: CategoryType;
  readingDate: string; // YYYY-MM-DD
  readingValue: number; // accumulated value
  consumption: number; // current - previous
  unit: string;
  notes?: string;
  // Custom category fields based on Excel imports
  kmInicial?: number;
  kmFinal?: number;
  destinos?: string;
  costMt?: number;
  readingValueOffpeak?: number; // accumulated off-peak for energy
  consumptionOffpeak?: number; // calculated offpeak
  readingValuePeak?: number; // accumulated peak (expediente) for energy
  consumptionPeak?: number; // calculated peak
  saldoInicioDia?: number; // saldo no inicio de hoje
  createdAt: string;
  gmailId?: string;

  // Custom fuel fields
  distancia?: number;
  consumoLitros?: number;
  consumoMt?: number;
  precoPorLitro?: number;
  source?: string;
}

export interface Alert {
  id: string;
  userId: string;
  monitorId: string;
  monitorName: string;
  date: string;
  value: number;
  average7days: number;
  percentDeviation: number;
  read: boolean;
  createdAt: string;
}


export interface Target {
  id: string;
  userId: string;
  category: CategoryType;
  month: string; // YYYY-MM (reference month)
  targetValue: number;
  createdAt: string;
}

export interface DashboardStats {
  category: CategoryType;
  currentValue: number;
  unit: string;
  percentageChange: number; // relative to previous day/record
  trend: "up" | "down" | "flat";
  monthlyTarget: number;
  monthlyTotal: number;
  alertActive: boolean; // if consumption > 7-day average + 20%
  average7Days: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "model";
  content: string;
  image?: {
    mimeType: string;
    data: string; // Base64
  };
  detectedData?: {
    category: CategoryType;
    unit: string;
    value: number;
    date: string;
    confidence: "alta" | "baixa";
    message: string;
  };
  createdAt: string;
}
