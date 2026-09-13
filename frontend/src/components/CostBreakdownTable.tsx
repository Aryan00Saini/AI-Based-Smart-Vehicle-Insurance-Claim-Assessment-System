import React, { useState } from 'react';
import { Wrench, RefreshCw, AlertCircle, Sparkles, Tag, Layers } from 'lucide-react';
import { LineItem, PartPricingOption } from '../types';
import { PartPricingModal } from './PartPricingModal';
import { getSeverityBadgeClass } from '../constants/theme';


interface CostBreakdownTableProps {
  lineItems: LineItem[];
  subtotal: number;
  deductible: number;
  payableAmount: number;
  vehicleTier?: string;
  editable?: boolean;
  onLineItemChange?: (index: number, updatedItem: LineItem) => void;
  onApplyPricingNote?: (note: string) => void;
}

export const CostBreakdownTable: React.FC<CostBreakdownTableProps> = ({
  lineItems,
  subtotal,
  deductible,
  payableAmount,
  vehicleTier = 'SEDAN',
  editable = false,
  onLineItemChange,
  onApplyPricingNote,
}) => {
  const [pricingModalState, setPricingModalState] = useState<{
    isOpen: boolean;
    partCode: string;
    lineIndex: number;
  }>({
    isOpen: false,
    partCode: '',
    lineIndex: -1,
  });

  const handleDecisionToggle = (index: number) => {
    if (!editable || !onLineItemChange) return;
    const item = lineItems[index];
    const newDecision = item.decision === 'REPAIR' ? 'REPLACE' : 'REPAIR';
    onLineItemChange(index, { ...item, decision: newDecision });
  };

  const handleCostChange = (index: number, newTotalStr: string) => {
    if (!editable || !onLineItemChange) return;
    const val = parseFloat(newTotalStr) || 0;
    const item = lineItems[index];
    onLineItemChange(index, { ...item, line_total: val });
  };

  const openPricingModal = (partName: string, index: number) => {
    setPricingModalState({
      isOpen: true,
      partCode: partName,
      lineIndex: index,
    });
  };

  const handleApplyPricing = (option: PartPricingOption, optionKey: string, partLabel: string) => {
    const { lineIndex } = pricingModalState;
    if (lineIndex >= 0 && lineIndex < lineItems.length && onLineItemChange) {
      const current = lineItems[lineIndex];
      onLineItemChange(lineIndex, {
        ...current,
        decision: 'REPLACE',
        base_cost: option.part_cost,
        labor_cost: option.labor_cost,
        line_total: option.total_cost,
      });

      if (onApplyPricingNote) {
        onApplyPricingNote(
          `Applied ${option.type} replacement pricing (${option.brand} - Part #${option.part_number}) for ${partLabel}: Part ₹${option.part_cost.toFixed(2)} + Labor ₹${option.labor_cost.toFixed(2)} = ₹${option.total_cost.toFixed(2)}`
        );
      }
    }
    setPricingModalState({ isOpen: false, partCode: '', lineIndex: -1 });
  };

  return (
    <div className="p-4 rounded-xl bg-[#070A12] border border-white/[0.08] flex flex-col gap-3 shadow-lg">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
            Deterministic Cost Estimation Breakdown
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#131929] text-slate-300 border border-white/[0.08] font-mono">
            Tier: {vehicleTier.toUpperCase()}
          </span>
          {editable && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
              Surveyor Edit Mode
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400 font-mono text-[10px] uppercase border-b border-white/[0.08]">
            <tr>
              <th className="py-2 px-3">Vehicle Part</th>
              <th className="py-2 px-3">Damage Type</th>
              <th className="py-2 px-3">Severity</th>
              <th className="py-2 px-3">Action</th>
              <th className="py-2 px-3 text-center">Part Pricing</th>
              <th className="py-2 px-3 text-right">Base Cost</th>
              <th className="py-2 px-3 text-right">Labor</th>
              <th className="py-2 px-3 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] font-mono text-xs">
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500 font-mono">
                  No damaged parts localized in image.
                </td>
              </tr>
            ) : (
              lineItems.map((item, index) => (
                <tr key={index} className="hover:bg-white/[0.03] transition-colors">
                  {/* Part Name */}
                  <td className="py-2.5 px-3 font-medium text-white flex items-center gap-1.5 font-sans">
                    <span className="capitalize">{item.part_name.replace('_', ' ')}</span>
                    {item.is_structural_part && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-red-900/60 text-red-300 border border-red-700">
                        Structural
                      </span>
                    )}
                    {item.unattributed && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-amber-900/60 text-amber-300 border border-amber-700">
                        Unattributed
                      </span>
                    )}
                  </td>

                  {/* Damage Type */}
                  <td className="py-2.5 px-3 capitalize text-slate-300">{item.damage_type}</td>

                  {/* Severity */}
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getSeverityBadgeClass(item.severity_band)}`}>
                      {item.severity_band}
                    </span>
                  </td>

                  {/* Action (Repair / Replace) */}
                  <td className="py-2.5 px-3">
                    {editable ? (
                      <button
                        onClick={() => handleDecisionToggle(index)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold font-mono border transition-all cursor-pointer ${
                          item.decision === 'REPLACE'
                            ? 'bg-purple-900/50 text-purple-200 border-purple-600 hover:bg-purple-800/60'
                            : 'bg-blue-900/50 text-blue-200 border-blue-600 hover:bg-blue-800/60'
                        }`}
                      >
                        {item.decision === 'REPLACE' ? <RefreshCw className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                        {item.decision}
                      </button>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          item.decision === 'REPLACE'
                            ? 'bg-purple-950/60 text-purple-300 border border-purple-800'
                            : 'bg-blue-950/60 text-blue-300 border border-blue-800'
                        }`}
                      >
                        {item.decision === 'REPLACE' ? <RefreshCw className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                        {item.decision}
                      </span>
                    )}
                  </td>

                  {/* Part Pricing Catalog / Suggestion Button */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => openPricingModal(item.part_name, index)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-[#131929] hover:bg-slate-700 text-blue-300 border border-white/[0.08] hover:border-cyan-400/40 transition-colors shadow-sm cursor-pointer"
                      title="Inspect OEM and certified aftermarket replacement catalog pricing"
                    >
                      <Tag className="w-3 h-3 text-cyan-400" />
                      <span>{editable ? 'Suggest Price' : 'Catalog'}</span>
                    </button>
                  </td>

                  {/* Base Cost */}
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                    ₹{Number(item.base_cost).toFixed(2)}
                  </td>

                  {/* Labor */}
                  <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                    {Number(item.labor_hrs).toFixed(1)}h (₹{Number(item.labor_cost).toFixed(0)})
                  </td>

                  {/* Line Total */}
                  <td className="py-2.5 px-3 text-right font-bold text-white font-mono">
                    {editable ? (
                      <input
                        type="number"
                        value={item.line_total}
                        onChange={(e) => handleCostChange(index, e.target.value)}
                        className="w-24 bg-[#070A12] border border-slate-600 rounded px-2 py-1 text-right text-white font-mono focus:outline-none focus:border-cyan-400"
                      />
                    ) : (
                      `₹${Number(item.line_total).toFixed(2)}`
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Financial Summary */}
      <div className="bg-[#131929] p-4 rounded-xl border border-white/[0.06] flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
          <AlertCircle className="w-4 h-4 text-cyan-400" />
          <span>Payable Amount = Subtotal - Policy Deductible</span>
        </div>

        <div className="flex items-center space-x-6 text-xs font-mono">
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase">Subtotal</span>
            <span className="text-sm font-semibold text-white font-mono">₹{Number(subtotal).toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase">Deductible</span>
            <span className="text-sm font-semibold text-amber-400 font-mono">- ₹{Number(deductible).toFixed(2)}</span>
          </div>
          <div className="text-right pl-4 border-l border-white/[0.08]">
            <span className="text-slate-400 block text-[10px] uppercase">Total Payable</span>
            <span className="text-base font-bold text-emerald-400 font-mono">₹{Number(payableAmount).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Part Pricing Modal */}
      <PartPricingModal
        isOpen={pricingModalState.isOpen}
        onClose={() => setPricingModalState({ isOpen: false, partCode: '', lineIndex: -1 })}
        partCode={pricingModalState.partCode}
        vehicleTier={vehicleTier}
        onApplyPricing={handleApplyPricing}
      />
    </div>
  );
};
