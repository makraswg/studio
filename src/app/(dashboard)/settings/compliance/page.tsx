
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Shield, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Info,
  Archive,
  RotateCcw,
  Zap,
  ListFilter
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { RegulatoryOption, UsageTypeOption } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ComplianceSettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  
  // Reg State
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Usage State
  const [newUsageName, setNewUsageName] = useState('');
  const [newUsageDesc, setNewUsageDesc] = useState('');

  const { data: options, refresh: refreshRegs, isLoading: regLoading } = usePluggableCollection<RegulatoryOption>('regulatory_options');
  const { data: usageTypes, refresh: refreshUsage, isLoading: usageLoading } = usePluggableCollection<UsageTypeOption>('usage_type_options');

  const handleAddOption = async () => {
    if (!newName) return;
    setIsSaving(true);
    const id = `reg-${Math.random().toString(36).substring(2, 7)}`;
    const data: RegulatoryOption = {
      id,
      tenantId: activeTenantId === 'all' ? 'global' : activeTenantId,
      name: newName,
      description: newDesc,
      enabled: true
    };

    try {
      const res = await saveCollectionRecord('regulatory_options', id, data, dataSource);
      if (res.success) {
        setNewName('');
        setNewDesc('');
        refreshRegs();
        toast({ title: "Regulatorik hinzugefügt" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUsageType = async () => {
    if (!newUsageName) return;
    setIsSaving(true);
    const id = `usage-${Math.random().toString(36).substring(2, 7)}`;
    const data: UsageTypeOption = {
      id,
      name: newUsageName,
      description: newUsageDesc,
      enabled: true
    };

    try {
      const res = await saveCollectionRecord('usage_type_options', id, data, dataSource);
      if (res.success) {
        setNewUsageName('');
        setNewUsageDesc('');
        refreshUsage();
        toast({ title: "Nutzungstyp hinzugefügt" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEnabled = async (coll: string, item: any) => {
    const updated = { ...item, enabled: !item.enabled };
    await saveCollectionRecord(coll, item.id, updated, dataSource);
    if (coll === 'regulatory_options') refreshRegs();
    else refreshUsage();
  };

  const handleDelete = async (coll: string, id: string) => {
    if (!confirm("Eintrag wirklich entfernen?")) return;
    await deleteCollectionRecord(coll, id, dataSource);
    if (coll === 'regulatory_options') refreshRegs();
    else refreshUsage();
  };

  return (
    <div className="space-y-10">
      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Regulatorik & Prozess-Nutzung</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Zentrale Steuerung von Compliance-Standards und Merkmals-Kontexten</p>
            </div>
          </div>
        </CardHeader>
        
        <Tabs defaultValue="reg">
          <TabsList className="bg-white border-b h-12 w-full justify-start rounded-none px-8 gap-8">
            <TabsTrigger value="reg" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 text-[10px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-primary">Regelwerke</TabsTrigger>
            <TabsTrigger value="usage" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent h-full px-0 text-[10px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-indigo-600">Nutzungstypen</TabsTrigger>
          </TabsList>

          <CardContent className="p-8 space-y-10">
            <TabsContent value="reg" className="m-0 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Neuer Standard</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Kurzbezeichnung</Label>
                      <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. ISO 9001:2015" className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Beschreibung</Label>
                      <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Zweck..." className="min-h-[100px] rounded-lg" />
                    </div>
                    <Button onClick={handleAddOption} disabled={isSaving || !newName} className="w-full h-11 rounded-lg font-black uppercase text-[10px] tracking-widest gap-2 bg-primary text-white shadow-lg">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Hinzufügen
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-6 border-l pl-8 border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Aktive Regelwerke</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {options?.map(opt => (
                      <div key={opt.id} className={cn("p-4 border rounded-xl flex items-center justify-between group transition-all", opt.enabled ? "bg-white" : "bg-slate-50 opacity-60")}>
                        <div className="flex items-center gap-4">
                          <Switch checked={!!opt.enabled} onCheckedChange={() => toggleEnabled('regulatory_options', opt)} />
                          <div><p className="text-sm font-bold">{opt.name}</p><p className="text-[10px] text-slate-400 truncate max-w-md">{opt.description}</p></div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={() => handleDelete('regulatory_options', opt.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="usage" className="m-0 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Neuer Nutzungstyp</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Typ-Bezeichnung</Label>
                      <Input value={newUsageName} onChange={e => setNewUsageName(e.target.value)} placeholder="z.B. Schreibend, Berechnend..." className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Anwendungs-Beispiel</Label>
                      <Textarea value={newUsageDesc} onChange={e => setNewUsageDesc(e.target.value)} placeholder="Wann wird dieser Typ genutzt?..." className="min-h-[100px] rounded-lg" />
                    </div>
                    <Button onClick={handleAddUsageType} disabled={isSaving || !newUsageName} className="w-full h-11 rounded-lg font-black uppercase text-[10px] tracking-widest gap-2 bg-indigo-600 text-white shadow-lg">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Hinzufügen
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-6 border-l pl-8 border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Aktive Nutzungstypen</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {usageTypes?.map(u => (
                      <div key={u.id} className={cn("p-4 border rounded-xl flex items-center justify-between group transition-all", u.enabled ? "bg-white" : "bg-slate-50 opacity-60")}>
                        <div className="flex items-center gap-4">
                          <Switch checked={!!u.enabled} onCheckedChange={() => toggleEnabled('usage_type_options', u)} />
                          <div><p className="text-sm font-bold">{u.name}</p><p className="text-[10px] text-slate-400 truncate max-w-md">{u.description}</p></div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={() => handleDelete('usage_type_options', u.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
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
