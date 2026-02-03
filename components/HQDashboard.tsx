import React, { useMemo, useState } from 'react';
import { AnalysisResult, VendorBill, Outlet, Country } from '../types';
import { ICONS } from '../constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block w-56 p-3 bg-slate-900 text-white text-[10px] font-bold rounded-xl shadow-2xl z-50 leading-relaxed border border-white/10">
      {tooltip}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
    </div>
  </div>
);

const HQDashboard: React.FC<HQDashboardProps> = ({ records, bills, outlets, countries }) => {
  const [isGeneratingAudit, setIsGeneratingAudit] = useState(false);
  const [globalAudit, setGlobalAudit] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalRev = records
      .filter(r => r.classification === 'REVENUE')
      .reduce((sum, r) => sum + (r.financialData?.totalSales || r.financialData?.grossSales || 0) * (r.exchangeRateUsed || 1), 0);
    
    const totalExp = bills.reduce((sum, b) => sum + (b.baseAmount || 0), 0);

    // F&B Specific Aggregations based on Category Matching
    const cogsExp = bills
      .filter(b => /food|raw|material|beverage|ingredient/i.test(b.category))
      .reduce((sum, b) => sum + (b.baseAmount || 0), 0);
    
    const laborExp = bills
      .filter(b => /labor|salary|payroll|staff|wage/i.test(b.category))
      .reduce((sum, b) => sum + (b.baseAmount || 0), 0);
    
    const occupancyExp = bills
      .filter(b => /rent|utility|electricity|water|maintenance/i.test(b.category))
      .reduce((sum, b) => sum + (b.baseAmount || 0), 0);
    
    return {
      revenue: totalRev,
      expenses: totalExp,
      profit: totalRev - totalExp,
      margin: totalRev > 0 ? ((totalRev - totalExp) / totalRev) * 100 : 0,
      cogsRatio: totalRev > 0 ? (cogsExp / totalRev) * 100 : 0,
      laborRatio: totalRev > 0 ? (laborExp / totalRev) * 100 : 0,
      occupancyRatio: totalRev > 0 ? (occupancyExp / totalRev) * 100 : 0,
      primeCostRatio: totalRev > 0 ? ((cogsExp + laborExp) / totalRev) * 100 : 0
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
    records.filter(r => r.classification === 'REVENUE').forEach(r => {
      if (!daily[r.date]) daily[r.date] = { date: r.date, revenue: 0, expense: 0 };
      daily[r.date].revenue += (r.financialData?.totalSales || r.financialData?.grossSales || 0) * (r.exchangeRateUsed || 1);
    });
    bills.forEach(b => {
      if (!daily[b.date]) daily[b.date] = { date: b.date, revenue: 0, expense: 0 };
      daily[b.date].expense += (b.baseAmount || 0);
    });
    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
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
      const prompt = `Analyze this F&B portfolio: Rev ${stats.revenue}, Exp ${stats.expenses}, Profit ${stats.profit}. COGS Ratio: ${stats.cogsRatio.toFixed(1)}%, Prime Cost: ${stats.primeCostRatio.toFixed(1)}%. Provide executive strategy for margin expansion.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
      setGlobalAudit(response.text || "No insights found.");
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAudit(false);
    }
  };

  return (
    <div className="space-y-10 animate-slide-up pb-12">
      <header>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">Enterprise Hub.</h2>
        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em] mt-2">Combined Portfolio Analytics</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Revenue</p>
          <p className="text-3xl font-black tracking-tighter">{formatINR(stats.revenue)}</p>
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Total Expenses</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatINR(stats.expenses)}</p>
        </div>
        <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white">
          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Net Yield</p>
          <p className="text-3xl font-black tracking-tighter">{formatINR(stats.profit)}</p>
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Avg Margin</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{stats.margin.toFixed(1)}%</p>
        </div>
      </div>

      <section className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl p-10">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">F&B Critical Ratios</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'COGS Ratio', value: stats.cogsRatio, tip: '(Cost of Goods Sold / Revenue) * 100. Benchmarks: QSR (28%), Casual (32%), Fine (35%+).', color: 'emerald' },
            { label: 'Labor Cost', value: stats.laborRatio, tip: '(Wages + Payroll Tax + Benefits / Revenue) * 100. Target: < 30%.', color: 'blue' },
            { label: 'Prime Cost', value: stats.primeCostRatio, tip: '(COGS + Labor) / Revenue. Most critical restaurant metric. Healthy: < 60%.', color: 'amber' },
            { label: 'Occupancy', value: stats.occupancyRatio, tip: '(Rent + Utilities / Revenue) * 100. Ideal: 6-10%. Higher indicates site inefficiency.', color: 'slate' }
          ].map((r, i) => (
            <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 transition-all hover:bg-white hover:shadow-lg">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-4">
                {r.label} <InfoIcon tooltip={r.tip} />
              </span>
              <p className="text-3xl font-black text-slate-900">{r.value.toFixed(1)}%</p>
              <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    r.value > (r.label === 'Occupancy' ? 12 : 35) ? 'bg-rose-500' : 
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
        <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl h-[450px]">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Portfolio Cash Flow (Last 14 Days)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={5} dot={false} />
                <Line type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl overflow-y-auto max-h-[450px] no-scrollbar">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Top Yield Branches</h3>
          <div className="space-y-4">
            {branchPerformance.map((bp, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{bp.flag}</span>
                  <div>
                    <p className="text-xs font-black text-slate-800">{bp.name}</p>
                    <p className="text-[9px] font-bold text-slate-400">Yield: {formatINR(bp.profit)}</p>
                  </div>
                </div>
                <p className="text-sm font-black text-slate-900">{formatINR(bp.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
          <div><h4 className="text-3xl font-black italic tracking-tighter">AI Portfolio Review.</h4><p className="text-blue-400 font-black text-[10px] mt-1 uppercase tracking-widest">Global HQ Intelligence</p></div>
          <button onClick={runGlobalAudit} disabled={isGeneratingAudit} className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50">
            {isGeneratingAudit ? 'Running HQ Audit...' : 'Execute Strategy Review'}
          </button>
        </div>
        {globalAudit && (
          <div className="bg-white/5 border border-white/10 p-10 rounded-[2.5rem] text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto no-scrollbar">
            {globalAudit}
          </div>
        )}
      </div>
    </div>
  );
};

export default HQDashboard;