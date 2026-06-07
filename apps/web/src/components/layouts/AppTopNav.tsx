'use client';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function AppTopNav({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header className="md:hidden bg-surface/80 dark:bg-surface/80 backdrop-blur-xl docked full-width top-0 sticky z-50 border-b border-outline-variant/30 shadow-sm flex justify-between items-center px-gutter w-full h-16">
      <div className="flex items-center gap-sm">
        <span onClick={onMenuOpen} className="material-symbols-outlined cursor-pointer active:scale-95 transition-transform text-on-surface-variant font-medium hover:bg-secondary-container/50 duration-200 p-2 rounded-full">menu</span>
        <span className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-primary-fixed-dim">NexGen EMS</span>
      </div>
      <div className="flex items-center gap-xs">
        <span className="material-symbols-outlined cursor-pointer active:scale-95 transition-transform text-on-surface-variant font-medium hover:bg-secondary-container/50 duration-200 p-2 rounded-full">search</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
