
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
  const pathname = usePathname();

  const navItems = [
    { id: 'general', label: 'Organisation', icon: Building2, href: '/settings/general' },
    { id: 'structure', label: 'Struktur & Stellen', icon: Briefcase, href: '/settings/structure' },
    { id: 'ux', label: 'User Experience', icon: Sparkles, href: '/settings/ux' },
    { id: 'pusers', label: 'Administratoren', icon: Users, href: '/settings/pusers' },
    { id: 'sync', label: 'Identität & Sync', icon: Network, href: '/settings/sync' },
    { id: 'integrations', label: 'Jira Gateway', icon: RefreshCw, href: '/settings/integrations' },
    { id: 'bookstack', label: 'BookStack Export', icon: BookOpen, href: '/settings/bookstack' },
    { id: 'ai', label: 'KI Access Advisor', icon: BrainCircuit, href: '/settings/ai' },
    { id: 'dsgvo', label: 'Datenschutz', icon: FileCheck, href: '/settings/dsgvo' },
    { id: 'email', label: 'E-Mail (SMTP)', icon: Mail, href: '/settings/email' },
    { id: 'data', label: 'Katalog-Import', icon: FileCode, href: '/settings/data' },
  ];

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div>
          <Badge className="mb-2 rounded-full px-3 py-0 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border-none">Control Panel</Badge>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-slate-900 dark:text-white uppercase">Systemeinstellungen</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Konfiguration der Governance-Engine und Konzern-Infrastruktur.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 items-start">
        <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24">
          <div className="bg-white dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none p-3 overflow-hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.id} 
                    href={item.href}
                    className={cn(
                      "w-full flex items-center justify-between px-5 py-3.5 rounded-2xl transition-all group",
                      isActive 
                        ? "bg-primary text-white shadow-lg shadow-primary/20 ring-1 ring-primary/10" 
                        : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <item.icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400")} />
                      <span className="text-[11px] font-black uppercase tracking-wider">{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="mt-6 px-6 py-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800">
            <p className="text-[9px] font-black uppercase text-blue-600 tracking-[0.2em] mb-1">Support Info</p>
            <p className="text-[10px] text-slate-500 italic leading-relaxed">
              Änderungen an der Infrastruktur wirken sich auf alle Mandanten der Plattform aus.
            </p>
          </div>
        </aside>

        <main className="flex-1 min-w-0 w-full animate-in slide-in-from-right-4 duration-500">
          {children}
        </main>
      </div>
    </div>
  );
}
