"use client";

import React from "react";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
}

export default function MapControls({ onZoomIn, onZoomOut, onFitAll }: MapControlsProps) {
  const buttonClass =
    "w-10 h-10 flex items-center justify-center rounded-none bg-gray-900/90 border-2 border-gray-600 text-[#F5E6D0] hover:bg-gray-800 hover:border-amber-700 hover:text-amber-200 transition-colors font-mono text-lg font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,0.6)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] cursor-pointer select-none";

  return (
    <div className="absolute bottom-28 right-4 flex flex-col gap-0 z-10">
      <div className="bg-gray-900/90 border-2 border-gray-600 p-1 flex flex-col gap-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.6)]">
        <button className={buttonClass} onClick={onZoomIn} title="Zoom in">
          +
        </button>
        <button className={buttonClass} onClick={onZoomOut} title="Zoom out">
          -
        </button>
        <div className="h-px bg-gray-600 mx-0.5" />
        <button
          className={buttonClass}
          onClick={onFitAll}
          title="Fit all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
