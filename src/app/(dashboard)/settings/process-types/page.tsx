"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Workflow,
  Archive, 
  RotateCcw,
  Search,
  Settings2,
  Info
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export const dynamic = 'force-dynamic';

export default function ProcessTypesSettingsPage() {
  const { dataSource } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data: types, refresh, isLoading } = usePluggableCollection<ProcessType>('processTypes');

  const handleAddType = async () => {
    if (!newName) return;
    setIsSaving(true);
    const id = `pt-${Math.random().toString(36).substring(2, 7)}`;
    const data: ProcessType = {
      id,
      name: newName,
      description: newDesc,
      enabled: true
    };

    try {
      const res = await saveCollectionRecord('processTypes', id, data, dataSource);
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
    await saveCollectionRecord('processTypes', item.id, updated, dataSource);
    refresh();
    toast({ title: "Status aktualisiert" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Prozesstyp permanent löschen?")) return;
    await deleteCollectionRecord('processTypes', id, dataSource);
    refresh();
    toast({ title: "Eintrag entfernt" });
  };

  const filteredTypes = useMemo(() => {
    if (!types) return [];
    return types.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  }, [types, search]);

  return (
    <div className="space-y-10">
      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 dark:border-blue-900/30 shadow-sm">
              <Workflow className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Prozess-Kategorisierung</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Definition der Prozesstypen für den WorkflowHub</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
              <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Neuer Prozesstyp</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label required className="text-[10px] font-black uppercase text-slate-400 ml-1">Bezeichnung</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Managementprozess..." className="h-11 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Beschreibung</Label>
                  <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Verwendung..." className="min-h-[100px] rounded-lg" />
                </div>
                <Button onClick={handleAddType} disabled={isSaving || !newName} className="w-full h-11 rounded-lg font-black uppercase text-[10px] tracking-widest gap-2 bg-primary text-white shadow-lg">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Hinzufügen
                </Button>
              </div>
            </div>

            <div className="md:col-span-2 space-y-6 border-l pl-8 border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest">Verfügbare Typen</h3>
                <div className="relative group">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 group-focus-within:text-primary" />
                  <Input placeholder="Filtern..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-[10px] w-40 rounded-md" />
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary opacity-20" /></div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="grid grid-cols-1 gap-2">
                    {filteredTypes.map(t => (
                      <div key={t.id} className={cn("p-4 border rounded-xl flex items-center justify-between group transition-all", t.enabled ? "bg-white dark:bg-slate-950" : "bg-slate-50 opacity-60")}>
                        <div className="flex items-center gap-4">
                          <Switch checked={!!t.enabled} onCheckedChange={() => toggleEnabled(t)} />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.name}</p>
                            <p className="text-[10px] text-slate-400 italic truncate max-w-sm">{t.description || 'Keine Beschreibung'}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
