import React, { useState, useMemo } from 'react';
import { AnalysisResult, VendorBill } from '../types';

interface AccountsPanelProps {
  records: AnalysisResult[];
  bills: VendorBill[];
}

type AccountType = 'p&l' | 'trial-balance' | 'day-book';

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

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const balances: Record<string, { debit: number, credit: number }> = useMemo(() => {
    const b: Record<string, { debit: number, credit: number }> = {};
    allJournalEntries.forEach(je => {
      if (!b[je.debitAccount]) b[je.debitAccount] = { debit: 0, credit: 0 };
      b[je.debitAccount].debit += je.baseAmount;
      if (!b[je.creditAccount]) b[je.creditAccount] = { debit: 0, credit: 0 };
      b[je.creditAccount].credit += je.baseAmount;
    });
    return b;
  }, [allJournalEntries]);

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4 animate-slide-up">
      <header className="flex flex-col lg:flex-row justify-between items-center gap-8">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">Digital Books.</h2>
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] mt-2">Professional Financial Statements</p>
        </div>
        <nav className="flex gap-3 p-2 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
          {[
            { id: 'p&l', label: 'P&L Statement' },
            { id: 'trial-balance', label: 'Trial Balance' },
            { id: 'day-book', label: 'Day Book' }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveReport(tab.id as AccountType)} className={`px-8 py-3 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all ${activeReport === tab.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {activeReport === 'p&l' && (
        <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-xl space-y-10">
          <div className="flex justify-between items-end border-b-4 border-slate-900 pb-6 mb-12">
            <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Profit & Loss Summary</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Revenue Streams</h4>
              <div className="flex justify-between font-bold text-slate-700"><span>Gross Verified Sales</span><span>{formatINR(revenue)}</span></div>
              <div className="pt-6 border-t-2 flex justify-between font-black text-xl text-slate-900 italic"><span>Total Income</span><span>{formatINR(revenue)}</span></div>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Operating Expenses</h4>
              <div className="flex justify-between font-bold text-slate-500"><span>Vendor Payments</span><span>{formatINR(expenses)}</span></div>
              <div className="pt-6 border-t-2 flex justify-between font-black text-xl text-rose-500 italic"><span>Total Expenditure</span><span>({formatINR(expenses)})</span></div>
            </div>
          </div>
          <div className="mt-12 p-8 bg-slate-50 rounded-3xl flex justify-between items-center">
            <span className="text-2xl font-black text-slate-900 italic">Net Profit/Loss</span>
            <span className={`text-4xl font-black tracking-tighter ${revenue >= expenses ? 'text-emerald-600' : 'text-rose-600'}`}>{formatINR(revenue - expenses)}</span>
          </div>
        </div>
      )}

      {activeReport === 'trial-balance' && (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                <th className="p-6">Ledger Account</th>
                <th className="p-6 text-right">Debit (INR)</th>
                <th className="p-6 text-right">Credit (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(balances).map(([acc, bal], i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-6 text-sm font-bold text-slate-700">{acc}</td>
                  <td className="p-6 text-right font-black text-emerald-600">{bal.debit > 0 ? formatINR(bal.debit) : '—'}</td>
                  <td className="p-6 text-right font-black text-rose-600">{bal.credit > 0 ? formatINR(bal.credit) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeReport === 'day-book' && (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                <th className="p-6">Date</th>
                <th className="p-6">Particulars</th>
                <th className="p-6 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allJournalEntries.map((je, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-6 text-xs font-black text-slate-400">{je.date}</td>
                  <td className="p-6">
                    <div className="font-black text-slate-800">{je.debitAccount}</div>
                    <div className="text-[10px] font-bold text-slate-400 italic">To {je.creditAccount}</div>
                  </td>
                  <td className="p-6 text-right font-black text-slate-900">{formatINR(je.baseAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AccountsPanel;