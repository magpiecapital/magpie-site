"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number, label: string): string {
  if (ms <= 0) return label === "ended" ? "ended" : "starting";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${label}`;
  if (hours > 0) return `${hours}h ${minutes}m ${label}`;
  return `${minutes}m ${label}`;
}

interface GovernanceCountdownProps {
  targetIso: string;
  label: "left" | "until open" | "ended";
}

export function GovernanceCountdown({ targetIso, label }: GovernanceCountdownProps) {
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    const target = new Date(targetIso).getTime();
    const tick = () => setRemaining(formatRemaining(target - Date.now(), label));
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [targetIso, label]);

  if (!remaining) return null;
  return <span>{remaining}</span>;
}
