"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  FileArchive,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Shield,
  FileText,
  Clock,
  Loader2,
} from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => Promise<void>;
  currentDataset: {
    active_dataset: string;
    dataset_name: string;
    is_custom: boolean;
    nodes_count: number;
    edges_count: number;
    seeds_count: number;
  } | null;
}

export default function UploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
  currentDataset,
}: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<"package" | "transfers_seeds">("transfers_seeds");
  
  // Package mode files
  const [edgesFile, setEdgesFile] = useState<File | null>(null);
  const [nodesFile, setNodesFile] = useState<File | null>(null);
  const [txFile, setTxFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);

  // Transfers + Seeds mode
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [seedGidsInput, setSeedGidsInput] = useState<string>("");
  const [caseName, setCaseName] = useState<string>("");

  // Upload & execution state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // File input refs
  const edgesInputRef = useRef<HTMLInputElement>(null);
  const nodesInputRef = useRef<HTMLInputElement>(null);
  const txInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const transferInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFillSampleSeeds = () => {
    // 81 known seed clients from the baseline case
    setCaseName("Law Enforcement Inquiry - Operation KZT Transits");
    setSeedGidsInput(
      "100000003684369100, 100000008680731100, 100000002527114100, 100000003016635100, 100000008089404100, " +
      "100000004554271100, 100000003290680100, 100000005741634100, 100000006769976100, 100000003883015100, " +
      "100000001046187100, 100000006190343100, 100000004456577100, 100000006652431100, 100000008432322100, " +
      "100000003290680100, 100000001552278100, 100000008044738100, 100000003463936100, 100000003730248100"
    );
  };

  const handleResetToBaseline = async () => {
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/dataset/reset", { method: "POST" });
      if (!res.ok) throw new Error(`Reset failed: HTTP ${res.status}`);
      await onUploadSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore baseline dataset");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessResult(null);

    const formData = new FormData();

    if (activeTab === "package") {
      if (zipFile) {
        formData.append("zip_file", zipFile);
      } else if (edgesFile) {
        formData.append("edges_file", edgesFile);
        if (nodesFile) formData.append("nodes_file", nodesFile);
        if (txFile) formData.append("tx_file", txFile);
      } else {
        setErrorMsg("Please upload either a ZIP archive or at least an edges file.");
        return;
      }
      if (caseName) formData.append("dataset_name", caseName);
    } else {
      // Transfers + Seeds mode
      if (!transferFile) {
        setErrorMsg("Please upload an outbound transfers / edges file (.csv or .parquet).");
        return;
      }
      formData.append("edges_file", transferFile);
      if (seedGidsInput.trim()) {
        formData.append("seed_gids", seedGidsInput.trim());
      }
      formData.append(
        "dataset_name",
        caseName.trim() || `Custom Investigation (${transferFile.name})`
      );
    }

    setIsUploading(true);
    setUploadStep(1);

    // Simulate progressive status steps for visual fidelity
    const stepTimer1 = setTimeout(() => setUploadStep(2), 500);
    const stepTimer2 = setTimeout(() => setUploadStep(3), 1200);
    const stepTimer3 = setTimeout(() => setUploadStep(4), 1800);

    try {
      const res = await fetch("/api/dataset/upload", {
        method: "POST",
        body: formData,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      setUploadStep(5);
      setSuccessResult(data);
      await onUploadSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred during upload and analysis");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fb-border)] bg-[var(--fb-bg)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--fb-accent)] flex items-center justify-center text-black font-bold">
              <UploadCloud className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--fb-text-primary)]">
                Upload Custom Case Data
              </h2>
              <p className="text-xs text-[var(--fb-text-secondary)]">
                Construct transaction graph, compute metrics, and rank node roles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Dataset Status Banner */}
        <div className="px-6 py-2.5 bg-[var(--fb-border)]/40 border-b border-[var(--fb-border)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--fb-text-secondary)]">Active Case:</span>
            <span className="font-semibold text-[var(--fb-text-primary)]">
              {currentDataset?.dataset_name || "Baseline Case (2,248 Nodes)"}
            </span>
            {currentDataset?.is_custom && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                CUSTOM
              </span>
            )}
          </div>
          {currentDataset?.is_custom && (
            <button
              onClick={handleResetToBaseline}
              disabled={isUploading}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restore Baseline (81 Seeds)</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--fb-border)] px-6 pt-3 bg-[var(--fb-bg)]">
          <button
            type="button"
            onClick={() => setActiveTab("transfers_seeds")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "transfers_seeds"
                ? "border-[var(--fb-accent-dark)] text-[var(--fb-text-primary)]"
                : "border-transparent text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Transfers + Seed Clients (Direct Workflow)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("package")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "package"
                ? "border-[var(--fb-accent-dark)] text-[var(--fb-text-primary)]"
                : "border-transparent text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Multi-File / Parquet / ZIP Archive</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Upload Error</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {successResult && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Graph Analyzed & Prioritized Successfully!</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                <div className="p-2 rounded bg-emerald-100/60 dark:bg-emerald-900/40">
                  <span className="block text-[10px] uppercase font-sans text-emerald-900 dark:text-emerald-300">Nodes</span>
                  <strong className="text-sm">{successResult.dataset?.nodes_count?.toLocaleString()}</strong>
                </div>
                <div className="p-2 rounded bg-emerald-100/60 dark:bg-emerald-900/40">
                  <span className="block text-[10px] uppercase font-sans text-emerald-900 dark:text-emerald-300">Edges</span>
                  <strong className="text-sm">{successResult.dataset?.edges_count?.toLocaleString()}</strong>
                </div>
                <div className="p-2 rounded bg-emerald-100/60 dark:bg-emerald-900/40">
                  <span className="block text-[10px] uppercase font-sans text-emerald-900 dark:text-emerald-300">Seed Clients</span>
                  <strong className="text-sm">{successResult.dataset?.seeds_count?.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Transfers + Seeds (Direct HackAlem Scenario) */}
          {activeTab === "transfers_seeds" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-[var(--fb-text-primary)]">
                <strong className="block font-semibold mb-1">
                  Scenario: Outbound Transfer Tracing (4 Degrees of Separation)
                </strong>
                <p className="text-[var(--fb-text-secondary)] leading-relaxed">
                  Provide the outbound transaction export (CSV or Parquet) along with the list of case clients
                  received from law enforcement agencies. The pipeline automatically calculates 0–4 hop depths,
                  evaluates degree and betweenness centralities, and classifies network roles.
                </p>
              </div>

              {/* Case Name */}
              <div>
                <label className="block text-xs font-bold text-[var(--fb-text-primary)] mb-1">
                  Investigation Reference / Case Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Operation North Star - Case #2026-81"
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[var(--fb-bg)] border border-[var(--fb-border)] rounded-lg text-[var(--fb-text-primary)] focus:outline-none focus:border-[var(--fb-accent-dark)]"
                />
              </div>

              {/* Transfers File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-[var(--fb-text-primary)] mb-1">
                  Outbound Transfers Data (Required)
                </label>
                <div
                  onClick={() => transferInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                    transferFile
                      ? "border-emerald-500 bg-emerald-50/10"
                      : "border-[var(--fb-border)] hover:border-[var(--fb-accent-dark)] bg-[var(--fb-bg)]"
                  }`}
                >
                  <input
                    ref={transferInputRef}
                    type="file"
                    accept=".parquet,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setTransferFile(e.target.files[0]);
                    }}
                  />
                  {transferFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>{transferFile.name} ({(transferFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud className="w-6 h-6 mx-auto text-[var(--fb-text-secondary)]" />
                      <div className="text-xs font-semibold text-[var(--fb-text-primary)]">
                        Click or drag & drop outbound transfers file
                      </div>
                      <div className="text-[10px] text-[var(--fb-text-secondary)]">
                        Supports <code>edges.parquet</code>, <code>edges.csv</code>, or transaction tables with <code>src</code>, <code>dst</code>, <code>sum_kzt</code>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Seed Clients GIDs Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[var(--fb-text-primary)]">
                    Law Enforcement Seed Client List (81 GIDs)
                  </label>
                  <button
                    type="button"
                    onClick={handleFillSampleSeeds}
                    className="text-[11px] font-semibold text-[var(--fb-accent-dark)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Autofill Case Seeds</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder="Paste client GIDs separated by comma, space, or newline (e.g. 100000003684369100, 100000008680731100...)"
                  value={seedGidsInput}
                  onChange={(e) => setSeedGidsInput(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono bg-[var(--fb-bg)] border border-[var(--fb-border)] rounded-lg text-[var(--fb-text-primary)] placeholder-[var(--fb-text-secondary)] focus:outline-none focus:border-[var(--fb-accent-dark)]"
                />
                <span className="text-[10px] text-[var(--fb-text-secondary)]">
                  Identified seed accounts will be pinned at depth 0 and receive priority evaluation multipliers.
                </span>
              </div>
            </div>
          )}

          {/* Tab 2: Full Package Upload */}
          {activeTab === "package" && (
            <div className="space-y-4">
              {/* ZIP Archive Option */}
              <div className="p-4 rounded-xl border border-[var(--fb-border)] bg-[var(--fb-bg)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--fb-text-primary)] flex items-center gap-1.5">
                    <FileArchive className="w-4 h-4 text-purple-600" />
                    <span>Option A: Complete .ZIP Archive</span>
                  </span>
                  {zipFile && (
                    <button
                      type="button"
                      onClick={() => setZipFile(null)}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setZipFile(e.target.files[0]);
                  }}
                />
                <button
                  type="button"
                  onClick={() => zipInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-lg border border-dashed border-[var(--fb-border)] hover:border-[var(--fb-accent-dark)] text-xs text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition"
                >
                  {zipFile ? `Selected: ${zipFile.name}` : "Select .ZIP archive containing edges, nodes, and transactions"}
                </button>
              </div>

              <div className="text-center text-[10px] font-bold text-[var(--fb-text-secondary)] uppercase">
                — OR Upload Individual Files —
              </div>

              {/* Individual Files Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Edges */}
                <div className="p-3 rounded-xl border border-[var(--fb-border)] bg-[var(--fb-bg)] space-y-2">
                  <span className="text-[11px] font-bold text-[var(--fb-text-primary)] flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    <span>edges (.parquet / .csv)</span>
                  </span>
                  <input
                    ref={edgesInputRef}
                    type="file"
                    accept=".parquet,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setEdgesFile(e.target.files[0]);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => edgesInputRef.current?.click()}
                    className="w-full py-1.5 px-2 rounded border border-[var(--fb-border)] text-[11px] truncate text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
                  >
                    {edgesFile ? edgesFile.name : "Select edges"}
                  </button>
                </div>

                {/* Nodes */}
                <div className="p-3 rounded-xl border border-[var(--fb-border)] bg-[var(--fb-bg)] space-y-2">
                  <span className="text-[11px] font-bold text-[var(--fb-text-primary)] flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>nodes (.parquet / .csv)</span>
                  </span>
                  <input
                    ref={nodesInputRef}
                    type="file"
                    accept=".parquet,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setNodesFile(e.target.files[0]);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => nodesInputRef.current?.click()}
                    className="w-full py-1.5 px-2 rounded border border-[var(--fb-border)] text-[11px] truncate text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
                  >
                    {nodesFile ? nodesFile.name : "Select nodes"}
                  </button>
                </div>

                {/* Transactions (optional) */}
                <div className="p-3 rounded-xl border border-[var(--fb-border)] bg-[var(--fb-bg)] space-y-2">
                  <span className="text-[11px] font-bold text-[var(--fb-text-primary)] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>transactions (opt.)</span>
                  </span>
                  <input
                    ref={txInputRef}
                    type="file"
                    accept=".parquet,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setTxFile(e.target.files[0]);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => txInputRef.current?.click()}
                    className="w-full py-1.5 px-2 rounded border border-[var(--fb-border)] text-[11px] truncate text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
                  >
                    {txFile ? txFile.name : "Select txs"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Progress Display */}
          {isUploading && (
            <div className="p-4 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--fb-text-primary)]">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--fb-accent-dark)]" />
                  <span>Constructing & Analyzing Graph...</span>
                </span>
                <span className="font-mono text-[var(--fb-text-secondary)]">Step {uploadStep} of 5</span>
              </div>
              <div className="w-full bg-[var(--fb-border)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--fb-accent)] transition-all duration-300"
                  style={{ width: `${(uploadStep / 5) * 100}%` }}
                />
              </div>
              <div className="text-[11px] text-[var(--fb-text-secondary)] space-y-1">
                {uploadStep >= 1 && <div>✓ Ingesting transfer edges and client seed accounts...</div>}
                {uploadStep >= 2 && <div>✓ Building NetworkX directed graph & calculating degrees...</div>}
                {uploadStep >= 3 && <div>✓ Executing Louvain community clustering & betweenness centrality...</div>}
                {uploadStep >= 4 && <div>✓ Assigning AML operational roles & generating evidence rationales...</div>}
              </div>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-[var(--fb-border)] flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetToBaseline}
              disabled={isUploading}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[var(--fb-border)] bg-[var(--fb-surface)] hover:bg-[var(--fb-border)] text-[var(--fb-text-primary)] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Baseline Data</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition cursor-pointer"
              >
                {successResult ? "Close" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-[var(--fb-accent)] text-black hover:bg-[var(--fb-accent-dark)] transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Case...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze & Reconstruct Network</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
