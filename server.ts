import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { Database } from "./server/db.js";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini client lazily to avoid crashing on launch if missing API key
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("A chave GEMINI_API_KEY não foi configurada nas variáveis de ambiente.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Import helper files natively using ES module loading
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" })); // Increase JSON payload threshold for image uploads
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Secret key for token signing and password hashing
const JWT_SECRET = process.env.JWT_SECRET || "consumo-app-stable-secret-key-9284729487";
const PASSWORD_SALT = "consumo-app-stable-salt-key-1823984129";

// Simple JWT alternative (token = Base64 encoded payload + signature)
function generateToken(userId: string): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + 24 * 60 * 60 * 1000 * 7 });
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64") + "." + signature;
}

function verifyToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const payloadRaw = Buffer.from(parts[0], "base64").toString("utf-8");
    const signature = parts[1];
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(payloadRaw).digest("hex");
    if (signature !== expectedSig) return null;
    
    const payload = JSON.parse(payloadRaw);
    if (payload.exp < Date.now()) return null; // expired
    return payload.userId;
  } catch (e) {
    return null;
  }
}

// Auth Middleware
const authenticateUser = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const userId = verifyToken(token);
  if (!userId) {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
    return;
  }

  // Inject userId in request properties
  (req as any).userId = userId;
  next();
};

// Helper to strip credentials and append boolean status flag for Gmail
function sanitizeUser(user: any) {
  if (!user) return null;
  const { passwordHash, gmailToken, ...rest } = user;
  return {
    ...rest,
    gmailConnected: !!gmailToken,
  };
}

// --- AUTH API ROUTES ---
app.post("/api/auth/register", async (req, res) => {
  const { email, password, fullName, company } = req.body;
  if (!email || !password || !fullName) {
    res.status(400).json({ error: "Campos obrigatórios: email, senha, nome completo" });
    return;
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    // Simple hashed password with a stable salt
    const passwordHash = crypto.createHash("sha256").update(password + PASSWORD_SALT).digest("hex");
    const user = await Database.createUser(cleanEmail, passwordHash, fullName, company || "");
    const token = generateToken(user.id);

    res.status(201).json({ user: sanitizeUser(user), token });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Erro ao registrar" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Campos obrigatórios: email e senha" });
    return;
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const user = await Database.getUserByEmail(cleanEmail);
    if (!user) {
      res.status(400).json({ error: "Credenciais inválidas" });
      return;
    }

    const passwordHash = crypto.createHash("sha256").update(password + PASSWORD_SALT).digest("hex");
    if (user.passwordHash !== passwordHash) {
      res.status(400).json({ error: "Credenciais inválidas" });
      return;
    }

    const token = generateToken(user.id);
    res.json({ user: sanitizeUser(user), token });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro de login" });
  }
});

app.get("/api/auth/me", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const user = await Database.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  res.json({ user: sanitizeUser(user) });
});

app.patch("/api/auth/profile", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const { fullName, company, emailReportsEnabled, theme, precoPorLitro, whatsappReportsEnabled, whatsappPhone } = req.body;

  try {
    const user = await Database.updateUserProfile(userId, {
      fullName,
      company,
      emailReportsEnabled,
      theme,
      precoPorLitro: precoPorLitro !== undefined ? Number(precoPorLitro) : undefined,
      whatsappReportsEnabled: whatsappReportsEnabled !== undefined ? Boolean(whatsappReportsEnabled) : undefined,
      whatsappPhone,
    });

    res.json({ user: sanitizeUser(user) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Erro ao atualizar perfil" });
  }
});

// --- METER READINGS API ROUTES ---
app.get("/api/readings", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const readings = await Database.getReadings(userId);
  res.json(readings);
});

