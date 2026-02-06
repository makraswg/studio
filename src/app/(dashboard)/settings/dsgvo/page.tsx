"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileCheck, Plus, Archive, RotateCcw, Layers } from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { DataSubjectGroup, DataCategory } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function DsgvoSettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [newGroupName, setNewGroupName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { data: subjectGroups, refresh: refreshGroups } = usePluggableCollection<DataSubjectGroup>('dataSubjectGroups');
  const { data: dataCategories, refresh: refreshCats } = usePluggableCollection<DataCategory>('dataCategories');

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    const id = `dsg-${Math.random().toString(36).substring(2, 7)}`;
    const data: DataSubjectGroup = { 
      id, 
      name: newGroupName, 
      tenantId: activeTenantId === 'all' ? 't1' : activeTenantId,
      status: 'active'
    };
    await saveCollectionRecord('dataSubjectGroups', id, data, dataSource);
    setNewGroupName('');
    refreshGroups();
    toast({ title: "Gruppe hinzugefügt" });
  };

  const handleCreateCat = async () => {
    if (!newCatName) return;
    const id = `dcat-${Math.random().toString(36).substring(2, 7)}`;
    const data: DataCategory = { 
      id, 
      name: newCatName, 
      tenantId: activeTenantId === 'all' ? 't1' : activeTenantId,
      status: 'active'
    };
    await saveCollectionRecord('dataCategories', id, data, dataSource);
    setNewCatName('');
    refreshCats();
    toast({ title: "Kategorie hinzugefügt" });
  };

  const toggleStatus = async (coll: string, item: any) => {
    const updated = { ...item, status: item.status === 'active' ? 'archived' : 'active' };
    await saveCollectionRecord(coll, item.id, updated, dataSource);
    if (coll === 'dataSubjectGroups') refreshGroups();
    else refreshCats();
    toast({ title: "Status aktualisiert" });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="h-8 text-[9px] font-bold uppercase gap-2" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
          {showArchived ? 'Aktive anzeigen' : 'Archiv anzeigen'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="rounded-none border shadow-none flex flex-col h-[500px]">
          <CardHeader className="bg-muted/10 border-b py-4">
            <CardTitle className="text-[10px] font-bold uppercase flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" /> Betroffene Personengruppen
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 flex-1 flex flex-col min-h-0">
            {!showArchived && (
              <div className="flex gap-2 shrink-0">
                <Input placeholder="z.B. Mitarbeiter" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="rounded-none h-9" />
                <Button onClick={handleCreateGroup} className="rounded-none h-9"><Plus className="w-4 h-4" /></Button>
              </div>
            )}
            <ScrollArea className="flex-1 border bg-slate-50 p-2">
              <div className="space-y-1">
                {subjectGroups?.filter(g => showArchived ? g.status === 'archived' : g.status !== 'archived').map(g => (
                  <div key={g.id} className="flex items-center justify-between p-2 bg-white border">
                    <span className={cn("text-xs font-bold", g.status === 'archived' && "line-through text-muted-foreground")}>{g.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus('dataSubjectGroups', g)}>
                      {g.status === 'active' ? <Archive className="w-3.5 h-3.5 text-muted-foreground" /> : <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="rounded-none border shadow-none flex flex-col h-[500px]">
          <CardHeader className="bg-muted/10 border-b py-4">
            <CardTitle className="text-[10px] font-bold uppercase flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" /> Datenkategorien (DSGVO)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 flex-1 flex flex-col min-h-0">
            {!showArchived && (
              <div className="flex gap-2 shrink-0">
                <Input placeholder="z.B. Stammdaten" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="rounded-none h-9" />
                <Button onClick={handleCreateCat} className="rounded-none h-9"><Plus className="w-4 h-4" /></Button>
              </div>
            )}
            <ScrollArea className="flex-1 border bg-slate-50 p-2">
              <div className="space-y-1">
                {dataCategories?.filter(c => showArchived ? c.status === 'archived' : c.status !== 'archived').map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-white border">
                    <span className={cn("text-xs font-bold", c.status === 'archived' && "line-through text-muted-foreground")}>{c.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus('dataCategories', c)}>
                      {c.status === 'active' ? <Archive className="w-3.5 h-3.5 text-muted-foreground" /> : <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
