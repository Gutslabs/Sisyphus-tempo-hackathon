"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Avatar,
  InputBase,
  IconButton,
  Stack,
  CircularProgress,
  Button,
} from "@mui/material";
import {
  Send as SendIcon,
  AutoAwesome as SparklesIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
type SimpleMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
};

const LANDING_WELCOME: SimpleMessage = {
  id: "landing-welcome",
  role: "system",
  content:
    'Watch a full on-chain workflow:\n• Deploy a new token\n• Distribute it to 10 wallets\n• Create a market & provide liquidity\n• Place / cancel bids & asks\nAll actions are simulated here — use the dashboard for real trades.',
  timestamp: 0,
};

function randomAddress(): string {
  // Generate a random EVM address (0x + 20 bytes)
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function buildDemoScript(): string[] {
  const wallets = Array.from({ length: 10 }, () => randomAddress()).join(", ");
  return [
    // Deploy & mint SISY
    'Deploy a new token named "Sisyphus Token" with symbol SISY.',
    "Mint 1_000_000 SISY tokens to my wallet.",
    // Market init for SISY
    "Create a trading pair for SISY against pathUSD.",
    "Provide liquidity for SISY with 10_000 SISY and 10_000 pathUSD.",
    "Swap 1_000 SISY to pathUSD on the new SISY/pathUSD market.",
    // Distribute SISY to many wallets
    `Send 10_000 SISY each to these 10 wallets: ${wallets}.`,
    // Limit orders on SISY
    "Place limit buy 1_000 SISY at 0.995 pathUSD.",
    "Place limit sell 1_000 SISY at 1.005 pathUSD.",
    "Show my open orders.",
    "Cancel bid 1.",
    "Show my open orders again.",
    "Show my balance.",
  ];
}

export function LandingChat() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<SimpleMessage[]>([LANDING_WELCOME]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<SimpleMessage[]>([LANDING_WELCOME]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const appendMessage = (msg: SimpleMessage) => {
    setMessages((prev) => [...prev, msg]);
  };

  const sendPrompt = async (prompt: string) => {
    if (!prompt.trim()) return;
    const userMessage: SimpleMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt.trim(),
      timestamp: Date.now(),
    };
    appendMessage(userMessage);
    setIsLoading(true);

    try {
      const chatHistory = messagesRef.current
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      chatHistory.push({ role: "user", content: userMessage.content });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
      });

      const data = await res.json().catch(() => ({}));
      const apiMessage = typeof data?.message === "string" ? data.message : "";

      if (!res.ok) {
        appendMessage({
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: apiMessage || `Request failed (${res.status}). Try again.`,
          timestamp: Date.now(),
        });
        return;
      }

      const content = apiMessage || "Done.";
      appendMessage({
        id: `ai-${Date.now()}`,
        role: "assistant",
        content,
        timestamp: Date.now(),
      });
    } catch {
      appendMessage({
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "An error occurred. Please try again.",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-play scripted demo once on mount (video-like)
  useEffect(() => {
    let cancelled = false;
    const runDemo = async () => {
      // infinite loop over the scripted sequence
      while (!cancelled) {
        // restart "from scratch" each cycle
        setMessages([LANDING_WELCOME]);
        messagesRef.current = [LANDING_WELCOME];

        // Small pause so it feels like a reset
        await new Promise((r) => setTimeout(r, 600));

        const script = buildDemoScript();
        for (const line of script) {
          if (cancelled) break;
          await new Promise((r) => setTimeout(r, 900));
          if (cancelled) break;
          await sendPrompt(line);
        }
        // küçük bir nefes arası
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    runDemo();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const current = input;
    setInput("");
    await sendPrompt(current);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "background.default",
      }}
    >
      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          p: { xs: 2, sm: 3 },
          display: "flex",
          flexDirection: "column",
          gap: { xs: 1.5, sm: 2 },
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
      >
        {messages.map((m) => (
          <Box
            key={m.id}
            sx={{
              display: "flex",
              gap: { xs: 1.5, sm: 2 },
              flexDirection: m.role === "user" ? "row-reverse" : "row",
              alignItems: "flex-start",
            }}
          >
            <Avatar
              sx={(theme) => ({
                width: { xs: 28, sm: 32 },
                height: { xs: 28, sm: 32 },
                bgcolor: m.role === "user" ? theme.palette.background.paper : theme.palette.primary.main,
                color: m.role === "user" ? theme.palette.text.primary : theme.palette.getContrastText(theme.palette.primary.main),
              })}
            >
              {m.role === "user" ? <PersonIcon sx={{ fontSize: 18 }} /> : <SparklesIcon sx={{ fontSize: 18 }} />}
            </Avatar>
            <Paper
              elevation={0}
              sx={(theme) => ({
                p: 1.5,
                borderRadius: 3,
                maxWidth: { xs: "92%", sm: "80%" },
                bgcolor:
                  m.role === "user"
                    ? theme.palette.mode === "dark"
                      ? "#303134"
                      : "#f1f3f4"
                    : theme.palette.mode === "dark"
                      ? "#202124"
                      : "#f8f9fa",
                whiteSpace: "pre-line",
                fontSize: { xs: "0.85rem", sm: "0.9rem" },
              })}
            >
              {m.content}
            </Paper>
          </Box>
        ))}
        {isLoading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Thinking...
            </Typography>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Input */}
      <Box
        sx={{
          borderTop: 1,
          borderColor: "divider",
          p: { xs: 1.5, sm: 2 },
        }}
      >
        <Paper
          component="form"
          onSubmit={handleSubmit}
          elevation={0}
          sx={(theme) => ({
            p: "4px 8px",
            display: "flex",
            alignItems: "center",
            borderRadius: 8,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: theme.palette.mode === "dark" ? "#202124" : "#f8f9fa",
          })}
        >
          <InputBase
            sx={{ ml: 1, flex: 1, fontSize: "0.9rem" }}
            placeholder="Use dashboard to get started."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            inputRef={inputRef}
            disabled
          />
          <IconButton type="submit" disabled color="primary">
            <SendIcon />
          </IconButton>
        </Paper>
      </Box>
    </Box>
  );
}