app.post("/api/readings", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const {
    category,
    readingDate,
    readingValue,
    unit,
    notes,
    kmInicial,
    kmFinal,
    destinos,
    costMt,
    readingValueOffpeak,
    readingValuePeak,
    saldoInicioDia,
  } = req.body;

  if (!category || !readingDate || readingValue === undefined || !unit) {
    res.status(400).json({ error: "Campos obrigatórios: categoria, data, valor da leitura e unidade" });
    return;
  }

  try {
    const reading = await Database.createReading(userId, {
      category,
      readingDate,
      readingValue,
      unit,
      notes: notes || "",
      kmInicial,
      kmFinal,
      destinos,
      costMt,
      readingValueOffpeak,
      readingValuePeak,
      saldoInicioDia,
    });
    res.status(201).json(reading);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Erro ao criar leitura" });
  }
});

app.patch("/api/readings/:id", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const readingId = req.params.id;
  const updates = req.body;

  try {
    const reading = await Database.updateReading(userId, readingId, updates);
    res.json(reading);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Erro ao atualizar leitura" });
  }
});

app.delete("/api/readings/:id", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const readingId = req.params.id;

  try {
    await Database.deleteReading(userId, readingId);
    res.json({ success: true, message: "Leitura excluída" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Erro ao excluir leitura" });
  }
});

// Purge all readings for this user
app.delete("/api/readings", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  try {
    await Database.clearAllReadings(userId);
    res.json({ success: true, message: "Todos os registros de consumo foram removidos" });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao limpar histórico de leituras" });
  }
});

// --- AI CHAT CORE API ENDPOINTS ---

// Fetch conversation log history
app.get("/api/chat/history", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const history = await Database.getChatHistory(userId);
    res.json(history);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao carregar histórico" });
  }
});

// Delete conversation history logs
app.delete("/api/chat/history", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  try {
    await Database.clearChatHistory(userId);
    res.json({ success: true, message: "Registro de conversas limpo!" });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Falha ao limpar histórico" });
  }
});

// Process a chat event (Text question or Multimodal Image Vision)
app.post("/api/chat", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const { message, image } = req.body;

  // Check upfront if GEMINI_API_KEY is configured
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(400).json({
      error: "GEMINI_API_KEY_NOT_CONFIGURED",
      error_pt: "A chave API do Gemini não está configurada.",
      message: "A chave GEMINI_API_KEY não foi configurada nas variáveis de ambiente. Por favor, aceda a 'Definições > Segredos' no painel lateral esquerdo do AI Studio e insira uma chave de API válida para ativar as funções do Assistente Inteligente."
    });
    return;
  }

  try {
    const ai = getGeminiClient();

    // 1. Save User Question to persistent history
    await Database.addChatMessage(userId, "user", message || (image ? "[Upload de Imagem]" : ""), image);

    if (image && image.data && image.mimeType) {
      // MULTIMODAL DETECTION MODE
      const promptText = `Analise a imagem de medidor, painel ou recibo de consumo e extraia os dados abaixo para registro. 
Mensagem adicional opcional do usuário: "${message || "registrar essa leitura"}"

Você deve retornar obrigatoriamente um objeto JSON com a seguinte estrutura:
{
  "Monitor detectado": "Energia" | "Água" | "Combustível" | "Internet",
  "unidade": "kWh" | "m³" | "L" | "GB",
  "Tipo de rastreamento": "cumulativo",
  "valor detectado": <número correspondente ao valor acumulado do visor ou quantidade abastecida>,
  "data detectada": "YYYY-MM-DD",
  "Confiança": "alta" | "baixa",
  "messageToUser": "A sua mensagem amigável explicando o que detectou na faturamento / visor."
}

Se a imagem estiver cortada ou o visor estiver ilegível, use Confiança="baixa". A data detectada hoje seria "${new Date().toISOString().slice(0, 10)}".`;

      const imagePart = {
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [imagePart, { text: promptText }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              "Monitor detectado": { type: Type.STRING },
              "unidade": { type: Type.STRING },
              "Tipo de rastreamento": { type: Type.STRING },
              "valor detectado": { type: Type.NUMBER },
              "data detectada": { type: Type.STRING },
              "Confiança": { type: Type.STRING },
              "messageToUser": { type: Type.STRING }
            },
            required: [
              "Monitor detectado",
              "unidade",
              "Tipo de rastreamento",
              "valor detectado",
              "data detectada",
              "Confiança",
              "messageToUser"
            ]
          }
        }
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText.trim());

      // Map dynamic Portuguese outputs back to strict category types
      const rawCategory = parsed["Monitor detectado"] || "";
      let mappedCategory: "energia" | "agua" | "combustivel" | "internet" = "energia";
      const lowerCat = rawCategory.toLowerCase();
      if (lowerCat.includes("águ") || lowerCat.includes("agua")) mappedCategory = "agua";
      else if (lowerCat.includes("combust") || lowerCat.includes("gasol") || lowerCat.includes("gas") || lowerCat.includes("fuel") || lowerCat.includes("receit") || lowerCat.includes("recib") || lowerCat.includes("posto")) mappedCategory = "combustivel";
      else if (lowerCat.includes("inter") || lowerCat.includes("net") || lowerCat.includes("wifi") || lowerCat.includes("dad") || lowerCat.includes("banda")) mappedCategory = "internet";

      const detected = {
        category: mappedCategory,
        unit: parsed.unidade || (mappedCategory === "energia" ? "kWh" : mappedCategory === "agua" ? "m³" : mappedCategory === "combustivel" ? "L" : "GB"),
        value: parsed["valor detectado"] || 0,
        date: parsed["data detectada"] || new Date().toISOString().slice(0, 10),
        confidence: parsed["Confiança"] === "alta" ? "alta" as const : "baixa" as const,
        message: parsed.messageToUser || "Leitura identificada com sucesso!"
      };

      // 2. Persist Assistant Response
      const assistantMsg = await Database.addChatMessage(
        userId, 
        "model", 
        detected.message, 
        undefined, 
        detected
      );

      res.status(201).json(assistantMsg);
    } else {
      // CONVERSATIONAL TEXT MODE WITH REAL DB CONTEXT
      const readings = await Database.getReadings(userId);
      const targets = await Database.getTargets(userId);
      const userObj = await Database.getUserById(userId);

      const readingsContext = readings.slice(0, 80).map(r => 
        `- Data: ${r.readingDate}, Categoria: ${r.category}, Valor Acumulado: ${r.readingValue} ${r.unit}, Consumo Diferencial: ${r.consumption} ${r.unit}, Notas: ${r.notes || "N/A"}${r.costMt ? `, Custo: ${r.costMt} Mt` : ""}${r.kmInicial ? `, KM: ${r.kmInicial} a ${r.kmFinal}` : ""}`
      ).join("\n");

      const targetsContext = targets.map(t =>
        `- Categoria: ${t.category}, Mês: ${t.month}, Meta Máxima Limitadora: ${t.targetValue}`
      ).join("\n");

      const systemInstruction = `Você é o "Assistente IA de Monitoria", um inteligente assistente de inteligência artificial em Moçambique especializado no monitoramento diário e faturamento doméstico de energia (Credelec/EDM), água, combustível e internet. 
O seu nome é "Assistente de Consumos IA". Você interage de forma acolhedora, objetiva e profissional.

Dados do usuário ativo:
- Nome: ${userObj?.fullName || "Usuário"}
- Residência / Empresa: ${userObj?.company || "N/A"}

=== HISTÓRICO DE LEITURAS (BD) ===
${readingsContext || "(Nenhum registro encontrado)"}

=== METAS MENSAIS DEFINIDAS (BD) ===
${targetsContext || "(Nenhuma meta estipulada)"}

Instruções e diretrizes:
1. Responda à pergunta do usuário utilizando os dados históricos reais listados acima.
2. Efetue somatórios, deduções, simulações ou comparações matemáticas diretamente das leituras se solicitado pelo usuário (ex: "quanto gastei de água?", "qual o consumo médio diário").
3. Alerte o usuário de maneira útil se eles estiverem perto de exceder ou já excederam as metas mensais definidas.
4. Caso as leituras indiquem que não há dados, incentive o usuário a registrar faturas ou usar o chat de visão enviando uma foto.
5. Responda amigavelmente em português. Use parágrafos claros e negrito para destacar valores chaves.`;

      // Fetch chat history (retriving users and models messages to establish context)
      const chatHistory = await Database.getChatHistory(userId);
      
      // Structure the multi-turn contents list based on actual stored logs
      const contentsList = chatHistory.map(item => ({
        role: item.role === "model" ? "model" as const : "user" as const,
        parts: [{ text: item.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsList,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const responseText = response.text || "Desculpe, não consegui processar sua mensagem de texto de forma satisfatória.";

      // 2. Persist Assistant Response
      const assistantMsg = await Database.addChatMessage(userId, "model", responseText);
      res.status(201).json(assistantMsg);
    }
  } catch (e: any) {
    console.error("Falha ao chamar a API do Gemini:", e);
    
    // Recovery Fallback / Intelligent Offline Mode response instead of freezing
    const errorText = `[MODO DE CONTINGÊNCIA ATIVO] Peço desculpas, mas não consigo comunicar com o servidor inteligente da Google no momento. Verifique as credenciais ou tente novamente. 
Detalhe técnico: ${e.message || "Erro de Conexão API"}`;
    
    const fallbackMsg = await Database.addChatMessage(userId, "model", errorText);
    res.status(201).json(fallbackMsg);
  }
});

// --- TARGETS API ROUTES ---
app.get("/api/targets", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const targets = await Database.getTargets(userId);
  res.json(targets);
});

app.post("/api/targets", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const { category, month, targetValue } = req.body;

  if (!category || !month || targetValue === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: categoria, mês de referência e valor da meta" });
    return;
  }

  try {
    const target = await Database.upsertTarget(userId, {
      category,
      month,
      targetValue,
    });
    res.status(200).json(target);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Erro ao salvar meta" });
  }
});

