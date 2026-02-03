import React, { useState } from 'react';
import _html2pdf from 'html2pdf.js';
import { AnalysisResult, Country } from '../types';
import { ICONS } from '../constants';
import SummaryCard from './SummaryCard';

interface AnalysisReportProps {
  data: AnalysisResult;
  onReset: () => void;
  countries: Country[];
}

const BASE_CURRENCY = 'INR';

const AnalysisReport: React.FC<AnalysisReportProps> = ({ data, onReset, countries }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const revenueBreakdown = data.financialData?.revenueBreakdown || [];
  const itemizedSales = data.financialData?.itemizedSales || [];
  const insights = data.insights || [];
  const redFlags = data.redFlags || [];
  
  const countryInfo = countries.find(c => c.currency === data.currency);
  const rate = data.exchangeRateUsed || 1;

  // Robustly get the html2pdf constructor to handle ESM/UMD differences
  const getPdfGenerator = () => {
    if (typeof _html2pdf === 'function') return _html2pdf;
    if ((_html2pdf as any)?.default && typeof (_html2pdf as any).default === 'function') return (_html2pdf as any).default;
    if (typeof (window as any).html2pdf === 'function') return (window as any).html2pdf;
    const fallback = (_html2pdf as any)?.default || _html2pdf;
    return typeof fallback === 'function' ? fallback : null;
  };

  const formatCurrency = (val: number, curr: string) => {
    return new Intl.NumberFormat(curr === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: curr,
    }).format(val);
  };

  const getBaseValue = (val: number | null) => val !== null ? val * rate : null;

  const commissionPercent = (data.financialData?.commission && data.financialData?.grossSales) 
    ? ((data.financialData.commission / data.financialData.grossSales) * 100).toFixed(1)
    : null;

  const handleDownloadPDF = async () => {
    const element = document.getElementById('audit-report-printable');
    if (!element) return;

    setIsGeneratingPDF(true);
    try {
      const html2pdfFn = getPdfGenerator();
      if (!html2pdfFn) throw new Error("PDF Library failed to initialize.");

      const opt = {
        margin: [10, 10],
        filename: `Audit_${data.date}_${data.outletName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdfFn().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div id="audit-report-printable" className="p-10 bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden print:p-0 print:border-0 print:shadow-none">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div className="flex items-center gap-5">
            <div className="text-4xl bg-slate-50 p-5 rounded-[2rem] shadow-inner border border-slate-100 no-print">
              {countryInfo?.flag || '🏢'}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded uppercase tracking-wider">
                  {data.documentType}
                </span>
                <span className="text-slate-400 text-xs font-bold tracking-tight">{data.date}</span>
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">
                {data.outletName || "Audit Summary"}
              </h2>
              <p className="text-[10px] text-slate-400 font-black mt-2 uppercase tracking-[0.3em]">Verified Digital Certificate • Audit-Ready</p>
            </div>
          </div>
          <div className="flex items-center gap-3 no-print">
            <button 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:border-blue-500 hover:text-blue-600 shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <ICONS.FileText />
              {isGeneratingPDF ? 'Packaging PDF...' : 'Export PDF Report'}
            </button>
            <button 
              onClick={onReset}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-blue-600 shadow-xl shadow-slate-200"
            >
              New Audit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {(data.financialData?.grossSales || data.financialData?.totalSales) !== null && (
            <SummaryCard 
              label="Gross Revenue" 
              value={data.financialData?.grossSales || data.financialData?.totalSales} 
              currency={data.currency}
              baseValue={getBaseValue(data.financialData?.grossSales || data.financialData?.totalSales || 0)}
              baseCurrency={BASE_CURRENCY}
            />
          )}
          {data.financialData?.netPayout !== null && (
            <SummaryCard 
              label="Realized Payout" 
              value={data.financialData?.netPayout} 
              currency={data.currency} 
              baseValue={getBaseValue(data.financialData?.netPayout || 0)}
              baseCurrency={BASE_CURRENCY}
              type="positive" 
            />
          )}
          {data.financialData?.commission !== null && data.financialData?.commission > 0 && (
            <SummaryCard 
              label={`Fees (${commissionPercent}%)`} 
              value={data.financialData.commission} 
              currency={data.currency} 
              baseValue={getBaseValue(data.financialData.commission)}
              baseCurrency={BASE_CURRENCY}
              type={Number(commissionPercent) > 25 ? 'negative' : 'neutral'} 
            />
          )}
          {data.financialData?.totalExpense !== null && (
            <SummaryCard 
              label="Expenditure" 
              value={data.financialData.totalExpense} 
              currency={data.currency} 
              baseValue={getBaseValue(data.financialData.totalExpense)}
              baseCurrency={BASE_CURRENCY}
              type="negative" 
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            {revenueBreakdown.length > 0 && (
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black mb-8 flex items-center gap-3 text-slate-800 uppercase tracking-[0.2em]">
                  <ICONS.TrendingUp /> Source Attribution
                </h3>
                <div className="space-y-4">
                  {revenueBreakdown.map((rev, idx) => (
                    <div key={idx} className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-100/50">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{rev.source}</span>
                      <span className="text-lg font-black text-slate-900">{formatCurrency(rev.amount, data.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {itemizedSales.length > 0 && (
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black mb-8 flex items-center gap-3 text-slate-800 uppercase tracking-[0.2em]">
                  <ICONS.FileText /> SKU-Level Audit
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em]">
                        <th className="py-5 px-8">Item Identity</th>
                        <th className="py-5 px-8 text-center">Unit Count</th>
                        <th className="py-5 px-8 text-right">Extended Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemizedSales.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-5 px-8 font-bold text-slate-700">{item.name}</td>
                          <td className="py-5 px-8 text-center font-black text-slate-500">{item.quantity}</td>
                          <td className="py-5 px-8 text-right font-black text-slate-900">{formatCurrency(item.amount || 0, data.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-10">
            <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <h3 className="text-sm font-black mb-10 uppercase tracking-[0.3em] text-blue-400">Auditor Insights</h3>
              <div className="space-y-8">
                {insights.length > 0 ? insights.map((insight, i) => (
                  <div key={i} className="flex gap-4">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                     <p className="text-xs text-slate-300 leading-relaxed font-medium">{insight}</p>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500 italic">No automated insights generated.</p>
                )}
              </div>
            </div>
            
            <div className="bg-rose-50 p-10 rounded-[3rem] border border-rose-100">
               <h3 className="text-sm font-black mb-8 flex items-center gap-3 text-rose-800 uppercase tracking-[0.2em]">
                 <ICONS.AlertTriangle /> Fraud & Risk Flags
               </h3>
               <div className="space-y-4">
                 {redFlags.length > 0 ? redFlags.map((flag, idx) => (
                   <div key={idx} className="p-5 bg-white rounded-2xl border border-rose-100 shadow-sm">
                     <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                          flag.severity === 'high' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {flag.severity} CRITICALITY
                        </span>
                     </div>
                     <p className="text-xs font-bold text-slate-800 leading-tight">{flag.message}</p>
                   </div>
                 )) : (
                   <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                     <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">Clean Audit Result</p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </div>

        <div className="mt-20 pt-10 border-t border-slate-100 text-center">
           <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">Digitally Audited by RestoFinance AI Engine • Legal Proof of Transaction</p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisReport;