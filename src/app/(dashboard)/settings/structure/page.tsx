"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Briefcase, 
  Building2, 
  Plus, 
  Archive, 
  RotateCcw,
  Search,
  ChevronRight,
  Filter,
  Layers,
  ArrowRight,
  BadgeAlert,
  Loader2,
  Trash2,
  Settings2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { Tenant, Department, JobTitle } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function StructureSettingsPage() {
  const { dataSource } = useSettings();
  const [showArchived, setShowArchived] = useState(false);
  
  // Selection
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  // Input
  const [newTenantName, setNewTenantName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newJobName, setNewJobName] = useState('');

  const { data: tenants, refresh: refreshTenants } = usePluggableCollection<Tenant>('tenants');
  const { data: departments, refresh: refreshDepts } = usePluggableCollection<Department>('departments');
  const { data: jobTitles, refresh: refreshJobs } = usePluggableCollection<JobTitle>('jobTitles');

  const filteredTenants = useMemo(() => {
    return tenants?.filter(t => showArchived ? t.status === 'archived' : t.status !== 'archived') || [];
  }, [tenants, showArchived]);

  const filteredDepts = useMemo(() => {
    if (!selectedTenantId) return [];
    return departments?.filter(d => 
      d.tenantId === selectedTenantId && 
      (showArchived ? d.status === 'archived' : d.status !== 'archived')
    ) || [];
  }, [departments, selectedTenantId, showArchived]);

  const filteredJobs = useMemo(() => {
    if (!selectedDeptId) return [];
    return jobTitles?.filter(j => 
      j.departmentId === selectedDeptId && 
      (showArchived ? j.status === 'archived' : j.status !== 'archived')
    ) || [];
  }, [jobTitles, selectedDeptId, showArchived]);

  const handleStatusChange = async (coll: string, item: any, newStatus: 'active' | 'archived') => {
    const updated = { ...item, status: newStatus };
    const res = await saveCollectionRecord(coll, item.id, updated, dataSource);
    if (res.success) {
      toast({ title: newStatus === 'archived' ? "Archiviert" : "Reaktiviert" });
      if (coll === 'tenants') refreshTenants();
      if (coll === 'departments') refreshDepts();
      if (coll === 'jobTitles') refreshJobs();
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenantName) return;
    const id = `t-${Math.random().toString(36).substring(2, 7)}`;
    const data: Tenant = {
      id,
      name: newTenantName,
      slug: newTenantName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    const res = await saveCollectionRecord('tenants', id, data, dataSource);
    if (res.success) {
      setNewTenantName('');
      refreshTenants();
      toast({ title: "Mandant angelegt" });
    }
  };

  const handleCreateDept = async () => {
    if (!newDeptName || !selectedTenantId) return;
    const id = `d-${Math.random().toString(36).substring(2, 7)}`;
    const data: Department = {
      id,
      tenantId: selectedTenantId,
      name: newDeptName,
      status: 'active'
    };
    const res = await saveCollectionRecord('departments', id, data, dataSource);
    if (res.success) {
      setNewDeptName('');
      refreshDepts();
      toast({ title: "Abteilung angelegt" });
    }
  };

  const handleCreateJob = async () => {
    if (!newJobName || !selectedDeptId) return;
    const dept = departments?.find(d => d.id === selectedDeptId);
    if (!dept) return;
    const id = `j-${Math.random().toString(36).substring(2, 7)}`;
    const data: JobTitle = {
      id,
      tenantId: dept.tenantId,
      departmentId: selectedDeptId,
      name: newJobName,
      status: 'active'
    };
    const res = await saveCollectionRecord('jobTitles', id, data, dataSource);
    if (res.success) {
      setNewJobName('');
      refreshJobs();
      toast({ title: "Stelle angelegt" });
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          Unternehmens-Struktur (Konzern-Sicht)
        </h2>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-9 text-[10px] font-black uppercase gap-2 px-4 rounded-xl transition-all",
              showArchived ? "text-orange-600 bg-orange-50 dark:bg-orange-900/20" : "text-slate-500 hover:text-slate-900"
            )} 
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {showArchived ? 'Archiv wird angezeigt' : 'Archiv anzeigen'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* TENANTS */}
        <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 flex flex-col h-[650px] overflow-hidden group">
          <CardHeader className="bg-slate-900 text-white p-6 shrink-0 transition-colors group-hover:bg-primary duration-500">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <CardTitle className="text-xs font-black uppercase tracking-widest">1. Mandanten</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
            {!showArchived && (
              <div className="flex gap-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shrink-0">
                <Input 
                  placeholder="Mandant-Name..." 
                  value={newTenantName} 
                  onChange={e => setNewTenantName(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleCreateTenant()}
                  className="h-10 border-none shadow-none text-xs rounded-xl bg-transparent focus:bg-white" 
                />
                <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-slate-900 hover:bg-black text-white" onClick={handleCreateTenant}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-2">
                {filteredTenants.map(t => (
                  <div 
                    key={t.id} 
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group/item",
                      selectedTenantId === t.id ? "bg-primary/5 border-primary shadow-lg shadow-primary/5" : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:border-slate-300"
                    )}
                    onClick={() => { setSelectedTenantId(t.id); setSelectedDeptId(''); }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-bold truncate", t.status === 'archived' && "line-through text-slate-400")}>{t.name}</p>
                      <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5 tracking-widest">{t.slug}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" size="icon" 
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleStatusChange('tenants', t, t.status === 'active' ? 'archived' : 'active'); }}
                      >
                        {t.status === 'active' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* DEPARTMENTS */}
        <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 flex flex-col h-[650px] overflow-hidden group">
          <CardHeader className="bg-slate-900 text-white p-6 shrink-0 transition-colors group-hover:bg-emerald-600 duration-500">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <CardTitle className="text-xs font-black uppercase tracking-widest">2. Abteilungen</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
            {!showArchived && (
              <div className={cn("flex gap-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shrink-0", !selectedTenantId && "opacity-30 grayscale cursor-not-allowed")}>
                <Input 
                  placeholder={selectedTenantId ? "Abteilung..." : "Mandant wählen..."} 
                  value={newDeptName} 
                  onChange={e => setNewDeptName(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleCreateDept()}
                  className="h-10 border-none shadow-none text-xs rounded-xl bg-transparent focus:bg-white" 
                  disabled={!selectedTenantId}
                />
                <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-slate-900 hover:bg-black text-white" onClick={handleCreateDept} disabled={!selectedTenantId}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-2">
                {filteredDepts.map(d => (
                  <div 
                    key={d.id} 
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group/item",
                      selectedDeptId === d.id ? "bg-emerald-50 border-emerald-500 shadow-lg shadow-emerald-500/5" : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:border-slate-300"
                    )}
                    onClick={() => setSelectedDeptId(d.id)}
                  >
                    <p className={cn("text-sm font-bold truncate", d.status === 'archived' && "line-through text-slate-400")}>{d.name}</p>
                    <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" size="icon" 
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleStatusChange('departments', d, d.status === 'active' ? 'archived' : 'active'); }}
                      >
                        {d.status === 'active' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {selectedTenantId && filteredDepts.length === 0 && (
                  <div className="py-20 text-center space-y-3 opacity-20">
                    <Layers className="w-10 h-10 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Keine Abteilungen</p>
                  </div>
                )}
                {!selectedTenantId && (
                  <div className="py-20 text-center space-y-3 opacity-20 italic">
                    <Building2 className="w-10 h-10 mx-auto" />
                    <p className="text-[9px] font-black uppercase tracking-widest">Mandant links wählen</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* JOB TITLES */}
        <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 flex flex-col h-[650px] overflow-hidden group">
          <CardHeader className="bg-slate-900 text-white p-6 shrink-0 transition-colors group-hover:bg-accent duration-500">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                <BadgeAlert className="w-5 h-5 text-white" />
              </div>
              <CardTitle className="text-xs font-black uppercase tracking-widest">3. Stellen / Rollen</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
            {!showArchived && (
              <div className={cn("flex gap-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shrink-0", !selectedDeptId && "opacity-30 grayscale cursor-not-allowed")}>
                <Input 
                  placeholder={selectedDeptId ? "Bezeichnung..." : "Abteilung wählen..."} 
                  value={newJobName} 
                  onChange={e => setNewJobName(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleCreateJob()}
                  className="h-10 border-none shadow-none text-xs rounded-xl bg-transparent focus:bg-white" 
                  disabled={!selectedDeptId}
                />
                <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-slate-900 hover:bg-black text-white" onClick={handleCreateJob} disabled={!selectedDeptId}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-2">
                {filteredJobs.map(j => (
                  <div 
                    key={j.id} 
                    className="flex items-center justify-between p-4 rounded-2xl border bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 group/item hover:border-slate-300 transition-all shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className={cn("text-sm font-bold truncate", j.status === 'archived' && "line-through text-slate-400")}>{j.name}</p>
                      <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">ID: {j.id}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" size="icon" 
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleStatusChange('jobTitles', j, j.status === 'active' ? 'archived' : 'active'); }}
                      >
                        {j.status === 'active' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {selectedDeptId && filteredJobs.length === 0 && (
                  <div className="py-20 text-center space-y-3 opacity-20">
                    <BadgeAlert className="w-10 h-10 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Keine Stellen</p>
                  </div>
                )}
                {!selectedDeptId && (
                  <div className="py-20 text-center space-y-3 opacity-20 italic">
                    <Layers className="w-10 h-10 mx-auto" />
                    <p className="text-[9px] font-black uppercase tracking-widest">Abteilung wählen</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shrink-0">
            <Settings2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-headline font-bold uppercase tracking-widest">Konzern-Struktur & Prozessmanagement</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">
              Diese Stellenpläne werden direkt im **ProcessHub Designer** zur Rollenzuweisung genutzt. 
              Stellen Sie sicher, dass alle fachlichen Rollen hier korrekt hinterlegt sind, um eine präzise Prozesslandkarte zu erstellen.
            </p>
          </div>
        </div>
        <Button variant="outline" className="rounded-xl border-white/20 text-white hover:bg-white hover:text-slate-900 font-black uppercase text-[10px] h-12 px-8 shrink-0">
          Stellenplan-Import (CSV)
        </Button>
      </div>
    </div>
  );
}
