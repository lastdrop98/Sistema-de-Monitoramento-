import fs from "fs";
import path from "path";
import crypto from "crypto";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch
} from "firebase/firestore";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  company: string;
  emailReportsEnabled: boolean;
  theme: "light" | "dark";
  createdAt: string;
  gmailToken?: string;
  gmailEmail?: string;
  precoPorLitro?: number;
  whatsappReportsEnabled?: boolean;
  whatsappPhone?: string;
}

export interface MeterReading {
  id: string;
  userId: string;
  category: "energia" | "agua" | "combustivel" | "internet";
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
  readingValuePeak?: number;    // accumulated peak (expediente) for energy
  consumptionPeak?: number;     // calculated peak
  saldoInicioDia?: number;      // saldo no inicio do dia
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
  category: "energia" | "agua" | "combustivel" | "internet";
  month: string; // YYYY-MM (reference month)
  targetValue: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "model";
  content: string;
  image?: {
    mimeType: string;
    data: string;
  };
  detectedData?: {
    category: string;
    unit: string;
    value: number;
    date: string;
    confidence: "alta" | "baixa";
    message: string;
  };
  createdAt: string;
}

// ----------------------------------------------------
// Firebase Firestore Initialization
// ----------------------------------------------------

const CONFIG_FILE = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
if (fs.existsSync(CONFIG_FILE)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (err) {
    console.error("Failed to parse firebase-applet-config.json", err);
  }
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export class Database {
  // --- Auth & Users ---
  public static async createUser(email: string, passwordHash: string, fullName: string, company: string): Promise<User> {
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new Error("E-mail já cadastrado");
    }

    const id = crypto.randomUUID();
    const newUser: User = {
      id,
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      company,
      emailReportsEnabled: false,
      theme: "light",
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "users", id), newUser);
    return newUser;
  }

  public static async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const q = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return undefined;
      return snapshot.docs[0].data() as User;
    } catch (e) {
      console.error("Error retrieving user by email from Firestore", e);
      return undefined;
    }
  }

  public static async getUserById(id: string): Promise<User | undefined> {
    try {
      const d = await getDoc(doc(db, "users", id));
      if (!d.exists()) return undefined;
      return d.data() as User;
    } catch (e) {
      console.error("Error retrieving user from Firestore", e);
      return undefined;
    }
  }

  public static async updateUserProfile(id: string, updates: Partial<User>): Promise<User> {
    const userRef = doc(db, "users", id);
    const d = await getDoc(userRef);
    if (!d.exists()) {
      throw new Error("Usuário não encontrado");
    }
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(userRef, cleanUpdates);
    const updated = await getDoc(userRef);
    return updated.data() as User;
  }

  // --- Meter Readings ---
  public static async getReadings(userId: string): Promise<MeterReading[]> {
    try {
      const q = query(collection(db, "readings"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const readings = snapshot.docs.map(doc => doc.data() as MeterReading);
      return readings.sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());
    } catch (e) {
      console.error("Error fetching readings from Firestore", e);
      return [];
    }
  }

  public static async createReading(userId: string, reading: Omit<MeterReading, "id" | "userId" | "consumption" | "consumptionOffpeak" | "createdAt">): Promise<MeterReading> {
    const allReadings = await this.getReadings(userId);
    const categoryReadingsSorted = allReadings
      .filter(r => r.category === reading.category)
      .sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());

    let prevReading: MeterReading | null = null;
    const targetTime = new Date(reading.readingDate).getTime();
    for (let i = categoryReadingsSorted.length - 1; i >= 0; i--) {
      const r = categoryReadingsSorted[i];
      if (new Date(r.readingDate).getTime() <= targetTime) {
        prevReading = r;
        break;
      }
    }

    let consumption = 0;
    if (reading.category === "combustivel") {
      consumption = reading.readingValue;
    } else if (prevReading) {
      consumption = Math.max(0, reading.readingValue - prevReading.readingValue);
    }

    let consumptionOffpeak: number | undefined;
    if (reading.category === "energia" && reading.readingValueOffpeak !== undefined) {
      consumptionOffpeak = 0;
      if (prevReading && prevReading.readingValueOffpeak !== undefined) {
        consumptionOffpeak = Math.max(0, reading.readingValueOffpeak - prevReading.readingValueOffpeak);
      }
    }

    let kmInicial = reading.category === "combustivel" ? reading.kmInicial : undefined;
    let kmFinal = reading.category === "combustivel" ? reading.kmFinal : undefined;
    let distancia: number | undefined;
    let consumoLitros: number | undefined;
    let consumoMt: number | undefined;
    let precoPorLitro: number | undefined;

    if (reading.category === "combustivel") {
      if (kmInicial !== undefined && kmFinal !== undefined) {
        distancia = Math.max(0, kmFinal - kmInicial);
      }
      consumoLitros = (reading as any).consumoLitros !== undefined ? (reading as any).consumoLitros : reading.readingValue;
      consumoMt = (reading as any).consumoMt;
      precoPorLitro = (reading as any).precoPorLitro;
    }

    const id = crypto.randomUUID();
    const newReading: MeterReading = {
      ...reading,
      id,
      userId,
      consumption,
      consumptionOffpeak,
      kmInicial,
      kmFinal,
      distancia,
      consumoLitros,
      consumoMt,
      precoPorLitro,
      createdAt: new Date().toISOString(),
    };

    const cleanedReading = Object.fromEntries(
      Object.entries(newReading).filter(([_, v]) => v !== undefined)
    );
    await setDoc(doc(db, "readings", id), cleanedReading);

    // Re-index readings for this user & category to ensure consistency of calculations
    await this.recalculateConsumptionForCategory(userId, reading.category);

    const finalRead = await getDoc(doc(db, "readings", id));
    return finalRead.data() as MeterReading;
  }

  public static async updateReading(userId: string, readingId: string, updates: Partial<Omit<MeterReading, "id" | "userId" | "createdAt">>): Promise<MeterReading> {
    const ref = doc(db, "readings", readingId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists() || snapshot.data().userId !== userId) {
      throw new Error("Leitura não encontrada");
    }

    const originalCategory = snapshot.data().category;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(ref, cleanUpdates);

    // Recalculate consumption
    await this.recalculateConsumptionForCategory(userId, originalCategory);
    if (updates.category && updates.category !== originalCategory) {
      await this.recalculateConsumptionForCategory(userId, updates.category);
    }

    const finalRead = await getDoc(ref);
    return finalRead.data() as MeterReading;
  }

  public static async deleteReading(userId: string, readingId: string): Promise<void> {
    const ref = doc(db, "readings", readingId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists() || snapshot.data().userId !== userId) {
      throw new Error("Leitura não encontrada");
    }

    const category = snapshot.data().category;
    await deleteDoc(ref);

    // Recalculate after delete to fix downstream readings
    await this.recalculateConsumptionForCategory(userId, category);
  }

  private static async recalculateConsumptionForCategory(userId: string, category: "energia" | "agua" | "combustivel" | "internet"): Promise<void> {
    const allReadings = await this.getReadings(userId);
    const catReadingsSorted = allReadings
      .filter(r => r.category === category)
      .sort((a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime());

    for (let i = 0; i < catReadingsSorted.length; i++) {
      const item = catReadingsSorted[i];
      let updatedFields: any = {};
      if (category === "combustivel") {
        updatedFields.consumption = item.readingValue;
        if (item.kmInicial !== undefined && item.kmFinal !== undefined) {
          updatedFields.distancia = Math.max(0, item.kmFinal! - item.kmInicial!);
        }
      } else if (i === 0) {
        updatedFields.consumption = 0; // Initial reading
        if (item.readingValueOffpeak !== undefined) {
          updatedFields.consumptionOffpeak = 0;
        }
        if (item.readingValuePeak !== undefined) {
          updatedFields.consumptionPeak = 0;
        }
      } else {
        const prev = catReadingsSorted[i - 1];
        updatedFields.consumption = Math.max(0, item.readingValue - prev.readingValue);
        if (item.readingValueOffpeak !== undefined && prev.readingValueOffpeak !== undefined) {
          updatedFields.consumptionOffpeak = Math.max(0, item.readingValueOffpeak - prev.readingValueOffpeak);
        }
        if (item.readingValuePeak !== undefined && prev.readingValuePeak !== undefined) {
          updatedFields.consumptionPeak = Math.max(0, item.readingValuePeak - prev.readingValuePeak);
        }
      }

      await updateDoc(doc(db, "readings", item.id), updatedFields);
    }
  }

  // --- Targets ---
  public static async getTargets(userId: string): Promise<Target[]> {
    try {
      const q = query(collection(db, "targets"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Target);
    } catch (e) {
      console.error("Error fetching targets from Firestore", e);
      return [];
    }
  }

  public static async upsertTarget(userId: string, target: Omit<Target, "id" | "userId" | "createdAt">): Promise<Target> {
    const q = query(
      collection(db, "targets"),
      where("userId", "==", userId),
      where("category", "==", target.category),
      where("month", "==", target.month)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const targetRef = doc(db, "targets", snapshot.docs[0].id);
      await updateDoc(targetRef, { targetValue: target.targetValue });
      const finalDoc = await getDoc(targetRef);
      return finalDoc.data() as Target;
    } else {
      const id = crypto.randomUUID();
      const newTarget: Target = {
        ...target,
        id,
        userId,
        createdAt: new Date().toISOString(),
      };
      const cleanedTarget = Object.fromEntries(
        Object.entries(newTarget).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, "targets", id), cleanedTarget);
      return newTarget;
    }
  }

  public static async deleteTarget(userId: string, targetId: string): Promise<void> {
    const ref = doc(db, "targets", targetId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists() || snapshot.data().userId !== userId) {
      throw new Error("Meta não encontrada");
    }
    await deleteDoc(ref);
  }

  // --- Clear Readings Helper ---
  public static async clearAllReadings(userId: string): Promise<void> {
    const q = query(collection(db, "readings"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }

  // --- Persistent Chat Log Helpers ---
  public static async getChatHistory(userId: string): Promise<ChatMessage[]> {
    try {
      const q = query(collection(db, "chats"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const chats = snapshot.docs.map(doc => doc.data() as ChatMessage);
      return chats.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      console.error("Error fetching chat logs from Firestore", e);
      return [];
    }
  }

  public static async addChatMessage(
    userId: string,
    role: "user" | "model",
    content: string,
    image?: { mimeType: string; data: string },
    detectedData?: ChatMessage["detectedData"]
  ): Promise<ChatMessage> {
    const id = crypto.randomUUID();
    const newMessage: ChatMessage = {
      id,
      userId,
      role,
      content,
      image: image || null as any,
      detectedData: detectedData || null as any,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "chats", id), newMessage);
    return newMessage;
  }

  public static async clearChatHistory(userId: string): Promise<void> {
    const q = query(collection(db, "chats"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}
