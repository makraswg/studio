
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
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
  Layers,
  Loader2,
  Trash2,
  Pencil,
  Info,
  Save as SaveIcon,
  PlusCircle,
  X,
  Globe,
  Settings2,
  AlertTriangle,
  Network,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Workflow,
  Shield,
  LayoutGrid
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { Tenant, Department, JobTitle, Entitlement, Resource } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { usePlatformAuth } from '@/context/auth-context';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { Textarea } from '@/components/ui/textarea';

export default function UnifiedOrganizationPage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user: authPlatformUser } = usePlatformAuth();
  const [mounted, setMounted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  
  const [activeAddParent, setActiveAddParent] = useState<{ id: string, type: 'tenant' | 'dept' } | null>(null);
  const [newName, setNewName] = useState('');

  // Tenant Editor State
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [tenantName, setTenantName] = useState('');
  const [tenantDescription, setTenantDescription] = useState('');
  const [isSavingTenant, setIsSavingTenant] = useState(false);

  // Job Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobTitle | null>(null);
  const [jobName, setJobName] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobEntitlementIds, setJobEntitlementIds] = useState<string[]>([]);
  const [isSavingJob, setIsSavingJob] = useState(false);

  const { data: tenants, refresh: refreshTenants } = usePluggableCollection<Tenant>('tenants');
  const { data: departments, refresh: refreshDepts } = usePluggableCollection<Department>('departments');
  const { data: jobTitles, refresh: refreshJobs } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');

  useEffect(() => { setMounted(true); }, []);

  const isSuperAdmin = authPlatformUser?.role === 'superAdmin';

  const resetForm = () => {
    setEditingTenant(null);
    setTenantName('');
    setTenantDescription('');
    setActiveAddParent(null);
    setNewName('');
  };

  const groupedData = useMemo(() => {
    if (!tenants) return [];
    return tenants
      .filter(t => (showArchived ? t.status === 'archived' : t.status !== 'archived'))
      .map(tenant => {
        const tenantDepts = departments?.filter(d => d.tenantId === tenant.id) || [];
        const deptsWithJobs = tenantDepts.map(dept => ({
          ...dept,
          jobs: jobTitles?.filter(j => j.departmentId === dept.id) || []
        }));
        return { ...tenant, departments: deptsWithJobs };
      })
      .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));
  }, [tenants, departments, jobTitles, search, showArchived]);

  const handleSaveTenant = async () => {
    if (!tenantName) return;
    setIsSavingTenant(true);
    const id = editingTenant?.id || `t-${Math.random().toString(36).substring(2, 7)}`;
    try {
      const res = await saveCollectionRecord('tenants', id, {
        id,
        name: tenantName,
        slug: tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        companyDescription: tenantDescription,
        status: editingTenant?.status || 'active',
        createdAt: editingTenant?.createdAt || new Date().toISOString()
      }, dataSource);
      if (res.success) {
        setIsTenantDialogOpen(false);
        refreshTenants();
        toast({ title: "Mandant gespeichert" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSavingTenant(false);
    }
  };

  const handleCreateSub = async () => {
    if (!newName || !activeAddParent) return;
    const id = `${activeAddParent.type === 'tenant' ? 'd' : 'j'}-${Math.random().toString(36).substring(2, 7)}`;
    if (activeAddParent.type === 'tenant') {
      await saveCollectionRecord('departments', id, { id, tenantId: activeAddParent.id, name: newName, status: 'active' }, dataSource);
      refreshDepts();
    } else {
      const dept = departments?.find(d => d.id === activeAddParent.id);
      if (dept) {
        await saveCollectionRecord('jobTitles', id, { id, tenantId: dept.tenantId, departmentId: activeAddParent.id, name: newName, status: 'active', entitlementIds: [] }, dataSource);
        refreshJobs();
      }
    }
    setNewName('');
    setActiveAddParent(null);
    toast({ title: "Erfolgreich angelegt" });
  };

  const handleStatusChange = async (coll: string, item: any, newStatus: 'active' | 'archived') => {
    const res = await saveCollectionRecord(coll, item.id, { ...item, status: newStatus }, dataSource);
    if (res.success) {
      if (coll === 'tenants') refreshTenants();
      if (coll === 'departments') refreshDepts();
      if (coll === 'jobTitles') refreshJobs();
      toast({ title: "Status geändert" });
    }
  };

  const openJobEditor = (job: JobTitle) => {
    setEditingJob(job);
    setJobName(job.name);
    setJobDesc(job.description || '');
    setJobEntitlementIds(job.entitlementIds || []);
    setIsEditorOpen(true);
  };

  const saveJobEdits = async () => {
    if (!editingJob) return;
    setIsSavingJob(true);
    try {
      const res = await saveCollectionRecord('jobTitles', editingJob.id, {
        ...editingJob,
        name: jobName,
        description: jobDesc,
        entitlementIds: jobEntitlementIds
      }, dataSource);
      if (res.success) {
        setIsEditorOpen(false);
        refreshJobs();
        toast({ title: "Gespeichert" });
      }
    } finally {
      setIsSavingJob(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10 w-full mx-auto px-4 md:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <Badge className="mb-1 bg-primary/10 text-primary text-[9px] font-bold">Organisation</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase">Struktur & Blueprints</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold text-[10px]" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Aktive' : 'Archiv'}</Button>
          <Button size="sm" className="h-9 font-bold text-[10px]" onClick={() => { resetForm(); setIsTenantDialogOpen(true); }}>Neuer Mandant</Button>
        </div>
      </div>

      <div className="space-y-4">
        {groupedData.map(tenant => (
          <Card key={tenant.id} className="border shadow-sm bg-white dark:bg-slate-900 overflow-hidden rounded-2xl group">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b p-4 px-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm"><Building2 className="w-5 h-5" /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold">{tenant.name}</CardTitle>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => { setEditingTenant(tenant); setTenantName(tenant.name); setTenantDescription(tenant.companyDescription || ''); setIsTenantDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-8 text-[10px] font-black" onClick={() => setActiveAddParent({ id: tenant.id, type: 'tenant' })}><PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Abteilung</Button>
                <Button variant="ghost" size="icon" onClick={() => handleStatusChange('tenants', tenant, tenant.status === 'active' ? 'archived' : 'active')}>
                  {tenant.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {tenant.departments.map((dept: any) => (
                  <div key={dept.id}>
                    <div className="flex items-center justify-between p-4 px-8 hover:bg-slate-50 group/dept">
                      <div className="flex items-center gap-3"><Layers className="w-4 h-4 text-emerald-600" /><h4 className="text-xs font-bold">{dept.name}</h4></div>
                      <div className="flex items-center gap-2 opacity-0 group-hover/dept:opacity-100">
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black" onClick={() => setActiveAddParent({ id: dept.id, type: 'dept' })}><Plus className="w-3 h-3 mr-1" /> Zuweisung</Button>
                        <Button variant="ghost" size="icon" onClick={() => handleStatusChange('departments', dept, dept.status === 'active' ? 'archived' : 'active')}><Archive className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <div className="bg-slate-50/30 px-8 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-10 border-l-2 ml-4">
                        {dept.jobs?.map((job: any) => (
                          <div key={job.id} className="p-3 bg-white rounded-xl border flex items-center justify-between group/job hover:border-primary/30 cursor-pointer" onClick={() => openJobEditor(job)}>
                            <div className="flex items-center gap-3 truncate"><Briefcase className="w-4 h-4 text-slate-400" /><span className="text-[11px] font-bold truncate">{job.name}</span></div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/job:opacity-100" onClick={(e) => { e.stopPropagation(); openJobEditor(job); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                        {activeAddParent?.id === dept.id && (
                          <div className="flex gap-2 p-2 bg-white rounded-lg border-2 border-primary">
                            <Input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateSub()} className="h-8 border-none shadow-none text-[11px] font-bold" />
                            <Button size="sm" className="h-8 px-4 font-bold text-[10px]" onClick={handleCreateSub}>OK</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {activeAddParent?.id === tenant.id && (
                  <div className="p-4 px-8 bg-primary/5 flex items-center gap-3">
                    <Input placeholder="Abteilungsname..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateSub()} className="h-10 text-xs rounded-xl" />
                    <Button size="sm" onClick={handleCreateSub}>Erstellen</Button>
                    <Button variant="ghost" size="icon" onClick={() => setActiveAddParent(null)}><X className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isTenantDialogOpen} onOpenChange={(v) => !v && setIsTenantDialogOpen(false)}>
        <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-lg font-bold">Mandant bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Name</Label><Input value={tenantName} onChange={e => setTenantName(e.target.value)} className="h-11 font-bold" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">KI Beschreibung</Label><Textarea value={tenantDescription} onChange={e => setTenantDescription(e.target.value)} className="min-h-[100px] text-xs" /></div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t">
            <Button variant="ghost" onClick={() => setIsTenantDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveTenant} disabled={isSavingTenant}>{isSavingTenant ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />} Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditorOpen} onOpenChange={(v) => !v && setIsEditorOpen(false)}>
        <DialogContent className="max-w-4xl rounded-2xl p-0 overflow-hidden flex flex-col shadow-2xl bg-white h-[85vh]">
          <DialogHeader className="p-6 bg-slate-900 text-white"><DialogTitle>Rollen-Standardzuweisung bearbeiten</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 p-8 space-y-10">
            <div className="space-y-4">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Bezeichnung</Label>
              <Input value={jobName} onChange={e => setJobName(e.target.value)} className="h-11 font-bold" />
              <Label className="text-[10px] font-bold uppercase text-slate-400">Beschreibung</Label>
              <Textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} className="min-h-[100px] text-xs" />
            </div>
            <div className="pt-6 border-t">
              <Label className="text-xs font-bold text-primary mb-4 block">Enthaltene Berechtigungen ({jobEntitlementIds.length})</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {entitlements?.filter(e => activeTenantId === 'all' || e.tenantId === activeTenantId || e.tenantId === 'global').map(ent => (
                  <div key={ent.id} className={cn("p-3 border rounded-xl flex items-center gap-3 cursor-pointer", jobEntitlementIds.includes(ent.id) ? "border-primary bg-primary/5" : "bg-white")} onClick={() => setJobEntitlementIds(prev => prev.includes(ent.id) ? prev.filter(id => id !== ent.id) : [...prev, ent.id])}>
                    <Checkbox checked={jobEntitlementIds.includes(ent.id)} />
                    <span className="text-[11px] font-bold truncate">{ent.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t">
            <Button variant="ghost" onClick={() => setIsEditorOpen(false)}>Abbrechen</Button>
            <Button onClick={saveJobEdits} disabled={isSavingJob}>{isSavingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />} Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
