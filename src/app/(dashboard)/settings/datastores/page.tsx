"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  HardDrive, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Archive, 
  RotateCcw,
  Search,
  Database,
  Info,
  Briefcase
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { DataStore, JobTitle, Department } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DataStoresSettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [ownerRoleId, setOwnerRoleId] = useState('');

  const { data: dataStores, refresh, isLoading } = usePluggableCollection<DataStore>('dataStores');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');

  const sortedRoles = useMemo(() => {
    if (!jobTitles || !departments) return [];
    return [...jobTitles].sort((a, b) => {
      const deptA = departments.find(d => d.id === a.departmentId)?.name || '';
      const deptB = departments.find(d => d.id === b.departmentId)?.name || '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.name.localeCompare(b.name);
    });
  }, [jobTitles, departments]);

  const handleAddStore = async () => {
    if (!newName) return;
    setIsSaving(true);
    const id = `ds-${Math.random().toString(36).substring(2, 7)}`;
    const data: DataStore = {
      id,
      tenantId: activeTenantId === 'all' ? 'global' : activeTenantId,
      name: newName,
      description: newDesc,
      status: 'active',
      ownerRoleId: ownerRoleId || undefined
    };

    try {
      const res = await saveCollectionRecord('dataStores', id, data, dataSource);
      if (res.success) {
        setNewName('');
        setNewDesc('');
        setOwnerRoleId('');
        refresh();
        toast({ title: "Datenspeicher hinzugefügt" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (item: DataStore) => {
    const updated = { ...item, status: item.status === 'active' ? 'archived' : 'active' };
    await saveCollectionRecord('dataStores', item.id, updated, dataSource);
    refresh();
    toast({ title: "Status aktualisiert" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eintrag permanent löschen?")) return;
    await deleteCollectionRecord('dataStores', id, dataSource);
    refresh();
    toast({ title: "Eintrag entfernt" });
  };

  const filteredStores = useMemo(() => {
    if (!dataStores) return [];
    return dataStores.filter(ds => {
      const matchesStatus = showArchived ? ds.status === 'archived' : ds.status !== 'archived';
      const matchesSearch = ds.name.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [dataStores, search, showArchived]);

  const getFullRoleName = (roleId: string) => {
    const role = jobTitles?.find(j => j.id === roleId);
    if (!role) return roleId;
    const dept = departments?.find(d => d.id === role.departmentId);
    return dept ? `${dept.name} — ${role.name}` : role.name;
  };

  return (
    <div className="space-y-10">
      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
              <HardDrive className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Datenspeicher & Repositories</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Physische und logische Ablageorte für fachliche Daten</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
              <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest border-b pb-2">Neuer Datenspeicher</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label required className="text-[10px] font-black uppercase text-slate-400 ml-1">Bezeichnung</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. SAP HANA, Azure Blob..." className="h-11 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Verantwortliche Rolle</Label>
                  <Select value={ownerRoleId} onValueChange={setOwnerRoleId}>
                    <SelectTrigger className="h-11 rounded-lg">
                      <SelectValue placeholder="Rolle wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedRoles?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(j => (
                        <SelectItem key={j.id} value={j.id}>{getFullRoleName(j.id)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Beschreibung</Label>
                  <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Technische Details..." className="min-h-[100px] rounded-lg" />
                </div>
                <Button onClick={handleAddStore} disabled={isSaving || !newName} className="w-full h-11 rounded-lg font-black uppercase text-[10px] tracking-widest gap-2 bg-primary text-white shadow-lg">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Erfassen
                </Button>
              </div>
            </div>

            <div className="md:col-span-2 space-y-6 border-l pl-8 border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest">Verzeichnis</h3>
                <div className="flex items-center gap-2">
                  <div className="relative group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-[10px] w-40 rounded-md" />
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-[9px] font-bold gap-2" onClick={() => setShowArchived(!showArchived)}>
                    {showArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    {showArchived ? 'Aktiv' : 'Archiv'}
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary opacity-20" /></div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="grid grid-cols-1 gap-2">
                    {filteredStores.map(ds => {
                      const role = jobTitles?.find(j => j.id === ds.ownerRoleId);
                      return (
                        <div key={ds.id} className={cn("p-4 border rounded-xl flex items-center justify-between group transition-all", ds.status === 'active' ? "bg-white dark:bg-slate-950" : "bg-slate-50 opacity-60")}>
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                              <Database className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{ds.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {role && <Badge variant="outline" className="text-[8px] font-black uppercase h-4 px-1.5 gap-1"><Briefcase className="w-2 h-2" /> {getFullRoleName(role.id)}</Badge>}
                                <p className="text-[10px] text-slate-400 italic truncate max-w-sm">{ds.description || 'Keine Beschreibung'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => toggleStatus(ds)}>
                              {ds.status === 'active' ? <Archive className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => handleDelete(ds.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredStores.length === 0 && (
                      <div className="py-20 text-center opacity-30">
                        <HardDrive className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase">Keine Einträge gefunden</p>
                      </div>
                    )}
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