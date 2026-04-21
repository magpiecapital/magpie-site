/**
 * Telegram chat mockup — live-feeling preview of the Magpie bot flow.
 */

import { Mark } from "./Logo";

export function PhoneMock() {
  return (
    <div className="phone-frame mx-auto w-full max-w-[360px]">
      <div className="phone-screen aspect-[9/19.5] w-full">
        {/* TG Header */}
        <div className="flex items-center gap-3 border-b border-white/5 bg-[#17212b] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]">
            <Mark size={26} />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-white">Magpie</div>
            <div className="text-[10px] text-white/50">bot · online</div>
          </div>
          <div className="flex gap-1.5">
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span className="h-1 w-1 rounded-full bg-white/40" />
          </div>
        </div>

        {/* Chat body */}
        <div className="flex flex-col gap-3 bg-[#0e1621] px-3 py-4 text-[12px] leading-relaxed">
          <BotMsg>
            <div className="font-semibold text-white">Quote ready 📎</div>
            <div className="mt-1 text-white/80">
              Pledge <span className="font-mono text-[var(--accent)]">8,000 WIF</span>
            </div>
            <div className="mt-1 text-white/80">
              Get <span className="font-mono text-white">3.25 SOL</span> · 30% LTV · 2d
            </div>
            <div className="mt-1 text-white/50">Fee 3% · repay 3.35 SOL</div>
          </BotMsg>

          <BotMsg>
            <div className="flex gap-2">
              <button className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-[11px] font-semibold text-black">
                ✓ Confirm
              </button>
              <button className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-[11px] font-semibold text-white">
                Edit
              </button>
            </div>
          </BotMsg>

          <UserMsg>Confirm</UserMsg>

          <BotMsg>
            <div className="text-white/80">Send to:</div>
            <div className="mt-1 rounded-md bg-black/30 px-2 py-1.5 font-mono text-[10px] text-[var(--accent)] break-all">
              5fh2K8...xP3q8Qz1
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/50">
              <span className="live-dot" />
              Watching on-chain
            </div>
          </BotMsg>

          <BotMsg highlight>
            <div className="flex items-center gap-1.5 font-semibold text-[var(--accent)]">
              <span>✓</span> Deposit confirmed
            </div>
            <div className="mt-1 text-white/80">
              <span className="font-mono text-white">3.25 SOL</span> sent to your wallet
            </div>
            <div className="mt-1 text-[10px] text-white/50">
              8.2s · sig 4k2p...9mNz
            </div>
          </BotMsg>
        </div>
      </div>
    </div>
  );
}

function BotMsg({
  children,
  highlight = false,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`max-w-[78%] rounded-2xl rounded-bl-md px-3 py-2 ${
        highlight ? "bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30" : "bg-[#182533]"
      }`}
    >
      {children}
    </div>
  );
}

function UserMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-[#2b5278] px-3 py-2 text-white">
      {children}
    </div>
  );
}
