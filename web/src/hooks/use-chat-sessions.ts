"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export interface ChatSession {
  id: string;
  wallet_address: string;
  title: string;
  created_at: string;
  updated_at: string;
}

/**
 * List, create, delete chat sessions for a wallet. Each session is a separate conversation (like ChatGPT).
 */
export function useChatSessions(walletAddress: string | undefined) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const stableAddressRef = useRef<string | undefined>(undefined);
  if (walletAddress) stableAddressRef.current = walletAddress;
  const stableAddress = stableAddressRef.current;

  const loadSessions = useCallback(async () => {
    if (!stableAddress) {
      setSessions([]);
      return;
    }
    setLoading(true);
    try {
      const normalized = stableAddress.toLowerCase();
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("wallet_address", normalized)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        setSessions([]);
        return;
      }
      setSessions((data as ChatSession[]) ?? []);
    } catch (err) {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [stableAddress]);

  useEffect(() => {
    if (stableAddress) loadSessions();
    else setSessions([]);
  }, [stableAddress, loadSessions]);

  const createSession = useCallback(async (): Promise<string | null> => {
    if (!stableAddress) return null;
    const normalized = stableAddress.toLowerCase();
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        wallet_address: normalized,
        title: "New chat",
      })
      .select("id")
      .single();

    if (error) {
      return null;
    }
    const id = (data as { id: string }).id;
    setSessions((prev) => [
      { id, wallet_address: normalized, title: "New chat", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ...prev,
    ]);
    return id;
  }, [stableAddress]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!stableAddress) return;
      const { error } = await supabase.from("chat_sessions").delete().eq("id", sessionId).eq("wallet_address", stableAddress.toLowerCase());
      if (!error) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    },
    [stableAddress],
  );

  const setSessionTitle = useCallback(
    async (sessionId: string, title: string) => {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (!error) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title, updated_at: new Date().toISOString() } : s)));
      }
    },
    [],
  );

  return { sessions, loading, loadSessions, createSession, deleteSession, setSessionTitle };
}
