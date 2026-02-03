
import React, { useState } from 'react';
import { SettlementItem, AnalysisResult, CurrencyCode } from '../types';
import { ICONS } from '../constants';

interface ReconciliationPanelProps {
  settlements: SettlementItem[];
  systemRecords: AnalysisResult[];
  onUploadSettlement: (file: File) => Promise<void>;
  isProcessing: boolean;
  currency: CurrencyCode;
}

const ReconciliationPanel: React.FC<ReconciliationPanelProps> = ({ settlements, systemRecords, onUploadSettlement, isProcessing, currency }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const findSystemMatch = (settlement: SettlementItem) => {
    // Basic matching logic based on date and platform name (fuzzy)
    return systemRecords.find(record => {
      const isDateMatch = record.date === settlement.date;
      const isPlatformMatch = record.financialData.revenueBreakdown?.some(
        rb => rb.source.toLowerCase().includes(settlement.platform.toLowerCase())
      );
      return isDateMatch && isPlatformMatch;
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pending Reconciliation</p>
          <p className="text-4xl font-black text-slate-900">{settlements.length}</p>
        </div>
        <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100 shadow-sm">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Total Variance</p>
          <p className="text-4xl font-black text-amber-600 italic">Review Required</p>
        </div>
        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Upload New Settlement</p>
            <p className="text-xs text-white/60">Zomato, Swiggy, Bank Stmt</p>
          </div>
          <label className={`cursor-pointer w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white hover:bg-blue-700 transition-all ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
            {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ICONS.Upload />}
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadSettlement(e.target.files[0])} />
          </label>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-lg font-black text-slate-800 tracking-tight">Reconciliation Workspace</h3>
          <div className="flex gap-2 p-1 bg-white rounded-xl border border-slate-200">
            <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${activeTab === 'pending' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>Pending</button>
            <button onClick={() => setActiveTab('completed')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${activeTab === 'completed' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>History</button>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 gap-6">
            {settlements.length === 0 ? (
              <div className="py-20 text-center opacity-30 italic font-bold">No settlements pending reconciliation. Upload a statement to begin.</div>
            ) : (
              settlements.map(item => {
                const match = findSystemMatch(item);
                const variance = match ? (item.grossAmount - (match.financialData.grossSales || 0)) : 0;
                
                return (
                  <div key={item.id} className="border border-slate-100 rounded-[2rem] overflow-hidden hover:border-blue-200 transition-all">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                      {/* Left Side: Statement (The "Truth" from bank/platform) */}
                      <div className="p-8 bg-blue-50/30 border-r border-slate-100">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2 py-0.5 bg-blue-100 rounded">Settlement Report</span>
                            <h4 className="text-xl font-black text-slate-800 mt-2">{item.platform}</h4>
                            <p className="text-xs text-slate-400 font-bold uppercase">{item.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Paid</p>
                            <p className="text-2xl font-black text-slate-900">{formatCurrency(item.netPayout)}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm font-medium text-slate-600">
                            <span>Gross Amount</span>
                            <span>{formatCurrency(item.grossAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-medium text-rose-500">
                            <span>Commission & Fees</span>
                            <span>-{formatCurrency(item.commission)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: System Records (Our internal numbers) */}
                      <div className="p-8 relative">
                        {match ? (
                          <div className="animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-start mb-6">
                              <div>
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest px-2 py-0.5 bg-emerald-100 rounded">System Match Found</span>
                                <h4 className="text-xl font-black text-slate-800 mt-2">{match.outletName}</h4>
                                <p className="text-xs text-slate-400 font-bold uppercase">POS RECORD: {match.date}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variance</p>
                                <p className={`text-2xl font-black ${variance === 0 ? 'text-emerald-500' : 'text-rose-600'}`}>
                                  {variance === 0 ? 'MATCHED' : formatCurrency(variance)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-8">
                                <div className="flex items-center gap-3">
                                   <div className={`w-3 h-3 rounded-full ${variance === 0 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                                   <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                     {variance === 0 ? 'Perfect Reconciliation' : 'Audit Required'}
                                   </span>
                                </div>
                                <button className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-600 transition-all">Confirm Match</button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center py-8">
                             <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
                                <ICONS.AlertTriangle />
                             </div>
                             <p className="text-sm font-bold text-slate-400 italic">No system sales record found for this date/platform.</p>
                             <button className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-3 hover:underline">Link Manually</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReconciliationPanel;
