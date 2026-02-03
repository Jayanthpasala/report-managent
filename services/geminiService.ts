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
  try {
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${FX_API_KEY}/latest/INR`);
    const data = await response.json();

    if (data.result === "success") {
      const conversionRates = data.conversion_rates;
      const processedRates: ExchangeRates = { 'INR': 1 };
      
      currencies.forEach(curr => {
        if (curr === 'INR') return;
        if (conversionRates[curr]) {
          processedRates[curr] = 1 / conversionRates[curr];
        }
      });

      return { 
        rates: processedRates, 
        sources: [{ title: "ExchangeRate-API", uri: "https://www.exchangerate-api.com" }], 
        isLive: true 
      };
    }
    throw new Error("FX API returned failure");
  } catch (error: any) {
    console.warn("Live FX API failed fallback to Gemini search:", error.message);
    const apiKey = getSafeApiKey();
    if (!apiKey) return { rates: { 'SGD': 63.45, 'AUD': 55.20, 'INR': 1 }, sources: [], isLive: false };
    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find current exchange rates for ${currencies.join(', ')} against INR. Format as JSON: {"CURRENCY": rate_in_inr}.`,
        config: { tools: [{ googleSearch: {} }] },
      });
      const text = response.text || "{}";
      const rates = JSON.parse(text.match(/\{.*\}/s)?.[0] || "{}");
      rates['INR'] = 1;
      return { rates, sources: [], isLive: true };
    } catch (e) {
      return { rates: { 'SGD': 63.45, 'AUD': 55.20, 'INR': 1 }, sources: [], isLive: false };
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
    1. RECTIFICATION: If the input document contains both sales data (revenue) and invoices (expenses) on different pages, RECTIFY and prioritize the classification based on the main workflow.
    2. CLASSIFICATION: If input is a Sales/POS Report, classify as "REVENUE". If input is a Vendor Bill/Invoice, classify as "EXPENSE".
    3. REVENUE LEDGER: Map to "Sales Account" (Credit) and "Cash/Bank Account" (Debit).
    4. EXPENSE LEDGER: Map to "Utilities/COGS/Rent" (Debit) and "Accounts Payable" (Credit).
    5. DATA INTEGRITY: Compare Payment Totals against Itemized SKU totals. If they differ, flag as HIGH criticality.
    
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