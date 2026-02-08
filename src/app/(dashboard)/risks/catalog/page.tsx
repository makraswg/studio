
"use client";

import { useState, useMemo, useEffect } from 'react';
import { 
  Library, 
  Search, 
  Plus, 
  Loader2, 
  Database,
  FileJson,
  ChevronDown,
  Info,
  Filter
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
import { cn } from '@/lib/utils';

export default function CatalogBrowserPage() {
  const router = useRouter();
  const { dataSource } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');

  const { data: catalogs } = usePluggableCollection<Catalog>('catalogs');
  const { data: modules } = usePluggableCollection<HazardModule>('hazardModules');
  const { data: hazards, isLoading: isHazardsLoading } = usePluggableCollection<Hazard>('hazards');

  useEffect(() => { setMounted(true); }, []);

  const filteredHazards = useMemo(() => {
    if (!hazards) return [];
    const filtered = hazards.filter(h => {
      const matchesSearch = h.title.toLowerCase().includes(search.toLowerCase()) || h.code.toLowerCase().includes(search.toLowerCase());
      const matchesModule = selectedModuleId === 'all' || h.moduleId === selectedModuleId;
      return matchesSearch && matchesModule;
    });

    return [...filtered].sort((a, b) => {
      const regex = /G\s+(\d+)\.(\d+)/i;
      const matchA = a.code.match(regex);
      const matchB = b.code.match(regex);

      if (matchA && matchB) {
        const majorA = parseInt(matchA[1], 10);
        const minorA = parseInt(matchA[2], 10);
        const majorB = parseInt(matchB[1], 10);
        const minorB = parseInt(matchB[2], 10);

        if (majorA !== majorB) return majorA - majorB;
        return minorA - minorB;
      }
      return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [hazards, search, selectedModuleId]);

  const currentModules = useMemo(() => {
    if (!modules) return [];
    if (selectedCatalogId === 'all') return modules;
    return modules.filter(m => m.catalogId === selectedCatalogId);
  }, [modules, selectedCatalogId]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-600 flex items-center justify-center rounded-xl border border-blue-500/10 shadow-sm transition-transform hover:scale-105">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-blue-100 text-blue-700 text-[9px] font-bold border-none uppercase tracking-wider">RiskHub Intelligence</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Gefährdungskatalog</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Basis für die Risiko-Ableitung nach BSI IT-Grundschutz.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isHazardsLoading && hazards && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Aktualisiere...
            </div>
          )}
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs border-slate-200 hover:bg-slate-50 transition-all active:scale-95" onClick={() => router.push('/settings/data')}>
            <Database className="w-3.5 h-3.5 mr-2" /> Kataloge verwalten
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          <Input 
            placeholder="Gefährdung oder Code suchen..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
            <SelectTrigger className="border-none shadow-none h-full rounded-sm bg-transparent text-[10px] font-bold min-w-[140px] hover:bg-white/50 transition-all">
              <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Katalog" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Alle Kataloge</SelectItem>
              {catalogs?.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 my-auto mx-1" />
          <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
            <SelectTrigger className="border-none shadow-none h-full rounded-sm bg-transparent text-[10px] font-bold min-w-[140px] hover:bg-white/50 transition-all">
              <SelectValue placeholder="Alle Module" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Alle Module</SelectItem>
              {currentModules.map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.code}: {m.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden min-h-[400px]">
        {(isHazardsLoading && !hazards) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 opacity-20" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lade Katalog-Daten...</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {filteredHazards.map(h => {
              const mod = modules?.find(m => m.id === h.moduleId);
              return (
                <AccordionItem key={h.id} value={h.id} className="border-b last:border-0 px-4 group">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-4 text-left w-full">
                      <Badge className="bg-blue-600 text-white rounded-md text-[10px] font-black h-5 px-2 shrink-0 shadow-sm">{h.code}</Badge>
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200 leading-tight truncate group-hover:text-blue-600 transition-colors">
                        {h.title}
                      </span>
                      <div className="hidden sm:flex items-center gap-2 ml-auto mr-4 shrink-0">
                        <Badge variant="outline" className="text-[8px] font-bold uppercase text-slate-400 border-slate-100 bg-slate-50 h-4 px-1.5">MOD: {mod?.code || '---'}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pt-2">
                    <div className="space-y-6">
                      <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl relative overflow-hidden group/card shadow-inner">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 opacity-50" />
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Gefährdungsanalyse</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium pl-2 italic">
                          {h.description}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          <Info className="w-3.5 h-3.5 text-blue-400" />
                          <span>Quelle: {mod?.title}</span>
                        </div>
                        <Button 
                          className="bg-accent hover:bg-accent/90 text-white rounded-xl text-[10px] font-black uppercase h-10 px-8 gap-2 shadow-lg shadow-accent/20 transition-all active:scale-95"
                          onClick={() => router.push(`/risks?derive=${h.id}`)}
                        >
                          <Plus className="w-4 h-4" /> Risiko ableiten
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
            {filteredHazards.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-dashed border-slate-200 opacity-50">
                  <FileJson className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Keine Übereinstimmungen gefunden.</p>
              </div>
            )}
          </Accordion>
        )}
      </div>
    </div>
  );
}
