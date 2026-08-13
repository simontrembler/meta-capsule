import React from 'react';

interface IngestOverlayProps {
  progress: number;
  statusText: string;
  title: string;
  hint: string;
}

/** Non-blocking shell overlay while a second archive is imported */
export const IngestOverlay: React.FC<IngestOverlayProps> = ({
  progress,
  statusText,
  title,
  hint
}) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/45 px-4">
      <div className="w-full max-w-md bg-white border border-ink-200 rounded-md shadow-lg p-6">
        <p className="font-display text-xl font-semibold text-ink-950 tracking-[-0.02em]">{title}</p>
        <p className="mt-1 text-sm text-ink-500">{hint}</p>

        <div className="mt-6 flex items-end justify-between gap-3">
          <p className="text-sm text-ink-600 min-w-0 truncate">{statusText}</p>
          <span className="font-display text-2xl font-semibold text-ink-950 shrink-0">{progress}%</span>
        </div>
        <div className="mt-3 h-1.5 w-full bg-ink-100 overflow-hidden rounded-full">
          <div
            className="h-full bg-brand-600 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
