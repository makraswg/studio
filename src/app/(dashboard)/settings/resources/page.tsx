"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Archive, 
  RotateCcw,
  Settings2,
  Layers,
  Server,
  Workflow,
  Filter
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
import { AssetTypeOption, OperatingModelOption } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ResourceOptionsPage() {
  const { dataSource } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  
  // Asset Type State
  const [newTypeName, setNewTypeName] = useState('');
  
  // Operating Model State
  const [newModelName, setNewModelName] = useState('');

  const { data: assetTypes, refresh: refreshTypes, isLoading: typesLoading } = usePluggableCollection<AssetTypeOption>('assetTypeOptions');
  const { data: operatingModels, refresh: refreshModels, isLoading: modelsLoading } = usePluggableCollection<OperatingModelOption>('operatingModelOptions');

  const handleAddType = async () => {
    if (!newTypeName) return;
    setIsSaving(true);
    const id = `at-${Math.random().toString(36).substring(2, 7)}`;
    const data: AssetTypeOption = { id, name: newTypeName, enabled: true };
    try {
      const res = await saveCollectionRecord('assetTypeOptions', id, data, dataSource);
      if (res.success) {
        setNewTypeName('');
        refreshTypes();
        toast({ title: "Asset Typ hinzugefügt" });
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.error });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddModel = async () => {
    if (!newModelName) return;
    setIsSaving(true);
    const id = `om-${Math.random().toString(36).substring(2, 7)}`;
    const data: OperatingModelOption = { id, name: newModelName, enabled: true };
    try {
      const res = await saveCollectionRecord('operatingModelOptions', id, data, dataSource);
      if (res.success) {
        setNewModelName('');
        refreshModels();
        toast({ title: "Betriebsmodell hinzugefügt" });
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.error });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEnabled = async (coll: string, item: any) => {
    const updated = { ...item, enabled: !item.enabled };
    const res = await saveCollectionRecord(coll, item.id, updated, dataSource);
    if (res.success) {
      if (coll === 'assetTypeOptions') refreshTypes();
      else refreshModels();
      toast({ title: "Status aktualisiert" });
    }
  };

  const handleDelete = async (coll: string, id: string) => {
    if (!confirm("Eintrag permanent entfernen?")) return;
    try {
      const res = await deleteCollectionRecord(coll, id, dataSource);
      if (res.success) {
        toast({ title: "Eintrag gelöscht" });
        if (coll === 'assetTypeOptions') refreshTypes();
        else refreshModels();
      } else {
        toast({ variant: "destructive", title: "Löschen fehlgeschlagen", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Systemfehler", description: e.message });
    }
  };

  return (
    <div className="space-y-10">
      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
              <Settings2 className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Ressourcen-Optionen</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Konfiguration von System-Typen und Bereitstellungsmodellen</p>
            </div>
          </div>
        </CardHeader>
        
        <Tabs defaultValue="types">
          <TabsList className="bg-white border-b h-12 w-full justify-start rounded-none px-8 gap-8">
            <TabsTrigger value="types" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 text-[10px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-primary">Asset Typen</TabsTrigger>
            <TabsTrigger value="models" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent h-full px-0 text-[10px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-indigo-600">Betriebsmodelle</TabsTrigger>
          </TabsList>

          <CardContent className="p-8 space-y-10">
            <TabsContent value="types" className="m-0 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Neuer Typ</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Bezeichnung</Label>
                      <Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="z.B. Cloud-App, Hardware-Server..." className="h-11 rounded-lg" />
                    </div>
                    <Button onClick={handleAddType} disabled={isSaving || !newTypeName} className="w-full h-11 rounded-lg font-black uppercase text-[10px] tracking-widest gap-2 bg-primary text-white shadow-lg">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Hinzufügen
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-6 border-l pl-8 border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Verfügbare Asset Typen</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {assetTypes?.map(opt => (
                      <div key={opt.id} className={cn("p-4 border rounded-xl flex items-center justify-between group transition-all", opt.enabled ? "bg-white" : "bg-slate-50 opacity-60")}>
                        <div className="flex items-center gap-4">
                          <Switch checked={!!opt.enabled} onCheckedChange={() => toggleEnabled('assetTypeOptions', opt)} />
                          <span className="text-sm font-bold">{opt.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={() => handleDelete('assetTypeOptions', opt.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                    {(!assetTypes || assetTypes.length === 0) && !typesLoading && (
                      <div className="py-10 text-center opacity-30 italic text-xs">Keine Typen definiert</div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="models" className="m-0 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Neues Modell</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Modell-Name</Label>
                      <Input value={newModelName} onChange={e => setNewModelName(e.target.value)} placeholder="z.B. Externer Host, SaaS Shared..." className="h-11 rounded-lg" />
                    </div>
                    <Button onClick={handleAddModel} disabled={isSaving || !newModelName} className="w-full h-11 rounded-lg font-black uppercase text-[10px] tracking-widest gap-2 bg-indigo-600 text-white shadow-lg">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Hinzufügen
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-6 border-l pl-8 border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Verfügbare Betriebsmodelle</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {operatingModels?.map(opt => (
                      <div key={opt.id} className={cn("p-4 border rounded-xl flex items-center justify-between group transition-all", opt.enabled ? "bg-white" : "bg-slate-50 opacity-60")}>
                        <div className="flex items-center gap-4">
                          <Switch checked={!!opt.enabled} onCheckedChange={() => toggleEnabled('operatingModelOptions', opt)} />
                          <span className="text-sm font-bold">{opt.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={() => handleDelete('operatingModelOptions', opt.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                    {(!operatingModels || operatingModels.length === 0) && !modelsLoading && (
                      <div className="py-10 text-center opacity-30 italic text-xs">Keine Modelle definiert</div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
