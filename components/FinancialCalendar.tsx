import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import _html2pdf from 'html2pdf.js';
import JSZip from 'jszip';
import { AnalysisResult, VendorBill, CurrencyCode, ExchangeRates } from '../types';
import { ICONS } from '../constants';

interface FinancialCalendarProps {
  records: AnalysisResult[];
  bills: VendorBill[];
  currency: CurrencyCode;
  rates: ExchangeRates;
  onViewReport?: (report: AnalysisResult) => void;
  onDeleteRecord?: (record: AnalysisResult) => void;
}

const FinancialCalendar: React.FC<FinancialCalendarProps> = ({ records = [], bills = [], currency, rates, onViewReport, onDeleteRecord }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const dayData = useMemo(() => {
    const map: Record<string, { 
      revenue: number, 
      expenses: number, 
      pendingBills: number, 
      docCount: number,
      digitalCertificates: AnalysisResult[],
      vendorBills: VendorBill[]
    }> = {};
    
    records.forEach(r => {
      if (!r || !r.date) return;
      if (!map[r.date]) map[r.date] = { revenue: 0, expenses: 0, pendingBills: 0, docCount: 0, digitalCertificates: [], vendorBills: [] };
      map[r.date].docCount += 1;
      map[r.date].digitalCertificates.push(r);
      if (r.classification === 'REVENUE') {
        map[r.date].revenue += (r.financialData?.totalSales || r.financialData?.grossSales || 0);
      } else {
        map[r.date].expenses += (r.financialData?.totalExpense || 0);
      }
    });

    bills.forEach(b => {
      if (!b || !b.date) return;
      if (!map[b.date]) map[b.date] = { revenue: 0, expenses: 0, pendingBills: 0, docCount: 0, digitalCertificates: [], vendorBills: [] };
      if (b.status === 'Pending') map[b.date].pendingBills += 1;
      map[b.date].vendorBills.push(b);
    });

    return map;
  }, [records, bills]);

  const filteredRangeRecords = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    return records.filter(r => r.date >= rangeStart && r.date <= rangeEnd);
  }, [records, rangeStart, rangeEnd]);

  const filteredRangeBills = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    return bills.filter(b => b.date >= rangeStart && b.date <= rangeEnd);
  }, [bills, rangeStart, rangeEnd]);

  const handleDownloadBatch = async () => {
    if (filteredRangeRecords.length === 0 && filteredRangeBills.length === 0) return;
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      const docsFolder = zip.folder("Analysis_Reports");
      const billsFolder = zip.folder("Vendor_Bills");

      filteredRangeRecords.forEach((r) => {
        if (r.fileData) {
          const name = `${r.date}_${r.classification}_${r.id.substr(0,4)}_${r.fileData.fileName}`;
          docsFolder?.file(name, r.fileData.data, {base64: true});
        }
      });

      filteredRangeBills.forEach((b) => {
        if (b.fileData) {
          const name = `${b.date}_BILL_${b.vendorName.replace(/\s+/g, '_')}_${b.id.substr(0,4)}_${b.fileData.fileName}`;
          billsFolder?.file(name, b.fileData.data, {base64: true});
        }
      });

      const wb = XLSX.utils.book_new();
      const excelData = [
        ...filteredRangeRecords.map(r => ({ Date: r.date, Type: r.documentType, Classification: r.classification, Amount: r.financialData.totalSales || r.financialData.totalExpense || 0, Currency: r.currency })),
        ...filteredRangeBills.map(b => ({ Date: b.date, Type: 'Vendor Bill', Classification: 'EXPENSE', Amount: b.amount, Currency: b.currency, Vendor: b.vendorName }))
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelData), "Financial_Log");
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      zip.file(`Financial_Audit_Log.xlsx`, excelBuffer);

      const content = await zip.generateAsync({type: "blob"});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Full_Audit_Vault_Package_${rangeStart}_to_${rangeEnd}.zip`;
      link.click();
    } finally {
      setIsExportingZip(false);
    }
  };

  const formatValue = (val: number) => {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const renderDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="h-16 lg:h-32 opacity-20 border border-slate-100 rounded-xl bg-slate-50"></div>);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const data = dayData[dateStr];
      const isSelected = selectedDay === dateStr;
      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDay(dateStr)}
          className={`h-16 lg:h-32 p-1 lg:p-4 border rounded-xl transition-all relative flex flex-col justify-between overflow-hidden cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10' : 'bg-white border-slate-100 hover:border-slate-300'}`}
        >
          <span className={`text-[8px] lg:text-[10px] font-black ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>{d}</span>
          <div className="flex flex-col gap-0.5 items-center lg:items-end">
            {data?.revenue > 0 && <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-emerald-500 rounded-full"></div>}
            {data?.expenses > 0 && <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-rose-500 rounded-full"></div>}
            {data?.pendingBills > 0 && <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-amber-500 rounded-full"></div>}
          </div>
        </div>
      );
    }
    return days;
  };

  const selectedDayData = selectedDay ? dayData[selectedDay] : null;

  return (
    <div className="max-w-7xl mx-auto space-y-4 lg:space-y-8 animate-slide-up pb-10">
      <header className="flex justify-between items-center bg-white p-6 lg:p-10 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl lg:text-4xl font-black text-slate-900 tracking-tight italic">Audit Vault.</h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-200">
          <button onClick={prevMonth} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg></button>
          <button onClick={nextMonth} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
      </header>

      <section className="bg-slate-900 rounded-3xl p-6 lg:p-10 text-white relative overflow-hidden shadow-xl">
        <h3 className="text-lg lg:text-3xl font-black italic tracking-tighter mb-4 lg:mb-8">Bulk Audit Export.</h3>
        <p className="text-xs font-medium text-white/50 mb-6 max-w-lg">Select a date range to generate a comprehensive audit package including analysis reports, raw vendor bills, and a consolidated financial log.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Start Date</label>
            <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">End Date</label>
            <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1 sm:pt-6">
            <button disabled={!rangeStart || !rangeEnd || isExportingZip} onClick={handleDownloadBatch} className="w-full h-[46px] bg-blue-600 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
              {isExportingZip ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ICONS.Upload />}
              {isExportingZip ? 'Packaging...' : 'Export Audit ZIP'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8">
        <div className="lg:col-span-3 bg-white p-4 lg:p-10 rounded-[2rem] lg:rounded-[3.5rem] border border-slate-200 shadow-sm">
          <div className="grid grid-cols-7 gap-2 lg:gap-6">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <div key={d} className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2">{d}</div>
            ))}
            {renderDays()}
          </div>
        </div>

        {selectedDay && (
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl animate-slide-up flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Evidence Hub</h4>
                <p className="text-xl font-black text-slate-900">{selectedDay}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 text-slate-300">✕</button>
            </div>
            
            <div className="space-y-6 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
              <div className="space-y-3">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analysis Logs</h5>
                {selectedDayData?.digitalCertificates.map((cert, i) => (
                  <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:border-blue-200 transition-colors">
                    <div>
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{cert.classification}</p>
                      <p className="text-xs font-bold text-slate-700 mt-1 truncate max-w-[120px]">{cert.fileData?.fileName || 'POS Log'}</p>
                    </div>
                    <button onClick={() => onViewReport?.(cert)} className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>
                  </div>
                ))}
                {!selectedDayData?.digitalCertificates.length && <p className="text-[10px] font-bold text-slate-300 italic px-2">No logs found.</p>}
              </div>

              <div className="space-y-3">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor Bills</h5>
                {selectedDayData?.vendorBills.map((bill, i) => (
                  <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:border-amber-200 transition-colors">
                    <div>
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">{bill.vendorName}</p>
                      <p className="text-xs font-bold text-slate-700 mt-1">{formatValue(bill.amount)}</p>
                    </div>
                    {bill.fileData && (
                      <a href={`data:${bill.fileData.mimeType};base64,${bill.fileData.data}`} download={bill.fileData.fileName} className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      </a>
                    )}
                  </div>
                ))}
                {!selectedDayData?.vendorBills.length && <p className="text-[10px] font-bold text-slate-300 italic px-2">No bills found.</p>}
              </div>
            </div>

            <div className="mt-auto p-6 bg-slate-900 rounded-2xl text-white">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Day Revenue</span>
                <span className="text-sm font-black text-emerald-400">+{formatValue(selectedDayData?.revenue || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Day Expenses</span>
                <span className="text-sm font-black text-rose-400">-{formatValue(selectedDayData?.expenses || 0)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialCalendar;