app.delete("/api/targets/:id", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const targetId = req.params.id;

  try {
    await Database.deleteTarget(userId, targetId);
    res.json({ success: true, message: "Meta excluída" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Erro ao excluir meta" });
  }
});

// Helper to extract email body from Gmail's mime payload
function getBodyFromMessage(message: any): string {
  let body = "";
  if (message.payload && message.payload.parts) {
    const findPlain = (parts: any[]): string => {
      for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body && part.body.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }
        if (part.parts) {
          const res = findPlain(part.parts);
          if (res) return res;
        }
      }
      return "";
    };
    body = findPlain(message.payload.parts);
  }
  if (!body && message.payload && message.payload.body && message.payload.body.data) {
    body = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
  }
  return body || message.snippet || "";
}

// --- GMAIL SERVICES & OAUTH ROUTES ---

app.get("/api/auth/google/url", authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const redirectUri = `${process.env.APP_URL || req.protocol + "://" + req.get("host")}/auth/callback`;
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || "";
  
  if (!clientId) {
    res.status(500).json({ error: "GOOGLE_CLIENT_ID não configurado no servidor. Defina CLIENT_ID na consola do AI Studio." });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.json({ url: authUrl });
});

// Catch OAuth Google Flow Callback
app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code, state } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || "";
  const redirectUri = `${process.env.APP_URL || req.protocol + "://" + req.get("host")}/auth/callback`;

  if (!code) {
    res.status(400).send("Código de autorização não fornecido pela Google.");
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      res.status(400).send(`Erro ao trocar código por token Google: ${tokenData.error_description || tokenData.error || "Erro desconhecido"}`);
      return;
    }

    const accessToken = tokenData.access_token;

    // Fetch user Gmail address
    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileData = await profileRes.json();
    const gmailEmail = profileData.emailAddress || "";

    // Save token associated with the user state
    const userId = state as string;
    if (userId) {
      await Database.updateUserProfile(userId, {
        gmailToken: accessToken,
        gmailEmail: gmailEmail,
      });
    }

    res.send(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Conexão com o Gmail com sucesso!</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              background-color: #0c0a09;
              color: #f5f5f4;
              margin: 0;
              text-align: center;
            }
            .card {
              background: #1c1917;
              padding: 2.5rem;
              border-radius: 1.5rem;
              border: 1px solid #2e2a24;
              max-width: 420px;
            }
            h2 { color: #3b82f6; margin-top: 0; }
            p { margin-bottom: 2rem; color: #a8a29e; line-height: 1.5; }
            .spinner {
              border: 4px solid rgba(255, 255, 255, 0.1);
              width: 36px;
              height: 36px;
              border-radius: 50%;
              border-left-color: #3b82f6;
              animation: spin 1s linear infinite;
              margin: 0 auto;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Gmail Conectado!</h2>
            <p>O seu e-mail <strong>${gmailEmail}</strong> foi associado de forma segura ao seu perfil de monitoramento de consumos.</p>
            <div class="spinner"></div>
            <p style="font-size: 0.85rem; color: #78716c; margin-top: 1.5rem;">Esta janela será fechará automaticamente...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GMAIL_AUTH_SUCCESS', email: '${gmailEmail}' }, '*');
              setTimeout(() => {
                window.close();
              }, 2500);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Erro no callback de autenticação do Google:", err);
    res.status(500).send(`Erro interno ao processar autenticação Google: ${err.message}`);
  }
});

