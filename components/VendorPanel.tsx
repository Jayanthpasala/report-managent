import React, { useRef, useState } from 'react';
import { VendorBill, Vendor, CountryCode, ExchangeRates, Country, Outlet } from '../types';
import { ICONS } from '../constants';

interface VendorPanelProps {
  vendors: Vendor[];
  bills: VendorBill[];
  outlets: Outlet[];
  onUploadBill: (file: File, vendorHint?: string) => Promise<void>;
  onAddVendor: (vendor: Omit<Vendor, 'id' | 'createdAt'>) => void;
  onSettleBill: (billId: string) => void;
  onDeleteVendor?: (vendorId: string) => void;
  isProcessing: boolean;
  rates: ExchangeRates;
  countries: Country[];
  onAddCountry: (country: Country) => void;
}

const VendorPanel: React.FC<VendorPanelProps> = ({ vendors = [], bills = [], outlets = [], onUploadBill, onAddVendor, onSettleBill, onDeleteVendor, isProcessing, rates, countries = [] }) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const billInputRef = useRef<HTMLInputElement>(null);

  const selectedVendor = vendors.find(v => v.id === selectedVendorId);
  const selectedVendorBills = selectedVendor 
    ? bills.filter(b => b.vendorName.toLowerCase().includes(selectedVendor.name.toLowerCase()))
    : [];

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getVendorTotalSpend = (vendorName: string) => {
    return bills
      .filter(b => b.vendorName.toLowerCase().includes(vendorName.toLowerCase()))
      .reduce((sum, b) => sum + (b.baseAmount || 0), 0);
  };

  const filteredVendors = vendors.filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (selectedVendor) {
    return (
      <div className="space-y-6 animate-slide-up">
        <button onClick={() => setSelectedVendorId(null)} className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest active:scale-95">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 19-7-7 7-7"/></svg>
          Directory
        </button>

        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl p-10 space-y-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center text-3xl font-black">{selectedVendor.name.charAt(0)}</div>
              <div>
                <h3 className="text-3xl font-black text-slate-900">{selectedVendor.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{selectedVendor.category}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Spent: {formatCurrency(getVendorTotalSpend(selectedVendor.name), 'INR')}</span>
                </div>
              </div>
            </div>
            <button disabled={isProcessing} onClick={() => billInputRef.current?.click()} className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 flex items-center gap-3">
              {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ICONS.Upload />}
              Scan New Invoice
            </button>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Transaction Vault</h4>
            <div className="space-y-4">
              {selectedVendorBills.length > 0 ? selectedVendorBills.map(bill => (
                <div key={bill.id} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{bill.date.split('-')[1]}</p>
                      <p className="text-lg font-black text-slate-900 leading-none">{bill.date.split('-')[2]}</p>
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900">{formatCurrency(bill.amount, bill.currency)}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ref: {bill.id.substr(0,8)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {bill.fileData && (
                      <a 
                        href={`data:${bill.fileData.mimeType};base64,${bill.fileData.data}`} 
                        download={bill.fileData.fileName}
                        className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-blue-500 transition-all shadow-sm"
                      >
                        Download PDF
                      </a>
                    )}
                    <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${bill.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{bill.status}</span>
                    {bill.status !== 'Paid' && (
                      <button onClick={() => onSettleBill(bill.id)} className="p-3 bg-emerald-600 text-white rounded-xl active:scale-90"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></button>
                    )}
                  </div>
                </div>
              )) : <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 italic text-sm font-bold">No history for this vendor yet.</div>}
            </div>
          </div>
        </div>
        <input type="file" ref={billInputRef} onChange={(e) => e.target.files?.[0] && onUploadBill(e.target.files[0], selectedVendor.name)} className="hidden" accept="image/*,application/pdf" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <h2 className="text-4xl font-black italic tracking-tighter">Vendor Books.</h2>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mt-2">{vendors.length} Registered Partners</p>
          </div>
          <div className="flex w-full md:w-auto gap-4">
            <input type="text" placeholder="Search partners..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 md:w-64 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none focus:bg-white/10" />
            <button onClick={() => setShowAddVendor(true)} className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95">Add Profile</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.map(vendor => (
          <div key={vendor.id} onClick={() => setSelectedVendorId(vendor.id)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:border-blue-300 hover:shadow-xl cursor-pointer group flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center font-black group-hover:bg-blue-600 group-hover:text-white transition-all">{vendor.name.charAt(0)}</div>
              <div>
                <h4 className="font-black text-slate-900 text-lg leading-tight">{vendor.name}</h4>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{vendor.category}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Spent</p>
              <p className="text-sm font-black text-slate-900">{formatCurrency(getVendorTotalSpend(vendor.name), 'INR')}</p>
            </div>
          </div>
        ))}
      </div>

      {showAddVendor && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-12 animate-slide-up space-y-8">
            <h3 className="text-2xl font-black text-slate-900 italic tracking-tight">Register New Vendor</h3>
            <div className="space-y-4">
              <input id="new-v-name" type="text" placeholder="Legal Name..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
              <select id="new-v-cat" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm appearance-none outline-none">
                <option value="Raw Food">Raw Food / Inventory</option>
                <option value="Labor">Labor / Salaries</option>
                <option value="Rent">Rent / Occupancy</option>
                <option value="Utilities">Utilities</option>
                <option value="Marketing">Marketing</option>
              </select>
              <button onClick={() => {
                const n = (document.getElementById('new-v-name') as HTMLInputElement).value;
                const c = (document.getElementById('new-v-cat') as HTMLSelectElement).value;
                if(n) { onAddVendor({ name: n, category: c, country: 'IN' }); setShowAddVendor(false); }
              }} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95">Establish Profile</button>
              <button onClick={() => setShowAddVendor(false)} className="w-full py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorPanel;