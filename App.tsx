import React, { useState, useRef, useEffect, useMemo } from 'react';
import { COUNTRIES as INITIAL_COUNTRIES, ICONS } from './constants';
import { AnalysisResult, AnalysisContext, FileData, VendorBill, Vendor, ExchangeRates, Country, Outlet } from './types';
import { analyzeDocument, getLatestExchangeRates } from './services/geminiService';
import { db, syncOutlets, syncRecords, syncBills, syncVendors, syncCountries, uploadFileToCloud } from './services/firebaseService';
import { ref, set, update, push } from "firebase/database";
import AnalysisReport from './components/AnalysisReport';
import VendorPanel from './components/VendorPanel';
import AccountsPanel from './components/AccountsPanel';
import FinancialCalendar from './components/FinancialCalendar';
import HQDashboard from './components/HQDashboard';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis' | 'vendors' | 'accounts' | 'outlets' | 'calendar'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('restofinance_sidebar_collapsed') === 'true');
  
  const [availableCountries, setAvailableCountries] = useState<Country[]>([...INITIAL_COUNTRIES]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(() => localStorage.getItem('restofinance_selected_outlet') || '');
  const [systemRecords, setSystemRecords] = useState<AnalysisResult[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [rates, setRates] = useState<ExchangeRates>({ 'SGD': 63.80, 'AUD': 55.40, 'INR': 1, 'USD': 83.90, 'AED': 22.80, 'GBP': 106.10 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<string>('INITIATING');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisResult | null>(null);

  const [salesFile, setSalesFile] = useState<FileData | null>(null);
  const [itemsFile, setItemsFile] = useState<FileData | null>(null);

  const salesInputRef = useRef<HTMLInputElement>(null);
  const itemsInputRef = useRef<HTMLInputElement>(null);

  // FX Rate Fetcher - ensuring "Live" rates appear on dashboard
  useEffect(() => {
    getLatestExchangeRates(['SGD', 'AUD', 'USD', 'AED', 'GBP']).then(res => {
      if (res.isLive) {
        setRates(res.rates);
      }
    });
  }, []);

  // Firebase Real-time Sync - ensuring branches and records load
  useEffect(() => {
    const unsubOutlets = syncOutlets((data) => {
      setOutlets(data);
      if (data.length > 0 && !selectedOutletId) {
        setSelectedOutletId(data[0].id);
      }
    });
    const unsubRecords = syncRecords(setSystemRecords);
    const unsubBills = syncBills(setVendorBills);
    const unsubVendors = syncVendors(setVendors);
    const unsubCountries = syncCountries((newCountries) => {
      if (newCountries && newCountries.length > 0) {
        setAvailableCountries([...INITIAL_COUNTRIES, ...newCountries]);
      }
    });

    return () => {
      unsubOutlets();
      unsubRecords();
      unsubBills();
      unsubVendors();
      unsubCountries();
    };
  }, [selectedOutletId]);

  const selectedOutlet = useMemo(() => outlets.find(o => o.id === selectedOutletId), [outlets, selectedOutletId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'sales' | 'items') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const fileData: FileData = {
        data: base64,
        mimeType: file.type,
        fileName: file.name,
        fileType: file.type.includes('image') ? 'image' : (file.type.includes('pdf') ? 'pdf' : 'excel')
      };
      if (type === 'sales') setSalesFile(fileData);
      else setItemsFile(fileData);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAnalysis = async () => {
    if (!salesFile || !selectedOutlet) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysisPhase('ANALYZING DATA');
    try {
      const context: AnalysisContext = {
        country: selectedOutlet.countryCode,
        currency: selectedOutlet.currency,
        outletName: selectedOutlet.name
      };
      const result = await analyzeDocument("", [salesFile, ...(itemsFile ? [itemsFile] : [])], context);
      const rate = rates[selectedOutlet.currency] || 1;
      result.exchangeRateUsed = rate;
      result.outletId = selectedOutlet.id;
      const recordRef = push(ref(db, 'records'));
      await set(recordRef, { ...result, id: recordRef.key });
      setReport(result);
      setActiveTab('analysis');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddVendor = (vendorData: Omit<Vendor, 'id' | 'createdAt'>) => {
    try {
      const vendorRef = push(ref(db, 'vendors'));
      const newVendor = { ...vendorData, id: vendorRef.key, createdAt: new Date().toISOString() };
      set(vendorRef, newVendor);
    } catch (e) { setError("Failed to add vendor."); }
  };

  const handleUploadBill = async (file: File, vendorHint?: string) => {
    if (!selectedOutlet) return;
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        const fileData: FileData = { data: base64, mimeType: file.type, fileName: file.name, fileType: file.type.includes('image') ? 'image' : 'pdf' };
        const result = await analyzeDocument("", [fileData], { country: selectedOutlet.countryCode, currency: selectedOutlet.currency, outletName: selectedOutlet.name }, vendorHint);
        const cloudUrl = await uploadFileToCloud(fileData);
        const billRef = push(ref(db, 'bills'));
        await set(billRef, {
          id: billRef.key!,
          vendorName: result.financialData.vendorDetails?.name || vendorHint || 'Unknown',
          category: result.financialData.vendorDetails?.category || 'General',
          date: result.date || new Date().toISOString().split('T')[0],
          amount: result.financialData.totalExpense || 0,
          currency: result.currency,
          baseAmount: (result.financialData.totalExpense || 0) * (rates[result.currency] || 1),
          status: 'Pending',
          outletId: selectedOutlet.id,
          fileUrl: cloudUrl
        });
      };
      reader.readAsDataURL(file);
    } catch (err) { setError("Bill processing failed."); } finally { setIsAnalyzing(false); }
  };

  const handleAddOutlet = (name: string, countryCode: string) => {
    const country = availableCountries.find(c => c.code === countryCode);
    if (!country) return;
    const outletRef = push(ref(db, 'outlets'));
    const newOutlet = { id: outletRef.key!, name, countryCode, currency: country.currency };
    set(outletRef, newOutlet).then(() => {
      setSelectedOutletId(newOutlet.id);
      localStorage.setItem('restofinance_selected_outlet', newOutlet.id);
      setActiveTab('dashboard');
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans selection:bg-blue-100 selection:text-blue-900">
      <aside className={`${isSidebarCollapsed ? 'w-24' : 'w-72'} bg-white border-r border-slate-200 transition-all duration-500 flex flex-col z-50`}>
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0"><ICONS.TrendingUp /></div>
          {!isSidebarCollapsed && <h1 className="text-xl font-black text-slate-900 italic">RestoFinance.</h1>}
        </div>
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <ICONS.Globe /> },
            { id: 'analysis', label: 'Audit Engine', icon: <ICONS.Upload /> },
            { id: 'vendors', label: 'Vendors', icon: <ICONS.FileText /> },
            { id: 'calendar', label: 'Vault', icon: <ICONS.AlertTriangle /> },
            { id: 'accounts', label: 'Ledger', icon: <ICONS.CheckCircle /> },
            { id: 'outlets', label: 'Branches', icon: <ICONS.TrendingUp /> },
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === item.id ? 'bg-slate-900 text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-50'}`}>
              <div className="shrink-0">{item.icon}</div>
              {!isSidebarCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4">
          <button onClick={() => { setIsSidebarCollapsed(!isSidebarCollapsed); localStorage.setItem('restofinance_sidebar_collapsed', String(!isSidebarCollapsed)); }} className="w-full p-4 bg-slate-50 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest">
            {isSidebarCollapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto no-scrollbar p-6 lg:p-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-center mb-12 gap-6">
            <div className="flex items-center gap-4">
              <select value={selectedOutletId} onChange={(e) => { setSelectedOutletId(e.target.value); localStorage.setItem('restofinance_selected_outlet', e.target.value); }} className="bg-white border-2 border-slate-100 rounded-2xl px-8 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-blue-500 shadow-sm transition-all">
                <option value="">Select Branch</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{availableCountries.find(c => c.code === o.countryCode)?.flag} {o.name}</option>
                ))}
              </select>
              <button onClick={() => setActiveTab('outlets')} className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-500 shadow-sm">+</button>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Currency</span>
              <span className="text-sm font-black text-slate-900">INR (₹)</span>
            </div>
          </div>

          {(activeTab === 'dashboard' || outlets.length === 0) && outlets.length > 0 && <HQDashboard records={systemRecords} bills={vendorBills} outlets={outlets} countries={availableCountries} />}
          {activeTab === 'analysis' && outlets.length > 0 && (
            <div className="space-y-8">
              {report ? <AnalysisReport data={report} onReset={() => setReport(null)} countries={availableCountries} /> : (
                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-xl text-center space-y-12">
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter italic">Upload Audit.</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <div onClick={() => salesInputRef.current?.click()} className={`p-12 border-4 border-dashed rounded-[3rem] transition-all cursor-pointer ${salesFile ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}>
                      <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center mx-auto mb-6"><ICONS.Upload /></div>
                      <h4 className="font-black text-slate-900 uppercase tracking-widest text-[11px]">{salesFile ? salesFile.fileName : 'Primary POS Report'}</h4>
                    </div>
                    <div onClick={() => itemsInputRef.current?.click()} className={`p-12 border-4 border-dashed rounded-[3rem] transition-all cursor-pointer ${itemsFile ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-emerald-200'}`}>
                      <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-6"><ICONS.FileText /></div>
                      <h4 className="font-black text-slate-900 uppercase tracking-widest text-[11px]">{itemsFile ? itemsFile.fileName : 'SKU Breakdown (Opt)'}</h4>
                    </div>
                  </div>
                  <input type="file" ref={salesInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'sales')} accept="image/*,application/pdf" />
                  <input type="file" ref={itemsInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'items')} accept="image/*,application/pdf" />
                  {salesFile && selectedOutlet && (
                    <button onClick={handleRunAnalysis} disabled={isAnalyzing} className="px-12 py-6 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 disabled:opacity-50">
                      {isAnalyzing ? `Engine: ${analysisPhase}...` : 'Initiate Deep Audit'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {activeTab === 'vendors' && outlets.length > 0 && <VendorPanel vendors={vendors} bills={vendorBills} outlets={outlets} onUploadBill={handleUploadBill} onAddVendor={handleAddVendor} onSettleBill={(id) => update(ref(db, `bills/${id}`), { status: 'Paid' })} isProcessing={isAnalyzing} rates={rates} countries={availableCountries} onAddCountry={(c) => setAvailableCountries(prev => [...prev, c])} />}
          {activeTab === 'calendar' && outlets.length > 0 && <FinancialCalendar records={systemRecords} bills={vendorBills} currency={selectedOutlet?.currency || 'INR'} rates={rates} onViewReport={(r) => { setReport(r); setActiveTab('analysis'); }} />}
          {activeTab === 'accounts' && outlets.length > 0 && <AccountsPanel records={systemRecords} bills={vendorBills} />}
          {(activeTab === 'outlets' || outlets.length === 0) && (
            <div className="animate-slide-up space-y-12">
              <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-xl">
                <h3 className="text-3xl font-black text-slate-900 italic mb-2">Branch Network.</h3>
                {outlets.length === 0 && <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-widest italic">Start by registering your first branch to unlock the dashboard.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {outlets.map(o => (
                    <div key={o.id} onClick={() => { setSelectedOutletId(o.id); localStorage.setItem('restofinance_selected_outlet', o.id); setActiveTab('dashboard'); }} className={`p-8 rounded-[2.5rem] border transition-all cursor-pointer ${selectedOutletId === o.id ? 'bg-slate-900 text-white shadow-2xl' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}>
                      <div className="text-3xl mb-4">{availableCountries.find(c => c.code === o.countryCode)?.flag}</div>
                      <h4 className="font-black text-lg">{o.name}</h4>
                      <p className="text-[10px] font-black uppercase opacity-60">{o.currency} Region</p>
                    </div>
                  ))}
                  <div className="p-8 rounded-[2.5rem] border-4 border-dashed border-slate-100 space-y-4">
                    <input id="new-branch-name" type="text" placeholder="Branch Name..." className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                    <select id="new-branch-country" className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none">
                      {availableCountries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                    </select>
                    <button onClick={() => {
                      const name = (document.getElementById('new-branch-name') as HTMLInputElement).value;
                      const code = (document.getElementById('new-branch-country') as HTMLSelectElement).value;
                      if (name && code) handleAddOutlet(name, code);
                    }} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95">Register Branch</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;