app.delete("/api/auth/google/disconnect", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  try {
    await Database.updateUserProfile(userId, {
      gmailToken: undefined,
      gmailEmail: undefined,
    });
    res.json({ success: true, message: "Conta do Gmail desconectada com sucesso!" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Erro ao desconectar Gmail" });
  }
});

app.get("/api/gmail/sync-invoices", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const user = await Database.getUserById(userId);
    if (!user || !user.gmailToken) {
      res.status(400).json({ error: "Sua conta do Gmail não está conectada. Por favor, conecte-a para buscar faturas." });
      return;
    }

    const token = user.gmailToken;
    const query = encodeURIComponent("fatura OR consumo OR edm OR credelec OR mcel OR vodacom OR internet OR agua OR combustível OR fipag");
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=15`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!searchRes.ok) {
      if (searchRes.status === 401) {
        // Clear expired token
        await Database.updateUserProfile(userId, {
          gmailToken: undefined,
          gmailEmail: undefined,
        });
        res.status(401).json({ error: "A sua conexão com o Gmail expirou. Por favor, conecte novamente.", reconnectRequired: true });
        return;
      }
      res.status(500).json({ error: `Erro na comunicação com o Gmail API: ${searchRes.statusText}` });
      return;
    }

    const searchData = await searchRes.json();
    const messages = searchData.messages || [];

    if (messages.length === 0) {
      res.json({ faturas: [] });
      return;
    }

    const invoiceCandidates: any[] = [];
    for (const msg of messages) {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (msgRes.ok) {
        const detail = await msgRes.json();
        const headers = detail.payload?.headers || [];
        const from = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
        const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
        const date = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";
        const snippet = detail.snippet || "";
        const body = getBodyFromMessage(detail);

        invoiceCandidates.push({
          gmailId: msg.id,
          from,
          subject,
          date,
          snippet,
          bodyExcerpt: body.slice(0, 1500),
        });
      }
    }

    // Now, run Gemini AI model to identify, filter and parse invoice emails
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(400).json({
        error: "GEMINI_API_KEY_NOT_CONFIGURED",
        error_pt: "A chave API do Gemini não está configurada.",
        message: "A chave GEMINI_API_KEY não foi configurada nas variáveis de ambiente. Por favor, aceda a 'Definições > Segredos' no painel lateral esquerdo do AI Studio e configure a chave para ativar a importação inteligente do Gmail."
      });
      return;
    }

    const ai = getGeminiClient();
    const prompt = `Você recebeu um array JSON com ${invoiceCandidates.length} e-mails recentes buscados na caixa de entrada de Gmail do usuário.
Analise o assunto, remetente, snippet e trecho do corpo para identificar se representam faturas de consumo ou recibos de pagamento de serviços em Moçambique dos seguintes e-mails / categorias:
1. Energia ("energia") - Credelec ou EDM (Eletricidade de Moçambique)
2. Água ("agua") - FIPAG, Águas da Região ou correspondentes
3. Combustível ("combustivel") - Galp, Total, Shell, Petromoc etc.
4. Internet / Telecom ("internet") - mCel, Vodacom, Movitel, TV Cabo, Jive, etc.

E-MAILS RECEBIDOS PARA ANALISAR:
${JSON.stringify(invoiceCandidates, null, 2)}

Incorpore as seguintes regras estritas de análise de faturas de Moçambique:
- Se for uma recarga EDM Credelec (compra de energia pré-paga), por exemplo, de 500 MT, e o saldo kWh não for especificado, estime o valor correspondente: 1 Metical é aproximadamente 0.1 kWh.
- Se for recarga ou factura de dados (como pacotes de internet da Vodacom ou Movitel) de 100 MT, e a quantidade de GB/MB não for explícita, estime: 100 MT representa aproximadamente 1.5 GB.
- Se for uma fatura de água (FIPAG) onde consta o valor consumido em m³ e o custo em Meticais, use esses.

Retorne OBRIGATORIAMENTE um objeto JSON que contém um array chamado "faturas" da seguinte forma estruturada:
{
  "faturas": [
    {
      "gmailId": "ID_DO_GMAIL_CORRESPONDENTE",
      "subject": "Assunto amigável para exibição",
      "date": "YYYY-MM-DD",  // Data da transição ou e-mail
      "category": "energia" | "agua" | "combustivel" | "internet",
      "value": <número correspondente ao consumo faturado ou quantia recarregada em unidades (kWh, m³, L, GB)>,
      "unit": "kWh" | "m³" | "L" | "GB",
      "costMt": <número com custo total pago ou faturado em Meticais, de preferência arredondado, ou null se não constar>,
      "notes": "Uma breve frase resumindo. Ex: 'Fatura EDM de Maio' ou 'Recarga Vodacom de 10GB'"
    }
  ]
}

Regras adicionais:
- Exclua totalmente e-mails promocionais, de spam, ou outros que não tenham relação com faturamento ou transações de serviços básicos.
- Só retorne as faturas válidas mapeadas. Se não existirem faturas, retorne o array "faturas" vazio.
- Utilize sempre o "gmailId" original fornecido no input.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faturas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  gmailId: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  date: { type: Type.STRING },
                  category: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  costMt: { type: Type.NUMBER },
                  notes: { type: Type.STRING },
                },
                required: ["gmailId", "subject", "date", "category", "value", "unit", "notes"],
              },
            },
          },
          required: ["faturas"],
        },
      },
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text.trim());
    res.json(parsed);
  } catch (err: any) {
    console.error("Erro ao sincronizar faturas do Gmail:", err);
    res.status(500).json({ error: `Erro na análise de faturas do Gmail: ${err.message}` });
  }
});

