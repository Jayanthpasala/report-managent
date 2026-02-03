import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, AnalysisContext, FileData, ExchangeRates } from "../types";

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1500;
const FX_API_KEY = "15462bbda90bc7978eaccae6";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface RateUpdateResponse {
  rates: ExchangeRates;
  sources: { title: string; uri: string }[];
  isLive: boolean;
}

const getSafeApiKey = (): string => {
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return "";
};

export const getLatestExchangeRates = async (currencies: string[]): Promise<RateUpdateResponse> => {
  // Hardcoded fallback rates as a last resort (INR equivalents)
  const defaultRates: ExchangeRates = { 'SGD': 63.80, 'AUD': 55.40, 'INR': 1, 'USD': 83.90, 'AED': 22.80, 'GBP': 106.10, 'EUR': 91.20 };
  
  try {
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${FX_API_KEY}/latest/INR`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (data.result === "success") {
      const conversionRates = data.conversion_rates;
      const processedRates: ExchangeRates = { 'INR': 1 };
      
      currencies.forEach(curr => {
        if (curr === 'INR' || !curr) return;
        if (conversionRates[curr]) {
          // conversionRates[curr] is unit of [curr] per 1 INR.
          // We need value of 1 [curr] in INR = (1 / rate).
          processedRates[curr] = 1 / conversionRates[curr];
        } else {
          processedRates[curr] = defaultRates[curr] || 1;
        }
      });

      return { 
        rates: { ...defaultRates, ...processedRates }, 
        sources: [{ title: "ExchangeRate-API", uri: "https://www.exchangerate-api.com" }], 
        isLive: true 
      };
    }
    throw new Error("FX API success field missing");
  } catch (error: any) {
    console.warn("Primary FX API failed, falling back to Gemini AI:", error.message);
    const apiKey = getSafeApiKey();
    if (!apiKey) return { rates: defaultRates, sources: [], isLive: false };

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide current exchange rates for: ${currencies.join(', ')}. 
        I need the value of exactly 1 unit of each currency converted into Indian Rupees (INR). 
        Format: If 1 SGD = 64.2 INR, the value for SGD is 64.2.
        IMPORTANT: Return ONLY a plain JSON object with currency codes as keys and numbers as values. 
        Example: {"SGD": 64.2, "USD": 83.9, "AUD": 55.4}.`,
        config: { 
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        },
      });
      
      const text = response.text.trim();
      const parsed = JSON.parse(text);
      const rates: ExchangeRates = { 'INR': 1 };
      
      Object.keys(parsed).forEach(k => {
        const val = Number(parsed[k]);
        if (!isNaN(val) && val > 0) rates[k] = val;
      });

      return { rates: { ...defaultRates, ...rates }, sources: [], isLive: true };
    } catch (e) {
      console.error("Gemini FX fallback failed:", e);
      return { rates: defaultRates, sources: [], isLive: false };
    }
  }
};

export const analyzeDocument = async (
  rawText: string,
  files: FileData[],
  context: AnalysisContext,
  vendorHint?: string,
  retryCount = 0
): Promise<AnalysisResult> => {
  const apiKey = getSafeApiKey();
  if (!apiKey) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = `
    Audit Task: Restaurant Financial Reconciliation & Rectification
    Context: Branch ${context.outletName || 'Global'} (${context.country}, ${context.currency})
    Target Vendor: ${vendorHint || 'None - Sales Audit'}
    
    CRITICAL ACCOUNTING RULES:
    1. RECTIFICATION: If the input document contains both sales data (revenue) and invoices (expenses) on different pages, prioritize based on the primary document content.
    2. CLASSIFICATION: Sales/POS Report = "REVENUE". Vendor Bill/Invoice = "EXPENSE".
    3. LEDGER: REVENUE maps to "Sales Account" (Cr) and "Cash/Bank" (Dr). EXPENSE maps to relevant COGS/Opex (Dr) and "Accounts Payable" (Cr).
    4. DATA INTEGRITY: Compare totals against line items. Flag any variances as HIGH severity.
    5. CURRENCY: All amounts in the JSON should be in the ORIGINAL document currency (${context.currency}).
    
    Response format must be valid JSON matching the schema.
  `;

  const parts: any[] = [{ text: systemPrompt }];
  files.forEach(file => {
    parts.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["classification", "documentType", "date", "outletName", "currency", "financialData", "journalEntries", "redFlags"],
          properties: {
            classification: { type: Type.STRING, description: "REVENUE or EXPENSE" },
            documentType: { type: Type.STRING },
            date: { type: Type.STRING },
            outletName: { type: Type.STRING },
            currency: { type: Type.STRING },
            financialData: {
              type: Type.OBJECT,
              properties: {
                grossSales: { type: Type.NUMBER, nullable: true },
                netPayout: { type: Type.NUMBER, nullable: true },
                commission: { type: Type.NUMBER, nullable: true },
                totalExpense: { type: Type.NUMBER, nullable: true },
                totalSales: { type: Type.NUMBER, nullable: true },
                revenueBreakdown: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { source: { type: Type.STRING }, amount: { type: Type.NUMBER } }
                  }
                },
                itemizedSales: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { name: { type: Type.STRING }, quantity: { type: Type.NUMBER }, amount: { type: Type.NUMBER } }
                  }
                },
                vendorDetails: {
                  type: Type.OBJECT,
                  properties: { name: { type: Type.STRING }, category: { type: Type.STRING } }
                }
              },
              required: ["revenueBreakdown", "itemizedSales"]
            },
            journalEntries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { debitAccount: { type: Type.STRING }, creditAccount: { type: Type.STRING }, amount: { type: Type.NUMBER } }
              }
            },
            insights: { type: Type.ARRAY, items: { type: Type.STRING } },
            redFlags: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { type: { type: Type.STRING }, severity: { type: Type.STRING }, message: { type: Type.STRING } }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text.trim());
    result.id = Math.random().toString(36).substr(2, 9);
    return result;
  } catch (error: any) {
    if (retryCount < MAX_RETRIES) {
      await sleep(INITIAL_RETRY_DELAY * Math.pow(2, retryCount));
      return analyzeDocument(rawText, files, context, vendorHint, retryCount + 1);
    }
    throw error; 
  }
};