import React from 'react';
import { Sparkles, Phone, ShieldCheck } from 'lucide-react';

/**
 * Top announcement and confidence bar.
 */
export const AnnouncementBar = () => {
  return (
    <div className="bg-slate-900 text-slate-200 text-xs py-2 px-4 border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Left: Assurance / Promotion */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full text-[10px] tracking-wide uppercase border border-emerald-800/50">
            <Sparkles className="w-3 h-3" />
            Seasonal Launch
          </span>
          <span className="text-slate-300">
            Complimentary express courier delivery on orders over <strong className="text-white font-semibold">$50</strong>
          </span>
        </div>

        {/* Right: Quick Utility Links */}
        <div className="hidden md:flex items-center gap-5 text-slate-300 text-xs">
          <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Authorized Retailer Guarantee
          </span>
          <span className="text-slate-700">|</span>
          <a
            href="tel:+18005550199"
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <Phone className="w-3 h-3 text-slate-400" />
            24/7 Concierge: 1-800-555-0199
          </a>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300 font-medium cursor-pointer hover:text-white">
            USD ($) · EN
          </span>
        </div>
      </div>
    </div>
  );
};
