'use client';

import React, { useState } from 'react';
import { EventState, EventStateSchema } from '@/types/event';
import {
  Download,
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEvent: EventState;
  allEvents: EventState[];
  onImportEvent: (event: EventState) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  activeEvent,
  allEvents,
  onImportEvent,
}) => {
  const [jsonInput, setJsonInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const handleExportSingle = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeEvent, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activeEvent.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportAll = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `utsavpilot_all_events.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(activeEvent, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonInput(content);
        setErrorMsg('');
      } catch (err: any) {
        setErrorMsg('Failed to read file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = () => {
    setErrorMsg('');
    try {
      const parsed = JSON.parse(jsonInput);
      
      // Strict schema enforcement using Zod
      const validation = EventStateSchema.safeParse(parsed);
      if (!validation.success) {
        const issues = validation.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .slice(0, 3)
          .join(', ');
        throw new Error(`Schema validation error: ${issues}`);
      }

      const validatedEvent = validation.data as EventState;
      validatedEvent.updatedAt = new Date().toISOString();

      onImportEvent(validatedEvent);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid JSON format or missing required fields');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-5">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-lg text-slate-900">
              Event Data Import & Export (Jury Testing)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* Export Section */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Export Event Data
            </h4>
            <p className="text-xs text-slate-500">
              Download active celebration state or the entire database to JSON for evaluation or backup.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleExportSingle}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs py-2 px-3 rounded-lg shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Export &quot;{activeEvent.title}&quot;</span>
              </button>

              <button
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs py-2 px-3 rounded-lg shadow-2xs transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Copied JSON!' : 'Copy to Clipboard'}</span>
              </button>

              <button
                onClick={handleExportAll}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs py-2 px-3 rounded-lg shadow-2xs transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>Export All ({allEvents.length})</span>
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Import Custom Event JSON
              </h4>
              <label className="cursor-pointer text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload JSON file</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={5}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Paste custom event JSON here or upload a file above..."
              className="w-full text-xs font-mono border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={!jsonInput.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors shadow-2xs"
              >
                Import & Validate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
