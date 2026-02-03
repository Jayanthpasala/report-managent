export type CountryCode = string;
export type CurrencyCode = string;

export interface Country {
  code: CountryCode;
  name: string;
  currency: CurrencyCode;
  flag: string;
}

export interface Outlet {
  id: string;
  name: string;
  countryCode: CountryCode;
  currency: CurrencyCode;
}

export interface FileData {
  data: string;
  mimeType: string;
  fileName: string;
  fileType: 'image' | 'pdf' | 'excel';
}

export interface ExchangeRates {
  [key: string]: number;
}

export interface RevenueSource {
  source: string;
  amount: number;
  baseAmount?: number;
}

export interface ItemizedSale {
  name: string;
  quantity: number;
  amount: number;
  baseAmount?: number;
}

export interface VendorDetails {
  name: string;
  category: string;
  taxId?: string;
  dueDate?: string;
}

export interface FinancialData {
  grossSales: number | null;
  netPayout: number | null;
  commission: number | null;
  tax: number | null;
  totalExpense: number | null;
  totalSales: number | null;
  revenueBreakdown: RevenueSource[];
  itemizedSales: ItemizedSale[];
  vendorDetails?: VendorDetails;
}

export interface JournalEntry {
  debitAccount: string;
  creditAccount: string;
  amount: number;
  baseAmount?: number;
  date?: string;
  description?: string;
}

export interface RedFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface AnalysisResult {
  id: string;
  classification: 'REVENUE' | 'EXPENSE';
  documentType: string;
  date: string;
  outletName: string;
  currency: string;
  exchangeRateUsed?: number;
  financialData: FinancialData;
  journalEntries: JournalEntry[];
  insights: string[];
  redFlags: RedFlag[];
  outletId?: string;
  fileData?: FileData;
}

export interface AnalysisContext {
  country: CountryCode;
  currency: CurrencyCode;
  outletName?: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  country: CountryCode;
  taxId?: string;
  paymentTerms?: number;
  createdAt: string;
  outletId?: string;
}

export interface VendorBill {
  id: string;
  vendorId?: string;
  vendorName: string;
  category: string;
  date: string;
  amount: number;
  currency: string;
  baseAmount?: number;
  status: 'Pending' | 'Paid' | 'Overdue';
  dueDate?: string;
  outletId: string;
  sourceRecordId?: string;
  fileData?: FileData; // Added for bulk download
}

export interface SettlementItem {
  id: string;
  platform: string;
  date: string;
  grossAmount: number;
  commission: number;
  netPayout: number;
}

export interface PeriodicSummary {
  period: string; // e.g., "October 2023" or "Week 42"
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  topItems: { name: string, quantity: number, revenue: number }[];
  expenseCategories: { category: string, amount: number }[];
  aiStrategicInsights: string[];
}
