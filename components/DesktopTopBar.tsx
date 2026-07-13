import React from 'react';
import { IconSparkles } from './Icons';

export const DesktopTopBar: React.FC = () => (
  <header className="hidden h-[66px] shrink-0 items-center justify-between border-b border-white/[0.09] bg-[#0b0c10] px-6 text-white lg:flex">
    <a href="/" className="flex items-center gap-3" aria-label="LiveGo landing page">
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-blue-500 shadow-[0_0_24px_rgba(67,83,255,.35)]">
        <IconSparkles className="h-5 w-5" />
      </span>
      <span className="text-[17px] font-bold tracking-tight">LIVEGO</span>
    </a>
    <div className="flex items-center gap-7 text-zinc-500" aria-hidden="true">
      <span className="h-px w-4 bg-current" />
      <span className="h-3.5 w-3.5 rounded-[2px] border border-current" />
      <span className="relative h-4 w-4 before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:-rotate-45 before:bg-current after:absolute after:left-1/2 after:top-0 after:h-full after:w-px after:rotate-45 after:bg-current" />
    </div>
  </header>
);

export default DesktopTopBar;
