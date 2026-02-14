"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  action?: Record<string, unknown> | null;
  actionResult?: { success: boolean; data?: unknown; error?: string } | null;
  timestamp: number;
}

interface DbRow {
  id: string;
  wallet_address: string;
  role: string;
  content: string;
  action: Record<string, unknown> | null;
  action_result: { success: boolean; data?: unknown; error?: string } | null;
  created_at: string;
}

const MAX_MESSAGES = 200;

/**
 * Persistent chat history hook backed by Supabase.
 * Messages are scoped per wallet address.
 *
 * Uses a stable address ref to prevent flickering when Privy
 * temporarily reports no wallets during re-initialization.
 */
export function useChatHistory(walletAddress: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Stable wallet address — only updates when we get a real new address.
  // Ignores brief undefined flickers from Privy re-init.
  const stableAddressRef = useRef<string | undefined>(undefined);
  const prevAddressRef = useRef<string | undefined>(undefined);

  if (walletAddress) {
    stableAddressRef.current = walletAddress;
  }

  const stableAddress = stableAddressRef.current;

  // Load messages from Supabase on mount / wallet change
  const loadMessages = useCallback(async () => {
    if (!stableAddress) {
      // Only clear if we truly never had an address
      if (!stableAddressRef.current) {
        setMessages([]);
        setLoaded(false);
      }
      return;
    }

    setLoading(true);
    try {
      const normalizedAddress = stableAddress.toLowerCase();
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("wallet_address", normalizedAddress)
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
  }, [stableAddress]);

  // Only reload when the ACTUAL address changes (not on undefined flickers)
  useEffect(() => {
    if (stableAddress && stableAddress !== prevAddressRef.current) {
      prevAddressRef.current = stableAddress;
      loadMessages();
    }
  }, [stableAddress, loadMessages]);

  // Save a single message to Supabase
  const saveMessage = useCallback(
    async (msg: ChatMessage) => {
      if (!stableAddress) return;

      const normalizedAddress = stableAddress.toLowerCase();
      const { error } = await supabase.from("chat_messages").insert({
        id: msg.id,
        wallet_address: normalizedAddress,
        role: msg.role,
        content: msg.content,
        action: msg.action ?? null,
        action_result: msg.actionResult ?? null,
        created_at: new Date(msg.timestamp).toISOString(),
      });

      if (error) {
        // Ignore save errors; app continues without persisting this message.
      }
    },
    [stableAddress],
  );

  // Update an existing message (e.g., after action execution)
  const updateMessage = useCallback(
    async (msgId: string, updates: Partial<Pick<ChatMessage, "actionResult">>) => {
      if (!stableAddress) return;

      const { error } = await supabase
        .from("chat_messages")
        .update({
          action_result: updates.actionResult ?? null,
        })
        .eq("id", msgId);

      // Ignore update errors; message will remain without action result.
    },
    [stableAddress],
  );

  // Clear all messages for this wallet
  const clearHistory = useCallback(async () => {
    if (!stableAddress) return;

    const normalizedAddress = stableAddress.toLowerCase();
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("wallet_address", normalizedAddress);

    if (!error) {
      setMessages([]);
    }
  }, [stableAddress]);

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
