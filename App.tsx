import React, { useState, useRef, useEffect, useMemo } from 'react';
import { COUNTRIES as INITIAL_COUNTRIES, ICONS, WORLD_COUNTRIES } from './constants';
import { CountryCode, CurrencyCode, AnalysisResult, AnalysisContext, FileData, VendorBill, Vendor, ExchangeRates, Country, Outlet } from './types';
import { analyzeDocument, getLatestExchangeRates } from './services/geminiService';
import AnalysisReport from './components/AnalysisReport';
import VendorPanel from './components/VendorPanel';
import AccountsPanel from './components/AccountsPanel';
import FinancialCalendar from './components/FinancialCalendar';
import HQDashboard from './components/HQDashboard';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis' | 'vendors' | 'accounts' | 'outlets' | 'calendar'>('dashboard');
  
  // Persistence Layer
  const [availableCountries, setAvailableCountries] = useState<Country[]>(() => {
    const saved = localStorage.getItem('restofinance_countries');
    return saved ? JSON.parse(saved) : [...(INITIAL_COUNTRIES || [])];
  });

  const [outlets, setOutlets] = useState<Outlet[]>(() => {
    const saved = localStorage.getItem('restofinance_outlets');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedOutletId, setSelectedOutletId] = useState<string>(() => {
    return localStorage.getItem('restofinance_selected_outlet') || '';
  });

  const [systemRecords, setSystemRecords] = useState<AnalysisResult[]>(() => {
    const saved = localStorage.getItem('restofinance_records');
    return saved ? JSON.parse(saved) : [];
  });

  const [vendorBills, setVendorBills] = useState<VendorBill[]>(() => {
    const saved = localStorage.getItem('restofinance_bills');
    return saved ? JSON.parse(saved) : [];
  });

  const [vendors, setVendors] = useState<Vendor[]>(() => {
    const saved = localStorage.getItem('restofinance_vendors');
    return saved ? JSON.parse(saved) : [];
  });

  const [rates, setRates] = useState<ExchangeRates>({ 'SGD': 63.42, 'AUD': 55.18, 'INR': 1 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<string>('INITIATING');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisResult | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [showAddCountryModal, setShowAddCountryModal] = useState(false);

  const [salesFile, setSalesFile] = useState<FileData | null>(null);
  const [itemsFile, setItemsFile] = useState<FileData | null>(null);

  const salesInputRef = useRef<HTMLInputElement>(null);
  const itemsInputRef = useRef<HTMLInputElement>(null);

  // FX Sync
  useEffect(() => {
    const initAI = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) { refreshExchangeRates(); setNeedsApiKey(false); }
        else setNeedsApiKey(true);
      } else refreshExchangeRates();
    };
    initAI();
  }, []);

  // Save State to LocalStorage
  useEffect(() => {
    localStorage.setItem('restofinance_vendors', JSON.stringify(vendors));
    localStorage.setItem('restofinance_bills', JSON.stringify(vendorBills));
    localStorage.setItem('restofinance_records', JSON.stringify(systemRecords));
    localStorage.setItem('restofinance_countries', JSON.stringify(availableCountries));
    localStorage.setItem('restofinance_outlets', JSON.stringify(outlets));
    localStorage.setItem('restofinance_selected_outlet', selectedOutletId);
  }, [vendors, vendorBills, systemRecords, availableCountries, outlets, selectedOutletId]);

  const refreshExchangeRates = async () => {
    try {
      const currencies = Array.from(new Set([...availableCountries.map(c => c.currency), ...outlets.map(o => o.currency)]));
      const { rates: newRates } = await getLatestExchangeRates(currencies);
      setRates(prev => ({ ...prev, ...newRates }));
    } catch (err) { console.error(err); }
  };

  const handleOpenApiKeyDialog = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setNeedsApiKey(false);
      refreshExchangeRates();
    }
  };

  const processAnalysisIntoState = (res: AnalysisResult, originalFiles: FileData[]) => {
    if (!selectedOutletId) return;
    const rate = rates[res.currency] || 1;
    res.exchangeRateUsed = rate;
    res.outletId = selectedOutletId;
    if (originalFiles.length > 0) res.fileData = originalFiles[0];
    
    if (res.classification === 'REVENUE') {
      setSystemRecords(prev => [res, ...prev]);
    } else {
      const amount = res.financialData?.totalExpense || 0;
      const vendorName = res.financialData?.vendorDetails?.name || 'Unknown Vendor';
      const newBill: VendorBill = {
        id: Math.random().toString(36).substr(2, 9),
        vendorName: vendorName,
        category: res.financialData?.vendorDetails?.category || 'General',
        date: res.date,
        amount: amount,
        currency: res.currency,
        baseAmount: amount * rate,
        status: 'Pending',
        outletId: selectedOutletId,
        sourceRecordId: res.id,
        fileData: originalFiles.length > 0 ? originalFiles[0] : undefined
      };
      setVendorBills(prev => [newBill, ...prev]);
      setSystemRecords(prev => [res, ...prev]);
    }
  };

  const startAnalysis = async () => {
    if (!salesFile || !itemsFile) { setError("Audit requires both Daily Summary and SKU Data."); return; }
    const currentOutlet = outlets.find(o => o.id === selectedOutletId);
    if (!currentOutlet) return;

    setIsAnalyzing(true);
    setAnalysisPhase('RECONCILING SALES');
    setError(null);
    try {
      const context: AnalysisContext = { country: currentOutlet.countryCode, currency: currentOutlet.currency, outletName: currentOutlet.name };
      const result = await analyzeDocument("", [salesFile, itemsFile], context);
      processAnalysisIntoState(result, [salesFile, itemsFile]);
      setReport(result);
    } catch (err: any) { setError(err.message || "Audit failed."); }
    finally { setIsAnalyzing(false); }
  };

  const handleUploadBill = async (file: File, vendorHint?: string) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      const fileData: FileData = { data: base64, mimeType: file.type, fileName: file.name, fileType: file.type === 'application/pdf' ? 'pdf' : 'image' };
      const currentOutlet = outlets.find(o => o.id === selectedOutletId);
      if (!currentOutlet) return;
      setIsAnalyzing(true);
      setError(null);
      try {
        const context: AnalysisContext = { country: currentOutlet.countryCode, currency: currentOutlet.currency, outletName: currentOutlet.name };
        const result = await analyzeDocument("", [fileData], context, vendorHint);
        processAnalysisIntoState(result, [fileData]);
      } catch (err: any) { setError(err.message || "Bill failed."); }
      finally { setIsAnalyzing(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleAddOutlet = (name: string, countryCode: string) => {
    const country = availableCountries.find(c => c.code === countryCode);
    if (!country) return;
    const newOutlet: Outlet = { id: Math.random().toString(36).substr(2, 9), name, countryCode, currency: country.currency };
    setOutlets(prev => [...prev, newOutlet]);
    if (!selectedOutletId) setSelectedOutletId(newOutlet.id);
  };

  const handleAddCountry = (country: Country) => {
    setAvailableCountries(prev => {
      if (prev.some(c => c.code === country.code)) return prev;
      return [...prev, country];
    });
  };

  const handleDeleteRecord = (record: AnalysisResult) => {
    setSystemRecords(prev => prev.filter(r => r.id !== record.id));
    setVendorBills(prev => prev.filter(b => b.sourceRecordId !== record.id));
    if (report?.id === record.id) setReport(null);
  };

  const navItems = [
    { id: 'dashboard', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, label: 'HQ Home' },
    { id: 'analysis', icon: <ICONS.Globe />, label: 'Audit Hub' },
    { id: 'calendar', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>, label: 'Vault' },
    { id: 'vendors', icon: <ICONS.FileText />, label: 'Vendors' },
    { id: 'accounts', icon: <ICONS.CheckCircle />, label: 'Books' },
    { id: 'outlets', icon: <ICONS.TrendingUp />, label: 'Branches' },
  ];

  const totalBasePayables = vendorBills.filter(b => b.outletId === selectedOutletId && b.status !== 'Paid').reduce((sum, b) => sum + (b.baseAmount || 0), 0);
  const branchRecords = useMemo(() => systemRecords.filter(r => r.outletId === selectedOutletId), [systemRecords, selectedOutletId]);
  const branchBills = useMemo(() => vendorBills.filter(b => b.outletId === selectedOutletId), [vendorBills, selectedOutletId]);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 relative pb-24 lg:pb-0">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-80 bg-white border-r border-slate-200 flex-col py-8 sticky top-0 h-screen z-50">
        <div className="px-8 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl">R</div>
          <div><h1 className="text-xl font-black text-slate-800 tracking-tight">RestoFinance</h1><p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-1">Global AI Analyst</p></div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-4 px-6 py-3.5 rounded-2xl transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>
              <div className="shrink-0">{item.icon}</div>
              <span className="font-black text-xs uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-6 w-full mt-auto space-y-4 pt-8">
           <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 no-print">
             <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Branch Focus</label>
             <select value={selectedOutletId} onChange={(e) => setSelectedOutletId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs outline-none">
               <option value="">Select branch...</option>
               {outlets.map(o => <option key={o.id} value={o.id}>{availableCountries.find(c => c.code === o.countryCode)?.flag} {o.name}</option>)}
             </select>
           </div>
          <div className="bg-slate-900 p-5 rounded-3xl text-white">
            <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-2">FX (INR)</p>
            <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar">
              {availableCountries.filter(c => c.currency !== 'INR').map(c => (
                <div key={c.code} className="flex justify-between text-[10px] font-bold">
                  <span className="opacity-60">{c.flag} {c.currency}</span>
                  <span className="text-blue-400">₹{rates[c.currency]?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-12 overflow-y-auto min-h-[calc(100vh-140px)]">
        {error && <div className="mb-4 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-black text-[10px] uppercase tracking-widest flex justify-between"><span>{error}</span><button onClick={() => setError(null)}>✕</button></div>}
        
        {activeTab === 'dashboard' && <HQDashboard records={systemRecords} bills={vendorBills} outlets={outlets} countries={availableCountries} />}

        {activeTab !== 'dashboard' && activeTab !== 'outlets' && !selectedOutletId && (
          <div className="flex flex-col items-center justify-center h-[70vh] text-center px-6 animate-slide-up">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mb-6 shadow-inner"><ICONS.Globe /></div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Branch Context Required</h2>
            <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-xs">Detailed audit and books require a branch context. Select one from the sidebar or dashboard.</p>
          </div>
        )}

        {selectedOutletId && (
          <>
            {activeTab === 'analysis' && (
              report ? (
                <AnalysisReport data={report} onReset={() => { setReport(null); setSalesFile(null); setItemsFile(null); }} countries={availableCountries} />
              ) : (
                <div className="max-w-4xl mx-auto animate-slide-up">
                  <header className="text-center mb-12">
                    <h2 className="text-3xl lg:text-5xl font-black text-slate-900 mb-2 tracking-tighter italic">Branch Auditor.</h2>
                    <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Reconcile POS Summary vs SKU Detail</p>
                  </header>
                  <div className="bg-white rounded-[4rem] shadow-xl border border-slate-100 p-12 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div onClick={() => salesInputRef.current?.click()} className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer active:scale-[0.98] ${salesFile ? 'border-blue-500 bg-blue-50/10' : 'border-slate-200 hover:border-blue-400 bg-slate-50/30'}`}>
                        <input type="file" ref={salesInputRef} onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setSalesFile({ data: (ev.target?.result as string).split(',')[1], mimeType: file.type, fileName: file.name, fileType: 'image' });
                            reader.readAsDataURL(file);
                          }
                        }} className="hidden" />
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${salesFile ? 'bg-blue-600 text-white' : 'bg-white text-slate-300'}`}><ICONS.TrendingUp /></div>
                        <span className="font-black text-slate-800 text-sm uppercase tracking-wider">{salesFile ? salesFile.fileName : '1. Summary PDF'}</span>
                      </div>
                      <div onClick={() => itemsInputRef.current?.click()} className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer active:scale-[0.98] ${itemsFile ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:border-blue-400 bg-slate-50/30'}`}>
                        <input type="file" ref={itemsInputRef} onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setItemsFile({ data: (ev.target?.result as string).split(',')[1], mimeType: file.type, fileName: file.name, fileType: 'image' });
                            reader.readAsDataURL(file);
                          }
                        }} className="hidden" />
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${itemsFile ? 'bg-emerald-600 text-white' : 'bg-white text-slate-300'}`}><ICONS.FileText /></div>
                        <span className="font-black text-slate-800 text-sm uppercase tracking-wider">{itemsFile ? itemsFile.fileName : '2. SKU Report'}</span>
                      </div>
                    </div>
                    <button disabled={isAnalyzing || !salesFile || !itemsFile || needsApiKey} onClick={startAnalysis} className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-blue-200 active:scale-95 disabled:opacity-50">
                      {isAnalyzing ? analysisPhase + '...' : 'Reconcile Revenue'}
                    </button>
                  </div>
                </div>
              )
            )}
            {activeTab === 'calendar' && <FinancialCalendar records={branchRecords} bills={branchBills} currency={outlets.find(o => o.id === selectedOutletId)?.currency || 'INR'} rates={rates} onViewReport={(r) => { setReport(r); setActiveTab('analysis'); }} onDeleteRecord={handleDeleteRecord} />}
            {activeTab === 'vendors' && <VendorPanel vendors={vendors.filter(v => !v.outletId || v.outletId === selectedOutletId)} bills={branchBills} outlets={outlets} onUploadBill={handleUploadBill} onAddVendor={(v) => setVendors(prev => [...prev, {...v, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString()}])} onSettleBill={(id) => setVendorBills(prev => prev.map(b => b.id === id ? {...b, status: 'Paid'} : b))} onDeleteVendor={(id) => setVendors(prev => prev.filter(v => v.id !== id))} isProcessing={isAnalyzing} rates={rates} countries={availableCountries} onAddCountry={handleAddCountry} />}
            {activeTab === 'accounts' && <AccountsPanel records={branchRecords} bills={branchBills} />}
          </>
        )}

        {activeTab === 'outlets' && (
          <div className="max-w-4xl mx-auto pb-12 animate-slide-up">
            <header className="mb-8 flex justify-between items-end">
              <div><h2 className="text-3xl font-black text-slate-900 tracking-tight">Active Branches</h2><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Multi-Region Portfolio</p></div>
              <button onClick={() => setShowAddCountryModal(true)} className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest">+ Region</button>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {outlets.map(o => (
                <div key={o.id} onClick={() => setSelectedOutletId(o.id)} className={`bg-white p-6 rounded-3xl border transition-all flex items-center justify-between cursor-pointer active:scale-95 ${selectedOutletId === o.id ? 'border-blue-500 shadow-xl' : 'border-slate-100 shadow-sm'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl">{availableCountries.find(c => c.code === o.countryCode)?.flag}</div>
                    <div><h4 className="font-black text-slate-800 text-base">{o.name}</h4><span className="text-[9px] font-black text-blue-500 uppercase tracking-wider">{o.currency}</span></div>
                  </div>
                </div>
              ))}
              <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl p-6 space-y-4">
                <input id="outlet-name-input" type="text" placeholder="Branch Label..." className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-500" />
                <select id="outlet-country-input" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold bg-white">
                  {availableCountries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                </select>
                <button onClick={() => {
                  const n = (document.getElementById('outlet-name-input') as HTMLInputElement).value;
                  const c = (document.getElementById('outlet-country-input') as HTMLSelectElement).value;
                  if(n) handleAddOutlet(n, c);
                  (document.getElementById('outlet-name-input') as HTMLInputElement).value = '';
                }} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95">Add Branch</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-slate-900 border-t border-white/10 flex items-center justify-around px-4 z-[100] pb-2">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === item.id ? 'text-blue-400' : 'text-slate-400'}`}>
            <div className={`${activeTab === item.id ? 'scale-110' : 'scale-100'} transition-transform`}>{item.icon}</div>
            <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>

      {showAddCountryModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 animate-slide-up">
            <h3 className="text-2xl font-black text-slate-900 mb-6 italic tracking-tight">Expand Region</h3>
            <select onChange={(e) => {
              const selected = WORLD_COUNTRIES.find(c => c.name === e.target.value);
              if (selected) { handleAddCountry({ code: selected.code, name: selected.name, currency: selected.currency, flag: selected.flag }); setShowAddCountryModal(false); }
            }} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold appearance-none outline-none focus:border-blue-500">
              <option value="">Select Country...</option>
              {WORLD_COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
            </select>
            <button onClick={() => setShowAddCountryModal(false)} className="w-full mt-6 py-4 text-slate-400 font-black text-xs uppercase tracking-widest">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;