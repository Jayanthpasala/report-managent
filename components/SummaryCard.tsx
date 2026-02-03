
import React from 'react';

interface SummaryCardProps {
  label: string;
  value: number | string | null;
  currency: string;
  baseValue?: number | null;
  baseCurrency?: string;
  type?: 'positive' | 'negative' | 'neutral';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, currency, baseValue, baseCurrency, type = 'neutral' }) => {
  const formatValue = (val: number | string | null, curr: string) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'string') return val;
    return new Intl.NumberFormat(curr === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: curr || 'USD',
    }).format(val);
  };

  const getColors = () => {
    switch (type) {
      case 'positive': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'negative': return 'text-rose-600 bg-rose-50 border-rose-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const isDifferentCurrency = currency !== baseCurrency && baseValue !== undefined;

  return (
    <div className={`p-5 border rounded-2xl ${getColors()} flex flex-col justify-center transition-all hover:shadow-md`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{label}</p>
      <div className="flex flex-col">
        <p className="text-2xl font-black tracking-tight">{formatValue(value, currency)}</p>
        {isDifferentCurrency && baseValue !== null && (
          <div className="mt-1 pt-1 border-t border-current border-opacity-10">
             <p className="text-[10px] font-black opacity-60 uppercase">Est. {formatValue(baseValue, baseCurrency || 'INR')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryCard;
