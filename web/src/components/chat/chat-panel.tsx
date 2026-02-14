"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  InputBase,
  IconButton,
  Avatar,
  Stack,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Button,
} from "@mui/material";
import {
  Send as SendIcon,
  AutoAwesome as SparklesIcon,
  AttachFile as PaperclipIcon,
  Delete as TrashIcon,
  AddComment as MessageSquarePlusIcon,
  ChatBubbleOutline as MessageCircleIcon,
  Chat as MessageSquareIcon,
  Schedule as ScheduleIcon,
  Loop as RecurringIcon,
} from "@mui/icons-material";
import {
  useTempoBalances, useTempoSend, useTempoFaucet, useTempoSwap,
  useTempoLimitOrder, useTempoScheduler, useTempoDeployment,
  type SendResult, type BatchSendResult
} from "@/hooks/use-tempo";
import { type ChatMessage as ChatMessageType } from "@/hooks/use-chat-history";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import { useChatSession } from "@/hooks/use-chat-session";
import { recordTxFromActionResult, recordTransaction } from "@/lib/record-tx";
import { parsePaymentFile, summarizePayments, formatPaymentTable, type ParseResult } from "@/lib/file-parser";
import { SchedulePaymentDialog } from "@/components/chat/schedule-payment-dialog";
import { RecurringPaymentDialog } from "@/components/chat/recurring-payment-dialog";
import { ChatMessage, executeAction, normalizeAction } from "@/components/chat/chat-actions";
import type { Address } from "viem";

const WELCOME_MESSAGE: ChatMessageType = {
  id: "welcome",
  role: "system",
  content:
    'Welcome to Sisyphus. You can:\n' +
    '• Deploy token: "Deploy a new ERC20 called MYTOKEN with 1,000,000 supply"\n' +
    '• Create pair: "Create a pair for my MYTOKEN token with pathUSD"\n' +
    '• Add liquidity: "Add 1,000 MYTOKEN and 500 pathUSD to the pool"\n' +
    '• Swap: "Swap 100 pathUSD to BetaUSD"\n' +
    '• Limit order: "Buy 100 BetaUSD at 0.999" or "Sell 50 AlphaUSD at 1.001"\n' +
    '• Batch transfers: "Send 50 AlphaUSD to 0x1, 0x2, 0x3"\n' +
    '• Scheduled payment: "On March 15 send 100 AlphaUSD to 0x..."\n' +
    '• Recurring payment: "Send 50 pathUSD to 0x... every week"\n' +
    '• Upload CSV/TXT: Bulk parallel payments from file\n' +
    '• Check balances: "Show my balance"\n' +
    '• Faucet: "Get testnet funds"',
  // Use stable timestamp to avoid SSR/client mismatch.
  timestamp: 0,
};

