"use client";

import React, { useState, useEffect } from "react";
import { Bot, Send, Sparkles, Loader2, X } from "lucide-react";
import { useT } from "@/lib/i18n";

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  mentioned_gids?: number[];
}

interface AssistantPanelProps {
  onSelectNode: (gid: number) => void;
  onHighlightGids: (gids: number[]) => void;
  selectedGid: number | null;
  isOpen: boolean;
  onToggle: () => void;
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
}

export default function AssistantPanel({
  onSelectNode,
  onHighlightGids,
  selectedGid,
  isOpen,
  onToggle,
  externalPrompt,
  onClearExternalPrompt,
}: AssistantPanelProps) {
  const { t } = useT();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    const userMsg: AssistantMessage = { role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const asstMsg: AssistantMessage = {
        role: "assistant",
        content: data.answer,
        mentioned_gids: data.mentioned_gids || [],
      };
      setMessages((prev) => [...prev, asstMsg]);

      if (data.mentioned_gids && data.mentioned_gids.length > 0) {
        onHighlightGids(data.mentioned_gids);
        if (data.mentioned_gids.length === 1) {
          onSelectNode(data.mentioned_gids[0]);
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Unable to process query: ${err.message || "Backend service unavailable"}.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (externalPrompt) {
      if (!isOpen) onToggle();
      handleSend(externalPrompt);
      onClearExternalPrompt?.();
    }
  }, [externalPrompt, isOpen, onToggle, onClearExternalPrompt]);

  /* Reset welcome message whenever locale changes so it appears in the new language */
  const { locale } = useT();
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: t.assistant_welcome,
      },
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          title={t.assistant_btn}
          aria-label={t.assistant_btn}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-[var(--fb-accent)] hover:bg-[var(--fb-accent-dark)] text-black shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-30 cursor-pointer border border-black/10"
        >
          <Bot className="w-5 h-5 text-black" />
        </button>
      )}

      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] h-[480px] flex flex-col rounded-2xl bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-2xl z-40 overflow-hidden text-xs text-[var(--fb-text-primary)]">
          {/* Header */}
          <div className="p-3.5 border-b border-[var(--fb-border)] bg-[var(--fb-bg)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[var(--fb-accent)] flex items-center justify-center text-black font-bold">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-[var(--fb-text-primary)] flex items-center gap-1.5">
                  {t.assistant_title}
                  <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {t.assistant_online}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--fb-text-secondary)]">
                  {t.assistant_subtitle}
                </div>
              </div>
            </div>

            <button
              onClick={onToggle}
              className="p-1 rounded-lg hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div className="p-2.5 bg-[var(--fb-surface)] border-b border-[var(--fb-border)] flex items-center gap-1.5 overflow-x-auto shrink-0">
            <button
              onClick={() => handleSend(t.assistant_prompt_top5)}
              className="px-2 py-1 rounded-md bg-[var(--fb-bg)] border border-[var(--fb-border)] hover:border-[var(--fb-accent-dark)] text-[var(--fb-text-primary)] whitespace-nowrap text-[11px] flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-[var(--role-consolidator)]" /> {t.assistant_chip_top}
            </button>
            <button
              onClick={() => handleSend(t.assistant_prompt_coordinators)}
              className="px-2 py-1 rounded-md bg-[var(--fb-bg)] border border-[var(--fb-border)] hover:border-[var(--fb-accent-dark)] text-[var(--fb-text-primary)] whitespace-nowrap text-[11px] flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-[var(--role-coordinator)]" /> {t.assistant_chip_coordinators}
            </button>
            <button
              onClick={() => handleSend(t.assistant_prompt_consolidators)}
              className="px-2 py-1 rounded-md bg-[var(--fb-bg)] border border-[var(--fb-border)] hover:border-[var(--fb-accent-dark)] text-[var(--fb-text-primary)] whitespace-nowrap text-[11px] flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-[var(--role-distributor)]" /> {t.assistant_chip_consolidators}
            </button>
            {selectedGid && (
              <button
                onClick={() => handleSend(`Analyze account GID ${selectedGid} and its direct money flow network`)}
                className="px-2 py-1 rounded-md bg-[var(--fb-accent)]/20 text-[var(--fb-accent-dark)] border border-[var(--fb-accent-dark)]/40 whitespace-nowrap text-[11px] font-mono font-semibold"
              >
                {t.assistant_inspect ? `${t.assistant_inspect}` : "Inspect #"}{String(selectedGid).slice(-6)}
              </button>
            )}
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pr-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl leading-relaxed ${
                  m.role === "user"
                    ? "bg-[var(--fb-accent)]/15 text-[var(--fb-text-primary)] ml-6 border border-[var(--fb-accent)]/30"
                    : "bg-[var(--fb-bg)] text-[var(--fb-text-primary)] mr-2 border border-[var(--fb-border)]"
                }`}
              >
                <div className="text-[10px] font-bold text-[var(--fb-text-secondary)] mb-1 flex items-center gap-1">
                  {m.role === "user" ? t.assistant_role_user : t.assistant_role_assistant}
                </div>
                <div className="whitespace-pre-wrap text-xs">{m.content}</div>

                {/* Clickable GIDs */}
                {m.mentioned_gids && m.mentioned_gids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-[var(--fb-border)]">
                    <span className="text-[10px] text-[var(--fb-text-secondary)] self-center">{t.assistant_focus_account}</span>
                    {m.mentioned_gids.map((gid) => (
                      <button
                        key={gid}
                        onClick={() => onSelectNode(gid)}
                        className="px-1.5 py-0.5 rounded bg-[var(--fb-surface)] border border-[var(--fb-border)] font-mono text-[10px] text-[var(--fb-accent-dark)] font-semibold hover:border-[var(--fb-accent-dark)] transition"
                      >
                        GID {gid}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-[var(--fb-text-secondary)] text-xs p-2">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--fb-accent-dark)]" />
                {t.loading_querying}
              </div>
            )}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 border-t border-[var(--fb-border)] bg-[var(--fb-bg)] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder={t.assistant_placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 px-3 py-1.5 text-xs bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-lg text-[var(--fb-text-primary)] placeholder-[var(--fb-text-secondary)] focus:outline-none focus:border-[var(--fb-accent-dark)] transition"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-lg bg-[var(--fb-accent)] hover:bg-[var(--fb-accent-dark)] text-black disabled:opacity-40 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
