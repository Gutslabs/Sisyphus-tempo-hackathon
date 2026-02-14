"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { ChatMessage } from "@/hooks/use-chat-history";

interface DbRow {
  id: string;
  wallet_address: string;
  session_id: string | null;
  role: string;
  content: string;
  action: Record<string, unknown> | null;
  action_result: { success: boolean; data?: unknown; error?: string } | null;
  created_at: string;
}

const MAX_MESSAGES = 200;

/**
 * Persistent chat history for a single session. When sessionId is null, returns empty state.
 * When sessionId is set, loads/saves messages for that session in Supabase.
 */
export function useChatSession(walletAddress: string | undefined, sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const stableAddressRef = useRef<string | undefined>(undefined);
  const prevSessionRef = useRef<string | null>(null);
  if (walletAddress) stableAddressRef.current = walletAddress;
  const stableAddress = stableAddressRef.current;

  const loadMessages = useCallback(async () => {
    if (!stableAddress || !sessionId) {
      setMessages([]);
      setLoaded(true);
      return;
    }

    setLoading(true);
    try {
      const normalizedAddress = stableAddress.toLowerCase();
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("wallet_address", normalizedAddress)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(MAX_MESSAGES);

      if (error) {
        setMessages([]);
        return;
      }

      const loadedMsgs: ChatMessage[] = (data as DbRow[]).map((row) => ({
        id: row.id,
        role: row.role as ChatMessage["role"],
        content: row.content,
        action: row.action,
        actionResult: row.action_result,
        timestamp: new Date(row.created_at).getTime(),
      }));

      setMessages(loadedMsgs);
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [stableAddress, sessionId]);

  useEffect(() => {
    if (sessionId !== prevSessionRef.current) {
      prevSessionRef.current = sessionId;
      if (sessionId && stableAddress) loadMessages();
      else {
        setMessages([]);
        setLoaded(true);
      }
    }
  }, [sessionId, stableAddress, loadMessages]);

  const saveMessage = useCallback(
    async (msg: ChatMessage) => {
      if (!stableAddress || !sessionId) return;

      const normalizedAddress = stableAddress.toLowerCase();
      const { error } = await supabase.from("chat_messages").insert({
        id: msg.id,
        wallet_address: normalizedAddress,
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        action: msg.action ?? null,
        action_result: msg.actionResult ?? null,
        created_at: new Date(msg.timestamp).toISOString(),
      });

      // Ignore save errors; app continues without persisting this message.
    },
    [stableAddress, sessionId],
  );

  const updateMessage = useCallback(
    async (msgId: string, updates: Partial<Pick<ChatMessage, "actionResult">>) => {
      if (!stableAddress) return;

      const { error } = await supabase
        .from("chat_messages")
        .update({ action_result: updates.actionResult ?? null })
        .eq("id", msgId);

      // Ignore update errors; message will remain without action result.
    },
    [stableAddress],
  );

  const clearHistory = useCallback(async () => {
    if (!stableAddress || !sessionId) return;

    const { error } = await supabase.from("chat_messages").delete().eq("session_id", sessionId);

    if (!error) {
      setMessages([]);
    }
  }, [stableAddress, sessionId]);

  return {
    messages,
    setMessages,
    loading,
    loaded,
    saveMessage,
    updateMessage,
    clearHistory,
    loadMessages,
  };
}