const SESSION_TITLE_MAX = 36;

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avoid hydration mismatch with wagmi / window usage.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { balances, refresh: refreshBalances, address: walletAddress } = useTempoBalances();
  const { sendPayment, sendParallel } = useTempoSend();
  const { requestFunds } = useTempoFaucet();
  const { swap } = useTempoSwap();
  const { placeLimitOrder, cancelOrder, provideLiquidity } = useTempoLimitOrder();
  const { schedulePayments, createRecurringPayment } = useTempoScheduler();
  const { deployToken, mintToken, createPair } = useTempoDeployment();

  const { sessions, createSession, deleteSession, setSessionTitle } = useChatSessions(walletAddress);

  // Restore selected chat from URL on mount (#chat/sessionId)
  useEffect(() => {
    const raw = window.location.hash.slice(1);
    const [base, sessionId] = raw.split("/");
    if (base?.toLowerCase() === "chat" && sessionId) setCurrentSessionId(sessionId);
  }, []);

  // Sync when hash changes (e.g. browser back/forward)
  useEffect(() => {
    const onHashChange = () => {
      const raw = window.location.hash.slice(1);
      const [base, sessionId] = raw.split("/");
      if (base?.toLowerCase() === "chat" && sessionId) setCurrentSessionId(sessionId);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Clear URL if current session was deleted
  useEffect(() => {
    if (!currentSessionId) return;
    const exists = sessions.some((s) => s.id === currentSessionId);
    if (sessions.length > 0 && !exists) {
      setCurrentSessionId(null);
      if (window.location.hash.startsWith("#chat/")) window.location.hash = "#chat";
    }
  }, [sessions, currentSessionId]);

  const {
    messages: persistedMessages,
    setMessages: setPersistedMessages,
    loading: historyLoading,
    loaded: historyLoaded,
    saveMessage,
    updateMessage,
  } = useChatSession(walletAddress, currentSessionId);

  const messages: ChatMessageType[] = historyLoaded && persistedMessages.length > 0
    ? persistedMessages
    : [WELCOME_MESSAGE];

  const addMessage = useCallback(
    async (msg: ChatMessageType) => {
      const isFirstUserMessage = msg.role === "user" && persistedMessages.filter((m) => m.role === "user").length === 0;
      setPersistedMessages((prev) => [...prev, msg]);
      await saveMessage(msg);
      if (isFirstUserMessage && currentSessionId) {
        const title = msg.content.slice(0, SESSION_TITLE_MAX).replace(/\n/g, " ").trim() || "New chat";
        await setSessionTitle(currentSessionId, title);
      }
    },
    [setPersistedMessages, saveMessage, currentSessionId, persistedMessages, setSessionTitle],
  );

  const handleNewChat = useCallback(async () => {
    const id = await createSession();
    if (id) {
      setCurrentSessionId(id);
      window.location.hash = `#chat/${id}`;
    }
  }, [createSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "txt"].includes(ext ?? "")) {
      await addMessage({
        id: `err-${Date.now()}`,
        role: "system",
        content: "Unsupported file format. Please upload a .csv or .txt file.",
        timestamp: Date.now(),
      });
      return;
    }

    try {
      const content = await file.text();
      const result: ParseResult = parsePaymentFile(content, file.name);
      if (result.total === 0) {
        await addMessage({
          id: `err-${Date.now()}`,
          role: "system",
          content: summarizePayments(result),
          timestamp: Date.now(),
        });
        return;
      }

      await addMessage({
        id: `user-file-${Date.now()}`,
        role: "user",
        content: `Uploaded "${file.name}"\n\n${summarizePayments(result)}`,
        timestamp: Date.now(),
      });

      await addMessage({
        id: `ai-preview-${Date.now()}`,
        role: "assistant",
        content: formatPaymentTable(result.payments) + `\n\nExecuting transfers...`,
        timestamp: Date.now(),
      });

      setIsLoading(true);
      const transfers = result.payments.map((p) => ({
        tokenSymbol: p.token,
        amount: p.amount,
        to: p.address as Address,
      }));

      try {
        const sendResult = await sendParallel(transfers);
        setTimeout(() => refreshBalances(), 2000);
        const isBatchResult = "isBatch" in sendResult && sendResult.isBatch;
        const transferCount = isBatchResult
          ? (sendResult as BatchSendResult).transferCount
          : (sendResult as SendResult[]).length;

        await addMessage({
          id: `ai-result-${Date.now()}`,
          role: "assistant",
          content: isBatchResult
            ? `All ${transferCount} payment(s) sent in a single batch transaction!`
            : `All ${transferCount} payment(s) sent successfully!`,
          action: { action: "send_parallel", isBatch: isBatchResult },
          actionResult: { success: true, data: sendResult },
          timestamp: Date.now(),
        });
        recordTxFromActionResult(walletAddress ?? undefined, { action: "send_parallel", isBatch: isBatchResult }, sendResult);
      } catch (err) {
        await addMessage({
          id: `ai-err-${Date.now()}`,
          role: "assistant",
          content: `Batch send failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          action: { action: "send_parallel" },
          actionResult: { success: false, error: err instanceof Error ? err.message : "Action failed" },
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      await addMessage({
        id: `err-${Date.now()}`,
        role: "system",
        content: `Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`,
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, sendParallel, refreshBalances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setInput("");
    setIsLoading(true);
    setStatusText("Thinking...");

    await addMessage(userMessage);

    try {
      const chatHistory = messages
        .filter((m) => m.role !== "system")
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      chatHistory.push({ role: "user", content: userMessage.content });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
      });

      const data = await res.json().catch(() => ({}));
      const apiMessage = typeof data?.message === "string" ? data.message : "";
      const rawAction = data?.action;

      if (!res.ok) {
        await addMessage({
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: apiMessage || `Request failed (${res.status}). Try again or start a new chat.`,
          timestamp: Date.now(),
        });
        setStatusText(null);
        return;
      }

      const aiMessage: ChatMessageType = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: apiMessage || "Done.",
        action: normalizeAction(rawAction),
        timestamp: Date.now(),
      };

      const actionToRun = aiMessage.action;
      if (actionToRun && typeof actionToRun === "object" && typeof actionToRun.action === "string") {
        try {
          const result = await executeAction(actionToRun, {
            balances,
            sendPayment,
            sendParallel,
            swap,
            placeLimitOrder,
            cancelOrder,
            schedulePayments,
            createRecurringPayment,
            refreshBalances,
            requestFunds,
            deployToken,
            mintToken,
            createPair,
            provideLiquidity,
            walletAddress: walletAddress ?? undefined,
            setStatus: setStatusText,
          });
          aiMessage.actionResult = { success: true, data: result };
          recordTxFromActionResult(walletAddress ?? undefined, actionToRun, result);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Action failed";
          aiMessage.actionResult = { success: false, error: errMsg };
          aiMessage.content = [aiMessage.content, `**Error:** ${errMsg}`].filter(Boolean).join("\n\n");
        }
      } else {
        const extra =
          rawAction == null
            ? "AI did not return a structured action, so no on-chain transaction was executed. Try rephrasing or start a new chat."
            : "Could not run the requested action (invalid format). Try rephrasing or start a new chat.";
        aiMessage.content = [aiMessage.content, extra].filter(Boolean).join("\n\n");
      }
      await addMessage(aiMessage);
    } catch {
      await addMessage({
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "An error occurred. Please try again.",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
      setStatusText(null);
      inputRef.current?.focus();
    }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const noSessionSelected = !currentSessionId;
  const canCompose = Boolean(walletAddress && currentSessionId);

  if (!mounted) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        flex: 1,
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      {/* Session list sidebar */}
      <Box sx={{ width: 260, flexShrink: 0, borderRight: 1, borderColor: "divider", display: { xs: "none", md: "flex" }, flexDirection: "column", bgcolor: "background.paper" }}>
        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<MessageSquarePlusIcon />}
            onClick={handleNewChat}
            disabled={!walletAddress}
            sx={{ borderRadius: 10, py: 1.5 }}
          >
            New chat
          </Button>
        </Box>
        <List sx={{ flex: 1, overflowY: "auto", px: 1 }}>
          {!walletAddress && (
            <Typography variant="caption" sx={{ px: 2, py: 4, display: "block", color: "text.secondary", textAlign: "center" }}>
              Connect wallet to start.
            </Typography>
          )}
          {walletAddress && sessions.length === 0 && !currentSessionId && (
            <Typography variant="caption" sx={{ px: 2, py: 4, display: "block", color: "text.secondary", textAlign: "center" }}>
              Click &quot;New chat&quot; to start.
            </Typography>
          )}
          {sessions.map((s) => (
            <ListItem key={s.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={currentSessionId === s.id}
                onClick={() => {
                  setCurrentSessionId(s.id);
                  window.location.hash = `#chat/${s.id}`;
                }}
                sx={{
                  borderRadius: 2,
                  "&.Mui-selected": {
                    bgcolor: "rgba(0, 0, 0, 0.06)",
                    color: "primary.main",
                    "& .MuiListItemIcon-root": { color: "primary.main" }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}><MessageCircleIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                <ListItemText
                  primary={s.title}
                  primaryTypographyProps={{ variant: "body2", noWrap: true, fontWeight: currentSessionId === s.id ? 600 : 400 }}
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.id);
                    if (currentSessionId === s.id) {
                      setCurrentSessionId(null);
                      window.location.hash = "#chat";
                    }
                  }}
                  sx={{ opacity: 0, ".MuiListItemButton-root:hover &": { opacity: 1 } }}
                >
                  <TrashIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Main Chat Area - full width, column flex so only messages scroll */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        {/* Chat Header */}
        <Box sx={{ flexShrink: 0, px: 3, py: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
            {currentSession ? currentSession.title : "AI Chat"}
          </Typography>
        </Box>

        {noSessionSelected ? (
          <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, p: 4, textAlign: "center" }}>
            <MessageSquareIcon sx={{ fontSize: 64, color: "divider" }} />
            <Typography variant="body1" color="text.secondary">Select a chat or start a new one to begin.</Typography>
            <Button variant="outlined" onClick={handleNewChat} disabled={!walletAddress}>New chat</Button>
          </Box>
        ) : (
          <>
            {/* Messages List - full width, scrolls when content grows */}
            <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%", overflowY: "auto", overflowX: "hidden", p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
              {historyLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={24} /></Box>
              )}
              {!historyLoading && messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32 }}><SparklesIcon sx={{ fontSize: 18 }} /></Avatar>
                  <Paper
                    elevation={0}
                    sx={(theme) => {
                      const isDark = theme.palette.mode === "dark";
                      return {
                        p: 2,
                        borderRadius: 3,
                        bgcolor: isDark ? "#202124" : "#f8f9fa",
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                      };
                    }}
                  >
                    <CircularProgress size={14} />
                    <Typography variant="body2" color="text.secondary">
                      {statusText ?? "Thinking..."}
                    </Typography>
                  </Paper>
                </Box>
              )}
              <div ref={bottomRef} />
            </Box>

            {/* Input Area - flexShrink: 0 so it never gets cut off; overflow visible so chips are never clipped */}
            <Box sx={{ flexShrink: 0, minWidth: 0, width: "100%", overflow: "visible", p: 3, pt: 2, pb: 3, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
              <Paper
                component="form"
                onSubmit={handleSubmit}
                elevation={0}
                sx={(theme) => {
                  const isDark = theme.palette.mode === "dark";
                  return {
                    p: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 8,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: isDark ? "#202124" : "#f8f9fa",
                    "&:focus-within": {
                      borderColor: "primary.main",
                      bgcolor: isDark ? "#303134" : "white",
                      boxShadow: "0 1px 6px rgba(0,0,0,0.28)",
                    },
                  };
                }}
              >
                <IconButton onClick={() => fileInputRef.current?.click()} disabled={isLoading} size="small">
                  <PaperclipIcon />
                </IconButton>
                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
                <Tooltip title="Schedule payment">
                  <span>
                    <IconButton onClick={() => setScheduleDialogOpen(true)} disabled={!walletAddress || isLoading} size="small" color="inherit">
                      <ScheduleIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Recurring payment">
                  <span>
                    <IconButton onClick={() => setRecurringDialogOpen(true)} disabled={!walletAddress || isLoading} size="small" color="inherit">
                      <RecurringIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <InputBase
                  sx={{ ml: 1, flex: 1, fontSize: "0.9rem", minWidth: 0 }}
                  placeholder="Ask anything or send commands..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!canCompose || isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  inputRef={inputRef}
                />
                <IconButton type="submit" disabled={isLoading || !input.trim() || !canCompose} color="primary" sx={{ flexShrink: 0 }}>
                  <SendIcon />
                </IconButton>
              </Paper>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  mt: 2,
                  flexWrap: "wrap",
                  gap: 1,
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: 0,
                  pb: 1,
                  "& .MuiChip-root": { flexShrink: 0 },
                }}
              >
                {[
                  "Show balance",
                  "Swap 100 AlphaUSD to BetaUSD",
                  "Buy 100 BetaUSD at 0.999",
                  "Sell 100 AlphaUSD at 1.001",
                  "Deploy a new token",
                  "Mint token",
                  "Create pair for my token",
                  "Provide liquidity for my token",
                ].map((q) => (
                  <Chip
                    key={q}
                    label={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    size="small"
                    variant="outlined"
                    sx={(theme) => ({
                      cursor: "pointer",
                      "&:hover": { bgcolor: theme.palette.action.hover },
                    })}
                  />
                ))}
              </Stack>
            </Box>

            <SchedulePaymentDialog
              open={scheduleDialogOpen}
              onClose={() => setScheduleDialogOpen(false)}
              onSchedule={schedulePayments}
              onSuccess={(msg) => addMessage({ id: `sys-${Date.now()}`, role: "system", content: msg, timestamp: Date.now() })}
              onError={(msg) => addMessage({ id: `err-${Date.now()}`, role: "system", content: msg, timestamp: Date.now() })}
              onRecordTxs={walletAddress ? (items) => items.forEach(({ hash, type }) => recordTransaction({ wallet_address: walletAddress, tx_hash: hash, type, label: null })) : undefined}
            />
            <RecurringPaymentDialog
              open={recurringDialogOpen}
              onClose={() => setRecurringDialogOpen(false)}
              onCreate={createRecurringPayment}
              onSuccess={(msg) => addMessage({ id: `sys-${Date.now()}`, role: "system", content: msg, timestamp: Date.now() })}
              onError={(msg) => addMessage({ id: `err-${Date.now()}`, role: "system", content: msg, timestamp: Date.now() })}
              onRecordTxs={walletAddress ? (items) => items.forEach(({ hash, type }) => recordTransaction({ wallet_address: walletAddress, tx_hash: hash, type, label: null })) : undefined}
            />
          </>
        )}
      </Box>
    </Box>
  );
}
