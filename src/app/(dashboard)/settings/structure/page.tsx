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
  Layers,
  Loader2,
  Trash2,
  Pencil,
  Info,
  Save,
  PlusCircle,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { Tenant, Department, JobTitle } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function StructureSettingsPage() {
  const { dataSource } = useSettings();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  
  const [activeAddParent, setActiveAddParent] = useState<{ id: string, type: 'tenant' | 'dept' } | null>(null);
  const [newName, setNewName] = useState('');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobTitle | null>(null);
  const [jobName, setJobName] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [isSavingJob, setIsSavingJob] = useState(false);

  const { data: tenants, refresh: refreshTenants, isLoading: tenantsLoading } = usePluggableCollection<Tenant>('tenants');
  const { data: departments, refresh: refreshDepts, isLoading: deptsLoading } = usePluggableCollection<Department>('departments');
  const { data: jobTitles, refresh: refreshJobs, isLoading: jobsLoading } = usePluggableCollection<JobTitle>('jobTitles');

  const filteredData = useMemo(() => {
    if (!tenants) return [];
    
    return tenants
      .filter(t => (showArchived ? t.status === 'archived' : t.status !== 'archived'))
      .map(tenant => {
        const tenantDepts = departments?.filter(d => 
          d.tenantId === tenant.id && 
          (showArchived ? d.status === 'archived' : d.status !== 'archived')
        ) || [];

        const deptsWithJobs = tenantDepts.map(dept => {
          const deptJobs = jobTitles?.filter(j => 
            j.departmentId === dept.id && 
            (showArchived ? j.status === 'archived' : j.status !== 'archived')
          ) || [];
          return { ...dept, jobs: deptJobs };
        });

        return { ...tenant, departments: deptsWithJobs };
      })
      .filter(t => {
        if (!search) return true;
        const s = search.toLowerCase();
        const hasMatchingJob = t.departments.some(d => d.jobs.some(j => j.name.toLowerCase().includes(s)));
        const hasMatchingDept = t.departments.some(d => d.name.toLowerCase().includes(s));
        return t.name.toLowerCase().includes(s) || hasMatchingDept || hasMatchingJob;
      });
  }, [tenants, departments, jobTitles, search, showArchived]);

  const handleCreate = async () => {
    if (!newName || !activeAddParent) return;
    const id = `${activeAddParent.type === 'tenant' ? 'd' : 'j'}-${Math.random().toString(36).substring(2, 7)}`;
    if (activeAddParent.type === 'tenant') {
      await saveCollectionRecord('departments', id, { id, tenantId: activeAddParent.id, name: newName, status: 'active' }, dataSource);
      refreshDepts();
    } else {
      const dept = departments?.find(d => d.id === activeAddParent.id);
      if (!dept) return;
      await saveCollectionRecord('jobTitles', id, { id, tenantId: dept.tenantId, departmentId: activeAddParent.id, name: newName, status: 'active' }, dataSource);
      refreshJobs();
    }
    setNewName('');
    setActiveAddParent(null);
    toast({ title: "Eintrag erstellt" });
  };

  const handleStatusChange = async (coll: string, item: any, newStatus: 'active' | 'archived') => {
    const updated = { ...item, status: newStatus };
    const res = await saveCollectionRecord(coll, item.id, updated, dataSource);
    if (res.success) {
      if (coll === 'tenants') refreshTenants();
      if (coll === 'departments') refreshDepts();
      if (coll === 'jobTitles') refreshJobs();
      toast({ title: "Status aktualisiert" });
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
    try {
      const res = await saveCollectionRecord('jobTitles', editingJob.id, { ...editingJob, name: jobName, description: jobDesc }, dataSource);
      if (res.success) {
        setIsEditorOpen(false);
        refreshJobs();
        toast({ title: "Stelle gespeichert" });
      }
    } finally {
      setIsSavingJob(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">Org Structure</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase">Struktur & Stellen</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Hierarchischer Stellenplan der Organisationseinheiten.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className={cn(
            "h-9 rounded-md font-bold uppercase text-[9px] tracking-wider",
            showArchived && "text-orange-600 bg-orange-50"
          )} 
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
          {showArchived ? 'Aktive Ansicht' : 'Archiv'}
        </Button>
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <Input 
          placeholder="Suche..." 
          className="pl-9 h-10 rounded-md border-slate-200 bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {(tenantsLoading || deptsLoading || jobsLoading) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            <p className="text-[9px] font-black uppercase text-slate-400">Lade Struktur...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed rounded-xl bg-white/50">
            <p className="text-xs font-bold uppercase text-slate-400">Keine Daten gefunden</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredData.map(tenant => (
              <Card key={tenant.id} className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-4 px-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary shadow-inner">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold uppercase">{tenant.name}</CardTitle>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-8 text-[9px] text-white hover:bg-white/10 gap-1.5" onClick={() => setActiveAddParent({ id: tenant.id, type: 'tenant' })}>
                      <PlusCircle className="w-3.5 h-3.5" /> Abt.
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleStatusChange('tenants', tenant, tenant.status === 'active' ? 'archived' : 'active')}>
                      <Archive className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {tenant.departments.map(dept => (
                      <div key={dept.id} className="group/dept">
                        <div className="flex items-center justify-between p-4 px-8 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <Layers className="w-4 h-4" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 uppercase">{dept.name}</h4>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover/dept:opacity-100">
                            <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-emerald-600 hover:bg-emerald-50 gap-1" onClick={() => setActiveAddParent({ id: dept.id, type: 'dept' })}>
                              <Plus className="w-3 h-3" /> Stelle
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300" onClick={() => handleStatusChange('departments', dept, dept.status === 'active' ? 'archived' : 'active')}>
                              <Archive className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="bg-slate-50/50 px-8 pb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-10 border-l-2 border-slate-100 ml-4">
                            {dept.jobs.map(job => (
                              <div key={job.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border shadow-sm group/job hover:border-primary/30 transition-all cursor-pointer" onClick={() => openJobEditor(job)}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <p className="text-[11px] font-bold text-slate-700 truncate">{job.name}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover/job:opacity-100">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openJobEditor(job); }}><Pencil className="w-3 h-3" /></Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={(e) => { e.stopPropagation(); handleStatusChange('jobTitles', job, job.status === 'active' ? 'archived' : 'active'); }}><Archive className="w-3 h-3" /></Button>
                                </div>
                              </div>
                            ))}
                            {activeAddParent?.id === dept.id && activeAddParent.type === 'dept' && (
                              <div className="col-span-full pt-2">
                                <div className="flex gap-2 p-2 bg-white rounded-lg border-2 border-primary shadow-sm">
                                  <Input autoFocus placeholder="Name der Stelle..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} className="h-8 border-none shadow-none text-[11px] font-bold" />
                                  <Button size="sm" className="h-8 px-4 rounded-md font-black uppercase text-[9px]" onClick={handleCreate}>Add</Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveAddParent(null)}><X className="w-3.5 h-3.5" /></Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {activeAddParent?.id === tenant.id && activeAddParent.type === 'tenant' && (
                      <div className="p-4 px-8 bg-primary/5 border-y border-primary/10">
                        <div className="flex items-center gap-3">
                          <Input autoFocus placeholder="Abteilungsname..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} className="h-10 border-slate-200 rounded-md bg-white text-xs font-bold" />
                          <Button size="sm" className="h-10 px-6 rounded-md font-black uppercase text-[10px]" onClick={handleCreate}>Erstellen</Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400" onClick={() => setActiveAddParent(null)}><X className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-lg w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <Briefcase className="w-6 h-6 text-primary" />
              <DialogTitle className="text-lg font-bold uppercase tracking-tight">Stelle bearbeiten</DialogTitle>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Bezeichnung</Label>
                <Input value={jobName} onChange={e => setJobName(e.target.value)} className="rounded-md h-11 font-bold text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Stellenbeschreibung</Label>
                <Textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} className="min-h-[150px] rounded-lg p-4 text-xs leading-relaxed border-slate-200" placeholder="Aufgaben & Kompetenzen..." />
              </div>
              <div className="p-4 bg-slate-50 rounded-lg flex items-start gap-3">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 italic leading-relaxed">Diese Info nutzt die KI für Least-Privilege Checks.</p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="rounded-md h-10 px-6 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={saveJobEdits} disabled={isSavingJob} className="rounded-md h-10 px-8 bg-slate-900 text-white font-bold uppercase text-[10px] gap-2">
              {isSavingJob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}