
"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Workflow, 
  Search,
  AlertTriangle,
  Info,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export const dynamic = 'force-dynamic';

const SYSTEM_TYPE_IDS = ['pt-corp', 'pt-backup', 'pt-update', 'pt-disaster'];

export default function ProcessTypesPage() {
  const { dataSource } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data: pTypes, refresh, isLoading } = usePluggableCollection<ProcessType>('process_types');

  useEffect(() => { setMounted(true); }, []);

  const handleAddType = async () => {
    if (!newName) return;
    setIsSaving(true);
    const id = `pt-${Math.random().toString(36).substring(2, 7)}`;
    const data: ProcessType = { 
      id, 
      name: newName, 
      description: newDesc, 
      enabled: true,
      createdAt: new Date().toISOString()
    };
    try {
      const res = await saveCollectionRecord('process_types', id, data, dataSource);
      if (res.success) {
        setNewName('');
        setNewDesc('');
        refresh();
        toast({ title: "Prozesstyp hinzugefügt" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEnabled = async (item: ProcessType) => {
    const updated = { ...item, enabled: !item.enabled };
    await saveCollectionRecord('process_types', item.id, updated, dataSource);
    refresh();
  };

  const filteredTypes = useMemo(() => {
    if (!pTypes) return [];
    return pTypes.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  }, [pTypes, search]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none uppercase tracking-widest">WorkflowHub Config</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Prozesstypen</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Strukturierung des Prozess-Registers durch Funktions-Kategorien.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <Card className="rounded-xl border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-400">Neuer Typ</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Bezeichnung</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Compliance-Check" className="h-11 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Beschreibung</Label>
                <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="min-h-[80px] rounded-lg" />
              </div>
              <Button onClick={handleAddType} disabled={isSaving || !newName} className="w-full h-11 rounded-lg font-black uppercase text-[10px] tracking-widest gap-2 bg-primary text-white shadow-lg shadow-primary/20">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Hinzufügen
              </Button>
            </CardContent>
          </Card>

          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 shadow-sm">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-amber-900 uppercase tracking-tight">System-Integrität</p>
              <p className="text-[9px] text-amber-700 leading-relaxed italic">
                System-Typen sind für die korrekte Funktion des Ressourcen-Katalogs und der Governance-Monitore (Backup/Patching) zwingend erforderlich und können nicht gelöscht werden.
              </p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="relative group max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input placeholder="Typen filtern..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-lg border-slate-200 bg-white shadow-sm" />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Kategorie</TableHead>
                  <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Beschreibung</TableHead>
                  <TableHead className="font-bold text-[11px] text-slate-400 text-right uppercase tracking-widest">Status / Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3} className="h-32 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary opacity-20" /></TableCell></TableRow>
                ) : filteredTypes.map(t => {
                  const isSystem = SYSTEM_TYPE_IDS.includes(t.id);
                  return (
                    <TableRow key={t.id} className="group border-b last:border-0">
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{t.name}</span>
                          {isSystem && (
                            <Badge className="bg-indigo-50 text-indigo-600 border-none text-[7px] font-black h-3.5 uppercase tracking-widest">System</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-500 italic max-w-xs truncate">{t.description || '---'}</TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex items-center justify-end gap-4">
                          <Switch checked={!!t.enabled} onCheckedChange={() => toggleEnabled(t)} />
                          {isSystem ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-8 h-8 flex items-center justify-center text-slate-200 cursor-not-allowed">
                                    <Lock className="w-3.5 h-3.5" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-[9px] font-black uppercase bg-slate-900 text-white border-none shadow-xl">System-Typ geschützt</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all" onClick={() => { if(confirm("Typ permanent löschen?")) deleteCollectionRecord('process_types', t.id, dataSource).then(() => refresh()); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
