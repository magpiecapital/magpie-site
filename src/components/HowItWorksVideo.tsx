"use client";

/**
 * HowItWorksVideo — the homepage walkthrough as a true <video>.
 *
 * The footage is a filmed session of the REAL site (production dashboard
 * rendering demo data through the actual components) with neural narration,
 * an ambient bed, and burned captions — plus a toggleable <track> for
 * platform-native captions. Custom control bar: play/pause, scrub, time,
 * volume slider, mute, captions, fullscreen (operator: "audio options on
 * the site — play, turn down volume, mute, etc.").
 */

import { useCallback, useEffect, useRef, useState } from "react";

const SRC = "/media/how-it-works.mp4";
const POSTER = "/media/how-it-works-poster.jpg";
const CAPTIONS_VTT = "/media/how-it-works.vtt";

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function HowItWorksVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false); // burned-in by default; track = double captions

  const v = () => videoRef.current;

  useEffect(() => {
    const el = v();
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted]);

  // keep the text track in the chosen mode (browsers love resetting it)
  useEffect(() => {
    const el = v();
    if (!el) return;
    const apply = () => {
      const tr = el.textTracks?.[0];
      if (tr) tr.mode = captionsOn ? "showing" : "hidden";
    };
    apply();
    el.textTracks?.addEventListener?.("change", apply);
    return () => el.textTracks?.removeEventListener?.("change", apply);
  }, [captionsOn]);

  const toggle = useCallback(() => {
    const el = v();
    if (!el) return;
    setStarted(true);
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  const seekFromPointer = (clientX: number) => {
    const el = v();
    const bar = barRef.current;
    if (!el || !bar || !dur) return;
    const rect = bar.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    el.currentTime = p * dur;
    setStarted(true);
  };

  const progress = dur ? t / dur : 0;

  return (
    <div
      className="group relative w-full overflow-hidden rounded-3xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] shadow-lg"
      role="region"
      aria-label="How Magpie works — video walkthrough with narration and captions"
    >
      <div className="relative aspect-video bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions are burned in; the vtt track is the optional extra layer */}
        <video
          ref={videoRef}
          className="h-full w-full"
          src={SRC}
          poster={POSTER}
          preload="metadata"
          playsInline
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onEnded={() => setPlaying(false)}
        >
          <track kind="captions" srcLang="en" label="English" src={CAPTIONS_VTT} />
        </video>

        {!started && (
          <button
            onClick={toggle}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[color-mix(in_srgb,black_25%,transparent)]"
            aria-label="Play the walkthrough video"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-2xl text-[var(--accent-ink)] shadow-lg transition-transform group-hover:scale-105">
              ▶
            </span>
            <span className="rounded-full bg-[color-mix(in_srgb,black_55%,transparent)] px-3 py-1 text-sm font-semibold text-white">
              Watch how Magpie works — 60 seconds, narrated
            </span>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2.5 border-t border-[var(--hairline)] px-3 py-2.5 sm:gap-3 sm:px-4">
        <button
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm text-[var(--accent-ink)]"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        <div
          ref={barRef}
          className="relative h-6 min-w-0 flex-1 cursor-pointer"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            seekFromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) seekFromPointer(e.clientX);
          }}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          onKeyDown={(e) => {
            const el = v();
            if (!el) return;
            if (e.key === "ArrowRight") el.currentTime = Math.min(dur, el.currentTime + 5);
            if (e.key === "ArrowLeft") el.currentTime = Math.max(0, el.currentTime - 5);
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              toggle();
            }
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--hairline)]">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        <span className="hidden shrink-0 text-[11px] tabular-nums text-[var(--ink-faint)] sm:block">
          {fmt(t)} / {fmt(dur)}
        </span>

        {/* Audio controls */}
        <button
          onClick={() => setMuted((m) => !m)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-sm"
          aria-label={muted ? "Unmute" : "Mute"}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => {
            const val = Number(e.target.value);
            setVolume(val);
            setMuted(val === 0);
          }}
          className="hidden w-20 accent-[var(--accent)] sm:block"
          aria-label="Volume"
        />

        <button
          onClick={() => setCaptionsOn((c) => !c)}
          className={`hidden h-8 shrink-0 items-center rounded-full border px-2 text-[11px] font-semibold sm:flex ${
            captionsOn
              ? "border-[var(--accent-deep)] bg-[var(--accent-dim)] text-[var(--ink)]"
              : "border-[var(--hairline)] text-[var(--ink-soft)]"
          }`}
          aria-pressed={captionsOn}
          aria-label="Toggle extra captions track"
          title="Captions are burned into the video; this toggles the additional selectable track"
        >
          CC
        </button>

        <button
          onClick={() => v()?.requestFullscreen?.()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-sm"
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
