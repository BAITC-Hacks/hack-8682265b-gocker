"use client";

import React, { useState } from "react";
import { Bot, Send, Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  mentioned_gids?: number[];
}

interface AssistantPanelProps {
  onSelectNode: (gid: number) => void;
  onHighlightGids: (gids: number[]) => void;
  selectedGid: number | null;
}

export default function AssistantPanel({
  onSelectNode,
  onHighlightGids,
  selectedGid,
}: AssistantPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your AML Graph Analyst Assistant. Ask me to investigate specific GIDs, examine cross-cluster coordinators, or identify consolidation structures.",
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
    <div className="fixed bottom-0 right-80 w-[480px] max-w-[calc(100vw-22rem)] z-30 transition-all">
      {/* Collapsed Bar / Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-3 rounded-t-2xl glass-panel bg-slate-900/95 cursor-pointer hover:bg-slate-800/95 transition shadow-2xl border-b-0"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              AML AI Assistant
              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                GPT / NIM
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Interactive hypothesis & counterparty analysis
            </div>
          </div>
        </div>

        <button className="text-slate-400 hover:text-slate-200 p-1">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div className="h-80 flex flex-col glass-panel bg-slate-950/95 border-t-0 p-3 text-xs shadow-2xl">
          {/* Quick Prompt Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => handleSend("Analyze top coordinator nodes and their cross-cluster bridges")}
              className="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 whitespace-nowrap text-[11px] flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-purple-400" /> Coordinators
            </button>
            <button
              onClick={() => handleSend("Identify consolidators pooling funds with low pass-through")}
              className="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 whitespace-nowrap text-[11px] flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-400" /> Consolidators
            </button>
            {selectedGid && (
              <button
                onClick={() => handleSend(`Analyze node GID ${selectedGid} and its counterparties`)}
                className="px-2 py-1 rounded-md bg-purple-950/70 border border-purple-800 text-purple-200 whitespace-nowrap text-[11px] flex items-center gap-1 font-mono"
              >
                Inspect #{selectedGid}
              </button>
            )}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-xl ${
                  m.role === "user"
                    ? "bg-slate-800/90 text-slate-100 ml-8 border border-slate-700/60"
                    : "bg-slate-900/80 text-slate-200 mr-4 border border-slate-800/80"
                }`}
              >
                <div className="text-[10px] font-bold text-slate-400 mb-1">
                  {m.role === "user" ? "Analyst" : "AML Assistant"}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                {/* Highlighted GIDs Chips */}
                {m.mentioned_gids && m.mentioned_gids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 self-center">Focus on graph:</span>
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
                Analyzing graph neighborhood...
              </div>
            )}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 pt-2 border-t border-slate-800"
          >
            <input
              type="text"
              placeholder="Ask assistant about nodes, flows, or GIDs..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-900/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white disabled:opacity-40 transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
