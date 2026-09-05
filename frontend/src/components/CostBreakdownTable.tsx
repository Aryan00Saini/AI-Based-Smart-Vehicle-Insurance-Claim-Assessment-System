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
    <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white text-sm">Deterministic Cost Estimation Breakdown</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 font-mono">
            Tier: {vehicleTier.toUpperCase()}
          </span>
          {editable && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
              Surveyor Edit Mode
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Vehicle Part</th>
              <th className="py-3 px-4">Damage Type</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4 text-center">Part Pricing</th>
              <th className="py-3 px-4 text-right">Base Cost</th>
              <th className="py-3 px-4 text-right">Labor</th>
              <th className="py-3 px-4 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500">
                  No damaged parts localized in image.
                </td>
              </tr>
            ) : (
              lineItems.map((item, index) => (
                <tr key={index} className="hover:bg-slate-700/30 transition-colors">
                  {/* Part Name */}
                  <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                    <span className="capitalize">{item.part_name.replace('_', ' ')}</span>
                    {item.is_structural_part && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-900/60 text-red-300 border border-red-700">
                        Structural
                      </span>
                    )}
                    {item.unattributed && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-900/60 text-amber-300 border border-amber-700">
                        Unattributed
                      </span>
                    )}
                  </td>

                  {/* Damage Type */}
                  <td className="py-3 px-4 capitalize">{item.damage_type}</td>

                  {/* Severity */}
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getSeverityBadgeClass(item.severity_band)}`}>
                      {item.severity_band}
                    </span>
                  </td>

                  {/* Action (Repair / Replace) */}
                  <td className="py-3 px-4">
                    {editable ? (
                      <button
                        onClick={() => handleDecisionToggle(index)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
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
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
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
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => openPricingModal(item.part_name, index)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-900 hover:bg-slate-700 text-blue-300 border border-slate-700 hover:border-blue-500/50 transition-colors shadow-sm"
                      title="Inspect OEM and certified aftermarket replacement catalog pricing"
                    >
                      <Tag className="w-3 h-3 text-blue-400" />
                      <span>{editable ? 'Suggest Price' : 'View Catalog'}</span>
                    </button>
                  </td>

                  {/* Base Cost */}
                  <td className="py-3 px-4 text-right font-mono">
                    ₹{Number(item.base_cost).toFixed(2)}
                  </td>

                  {/* Labor */}
                  <td className="py-3 px-4 text-right font-mono text-slate-400">
                    {Number(item.labor_hrs).toFixed(1)}h (₹{Number(item.labor_cost).toFixed(0)})
                  </td>

                  {/* Line Total */}
                  <td className="py-3 px-4 text-right font-bold text-white font-mono">
                    {editable ? (
                      <input
                        type="number"
                        value={item.line_total}
                        onChange={(e) => handleCostChange(index, e.target.value)}
                        className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-white font-mono focus:outline-none focus:border-blue-500"
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
      <div className="bg-slate-900/90 p-4 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-blue-400" />
          <span>Payable Amount = Subtotal - Policy Deductible (Minimum ₹0.00)</span>
        </div>

        <div className="flex items-center space-x-6 text-xs">
          <div className="text-right">
            <span className="text-slate-400 block">Subtotal</span>
            <span className="text-sm font-semibold text-white font-mono">₹{Number(subtotal).toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block">Deductible</span>
            <span className="text-sm font-semibold text-amber-400 font-mono">- ₹{Number(deductible).toFixed(2)}</span>
          </div>
          <div className="text-right pl-4 border-l border-slate-700">
            <span className="text-slate-400 block">Total Payable</span>
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