// Helper to construct a raw base64url encoded MIME email
function buildRawEmail(to: string, fromName: string, subject: string, htmlBody: string): string {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const messageParts = [
    `To: ${to}`,
    `From: "${fromName}" <me>`,
    `Subject: ${utf8Subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    htmlBody,
  ];
  const message = messageParts.join("\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Route to manually or automatically send daily consumption reports via Gmail
app.post("/api/gmail/send-report", authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const user = await Database.getUserById(userId);
    if (!user || !user.gmailToken || !user.gmailEmail) {
      res.status(400).json({ error: "Sua conta do Gmail não está conectada. Por favor, conecte-a nas configurações de Perfil." });
      return;
    }

    const readings = await Database.getReadings(userId);
    const targets = await Database.getTargets(userId);

    const dataSummary = {
      user: { fullName: user.fullName, company: user.company },
      hasReadings: readings.length > 0,
      recentReadings: readings.slice(0, 10).map(r => ({
        category: r.category,
        date: r.readingDate,
        value: r.readingValue,
        unit: r.unit,
        consumption: r.consumption,
        costMt: r.costMt,
        notes: r.notes
      })),
      targets: targets.map(t => ({
        category: t.category,
        month: t.month,
        targetValue: t.targetValue
      }))
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(400).json({
        error: "GEMINI_API_KEY_NOT_CONFIGURED",
        error_pt: "A chave API do Gemini não está configurada.",
        message: "A chave GEMINI_API_KEY não foi configurada nas variáveis de ambiente. Por favor, aceda a 'Definições > Segredos' no painel lateral esquerdo do AI Studio e insira uma chave de API para habilitar a geração inteligente do relatório diário."
      });
      return;
    }

    const ai = getGeminiClient();
    const prompt = `Gere um corpo de e-mail incrível em formato HTML extremamente limpo, moderno e profissional, sem nenhuma crase ou formatação markdown (como fatias de código \`\`\`html). O tema deve usar tons elegantes como ardósia (#334155), azul (#2563eb) e cinza (#f8fafc).
O e-mail é um Relatório Personalizado de Monitoramento Diário de Consumos em Moçambique para o usuário ${user.fullName} (${user.company || 'Residência'}).

Dados do Usuário a serem resumidos de forma humanizada e detalhada:
${JSON.stringify(dataSummary, null, 2)}

Seção por seção do e-mail:
1. Cabeçalho de alta qualidade: "Relatório Inteligente de Monitoria de Consumos" com um subtítulo estético e a data de hoje.
2. Resumo executivo dos registros mais recentes e estimativas de gastos atuais em Meticais.
3. Seção dedicada ao estado de metas: compare as metas estipuladas com o consumo real detectado. Destaque em cores (laranja/vermelho se estiver perto de estourar, verde se estiver seguro sob o limite).
4. Forneça exatamente 3 dicas fantásticas de economia personalizadas geradas por você (Gemini), com referências a Moçambique (ex: tarifas sociais de EDM, uso do Credelec em horários fora de ponta se aplicável, poupança de água do FIPAG, ou controle de pacotes de dados da Vodacom/Movitel).
5. Rodapé amigável do aplicativo de Gestão de Consumos IA.

Retorne SOMENTE o código HTML válido e direto para inserir sob a tag do corpo do e-mail, de modo que ele renderize perfeitamente em clientes modernos de e-mail (como Gmail, Outlook).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const htmlBody = response.text || "<h3>Relatório de Consumo</h3><p>Nenhuma leitura registrada recentemente para analisar.</p>";

    const rawMessage = buildRawEmail(
      user.gmailEmail,
      "Monitor de Consumo IA",
      `Relatório Diário de Consumo - ${new Date().toLocaleDateString("pt-BR")}`,
      htmlBody
    );

    const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.gmailToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: rawMessage }),
    });

    if (!gmailRes.ok) {
      if (gmailRes.status === 401) {
        // Clear revoked or expired token
        await Database.updateUserProfile(userId, {
          gmailToken: undefined,
          gmailEmail: undefined,
        });
        res.status(401).json({ error: "Sua autorização Google expirou ou foi revogada. Conecte novamente no Perfil.", reconnectRequired: true });
        return;
      }
      const gmailErr = await gmailRes.json().catch(() => ({}));
      res.status(500).json({ error: `Erro na API do Gmail ao enviar e-mail: ${gmailErr.error?.message || gmailRes.statusText}` });
      return;
    }

    res.json({ success: true, message: `O relatório diário com dicas personalizadas da IA foi enviado com sucesso para ${user.gmailEmail}!` });
  } catch (err: any) {
    console.error("Erro ao enviar e-mail:", err);
    res.status(500).json({ error: `Falha ao processar e enviar o relatório por e-mail: ${err.message}` });
  }
});

// --- VITE INTERFACE / STATIC FILES ---
async function start() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Use Vite dev server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: Static files serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running on http://0.0.0.0:${PORT}`);
  });
}

start();
