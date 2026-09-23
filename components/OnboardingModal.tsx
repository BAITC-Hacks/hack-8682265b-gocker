"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, ArrowRight, X, ListOrdered, Layers, Eye } from "lucide-react";
import { useT } from "@/lib/i18n";

interface OnboardingModalProps {
  onDismiss?: () => void;
}

export default function OnboardingModal({ onDismiss }: OnboardingModalProps) {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const onboarded = localStorage.getItem("money_graph_onboarded");
      if (!onboarded) {
        setIsOpen(true);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem("money_graph_onboarded", "true");
    } catch {
      // Ignore
    }
    setIsOpen(false);
    onDismiss?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--fb-accent)] flex items-center justify-center text-white">
              <ShieldCheck className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--fb-text-primary)]">
                {t.onboarding_title}
              </h2>
              <p className="text-xs text-[var(--fb-text-secondary)]">
                {t.onboarding_subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Step Guide */}
        <div className="space-y-3.5">
          <div className="p-3.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--fb-accent)]/20 text-[var(--fb-accent-dark)] font-bold text-xs flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--fb-text-primary)] flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
                {t.onboarding_step1_title}
              </div>
              <p className="text-xs text-[var(--fb-text-secondary)] mt-0.5 leading-relaxed">
                {t.onboarding_step1_desc}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--fb-accent)]/20 text-[var(--fb-accent-dark)] font-bold text-xs flex items-center justify-center shrink-0">
              2
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--fb-text-primary)] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
                {t.onboarding_step2_title}
              </div>
              <p className="text-xs text-[var(--fb-text-secondary)] mt-0.5 leading-relaxed">
                {t.onboarding_step2_desc}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--fb-accent)]/20 text-[var(--fb-accent-dark)] font-bold text-xs flex items-center justify-center shrink-0">
              3
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--fb-text-primary)] flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
                {t.onboarding_step3_title}
              </div>
              <p className="text-xs text-[var(--fb-text-secondary)] mt-0.5 leading-relaxed">
                {t.onboarding_step3_desc}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleDismiss}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-[var(--fb-accent)] text-black hover:bg-[var(--fb-accent-dark)] transition flex items-center gap-2 shadow-sm"
          >
            <span>{t.onboarding_start}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
