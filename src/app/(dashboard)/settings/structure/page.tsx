
"use client";

import { useState, useMemo, useEffect } from 'react';
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
  Settings2,
  Network,
  GitBranch,
  UserCircle,
  FileText,
  ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { Tenant, Department, JobTitle } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function StructureSettingsPage() {
  const { dataSource } = useSettings();
  const [showArchived, setShowArchived] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  
  // Selection
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  // Input
  const [newTenantName, setNewTenantName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newJobName, setNewJobName] = useState('');

  // Editor Dialog
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobTitle | null>(null);
  const [jobName, setJobName] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [isSavingJob, setIsSavingJob] = useState(false);

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

  const openJobEditor = (job: JobTitle) => {
    setEditingJob(job);
    setJobName(job.name);
    setJobDesc(job.description || '');
    setIsEditorOpen(true);
  };

  const saveJobEdits = async () => {
    if (!editingJob) return;
    setIsSavingJob(true);
    const updated = { ...editingJob, name: jobName, description: jobDesc };
    try {
      const res = await saveCollectionRecord('jobTitles', editingJob.id, updated, dataSource);
      if (res.success) {
        toast({ title: "Stelle aktualisiert" });
        setIsEditorOpen(false);
        refreshJobs();
      }
    } finally {
      setIsSavingJob(false);
    }
  };

  const OrgChartNode = ({ item, type, children }: any) => {
    const isArchived = item.status === 'archived';
    return (
      <div className={cn(
        "flex flex-col gap-2 relative pl-8 py-2 border-l-2 border-slate-100 dark:border-slate-800 transition-all ml-4",
        isArchived && "opacity-50"
      )}>
        <div className="absolute left-0 top-1/2 w-6 h-0.5 bg-slate-100 dark:bg-slate-800" />
        <div className={cn(
          "p-4 rounded-2xl border bg-white dark:bg-slate-950 flex items-center justify-between group shadow-sm transition-all hover:shadow-md",
          type === 'tenant' ? "border-primary/30 ring-4 ring-primary/5" : 
          type === 'dept' ? "border-emerald-500/30" : "border-slate-200 dark:border-slate-800"
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
              type === 'tenant' ? "bg-primary text-white" : 
              type === 'dept' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
            )}>
              {type === 'tenant' ? <Building2 className="w-5 h-5" /> : 
               type === 'dept' ? <Layers className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
            </div>
            <div>
              <p className={cn("text-sm font-bold truncate", isArchived && "line-through")}>{item.name}</p>
              {item.description && <p className="text-[10px] text-slate-400 truncate max-w-[200px] italic">{item.description}</p>}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {type === 'job' && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openJobEditor(item)}><Pencil className="w-3.5 h-3.5" /></Button>}
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600" onClick={() => handleStatusChange(type === 'tenant' ? 'tenants' : type === 'dept' ? 'departments' : 'jobTitles', item, item.status === 'active' ? 'archived' : 'active')}>
              {item.status === 'active' ? <Archive className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        {children}
      </div>
    );
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            Konzern-Struktur & Stellenplan
          </h2>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">Hierarchische Definition der Organisationseinheiten</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
            <TabsList className="bg-transparent h-9 gap-1">
              <TabsTrigger value="list" className="rounded-lg text-[10px] font-black uppercase tracking-wider h-7 px-4">Tabellen</TabsTrigger>
              <TabsTrigger value="visual" className="rounded-lg text-[10px] font-black uppercase tracking-wider h-7 px-4">Org-Chart</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-9 text-[10px] font-black uppercase gap-2 px-4 rounded-xl transition-all",
              showArchived ? "text-orange-600 bg-orange-50" : "text-slate-500 hover:text-slate-900"
            )} 
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {showArchived ? 'Archiv aktiv' : 'Archiv'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="list" className="mt-0">
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
                    <Input placeholder="Mandant..." value={newTenantName} onChange={e => setNewTenantName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateTenant()} className="h-10 border-none shadow-none text-xs rounded-xl bg-transparent focus:bg-white" />
                    <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-slate-900" onClick={handleCreateTenant}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
                <ScrollArea className="flex-1 -mx-2 px-2">
                  <div className="space-y-2">
                    {filteredTenants.map(t => (
                      <div key={t.id} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group/item", selectedTenantId === t.id ? "bg-primary/5 border-primary" : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:border-slate-300")} onClick={() => { setSelectedTenantId(t.id); setSelectedDeptId(''); }}>
                        <div className="min-w-0 flex-1"><p className={cn("text-sm font-bold truncate", t.status === 'archived' && "line-through text-slate-400")}>{t.name}</p><p className="text-[9px] font-black uppercase text-slate-400 mt-0.5 tracking-widest">{t.slug}</p></div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 opacity-0 group-hover/item:opacity-100" onClick={(e) => { e.stopPropagation(); handleStatusChange('tenants', t, t.status === 'active' ? 'archived' : 'active'); }}>{t.status === 'active' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}</Button>
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
                    <Input placeholder="Abteilung..." value={newDeptName} onChange={e => setNewDeptName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateDept()} className="h-10 border-none shadow-none text-xs rounded-xl bg-transparent focus:bg-white" disabled={!selectedTenantId} />
                    <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-slate-900" onClick={handleCreateDept} disabled={!selectedTenantId}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
                <ScrollArea className="flex-1 -mx-2 px-2">
                  <div className="space-y-2">
                    {filteredDepts.map(d => (
                      <div key={d.id} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group/item", selectedDeptId === d.id ? "bg-emerald-50 border-emerald-500" : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:border-slate-300")} onClick={() => setSelectedDeptId(d.id)}>
                        <p className={cn("text-sm font-bold truncate", d.status === 'archived' && "line-through text-slate-400")}>{d.name}</p>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 opacity-0 group-hover/item:opacity-100" onClick={(e) => { e.stopPropagation(); handleStatusChange('departments', d, d.status === 'active' ? 'archived' : 'active'); }}>{d.status === 'active' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}</Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* JOB TITLES */}
            <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 flex flex-col h-[650px] overflow-hidden group">
              <CardHeader className="bg-slate-900 text-white p-6 shrink-0 transition-colors group-hover:bg-accent duration-500">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                  <CardTitle className="text-xs font-black uppercase tracking-widest">3. Stellen / Rollen</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
                {!showArchived && (
                  <div className={cn("flex gap-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shrink-0", !selectedDeptId && "opacity-30 grayscale cursor-not-allowed")}>
                    <Input placeholder="Bezeichnung..." value={newJobName} onChange={e => setNewJobName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateJob()} className="h-10 border-none shadow-none text-xs rounded-xl bg-transparent focus:bg-white" disabled={!selectedDeptId} />
                    <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-slate-900" onClick={handleCreateJob} disabled={!selectedDeptId}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
                <ScrollArea className="flex-1 -mx-2 px-2">
                  <div className="space-y-2">
                    {filteredJobs.map(j => (
                      <div key={j.id} className="flex items-center justify-between p-4 rounded-2xl border bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 group/item hover:border-slate-300 transition-all shadow-sm">
                        <div className="min-w-0" onClick={() => openJobEditor(j)}>
                          <p className={cn("text-sm font-bold truncate", j.status === 'archived' && "line-through text-slate-400")}>{j.name}</p>
                          {j.description && <p className="text-[10px] text-slate-400 truncate mt-0.5 italic">{j.description}</p>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openJobEditor(j)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600" onClick={() => handleStatusChange('jobTitles', j, j.status === 'active' ? 'archived' : 'active')}>{j.status === 'active' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="visual" className="mt-0">
          <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white dark:bg-slate-900 p-10 min-h-[700px]">
            <div className="space-y-12 max-w-4xl">
              {filteredTenants.map(tenant => (
                <div key={tenant.id} className="space-y-6">
                  <div className="flex items-center gap-4 p-5 bg-slate-900 text-white rounded-[2rem] shadow-xl">
                    <Building2 className="w-8 h-8 text-primary" />
                    <div>
                      <h3 className="text-xl font-headline font-bold uppercase">{tenant.name}</h3>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Konzern-Obergesellschaft</p>
                    </div>
                  </div>
                  
                  <div className="ml-10 space-y-8 relative">
                    {/* Vertical line connector */}
                    <div className="absolute left-0 top-0 w-0.5 h-full bg-slate-100 dark:bg-slate-800" />
                    
                    {departments?.filter(d => d.tenantId === tenant.id && (!showArchived || d.status === 'archived')).map(dept => (
                      <div key={dept.id} className="space-y-4">
                        <OrgChartNode item={dept} type="dept">
                          <div className="ml-8 space-y-2 mt-2">
                            {jobTitles?.filter(j => j.departmentId === dept.id && (!showArchived || j.status === 'archived')).map(job => (
                              <OrgChartNode key={job.id} item={job} type="job" />
                            ))}
                            {jobTitles?.filter(j => j.departmentId === dept.id).length === 0 && (
                              <div className="pl-12 py-2 text-[10px] text-slate-300 uppercase font-black italic">Keine Stellen definiert</div>
                            )}
                          </div>
                        </OrgChartNode>
                      </div>
                    ))}
                    {departments?.filter(d => d.tenantId === tenant.id).length === 0 && (
                      <div className="ml-12 py-4 text-xs text-slate-400 italic">Keine Abteilungen angelegt.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Job Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-[2rem] md:rounded-[3rem] p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white dark:bg-slate-950 h-[90vh] md:h-auto">
          <DialogHeader className="p-6 md:p-10 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-xl">
                <Briefcase className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <div>
                <DialogTitle className="text-xl md:text-2xl font-headline font-bold uppercase tracking-tight">Stelle bearbeiten</DialogTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 tracking-widest">Detail-Dokumentation für Audit-Zwecke</p>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 md:p-10 space-y-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Bezeichnung</Label>
                <Input value={jobName} onChange={e => setJobName(e.target.value)} className="rounded-2xl h-12 md:h-14 font-bold text-lg border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Stellenbeschreibung (Aufgaben & Kompetenzen)</Label>
                <Textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} className="min-h-[200px] rounded-3xl p-6 text-sm leading-relaxed border-slate-200" placeholder="Beschreiben Sie hier die Hauptaufgaben der Stelle..." />
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 italic leading-relaxed">
                  <Info className="w-3.5 h-3.5 inline mr-1 text-primary" /> 
                  Diese Beschreibung dient der KI als Basis zur Bewertung, ob zugewiesene Berechtigungen (IAM) zur fachlichen Aufgabe passen (Least Privilege Check).
                </p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t shrink-0 flex flex-col sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="rounded-xl h-12 font-black uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={saveJobEdits} disabled={isSavingJob} className="rounded-2xl h-12 md:h-14 px-12 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest shadow-xl">
              {isSavingJob ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Änderungen Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
