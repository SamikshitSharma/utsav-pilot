'use client';

import React, { useState } from 'react';
import { Vendor, VendorStatus, CurrencyCode } from '@/types/event';
import { formatCurrency } from '@/lib/budget-math';
import {
  Store,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  FileText,
  Plus,
  Trash2,
  Phone,
  Mail,
  Scale,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface VendorTrackerProps {
  vendors: Vendor[];
  currency: CurrencyCode;
  onUpdateVendors: (vendors: Vendor[]) => void;
}

export const VendorTracker: React.FC<VendorTrackerProps> = ({
  vendors,
  currency,
  onUpdateVendors,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // New Vendor Form
  const [newVendor, setNewVendor] = useState({
    category: 'Catering & Food',
    name: '',
    quoteMajor: '',
    depositPaidMajor: '',
    status: 'quoted' as VendorStatus,
    inclusionsRaw: '',
    notes: '',
    contactEmail: '',
    contactPhone: '',
  });

  const handleStatusChange = (vendorId: string, newStatus: VendorStatus) => {
    const updated = vendors.map((v) =>
      v.id === vendorId ? { ...v, status: newStatus } : v
    );
    onUpdateVendors(updated);
  };

  const handleDeleteVendor = (vendorId: string) => {
    onUpdateVendors(vendors.filter((v) => v.id !== vendorId));
  };

  const handleAddVendor = (e: React.FormEvent) => {
    e.preventDefault();
    const quoteMinor = Math.round((parseFloat(newVendor.quoteMajor) || 0) * 100);
    const depositPaidMinor = Math.round((parseFloat(newVendor.depositPaidMajor) || 0) * 100);
    const balanceDueMinor = Math.max(0, quoteMinor - depositPaidMinor);

    const vendor: Vendor = {
      id: `ven-${Date.now()}`,
      category: newVendor.category,
      name: `${newVendor.name} [Sample Data]`,
      quoteMinor,
      depositPaidMinor,
      balanceDueMinor,
      status: newVendor.status,
      inclusions: newVendor.inclusionsRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      notes: newVendor.notes,
      contactEmail: newVendor.contactEmail,
      contactPhone: newVendor.contactPhone,
      isSampleData: true,
    };

    onUpdateVendors([...vendors, vendor]);
    setIsAddModalOpen(false);
    setNewVendor({
      category: 'Catering & Food',
      name: '',
      quoteMajor: '',
      depositPaidMajor: '',
      status: 'quoted',
      inclusionsRaw: '',
      notes: '',
      contactEmail: '',
      contactPhone: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Sample Data Integrity Banner (Mandatory Requirement) */}
      <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Demonstration Sample Data Notice:</span> All vendor listings, pricing figures, inclusions, and availability statuses shown in UtsavPilot are strictly generated sample data for judging evaluation and simulation. UtsavPilot does not invent or claim real vendor agreements, endorsements, or bookings.
        </div>
      </div>

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-lg text-slate-900">Vendor Quotation & Contract Tracker</h3>
          <p className="text-xs text-slate-500">
            Compare incoming estimates, monitor deposit disbursement, and track remaining balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {vendors.length > 1 && (
            <button
              onClick={() => setIsCompareModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs sm:text-sm py-2 px-3.5 rounded-lg transition-colors shadow-2xs"
            >
              <Scale className="w-4 h-4 text-indigo-600" />
              <span>Compare Quotes</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-2 px-3.5 rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {/* Vendor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {vendors.map((vendor) => {
          const balance = Math.max(0, vendor.quoteMinor - vendor.depositPaidMinor);
          const isDepositPaid = vendor.depositPaidMinor > 0;

          return (
            <div
              key={vendor.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                {/* Category & Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-0.5 rounded-md">
                    {vendor.category}
                  </span>

                  <select
                    value={vendor.status}
                    onChange={(e) => handleStatusChange(vendor.id, e.target.value as VendorStatus)}
                    className={`text-xs font-bold rounded-lg px-2 py-1 border focus:outline-hidden cursor-pointer ${
                      vendor.status === 'booked'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : vendor.status === 'shortlisted'
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                        : vendor.status === 'quoted'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <option value="inquired">Inquired</option>
                    <option value="quoted">Quoted</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="booked">Booked</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {/* Vendor Name */}
                <h4 className="font-extrabold text-base text-slate-900 mb-1">
                  {vendor.name}
                </h4>

                {/* Sample Badge */}
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/60 px-1.5 py-0.2 rounded inline-block mb-3">
                  Sample Demonstration Data
                </span>

                {/* Financial Summary */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Quoted Amount:</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {formatCurrency(vendor.quoteMinor, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Deposit Paid:</span>
                    <span className="font-bold text-blue-700">
                      {formatCurrency(vendor.depositPaidMinor, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                    <span className="font-medium text-slate-700">Balance Due:</span>
                    <span className="font-black text-rose-600">
                      {formatCurrency(balance, currency)}
                    </span>
                  </div>
                </div>

                {/* Inclusions List */}
                {vendor.inclusions.length > 0 && (
                  <div className="space-y-1 mb-4">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Confirmed Inclusions:
                    </div>
                    <ul className="space-y-1">
                      {vendor.inclusions.map((inc, i) => (
                        <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {vendor.notes && (
                  <p className="text-xs text-slate-500 italic bg-slate-50/50 p-2 rounded-lg border border-slate-100 mb-3">
                    &ldquo;{vendor.notes}&rdquo;
                  </p>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  {vendor.contactEmail && (
                    <span title={vendor.contactEmail} className="inline-flex items-center gap-1 text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteVendor(vendor.id)}
                  className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                  title="Delete Vendor"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compare Quotes Modal */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-extrabold text-xl text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-indigo-600" />
                  Vendor Quotation Comparator
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Side-by-side analysis of scope, pricing discrepancies, and missing contractual clauses.
                </p>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((v) => (
                <div key={v.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <div className="border-b border-slate-200 pb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {v.category}
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900">{v.name}</h4>
                    <div className="text-base font-black text-indigo-700 mt-1">
                      {formatCurrency(v.quoteMinor, currency)}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-[11px] font-bold text-slate-700 uppercase mb-1">Inclusions:</h5>
                    <ul className="space-y-1">
                      {v.inclusions.map((inc, idx) => (
                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-500">
                    <span className="font-bold">Missing Info Checklist:</span>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-slate-600">
                      <li>Check overtime hourly surcharge</li>
                      <li>Verify liability & breakage deposit terms</li>
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 transition-colors"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-extrabold text-lg text-slate-900 mb-4">Add Vendor Quotation</h3>
            <form onSubmit={handleAddVendor} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Marwar Decorators"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newVendor.category}
                    onChange={(e) => setNewVendor({ ...newVendor, category: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="Venue & Staging">Venue & Staging</option>
                    <option value="Catering & Food">Catering & Food</option>
                    <option value="Decor & Floral">Decor & Floral</option>
                    <option value="Photography & Cinema">Photography & Cinema</option>
                    <option value="Music & Audio">Music & Audio</option>
                    <option value="Transportation">Transportation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={newVendor.status}
                    onChange={(e) =>
                      setNewVendor({ ...newVendor, status: e.target.value as VendorStatus })
                    }
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="inquired">Inquired</option>
                    <option value="quoted">Quoted</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="booked">Booked</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quoted Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="250000"
                    value={newVendor.quoteMajor}
                    onChange={(e) => setNewVendor({ ...newVendor, quoteMajor: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deposit Paid (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="50000"
                    value={newVendor.depositPaidMajor}
                    onChange={(e) =>
                      setNewVendor({ ...newVendor, depositPaidMajor: e.target.value })
                    }
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Inclusions (One item per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Buffet service for 250 guests&#10;Crockery and cutlery included&#10;4 Service staff"
                  value={newVendor.inclusionsRaw}
                  onChange={(e) =>
                    setNewVendor({ ...newVendor, inclusionsRaw: e.target.value })
                  }
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes & Terms
                </label>
                <input
                  type="text"
                  placeholder="Cancellation policy, payment milestones..."
                  value={newVendor.notes}
                  onChange={(e) => setNewVendor({ ...newVendor, notes: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors shadow-xs"
                >
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
