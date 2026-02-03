
import React from 'react';

export const COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', flag: '🇮🇳' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', flag: '🇸🇬' },
  { code: 'AU', name: 'Australia', currency: 'AUD', flag: '🇦🇺' },
] as const;

export const WORLD_COUNTRIES = [
  { name: 'United Arab Emirates', code: 'AE', currency: 'AED', flag: '🇦🇪' },
  { name: 'United Kingdom', code: 'GB', currency: 'GBP', flag: '🇬🇧' },
  { name: 'United States', code: 'US', currency: 'USD', flag: '🇺🇸' },
  { name: 'Canada', code: 'CA', currency: 'CAD', flag: '🇨🇦' },
  { name: 'Japan', code: 'JP', currency: 'JPY', flag: '🇯🇵' },
  { name: 'Thailand', code: 'TH', currency: 'THB', flag: '🇹🇭' },
  { name: 'Malaysia', code: 'MY', currency: 'MYR', flag: '🇲🇾' },
  { name: 'Indonesia', code: 'ID', currency: 'IDR', flag: '🇮🇩' },
  { name: 'Vietnam', code: 'VN', currency: 'VND', flag: '🇻🇳' },
  { name: 'France', code: 'FR', currency: 'EUR', flag: '🇫🇷' },
  { name: 'Germany', code: 'DE', currency: 'EUR', flag: '🇩🇪' },
  { name: 'Italy', code: 'IT', currency: 'EUR', flag: '🇮🇹' },
  { name: 'Spain', code: 'ES', currency: 'EUR', flag: '🇪🇸' },
  { name: 'Switzerland', code: 'CH', currency: 'CHF', flag: '🇨🇭' },
  { name: 'Saudi Arabia', code: 'SA', currency: 'SAR', flag: '🇸🇦' },
  { name: 'Qatar', code: 'QA', currency: 'QAR', flag: '🇶🇦' },
  { name: 'South Africa', code: 'ZA', currency: 'ZAR', flag: '🇿🇦' },
  { name: 'New Zealand', code: 'NZ', currency: 'NZD', flag: '🇳🇿' },
];

export const ICONS = {
  Upload: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
  ),
  FileText: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14.5 2 14.5 8 20 8"/></svg>
  ),
  AlertTriangle: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12" y1="17" y2="17.01"/></svg>
  ),
  TrendingUp: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
  ),
  CheckCircle: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  ),
  Globe: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  )
};
