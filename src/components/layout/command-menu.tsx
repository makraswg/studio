
"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Users, 
  Layers, 
  Workflow, 
  AlertTriangle, 
  ChevronRight,
  ArrowRight,
  UserCircle,
  FileText,
  Clock,
  BrainCircuit,
  Building2
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { cn } from '@/lib/utils';

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const { data: users } = usePluggableCollection<any>('users');
  const { data: resources } = usePluggableCollection<any>('resources');
  const { data: processes } = usePluggableCollection<any>('processes');
  const { data: risks } = usePluggableCollection<any>('risks');

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const results = useMemo(() => {
    if (!search || search.length < 2) return null;
    const s = search.toLowerCase();

    return {
      users: users?.filter((u: any) => u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)).slice(0, 5),
      resources: resources?.filter((r: any) => r.name?.toLowerCase().includes(s)).slice(0, 5),
      processes: processes?.filter((p: any) => p.title?.toLowerCase().includes(s)).slice(0, 5),
      risks: risks?.filter((r: any) => r.title?.toLowerCase().includes(s)).slice(0, 5)
    };
  }, [search, users, resources, processes, risks]);

  const handleSelect = (href: string) => {
    setOpen(false);
    setSearch('');
    router.push(href);
  };

  const ResultItem = ({ icon: Icon, title, sub, href, color = "text-primary", bg = "bg-primary/10" }: any) => (
    <div 
      className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group active:scale-[0.98]"
      onClick={() => handleSelect(href)}
    >
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-3", bg, color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{title}</p>
          <p className="text-[10px] font-bold text-slate-400 truncate">{sub}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-950 top-[20%] translate-y-0">
        <DialogHeader className="p-6 bg-slate-100 dark:bg-slate-900 shrink-0 border-b">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Search className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-lg font-headline font-bold text-slate-900 dark:text-white">ComplianceHub Schnellsuche</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <Input 
            placeholder="Name, Ressource oder Prozess suchen... (Cmd+K)" 
            className="h-14 bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-base font-medium focus:border-primary shadow-inner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <ScrollArea className="h-[450px]">
          <div className="p-4 pb-10 space-y-8">
            {!search && (
              <div className="py-20 text-center space-y-4 opacity-30">
                <BrainCircuit className="w-12 h-12 mx-auto" />
                <p className="text-[10px] font-bold">Tippen Sie zum Suchen</p>
              </div>
            )}

            {results && (
              <>
                {results.users?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="px-4 text-[10px] font-bold text-slate-400 flex items-center gap-2">
                      <Users className="w-3 h-3" /> Identitäten
                    </h4>
                    {results.users.map((u: any) => (
                      <ResultItem key={u.id} icon={UserCircle} title={u.displayName} sub={u.email} href={`/users?search=${u.displayName}`} color="text-blue-500" bg="bg-blue-50" />
                    ))}
                  </div>
                )}

                {results.processes?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="px-4 text-[10px] font-bold text-slate-400 flex items-center gap-2">
                      <Workflow className="w-3 h-3" /> Prozesse
                    </h4>
                    {results.processes.map((p: any) => (
                      <ResultItem key={p.id} icon={Workflow} title={p.title} sub={`V${p.currentVersion}.0 • ${p.status}`} href={`/processhub/${p.id}`} color="text-primary" bg="bg-primary/5" />
                    ))}
                  </div>
                )}

                {results.resources?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="px-4 text-[10px] font-bold text-slate-400 flex items-center gap-2">
                      <Layers className="w-3 h-3" /> Ressourcen
                    </h4>
                    {results.resources.map((r: any) => (
                      <ResultItem key={r.id} icon={Layers} title={r.name} sub={`${r.assetType} • ${r.category}`} href={`/resources?search=${r.name}`} color="text-indigo-500" bg="bg-indigo-50" />
                    ))}
                  </div>
                )}

                {results.risks?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="px-4 text-[10px] font-bold text-slate-400 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" /> Risiken
                    </h4>
                    {results.risks.map((r: any) => (
                      <ResultItem key={r.id} icon={AlertTriangle} title={r.title} sub={`Score: ${r.impact * r.probability} • ${r.category}`} href={`/risks?search=${r.title}`} color="text-accent" bg="bg-accent/10" />
                    ))}
                  </div>
                )}

                {Object.values(results).every(arr => arr.length === 0) && (
                  <div className="py-20 text-center space-y-4 opacity-30">
                    <Search className="w-12 h-12 mx-auto" />
                    <p className="text-[10px] font-bold">Keine Treffer gefunden</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
            <div className="flex items-center gap-1.5"><Badge className="h-5 px-1 bg-slate-200 text-slate-600 border-none">Enter</Badge> Auswählen</div>
            <div className="flex items-center gap-1.5"><Badge className="h-5 px-1 bg-slate-200 text-slate-600 border-none">Esc</Badge> Schließen</div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-primary italic">
            Governance Intelligence Active <BrainCircuit className="w-3 h-3 fill-current" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
