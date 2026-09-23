"use client";

import React, { useState } from "react";
import {
  Database,
  Zap,
  UploadCloud,
  X,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  CheckCircle2,
  Layers,
  Users,
  GitBranch,
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface DataNotLoadedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSuccess: () => Promise<void> | void;
  onOpenUploadModal: () => void;
}

export default function DataNotLoadedModal({
  isOpen,
  onClose,
  onLoadSuccess,
  onOpenUploadModal,
}: DataNotLoadedModalProps) {
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (!isOpen) return null;

  const backendCommand =
    "./backend/.venv/bin/uvicorn app.main:app --app-dir backend --port 8000";

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(backendCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleLoadInstantly = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Call /api/dataset/reset to activate baseline dataset and pre-warm cache
      let res = await fetch("/api/dataset/reset", { method: "POST" });
      
      // Fallback: If reset is not 200, try triggering pipeline run
      if (!res.ok) {
        res = await fetch("/api/pipeline/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enable_llm: false }),
        });
      }

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      // 2. Fetch fresh graph data and update parent state
      await onLoadSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          "Could not connect to backend server. Make sure the backend service is running."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 relative overflow-hidden">
        {/* Subtle accent top border highlight */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[var(--fb-accent)] to-amber-500" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold tracking-wider uppercase mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {t.data_not_loaded_badge}
              </div>
              <h2 className="text-base font-bold text-[var(--fb-text-primary)]">
                {t.data_not_loaded_title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtitle description */}
        <p className="text-xs text-[var(--fb-text-secondary)] leading-relaxed">
          {t.data_not_loaded_subtitle}
        </p>

        {/* Baseline Specs Summary Card */}
        <div className="p-3.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-2.5">
          <span className="text-[11px] font-bold text-[var(--fb-text-primary)] uppercase tracking-wider block">
            {t.data_specs_title}
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-[var(--fb-text-secondary)]">
              <Users className="w-3.5 h-3.5 text-[var(--fb-accent-dark)] shrink-0" />
              <span>{t.data_specs_seeds}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--fb-text-secondary)]">
              <GitBranch className="w-3.5 h-3.5 text-[var(--fb-accent-dark)] shrink-0" />
              <span>{t.data_specs_nodes}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--fb-text-secondary)]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--fb-accent-dark)] shrink-0" />
              <span>{t.data_specs_edges}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--fb-text-secondary)]">
              <Layers className="w-3.5 h-3.5 text-[var(--fb-accent-dark)] shrink-0" />
              <span>{t.data_specs_clusters}</span>
            </div>
          </div>
        </div>

        {/* Backend offline error alert & quick fix command */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-red-500 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{t.data_backend_offline_title}</span>
            </div>
            <p className="text-[11px] text-[var(--fb-text-secondary)] leading-relaxed">
              {t.data_backend_offline_desc}
            </p>
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--fb-surface)] border border-[var(--fb-border)] font-mono text-[11px] text-[var(--fb-text-primary)] overflow-x-auto">
              <code className="truncate">{backendCommand}</code>
              <button
                type="button"
                onClick={handleCopyCmd}
                className="p-1 rounded hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition shrink-0 cursor-pointer"
                title={t.data_backend_cmd_copy}
              >
                {copiedCmd ? (
                  <Check className="w-3.5 h-3.5 text-[var(--fb-accent)]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleLoadInstantly}
            disabled={isLoading}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-[var(--fb-accent)] text-black hover:bg-[var(--fb-accent-dark)] font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{t.data_loading_instantly}</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 shrink-0 fill-current" />
                <span>{t.data_load_instantly_btn}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenUploadModal();
            }}
            disabled={isLoading}
            className="w-full sm:w-auto py-2.5 px-3.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:border-[var(--fb-accent)] font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
            <span>{t.data_upload_custom_btn}</span>
          </button>
        </div>

        {/* Footer dismiss link */}
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition underline cursor-pointer"
          >
            {t.data_dismiss_btn}
          </button>
        </div>
      </div>
    </div>
  );
}
