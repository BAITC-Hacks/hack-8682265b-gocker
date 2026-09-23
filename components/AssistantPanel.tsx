"use client";

import React, { useState } from "react";
import { Bot, Send, Sparkles, ChevronDown, ChevronUp, Loader2, X, MessageSquare } from "lucide-react";

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
}

export default function AssistantPanel({
  onSelectNode,
  onHighlightGids,
  selectedGid,
  isOpen,
  onToggle,
}: AssistantPanelProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content:
        "👋 Welcome! I am your AML Graph Intelligence Assistant. You can ask me to analyze high-risk targets, explain cluster bridges, or evaluate specific accounts.",
    },
  ]);

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

  return (
    <>
      {/* Floating Trigger Button (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 py-2.5 px-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-2xl flex items-center gap-2.5 border border-purple-400/30 transition transform hover:scale-105 z-40"
        >
          <Bot className="w-4 h-4 text-purple-200" />
          <span>Ask AML Assistant</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] h-[480px] flex flex-col rounded-2xl glass-panel bg-slate-950/95 border border-slate-700/80 shadow-2xl z-40 overflow-hidden text-xs">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-100 flex items-center gap-1.5">
                  AML AI Assistant
                  <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    Online
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Transaction & network investigator
                </div>
              </div>
            </div>

            <button
              onClick={onToggle}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div className="p-2.5 bg-slate-900/50 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
            <button
              onClick={() => handleSend("Identify the top 5 highest priority targets for immediate AML review")}
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap text-[11px] flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-amber-400" /> Top Targets
            </button>
            <button
              onClick={() => handleSend("Explain the coordinator nodes bridging multiple clusters")}
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap text-[11px] flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-purple-400" /> Coordinators
            </button>
            <button
              onClick={() => handleSend("Find accounts acting as fund consolidators with low pass-through")}
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap text-[11px] flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" /> Consolidators
            </button>
            {selectedGid && (
              <button
                onClick={() => handleSend(`Analyze account GID ${selectedGid} and its direct money flow network`)}
                className="px-2 py-1 rounded-md bg-purple-950 text-purple-200 border border-purple-800 whitespace-nowrap text-[11px] font-mono"
              >
                Inspect #{String(selectedGid).slice(-6)}
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
                    ? "bg-slate-800/90 text-slate-100 ml-6 border border-slate-700/60"
                    : "bg-slate-900/90 text-slate-200 mr-2 border border-slate-800/80"
                }`}
              >
                <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  {m.role === "user" ? "Analyst" : "Assistant"}
                </div>
                <div className="whitespace-pre-wrap text-xs">{m.content}</div>

                {/* Clickable GIDs */}
                {m.mentioned_gids && m.mentioned_gids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 self-center">Focus Account:</span>
                    {m.mentioned_gids.map((gid) => (
                      <button
                        key={gid}
                        onClick={() => onSelectNode(gid)}
                        className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[10px] hover:bg-cyan-900 transition"
                      >
                        GID {gid}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                Querying graph intelligence...
              </div>
            )}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 border-t border-slate-800 bg-slate-900/70 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder="Ask a question about accounts or flows..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
