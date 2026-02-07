"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2,
  Users,
  Network,
  RefreshCw,
  BrainCircuit,
  FileCheck,
  Mail,
  FileCode,
  Briefcase,
  Settings as SettingsIcon,
  ChevronRight,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div>
          <Badge className="mb-2 rounded-full px-3 py-0 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border-none">System Control</Badge>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-900 dark:text-white uppercase">Konfiguration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Verwalten Sie die technische Infrastruktur und Governance-Regeln.</p>
        </div>
      </div>

      <div className="animate-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </div>
  );
}