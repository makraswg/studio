
"use client";

import { useState, useMemo } from 'react';
import { 
  Library, 
  Search, 
  Plus, 
  Loader2, 
  Database,
  FileJson,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Hazard, HazardModule, Catalog } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function CatalogBrowserPage() {
  const router = useRouter();
  const { dataSource } = useSettings();
  const [search, setSearch] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');

  const { data: catalogs } = usePluggableCollection<Catalog>('catalogs');
  const { data: modules } = usePluggableCollection<HazardModule>('hazardModules');
  const { data: hazards, isLoading: isHazardsLoading } = usePluggableCollection<Hazard>('hazards');

  const filteredHazards = useMemo(() => {
    if (!hazards) return [];
    return hazards.filter(h => {
      const matchesSearch = h.title.toLowerCase().includes(search.toLowerCase()) || h.code.toLowerCase().includes(search.toLowerCase());
      const matchesModule = selectedModuleId === 'all' || h.moduleId === selectedModuleId;
      return matchesSearch && matchesModule;
    });
  }, [hazards, search, selectedModuleId]);

  const currentModules = useMemo(() => {
    if (!modules) return [];
    if (selectedCatalogId === 'all') return modules;
    return modules.filter(m => m.catalogId === selectedCatalogId);
  }, [modules, selectedCatalogId]);

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-600 flex items-center justify-center border-2 border-blue-500/20">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Gefährdungskatalog</h1>
            <p className="text-sm text-muted-foreground mt-1">Strukturierte Basis für die Risiko-Ableitung nach BSI IT-Grundschutz.</p>
          </div>
        </div>
        <Button variant="outline" className="h-10 font-bold uppercase text-[10px] rounded-none border-primary/20" onClick={() => router.push('/settings?tab=data')}>
          <Database className="w-4 h-4 mr-2" /> Kataloge Verwalten
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Gefährdung suchen (z.B. Malware, Brand, Backup)..." 
            className="pl-10 h-11 border-2 bg-white dark:bg-slate-950 rounded-none shadow-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border bg-card h-11 p-1 gap-1">
          <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
            <SelectTrigger className="border-none shadow-none h-full rounded-none bg-transparent min-w-[180px] text-[10px] font-bold uppercase border-r">
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all">Alle Kataloge</SelectItem>
              {catalogs?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.version}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
            <SelectTrigger className="border-none shadow-none h-full rounded-none bg-transparent min-w-[180px] text-[10px] font-bold uppercase">
              <SelectValue placeholder="Modul" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all">Alle Module</SelectItem>
              {currentModules.map(m => <SelectItem key={m.id} value={m.id}>{m.code}: {m.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        {isHazardsLoading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lade Gefährdungen...</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {filteredHazards.map(h => {
              const mod = modules?.find(m => m.id === h.moduleId);
              return (
                <AccordionItem key={h.id} value={h.id} className="border-b last:border-0 px-4">
                  <AccordionTrigger className="hover:no-underline py-4 group">
                    <div className="flex items-center gap-4 text-left w-full">
                      <Badge className="bg-blue-600 text-white rounded-none text-[10px] font-black h-5 px-2 shrink-0">{h.code}</Badge>
                      <span className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate group-hover:text-primary transition-colors">
                        {h.title}
                      </span>
                      <div className="hidden sm:flex items-center gap-2 ml-auto mr-4 shrink-0">
                        <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5">Modul: {mod?.code || '---'}</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pt-2 px-1">
                    <div className="space-y-6">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-none">
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Beschreibung der Gefährdung</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {h.description}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground">
                          <span>Quell-Modul:</span>
                          <span className="text-slate-900 dark:text-white">{mod?.title}</span>
                        </div>
                        <Button 
                          className="bg-orange-600 hover:bg-orange-700 text-white rounded-none text-[10px] font-black uppercase h-10 px-8 gap-2 shadow-md transition-all active:scale-95"
                          onClick={() => router.push(`/risks?derive=${h.id}`)}
                        >
                          <Plus className="w-4 h-4" /> Als Risiko ableiten
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
            {filteredHazards.length === 0 && (
              <div className="py-40 text-center space-y-4">
                <FileJson className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                <p className="text-sm font-bold uppercase text-muted-foreground tracking-widest">Keine Ergebnisse für diese Auswahl.</p>
              </div>
            )}
          </Accordion>
        )}
      </div>
    </div>
  );
}
