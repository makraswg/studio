"use client";

import { cn } from '@/lib/utils';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700 max-w-[1600px] mx-auto p-4 md:p-8">
      <div className="animate-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </div>
  );
}
