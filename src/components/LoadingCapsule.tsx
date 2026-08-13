import React from 'react';

type LoadingCapsuleProps = {
  progress: number;
};

export const LoadingCapsule: React.FC<LoadingCapsuleProps> = ({ progress }) => {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div className="relative flex h-56 w-40 items-center justify-center">
      {/* Elliptical rings — rotation reads as orbit because shells are taller than wide */}
      <div
        className="pointer-events-none absolute -inset-3 capsule-shell border border-brand-400/50 animate-capsule-orbit"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -inset-1 capsule-shell border border-dashed border-ink-300/70 animate-capsule-orbit-rev"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[6%] capsule-shell border border-brand-500/40 animate-capsule-orbit [animation-duration:5.5s]"
        aria-hidden
      />
      <div className="capsule-shell relative z-10 flex h-full w-full items-center justify-center border border-ink-300 bg-ink-50/80">
        <div
          className="pointer-events-none absolute inset-[14%] capsule-shell border border-ink-200/50"
          aria-hidden
        />
        <span className="font-display text-3xl font-semibold text-ink-950">
          {Math.round(clamped)}%
        </span>
      </div>
    </div>
  );
};
