import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Tag, Check, Loader2, Sparkles, Award, Leaf } from 'lucide-react';
import { PartPricingResponse, PartPricingOption } from '../types';
import { fetchPartPricing } from '../services/api';

interface PartPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  partCode: string;
  vehicleTier: string;
  onApplyPricing: (option: PartPricingOption, optionKey: string, partLabel: string) => void;
}

export const PartPricingModal: React.FC<PartPricingModalProps> = ({
  isOpen,
  onClose,
  partCode,
  vehicleTier,
  onApplyPricing,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PartPricingResponse | null>(null);

  useEffect(() => {
    if (!isOpen || !partCode) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchPartPricing(partCode, vehicleTier)
      .then((data) => {
        if (isMounted) {
          setPricing(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load parts pricing catalog');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, partCode, vehicleTier]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Replacement Part Price Advisor
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
                  {vehicleTier.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Deterministic OEM & Certified Aftermarket Catalog for{' '}
                <span className="text-white font-medium capitalize">
                  {pricing?.part_label || partCode.replace('_', ' ')}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <p className="text-sm font-medium">Querying Relational Rate Matrix & Parts Catalog...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-xs text-center">
              {error}
            </div>
          )}

          {!loading && !error && pricing && (
            <>
              {/* Part Overview Bar */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/80 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Component</span>
                    <span className="font-semibold text-white">{pricing.part_label}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Classification</span>
                    <span className={pricing.is_structural ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                      {pricing.is_structural ? 'Structural Panel' : 'Cosmetic Body Panel'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Criticality</span>
                    <span className="font-mono text-slate-300">Level {pricing.criticality} / 3</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Est. Labor Hours</span>
                    <span className="font-semibold text-white font-mono">{pricing.labor_hours} hrs</span>
                  </div>
                  <div className="border-l border-slate-700 pl-3">
                    <span className="text-slate-400 block text-[11px]">Hourly Labor Rate</span>
                    <span className="font-semibold text-blue-300 font-mono">₹{pricing.labor_rate_hr}/hr</span>
                  </div>
                </div>
              </div>

              {/* Pricing Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. OEM Genuine Option */}
                {pricing.options.oem && (
                  <div className="bg-gradient-to-b from-blue-950/30 to-slate-800/80 rounded-xl border border-blue-500/40 p-4 flex flex-col justify-between shadow-lg relative group">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          OEM Factory Genuine
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-white text-sm">{pricing.options.oem.brand}</h4>
                        <span className="text-[11px] font-mono text-slate-400">
                          Part #{pricing.options.oem.part_number}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 line-clamp-2">
                        {pricing.options.oem.description}
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-slate-700/60 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Part Cost:</span>
                          <span className="font-mono text-white">₹{pricing.options.oem.part_cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Labor Cost:</span>
                          <span className="font-mono text-white">₹{pricing.options.oem.labor_cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Warranty:</span>
                          <span className="text-emerald-400 font-medium">{pricing.options.oem.warranty}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Availability:</span>
                          <span className="text-blue-300">{pricing.options.oem.availability}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-700/80">
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xs text-slate-400">Total Installed:</span>
                        <span className="text-lg font-bold text-white font-mono">
                          ₹{pricing.options.oem.total_cost.toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => onApplyPricing(pricing.options.oem, 'oem', pricing.part_label)}
                        className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply OEM Price</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Certified Aftermarket Option */}
                {pricing.options.aftermarket && (
                  <div className="bg-gradient-to-b from-purple-950/30 to-slate-800/80 rounded-xl border border-purple-500/40 p-4 flex flex-col justify-between shadow-lg relative group">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Certified Aftermarket
                        </span>
                        {pricing.options.aftermarket.savings && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Save ₹{pricing.options.aftermarket.savings.toFixed(0)}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-bold text-white text-sm">{pricing.options.aftermarket.brand}</h4>
                        <span className="text-[11px] font-mono text-slate-400">
                          Part #{pricing.options.aftermarket.part_number}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 line-clamp-2">
                        {pricing.options.aftermarket.description}
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-slate-700/60 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Part Cost (30% off):</span>
                          <span className="font-mono text-white">₹{pricing.options.aftermarket.part_cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Labor Cost:</span>
                          <span className="font-mono text-white">₹{pricing.options.aftermarket.labor_cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Warranty:</span>
                          <span className="text-emerald-400 font-medium">{pricing.options.aftermarket.warranty}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Availability:</span>
                          <span className="text-purple-300">{pricing.options.aftermarket.availability}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-700/80">
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xs text-slate-400">Total Installed:</span>
                        <span className="text-lg font-bold text-emerald-400 font-mono">
                          ₹{pricing.options.aftermarket.total_cost.toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => onApplyPricing(pricing.options.aftermarket, 'aftermarket', pricing.part_label)}
                        className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Aftermarket</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Eco-Recycled OEM Option */}
                {pricing.options.recycled && (
                  <div className="bg-gradient-to-b from-emerald-950/30 to-slate-800/80 rounded-xl border border-emerald-500/40 p-4 flex flex-col justify-between shadow-lg relative group">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Leaf className="w-3 h-3" />
                          Eco-Recycled OEM
                        </span>
                        {pricing.options.recycled.savings && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Save ₹{pricing.options.recycled.savings.toFixed(0)}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-bold text-white text-sm">{pricing.options.recycled.brand}</h4>
                        <span className="text-[11px] font-mono text-slate-400">
                          Part #{pricing.options.recycled.part_number}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 line-clamp-2">
                        {pricing.options.recycled.description}
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-slate-700/60 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Part Cost (50% off):</span>
                          <span className="font-mono text-white">₹{pricing.options.recycled.part_cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Labor Cost:</span>
                          <span className="font-mono text-white">₹{pricing.options.recycled.labor_cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Warranty:</span>
                          <span className="text-emerald-400 font-medium">{pricing.options.recycled.warranty}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Availability:</span>
                          <span className="text-emerald-300">{pricing.options.recycled.availability}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-700/80">
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xs text-slate-400">Total Installed:</span>
                        <span className="text-lg font-bold text-emerald-400 font-mono">
                          ₹{pricing.options.recycled.total_cost.toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => onApplyPricing(pricing.options.recycled, 'recycled', pricing.part_label)}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Recycled</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Regulatory Notice */}
              <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/60 flex items-center gap-2 text-[11px] text-slate-400">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  All part options comply with IRDAI motor insurance claim settlement guidelines. Labor hours are determined strictly from the vehicle tier rate matrix.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
