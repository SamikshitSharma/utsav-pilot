'use client';

import React, { useState } from 'react';
import { EventState, BudgetItem, BudgetItemSource, BudgetItemPriority } from '@/types/event';
import { calculateBudgetSummary, formatCurrency } from '@/lib/budget-math';
import {
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  Tag,
  Sparkles,
  Users,
  ShieldCheck,
  Percent,
} from 'lucide-react';

interface BudgetBoardProps {
  event: EventState;
  onUpdateBudgetItems: (items: BudgetItem[]) => void;
  onUpdateContingency: (contingencyPercent: number) => void;
}

export const BudgetBoard: React.FC<BudgetBoardProps> = ({
  event,
  onUpdateBudgetItems,
  onUpdateContingency,
}) => {
  const summary = calculateBudgetSummary(
    event.budgetItems,
    event.totalBudgetMinor,
    event.contingencyPercent,
    event.currency
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    category: 'Venue & Staging',
    name: '',
    estimatedMajor: '',
    confirmedMajor: '',
    paidMajor: '',
    source: 'user_defined' as BudgetItemSource,
    isScalable: false,
    costPerGuestMajor: '',
    fixedCostMajor: '',
    priority: 'must_have' as BudgetItemPriority,
    notes: '',
  });

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      category: 'Venue & Staging',
      name: '',
      estimatedMajor: '',
      confirmedMajor: '',
      paidMajor: '',
      source: 'user_defined',
      isScalable: false,
      costPerGuestMajor: '',
      fixedCostMajor: '',
      priority: 'must_have',
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: BudgetItem) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      name: item.name,
      estimatedMajor: (item.estimatedMinor / 100).toString(),
      confirmedMajor: item.confirmedMinor > 0 ? (item.confirmedMinor / 100).toString() : '',
      paidMajor: item.paidMinor > 0 ? (item.paidMinor / 100).toString() : '',
      source: item.source,
      isScalable: item.isScalableWithGuests,
      costPerGuestMajor: item.costPerGuestMinor > 0 ? (item.costPerGuestMinor / 100).toString() : '',
      fixedCostMajor: item.fixedCostMinor > 0 ? (item.fixedCostMinor / 100).toString() : '',
      priority: item.priority,
      notes: item.notes || '',
    });
    setIsAddModalOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    onUpdateBudgetItems(event.budgetItems.filter((i) => i.id !== id));
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const estMinor = Math.round((parseFloat(formData.estimatedMajor) || 0) * 100);
    const confMinor = Math.round((parseFloat(formData.confirmedMajor) || 0) * 100);
    const paidMinor = Math.round((parseFloat(formData.paidMajor) || 0) * 100);
    const costPerGuestMinor = Math.round((parseFloat(formData.costPerGuestMajor) || 0) * 100);
    const fixedCostMinor = Math.round((parseFloat(formData.fixedCostMajor) || 0) * 100);

    if (editingItem) {
      const updated = event.budgetItems.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              category: formData.category,
              name: formData.name,
              estimatedMinor: estMinor,
              confirmedMinor: confMinor,
              paidMinor,
              source: formData.source,
              isScalableWithGuests: formData.isScalable,
              costPerGuestMinor,
              fixedCostMinor,
              priority: formData.priority,
              notes: formData.notes,
            }
          : item
      );
      onUpdateBudgetItems(updated);
    } else {
      const newItem: BudgetItem = {
        id: `bud-${Date.now()}`,
        category: formData.category,
        name: formData.name,
        estimatedMinor: estMinor,
        confirmedMinor: confMinor,
        paidMinor,
        source: formData.source,
        isScalableWithGuests: formData.isScalable,
        costPerGuestMinor,
        fixedCostMinor,
        priority: formData.priority,
        notes: formData.notes,
      };
      onUpdateBudgetItems([...event.budgetItems, newItem]);
    }
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Financial Health Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Budget
          </div>
          <div className="text-lg font-black text-slate-900 truncate">
            {formatCurrency(summary.totalBudgetMinor, summary.currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Preset Spending Cap</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Allocated Funds
          </div>
          <div className="text-lg font-black text-indigo-700 truncate">
            {formatCurrency(summary.allocatedMinor, summary.currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Confirmed + Estimates</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Confirmed Quotes
          </div>
          <div className="text-lg font-black text-emerald-700 truncate">
            {formatCurrency(summary.confirmedMinor, summary.currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Signed Agreements</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Paid Deposits
          </div>
          <div className="text-lg font-black text-blue-700 truncate">
            {formatCurrency(summary.paidMinor, summary.currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Already Disbursed</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Contingency ({event.contingencyPercent}%)
          </div>
          <div className="text-lg font-black text-amber-700 truncate">
            {formatCurrency(summary.contingencyMinor, summary.currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Reserve Safety Buffer</div>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            summary.isOverBudget
              ? 'bg-rose-50 border-rose-300'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
            {summary.isOverBudget ? 'Budget Overrun' : 'Remaining Buffer'}
          </div>
          <div
            className={`text-lg font-black truncate ${
              summary.isOverBudget ? 'text-rose-600 animate-pulse' : 'text-emerald-700'
            }`}
          >
            {summary.isOverBudget
              ? `-${formatCurrency(summary.overrunMinor, summary.currencyCode)}`
              : formatCurrency(summary.remainingMinor, summary.currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {summary.isOverBudget ? 'Exceeds budget limit!' : 'Available for extras'}
          </div>
        </div>
      </div>

      {/* Overrun Warning Banner with Quick Action */}
      {summary.isOverBudget && (
        <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">
                Projected Budget Overrun of {formatCurrency(summary.overrunMinor, summary.currencyCode)}!
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Current allocated line items plus your {event.contingencyPercent}% contingency exceed total funds. Review non-essential items or use the Ripple Engine to simulate trade-offs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Line Items Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Itemized Budget Allocations</h3>
            <p className="text-xs text-slate-500">
              Evaluated strictly with minor currency arithmetic. No floating-point inaccuracies.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm py-2 px-3.5 rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Line Item</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-bold">Category & Item</th>
                <th className="py-3 px-3 font-bold">Source & Priority</th>
                <th className="py-3 px-3 font-bold text-right">Estimated</th>
                <th className="py-3 px-3 font-bold text-right">Confirmed</th>
                <th className="py-3 px-3 font-bold text-right">Paid</th>
                <th className="py-3 px-3 font-bold text-right">Effective Cost</th>
                <th className="py-3 px-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {event.budgetItems.map((item) => {
                const effective = item.confirmedMinor > 0 ? item.confirmedMinor : item.estimatedMinor;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-medium">{item.category}</span>
                        {item.isScalableWithGuests && (
                          <span className="inline-flex items-center gap-0.5 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            <Users className="w-3 h-3" />
                            {formatCurrency(item.costPerGuestMinor, event.currency)}/guest
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <div className="text-[11px] text-slate-400 italic mt-0.5">
                          {item.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        {/* Source Badge */}
                        {item.source === 'vendor_quote' ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" /> Vendor Quote
                          </span>
                        ) : item.source === 'ai_estimate' ? (
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-indigo-600" /> AI Estimate
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            User Defined
                          </span>
                        )}

                        {/* Priority Badge */}
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                            item.priority === 'must_have'
                              ? 'text-rose-700 bg-rose-50'
                              : item.priority === 'nice_to_have'
                              ? 'text-amber-700 bg-amber-50'
                              : 'text-slate-600 bg-slate-100'
                          }`}
                        >
                          {item.priority === 'must_have'
                            ? 'Must Have'
                            : item.priority === 'nice_to_have'
                            ? 'Nice to Have'
                            : 'Optional'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-slate-600">
                      {formatCurrency(item.estimatedMinor, event.currency)}
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-emerald-700">
                      {item.confirmedMinor > 0
                        ? formatCurrency(item.confirmedMinor, event.currency)
                        : '—'}
                    </td>

                    <td className="py-3 px-3 text-right font-semibold text-blue-700">
                      {item.paidMinor > 0
                        ? formatCurrency(item.paidMinor, event.currency)
                        : '—'}
                    </td>

                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      {formatCurrency(effective, event.currency)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Line Item"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Line Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
              <tr>
                <td className="py-2.5 px-4 font-semibold">Allocated Line Items Subtotal</td>
                <td></td>
                <td className="py-2.5 px-3 text-right text-slate-600">
                  {formatCurrency(summary.estimatedMinor, event.currency)}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-700">
                  {formatCurrency(summary.confirmedMinor, event.currency)}
                </td>
                <td className="py-2.5 px-3 text-right text-blue-700">
                  {formatCurrency(summary.paidMinor, event.currency)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-900 font-bold">
                  {formatCurrency(summary.allocatedMinor, event.currency)}
                </td>
                <td></td>
              </tr>
              <tr className="border-t border-slate-200 text-amber-800 bg-amber-50/40">
                <td className="py-2 px-4 font-medium">Contingency Safety Reserve ({event.contingencyPercent}%)</td>
                <td colSpan={4} className="text-right text-[11px] text-amber-600 italic pr-3">
                  Applied to allocated subtotal:
                </td>
                <td className="py-2 px-3 text-right font-bold text-amber-800">
                  +{formatCurrency(summary.contingencyMinor, event.currency)}
                </td>
                <td></td>
              </tr>
              <tr className="border-t border-slate-200 bg-slate-100 font-black text-slate-900">
                <td className="py-2.5 px-4 uppercase tracking-wider text-[11px]">Total Event Commitment</td>
                <td colSpan={4} className="text-right text-[11px] text-slate-500 font-normal pr-3">
                  Allocated + Contingency:
                </td>
                <td className="py-2.5 px-3 text-right font-black text-slate-900 text-sm">
                  {formatCurrency(summary.committedMinor, event.currency)}
                </td>
                <td></td>
              </tr>
              <tr className={`border-t border-slate-200 ${summary.isOverBudget ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50/50 text-emerald-800'}`}>
                <td className="py-2.5 px-4 font-bold">
                  {summary.isOverBudget ? 'Budget Overrun Deficit' : 'Net Unallocated Surplus'}
                </td>
                <td colSpan={4} className="text-right text-[11px] text-slate-500 font-normal pr-3">
                  Against Total Cap ({formatCurrency(summary.totalBudgetMinor, event.currency)}):
                </td>
                <td className={`py-2.5 px-3 text-right font-black text-sm ${summary.isOverBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {summary.isOverBudget
                    ? `-${formatCurrency(summary.overrunMinor, event.currency)}`
                    : `+${formatCurrency(summary.remainingMinor, event.currency)}`}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add / Edit Line Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="font-extrabold text-lg text-slate-900 mb-4">
              {editingItem ? 'Edit Budget Item' : 'Add New Budget Item'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4-Course Royal Rajasthani Buffet"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    <option value="Venue & Staging">Venue & Staging</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Decor & Floral">Decor & Floral</option>
                    <option value="Photography & Cinema">Photography & Cinema</option>
                    <option value="Entertainment & Music">Entertainment & Music</option>
                    <option value="Attire & Makeup">Attire & Makeup</option>
                    <option value="Guest Favors & Gifts">Guest Favors & Gifts</option>
                    <option value="Permits & Safety">Permits & Safety</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value as BudgetItemPriority })
                    }
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    <option value="must_have">Must Have</option>
                    <option value="nice_to_have">Nice to Have</option>
                    <option value="optional">Optional</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estimated (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="350000"
                    value={formData.estimatedMajor}
                    onChange={(e) =>
                      setFormData({ ...formData, estimatedMajor: e.target.value })
                    }
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirmed (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.confirmedMajor}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmedMajor: e.target.value })
                    }
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Paid (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.paidMajor}
                    onChange={(e) => setFormData({ ...formData, paidMajor: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Scalable with Guests Checkbox */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isScalable}
                    onChange={(e) =>
                      setFormData({ ...formData, isScalable: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-indigo-900">
                    Scales with Guest Count (Used by Ripple Engine)
                  </span>
                </label>

                {formData.isScalable && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Cost Per Head (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="1200"
                        value={formData.costPerGuestMajor}
                        onChange={(e) =>
                          setFormData({ ...formData, costPerGuestMajor: e.target.value })
                        }
                        className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Fixed Base Setup (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="50000"
                        value={formData.fixedCostMajor}
                        onChange={(e) =>
                          setFormData({ ...formData, fixedCostMajor: e.target.value })
                        }
                        className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes & Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details, menu highlights, supplier terms..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors shadow-xs"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
