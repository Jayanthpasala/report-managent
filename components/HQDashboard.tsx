import React, { useMemo, useState } from 'react';
import { AnalysisResult, VendorBill, Outlet, Country } from '../types';
import { ICONS } from '../constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { GoogleGenAI } from "@google/genai";

interface HQDashboardProps {
  records: AnalysisResult[];
  bills: VendorBill[];
  outlets: Outlet[];
  countries: Country[];
}

const InfoIcon = ({ tooltip }: { tooltip: string }) => (
  <div className="group relative inline-block ml-1 align-middle">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-300 hover:text-blue-500 cursor-help transition-all">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block w-64 p-4 bg-slate-900 text-white text-[11px] font-medium rounded-2xl shadow-2xl z-50 leading-relaxed border border-white/10">
      {tooltip}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
    </div>
  </div>
);

const HQDashboard: React.FC<HQDashboardProps> = ({ records, bills, outlets, countries }) => {
  const [isGeneratingAudit, setIsGeneratingAudit] = useState(false);
  const [globalAudit, setGlobalAudit] = useState<string | null>(null);
  const hasOutlets = outlets.length > 0;
  const hasActivity = records.length > 0 || bills.length > 0;

  const stats = useMemo(() => {
    const totalRev = records
      .filter(r => r.classification === 'REVENUE')
      .reduce((sum, r) => sum + (r.financialData?.totalSales || r.financialData?.grossSales || 0) * (r.exchangeRateUsed || 1), 0);
    
    const totalExp = bills.reduce((sum, b) => sum + (b.baseAmount || 0), 0);

    // Precise F&B Ratio Aggregations
    const cogsExp = bills
      .filter(b => /food|raw|material|beverage|ingredient|supplies/i.test(b.category))
      .reduce((sum, b) => sum + (b.baseAmount || 0), 0);
    
    const laborExp = bills
      .filter(b => /labor|salary|payroll|staff|wage|bonus/i.test(b.category))
      .reduce((sum, b) => sum + (b.baseAmount || 0), 0);
    
    const occupancyExp = bills
      .filter(b => /rent|utility|electricity|water|gas|internet/i.test(b.category))
      .reduce((sum, b) => sum + (b.baseAmount || 0), 0);
    
    const grossProfit = totalRev - cogsExp;
    
    return {
      revenue: totalRev,
      expenses: totalExp,
      netProfit: totalRev - totalExp,
      grossMargin: totalRev > 0 ? (grossProfit / totalRev) * 100 : 0,
      cogsRatio: totalRev > 0 ? (cogsExp / totalRev) * 100 : 0,
      laborRatio: totalRev > 0 ? (laborExp / totalRev) * 100 : 0,
      primeCostRatio: totalRev > 0 ? ((cogsExp + laborExp) / totalRev) * 100 : 0,
      occupancyRatio: totalRev > 0 ? (occupancyExp / totalRev) * 100 : 0
    };
  }, [records, bills]);

  const branchPerformance = useMemo(() => {
    return outlets.map(o => {
      const rev = records
        .filter(r => r.outletId === o.id && r.classification === 'REVENUE')
        .reduce((sum, r) => sum + (r.financialData?.totalSales || r.financialData?.grossSales || 0) * (r.exchangeRateUsed || 1), 0);
      const exp = bills
        .filter(b => b.outletId === o.id)
        .reduce((sum, b) => sum + (b.baseAmount || 0), 0);
      return {
        name: o.name,
        revenue: rev,
        profit: rev - exp,
        flag: countries.find(c => c.code === o.countryCode)?.flag || '🏢'
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [outlets, records, bills, countries]);

  const trendData = useMemo(() => {
    const daily: Record<string, { date: string, revenue: number, expense: number }> = {};
    const last14Days = [...Array(14)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    last14Days.forEach(date => daily[date] = { date, revenue: 0, expense: 0 });

    records.filter(r => r.classification === 'REVENUE').forEach(r => {
      if (daily[r.date]) daily[r.date].revenue += (r.financialData?.totalSales || r.financialData?.grossSales || 0) * (r.exchangeRateUsed || 1);
    });
    bills.forEach(b => {
      if (daily[b.date]) daily[b.date].expense += (b.baseAmount || 0);
    });
    return Object.values(daily);
  }, [records, bills]);

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const runGlobalAudit = async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return;
    setIsGeneratingAudit(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Act as a CFO for a restaurant chain. Data: Revenue ${stats.revenue}, Expenses ${stats.expenses}, Net Profit ${stats.netProfit}. 
      COGS: ${stats.cogsRatio.toFixed(1)}%, Labor: ${stats.laborRatio.toFixed(1)}%, Prime Cost: ${stats.primeCostRatio.toFixed(1)}%. 
      Prime cost should be under 60%. Provide 3 specific bullet points for improvement.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
      setGlobalAudit(response.text || "Analysis unavailable.");
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAudit(false);
    }
  };

  return (
    <div className="space-y-10 animate-slide-up pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter italic">HQ Dashboard.</h2>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em] mt-2">Chain-wide Financial Performance</p>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Portfolio Live
          </div>
        </div>
      </header>

      {!hasOutlets && (
        <section className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl p-10">
          <div className="flex flex-col lg:flex-row gap-10 items-start lg:items-center">
            <div className="flex-1">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Welcome to RestoFinance.</h3>
              <p className="text-slate-500 text-sm font-medium mt-3 leading-relaxed">
                Start by creating your first branch so the system can track sales, bills, and performance.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { step: '01', title: 'Add Branch', detail: 'Open “Branches” and save your restaurant or cafe location.' },
                  { step: '02', title: 'Upload Sales', detail: 'Use “Audit Hub” to reconcile daily summary and SKU reports.' },
                  { step: '03', title: 'Track Vendors', detail: 'Add vendor bills to see cost ratios and cash flow.' }
                ].map((item) => (
                  <div key={item.step} className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{item.step}</p>
                    <p className="text-sm font-black text-slate-900 mt-2">{item.title}</p>
                    <p className="text-[11px] font-medium text-slate-500 mt-1 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 w-full lg:w-72">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Quick Tip</p>
              <p className="text-sm font-medium text-white/80 leading-relaxed">
                If you manage multiple brands, create one branch per outlet. You can filter by branch from the sidebar.
              </p>
            </div>
          </div>
        </section>
      )}

      {hasOutlets && !hasActivity && (
        <section className="bg-blue-50 border border-blue-100 rounded-[2.5rem] p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Next Step</p>
              <h3 className="text-xl font-black text-slate-900 mt-2">Upload your first sales report.</h3>
              <p className="text-sm text-slate-600 mt-2">
                Go to “Audit Hub” and upload the Daily Summary + SKU report to generate your first analysis.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-blue-100 px-6 py-4 text-[11px] font-bold text-slate-600">
              Tip: PDF, JPG, or PNG files work best.
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Total Revenue</p>
          <p className="text-3xl font-black tracking-tighter">{formatINR(stats.revenue)}</p>
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
            <span className="text-[10px] font-bold text-white/40">Portfolio Volume</span>
          </div>
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Total Opex</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatINR(stats.expenses)}</p>
        </div>
        <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-500/20">
          <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">Net Earnings</p>
          <p className="text-3xl font-black tracking-tighter">{formatINR(stats.netProfit)}</p>
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gross Margin</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{stats.grossMargin.toFixed(1)}%</p>
        </div>
      </div>

      <section className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl p-10">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Core F&B Efficiency Ratios</h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Industry Benchmarks Active</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'COGS Ratio', value: stats.cogsRatio, tip: 'Cost of Goods Sold / Revenue. Target: 28-35%. Higher suggests waste or theft.', color: 'emerald' },
            { label: 'Labor Ratio', value: stats.laborRatio, tip: 'Total Payroll / Revenue. Target: <30%. Includes salaries, taxes, and benefits.', color: 'blue' },
            { label: 'Prime Cost', value: stats.primeCostRatio, tip: 'COGS + Labor. The most vital metric. Healthy: <60%. Critical warning if >65%.', color: 'amber' },
            { label: 'Occupancy', value: stats.occupancyRatio, tip: 'Rent + Utilities / Revenue. Ideal: 6-10%. Higher indicates inefficient site selection.', color: 'slate' }
          ].map((r, i) => (
            <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 transition-all hover:bg-white hover:shadow-lg group">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-4">
                {r.label} <InfoIcon tooltip={r.tip} />
              </span>
              <div className="flex items-end justify-between">
                <p className={`text-4xl font-black tracking-tighter ${
                  r.value > (r.label === 'Prime Cost' ? 60 : 35) ? 'text-rose-600' : 'text-slate-900'
                }`}>
                  {r.value.toFixed(1)}%
                </p>
                {r.value > (r.label === 'Prime Cost' ? 60 : 35) && (
                  <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-2">High Risk</span>
                )}
              </div>
              <div className="mt-4 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    r.value > (r.label === 'Prime Cost' ? 60 : 35) ? 'bg-rose-500' : 
                    r.color === 'emerald' ? 'bg-emerald-500' : 
                    r.color === 'blue' ? 'bg-blue-500' : 
                    r.color === 'amber' ? 'bg-amber-500' : 'bg-slate-900'
                  }`} 
                  style={{ width: `${Math.min(r.value, 100)}%` }} 
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl h-[500px] flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cash Flow Trends (14D)</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full"></div><span className="text-[8px] font-black uppercase text-slate-400">Revenue</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-rose-500 rounded-full"></div><span className="text-[8px] font-black uppercase text-slate-400">Expenses</span></div>
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={4} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl overflow-y-auto h-[500px] no-scrollbar">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Branch Leaderboard</h3>
          <div className="space-y-4">
            {branchPerformance.map((bp, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{bp.flag}</span>
                  <div>
                    <p className="text-xs font-black text-slate-800">{bp.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Yield: {formatINR(bp.profit)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{formatINR(bp.revenue)}</p>
                  <div className={`text-[8px] font-black uppercase ${bp.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {bp.profit >= 0 ? 'Profitable' : 'Loss'}
                  </div>
                </div>
              </div>
            ))}
            {branchPerformance.length === 0 && (
              <div className="py-20 text-center text-slate-300 italic text-sm">No branch data active.</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full -mr-64 -mt-64 blur-[120px]"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10 mb-12">
          <div className="max-w-xl text-center md:text-left">
            <h4 className="text-4xl font-black italic tracking-tighter mb-4">AI Audit Executive.</h4>
            <p className="text-blue-400 font-bold text-xs uppercase tracking-[0.3em]">Neural Portfolio Intelligence</p>
          </div>
          <button 
            onClick={runGlobalAudit} 
            disabled={isGeneratingAudit} 
            className="px-12 py-6 bg-white text-slate-900 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 disabled:opacity-50 transition-all hover:bg-blue-50"
          >
            {isGeneratingAudit ? 'Analyzing Portfolio...' : 'Generate CFO Insights'}
          </button>
        </div>
        {globalAudit ? (
          <div className="bg-white/5 border border-white/10 p-12 rounded-[3rem] text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto no-scrollbar font-medium backdrop-blur-md">
            {globalAudit}
          </div>
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
            <p className="text-white/20 font-black text-xs uppercase tracking-widest italic">CFO Intelligence Idle</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HQDashboard;
