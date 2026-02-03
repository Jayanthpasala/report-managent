import React, { useState, useMemo } from 'react';
import { AnalysisResult, VendorBill } from '../types';

interface AccountsPanelProps {
  records: AnalysisResult[];
  bills: VendorBill[];
}

type AccountType = 'p&l' | 'balance-sheet' | 'trial-balance' | 'day-book';

const AccountsPanel: React.FC<AccountsPanelProps> = ({ records, bills }) => {
  const [activeReport, setActiveReport] = useState<AccountType>('p&l');

  const allJournalEntries = useMemo(() => {
    return records.flatMap(r => 
      (r.journalEntries || []).map(je => ({
        ...je,
        date: r.date,
        description: `${r.documentType}: ${r.outletName || (r.financialData?.vendorDetails?.name || 'General')}`,
        baseAmount: je.amount * (r.exchangeRateUsed || 1),
        classification: r.classification
      }))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records]);

  const revenue = useMemo(() => {
    return records
      .filter(r => r.classification === 'REVENUE')
      .reduce((sum, r) => sum + (r.financialData?.totalSales || r.financialData?.grossSales || 0) * (r.exchangeRateUsed || 1), 0);
  }, [records]);

  const expenses = useMemo(() => {
    return bills.reduce((sum, b) => sum + (b.baseAmount || 0), 0);
  }, [bills]);

  const netProfit = revenue - expenses;

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const balances: Record<string, { debit: number, credit: number }> = useMemo(() => {
    const b: Record<string, { debit: number, credit: number }> = {};
    allJournalEntries.forEach(je => {
      const debitAcc = je.debitAccount || 'Uncategorized Asset';
      const creditAcc = je.creditAccount || 'Uncategorized Liability';
      
      if (!b[debitAcc]) b[debitAcc] = { debit: 0, credit: 0 };
      b[debitAcc].debit += je.baseAmount;
      
      if (!b[creditAcc]) b[creditAcc] = { debit: 0, credit: 0 };
      b[creditAcc].credit += je.baseAmount;
    });
    return b;
  }, [allJournalEntries]);

  // Balance Sheet Categorization
  const balanceSheetData = useMemo(() => {
    const assets: Record<string, number> = {};
    const liabilities: Record<string, number> = {};
    const equity: Record<string, number> = {};

    Object.entries(balances).forEach(([acc, bal]) => {
      const net = bal.debit - bal.credit;
      
      if (/Cash|Bank|Receivable|Inventory|Asset/i.test(acc)) {
        assets[acc] = net;
      } else if (/Payable|Liability|Tax/i.test(acc)) {
        liabilities[acc] = -net; // Credit is positive for liabilities
      } else if (/Capital|Equity|Earning/i.test(acc)) {
        equity[acc] = -net;
      }
    });

    // Manually add net profit to equity if not already reflected
    equity['Retained Earnings (Net Profit)'] = (equity['Retained Earnings (Net Profit)'] || 0) + netProfit;

    return { assets, liabilities, equity };
  }, [balances, netProfit]);

  // Fix: Explicitly cast Object.values to number[] to resolve unknown type errors in reduce
  const totalAssets = (Object.values(balanceSheetData.assets) as number[]).reduce((a: number, b: number) => a + b, 0);
  const totalLiabilities = (Object.values(balanceSheetData.liabilities) as number[]).reduce((a: number, b: number) => a + b, 0);
  const totalEquity = (Object.values(balanceSheetData.equity) as number[]).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4 animate-slide-up">
      <header className="flex flex-col lg:flex-row justify-between items-center gap-8">
        <div>
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter italic leading-none"> Chain Books.</h2>
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.4em] mt-3">Verified Financial Statements</p>
        </div>
        <nav className="flex gap-2 p-1.5 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: 'p&l', label: 'Profit & Loss' },
            { id: 'balance-sheet', label: 'Balance Sheet' },
            { id: 'trial-balance', label: 'Trial Balance' },
            { id: 'day-book', label: 'Day Book' }
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveReport(tab.id as AccountType)} 
              className={`px-6 lg:px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                activeReport === tab.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {activeReport === 'p&l' && (
        <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-xl space-y-12">
          <div className="flex justify-between items-end border-b-4 border-slate-900 pb-8">
            <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Chain P&L Summary</h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Portfolio Total</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
            <div className="space-y-8">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Operating Income</h4>
              <div className="flex justify-between font-bold text-slate-700 text-lg">
                <span>Verified Sales Revenue</span>
                <span>{formatINR(revenue)}</span>
              </div>
              <div className="pt-8 border-t-2 border-slate-900 flex justify-between font-black text-2xl text-slate-900 italic">
                <span>Total Income</span>
                <span>{formatINR(revenue)}</span>
              </div>
            </div>
            <div className="space-y-8">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Operating Expenditure</h4>
              <div className="flex justify-between font-bold text-slate-500 text-lg">
                <span>Verified Expenses</span>
                <span>{formatINR(expenses)}</span>
              </div>
              <div className="pt-8 border-t-2 border-rose-500 flex justify-between font-black text-2xl text-rose-500 italic">
                <span>Total Expenditure</span>
                <span>({formatINR(expenses)})</span>
              </div>
            </div>
          </div>
          <div className={`mt-12 p-10 rounded-[2.5rem] flex justify-between items-center ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-rose-50 text-rose-900 border border-rose-100'}`}>
            <span className="text-2xl font-black italic tracking-tight uppercase">Net Period Performance</span>
            <span className="text-5xl font-black tracking-tighter">{formatINR(netProfit)}</span>
          </div>
        </div>
      )}

      {activeReport === 'balance-sheet' && (
        <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-xl space-y-12">
          <div className="flex justify-between items-end border-b-4 border-slate-900 pb-8">
            <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Balance Sheet</h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Consolidated Statement</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
            {/* ASSETS */}
            <div className="space-y-10">
              <div>
                <h4 className="text-xl font-black text-slate-900 italic border-b-2 border-slate-100 pb-2 mb-6 uppercase tracking-tight">Assets</h4>
                <div className="space-y-4">
                  {Object.entries(balanceSheetData.assets).map(([acc, val], i) => (
                    <div key={i} className="flex justify-between text-sm font-bold text-slate-600">
                      <span>{acc}</span>
                      {/* Fix: Explicitly cast val to number */}
                      <span>{formatINR(val as number)}</span>
                    </div>
                  ))}
                  {Object.keys(balanceSheetData.assets).length === 0 && <p className="text-xs text-slate-300 italic">No assets registered.</p>}
                </div>
              </div>
              <div className="pt-6 border-t-4 border-slate-900 flex justify-between font-black text-xl text-slate-900 uppercase">
                <span>Total Assets</span>
                {/* Fix: Explicitly cast totalAssets to number */}
                <span>{formatINR(totalAssets as number)}</span>
              </div>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className="space-y-12">
              <div>
                <h4 className="text-xl font-black text-slate-900 italic border-b-2 border-slate-100 pb-2 mb-6 uppercase tracking-tight">Liabilities</h4>
                <div className="space-y-4">
                  {Object.entries(balanceSheetData.liabilities).map(([acc, val], i) => (
                    <div key={i} className="flex justify-between text-sm font-bold text-slate-600">
                      <span>{acc}</span>
                      {/* Fix: Explicitly cast val to number */}
                      <span>{formatINR(val as number)}</span>
                    </div>
                  ))}
                  {Object.keys(balanceSheetData.liabilities).length === 0 && <p className="text-xs text-slate-300 italic">No liabilities registered.</p>}
                </div>
              </div>

              <div>
                <h4 className="text-xl font-black text-slate-900 italic border-b-2 border-slate-100 pb-2 mb-6 uppercase tracking-tight">Equity</h4>
                <div className="space-y-4">
                  {Object.entries(balanceSheetData.equity).map(([acc, val], i) => (
                    <div key={i} className="flex justify-between text-sm font-bold text-slate-600">
                      <span>{acc}</span>
                      {/* Fix: Explicitly cast val to number */}
                      <span>{formatINR(val as number)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t-4 border-blue-600 flex justify-between font-black text-xl text-blue-600 uppercase">
                <span>Total Liab. & Equity</span>
                {/* Fix: Explicitly cast totalLiabilities and totalEquity to number for arithmetic operation */}
                <span>{formatINR((totalLiabilities as number) + (totalEquity as number))}</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-slate-50 rounded-3xl text-center">
             {/* Fix: Explicitly cast totalAssets, totalLiabilities, and totalEquity to number for balance comparison */}
             <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${Math.abs((totalAssets as number) - ((totalLiabilities as number) + (totalEquity as number))) < 1 ? 'text-emerald-500' : 'text-rose-500'}`}>
               {Math.abs((totalAssets as number) - ((totalLiabilities as number) + (totalEquity as number))) < 1 ? '✓ Balanced Statement' : '⚠ Balance Mismatch Detected'}
             </p>
          </div>
        </div>
      )}

      {activeReport === 'trial-balance' && (
        <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest">
                <th className="p-8">Ledger Account Name</th>
                <th className="p-8 text-right">Debit Balance (INR)</th>
                <th className="p-8 text-right">Credit Balance (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(balances).map(([acc, bal], i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="p-8 text-sm font-bold text-slate-700">{acc}</td>
                  <td className="p-8 text-right font-black text-emerald-600">{bal.debit > 0 ? formatINR(bal.debit) : '—'}</td>
                  <td className="p-8 text-right font-black text-rose-600">{bal.credit > 0 ? formatINR(bal.credit) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeReport === 'day-book' && (
        <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest">
                <th className="p-8">Post Date</th>
                <th className="p-8">Transaction Details</th>
                <th className="p-8 text-right">Journal Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allJournalEntries.map((je, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">{je.date}</td>
                  <td className="p-8">
                    <div className="font-black text-slate-800 text-base">{je.debitAccount}</div>
                    <div className="text-[10px] font-bold text-slate-400 italic mt-1 uppercase tracking-widest">To {je.creditAccount}</div>
                  </td>
                  <td className="p-8 text-right font-black text-slate-900 text-lg">{formatINR(je.baseAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {allJournalEntries.length === 0 && (
            <div className="py-20 text-center text-slate-300 italic font-bold">No digital entries found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountsPanel;