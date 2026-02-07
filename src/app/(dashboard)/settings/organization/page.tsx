
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
  Layers,
  Loader2,
  Trash2,
  Pencil,
  Info,
  Save,
  PlusCircle,
  X,
  Globe,
  BrainCircuit,
  Settings2,
  AlertTriangle,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { toast } from '@/hooks/use-toast';
import { Tenant, Department, JobTitle } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePlatformAuth } from '@/context/auth-context';

export default function UnifiedOrganizationPage() {
  const { dataSource } = useSettings();
  const { user } = usePlatformAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  
  // Selection
  const [activeAddParent, setActiveAddParent] = useState<{ id: string, type: 'tenant' | 'dept' } | null>(null);
  const [newName, setNewName] = useState('');

  // Tenant Editor
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Partial<Tenant> | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantRegion, setTenantRegion] = useState('EU-DSGVO');
  const [tenantDescription, setTenantDescription] = useState('');
  const [tenantLogoUrl, setTenantLogoUrl] = useState('');
  const [isSavingTenant, setIsSavingTenant] = useState(false);

  // Job Editor
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobTitle | null>(null);
  const [jobName, setJobName] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [isSavingJob, setIsSavingJob] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'tenants' | 'departments' | 'jobTitles', label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: tenants, refresh: refreshTenants, isLoading: tenantsLoading } = usePluggableCollection<Tenant>('tenants');
  const { data: departments, refresh: refreshDepts, isLoading: deptsLoading } = usePluggableCollection<Department>('departments');
  const { data: jobTitles, refresh: refreshJobs, isLoading: jobsLoading } = usePluggableCollection<JobTitle>('jobTitles');

  const isSuperAdmin = user?.role === 'superAdmin';

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

  const handleCreateTenant = async () => {
    if (!tenantName || !tenantSlug) return;
    setIsSavingTenant(true);
    const id = editingTenant?.id || `t-${Math.random().toString(36).substring(2, 7)}`;
    const isNew = !editingTenant;
    
    const data: Tenant = {
      ...editingTenant,
      id,
      name: tenantName,
      slug: tenantSlug.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      region: tenantRegion,
      companyDescription: tenantDescription,
      logoUrl: tenantLogoUrl,
      status: editingTenant?.status || 'active',
      createdAt: editingTenant?.createdAt || new Date().toISOString(),
    } as Tenant;

    try {
      const res = await saveCollectionRecord('tenants', id, data, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: id,
          actorUid: user?.email || 'system',
          action: isNew ? `Mandant erstellt: ${tenantName}` : `Mandant aktualisiert: ${tenantName}`,
          entityType: 'tenant',
          entityId: id,
          before: isNew ? null : editingTenant,
          after: data
        });

        setIsTenantDialogOpen(false);
        refreshTenants();
        toast({ title: "Mandant gespeichert" });
      }
    } finally {
      setIsSavingTenant(false);
    }
  };

  const handleCreateSub = async () => {
    if (!newName || !activeAddParent) return;
    const id = `${activeAddParent.type === 'tenant' ? 'd' : 'j'}-${Math.random().toString(36).substring(2, 7)}`;
    
    if (activeAddParent.type === 'tenant') {
      const deptData = { id, tenantId: activeAddParent.id, name: newName, status: 'active' };
      await saveCollectionRecord('departments', id, deptData, dataSource);
      await logAuditEventAction(dataSource, {
        tenantId: activeAddParent.id,
        actorUid: user?.email || 'system',
        action: `Abteilung erstellt: ${newName}`,
        entityType: 'department',
        entityId: id,
        after: deptData
      });
      refreshDepts();
    } else {
      const dept = departments?.find(d => d.id === activeAddParent.id);
      if (!dept) return;
      const jobData = { id, tenantId: dept.tenantId, departmentId: activeAddParent.id, name: newName, status: 'active' };
      await saveCollectionRecord('jobTitles', id, jobData, dataSource);
      await logAuditEventAction(dataSource, {
        tenantId: dept.tenantId,
        actorUid: user?.email || 'system',
        action: `Stelle erstellt: ${newName} (Abt: ${dept.name})`,
        entityType: 'jobTitle',
        entityId: id,
        after: jobData
      });
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
      await logAuditEventAction(dataSource, {
        tenantId: item.tenantId || item.id || 'global',
        actorUid: user?.email || 'system',
        action: `${newStatus === 'archived' ? 'Archivierung' : 'Reaktivierung'}: ${item.name}`,
        entityType: coll.slice(0, -1), // simplified
        entityId: item.id,
        after: updated
      });

      if (coll === 'tenants') refreshTenants();
      if (coll === 'departments') refreshDepts();
      if (coll === 'jobTitles') refreshJobs();
      toast({ title: "Status aktualisiert" });
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteCollectionRecord(deleteTarget.type, deleteTarget.id, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: 'global',
          actorUid: user?.email || 'system',
          action: `Permanente Löschung: ${deleteTarget.label} (${deleteTarget.type})`,
          entityType: deleteTarget.type,
          entityId: deleteTarget.id
        });

        toast({ title: "Eintrag permanent gelöscht" });
        if (deleteTarget.type === 'tenants') refreshTenants();
        if (deleteTarget.type === 'departments') refreshDepts();
        if (deleteTarget.type === 'jobTitles') refreshJobs();
        setDeleteTarget(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const openTenantEdit = (tenant: Partial<Tenant>) => {
    setEditingTenant(tenant);
    setTenantName(tenant.name || '');
    setTenantSlug(tenant.slug || '');
    setTenantRegion(tenant.region || 'EU-DSGVO');
    setTenantDescription(tenant.companyDescription || '');
    setTenantLogoUrl(tenant.logoUrl || '');
    setIsTenantDialogOpen(true);
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
      const updatedJob = { ...editingJob, name: jobName, description: jobDesc };
      const res = await saveCollectionRecord('jobTitles', editingJob.id, updatedJob, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: editingJob.tenantId,
          actorUid: user?.email || 'system',
          action: `Stelle aktualisiert: ${jobName}`,
          entityType: 'jobTitle',
          entityId: editingJob.id,
          before: editingJob,
          after: updatedJob
        });

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
          <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">Organisationsstruktur</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Mandanten & Stellenplan</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Zentrale Verwaltung der Standorte, Abteilungen und Rollenprofile.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className={cn("h-9 rounded-md font-bold text-xs", showArchived && "text-orange-600 bg-orange-50")} 
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
            {showArchived ? 'Aktive Ansicht' : 'Archiv'}
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs" onClick={() => { setEditingTenant(null); setTenantName(''); setTenantSlug(''); setTenantRegion('EU-DSGVO'); setTenantDescription(''); setTenantLogoUrl(''); setIsTenantDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Neuer Mandant
          </Button>
        </div>
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <Input 
          placeholder="Nach Name, Abteilung oder Stelle suchen..." 
          className="pl-9 h-10 rounded-md border-slate-200 bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {(tenantsLoading || deptsLoading || jobsLoading) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            <p className="text-[10px] font-bold text-slate-400">Lade Struktur...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed rounded-xl bg-white/50">
            <p className="text-xs font-bold text-slate-400">Keine Mandanten oder Übereinstimmungen gefunden.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredData.map(tenant => (
              <Card key={tenant.id} className="border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50/80 dark:bg-slate-900/80 border-b p-4 px-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm border border-primary/10 overflow-hidden">
                      {tenant.logoUrl ? (
                        <img src={tenant.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <Building2 className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white">{tenant.name}</CardTitle>
                        <Badge variant="outline" className="text-[8px] font-bold h-4 px-1">{tenant.region}</Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold">{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold hover:bg-primary/5 gap-1.5" onClick={() => openTenantEdit(tenant)}>
                      <Settings2 className="w-3.5 h-3.5" /> Details
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold hover:bg-primary/5 gap-1.5" onClick={() => setActiveAddParent({ id: tenant.id, type: 'tenant' })}>
                      <PlusCircle className="w-3.5 h-3.5 text-primary" /> Abteilung
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleStatusChange('tenants', tenant, tenant.status === 'active' ? 'archived' : 'active')}>
                      <Archive className="w-3.5 h-3.5" />
                    </Button>
                    {isSuperAdmin && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget({ id: tenant.id, type: 'tenants', label: tenant.name })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tenant.departments.map(dept => (
                      <div key={dept.id} className="group/dept">
                        <div className="flex items-center justify-between p-4 px-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
                              <Layers className="w-4 h-4" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{dept.name}</h4>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover/dept:opacity-100">
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 gap-1" onClick={() => setActiveAddParent({ id: dept.id, type: 'dept' })}>
                              <Plus className="w-3 h-3" /> Stelle
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300" onClick={() => handleStatusChange('departments', dept, dept.status === 'active' ? 'archived' : 'active')}>
                              <Archive className="w-3.5 h-3.5" />
                            </Button>
                            {isSuperAdmin && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-300 hover:text-red-600" onClick={() => setDeleteTarget({ id: dept.id, type: 'departments', label: dept.name })}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-50/30 dark:bg-slate-900/30 px-8 pb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-10 border-l-2 border-slate-100 dark:border-slate-800 ml-4">
                            {dept.jobs.map(job => (
                              <div key={job.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-950 rounded-lg border shadow-sm group/job hover:border-primary/30 transition-all cursor-pointer" onClick={() => openJobEditor(job)}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{job.name}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover/job:opacity-100">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openJobEditor(job); }}><Pencil className="w-3.5 h-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300" onClick={(e) => { e.stopPropagation(); handleStatusChange('jobTitles', job, job.status === 'active' ? 'archived' : 'active'); }}><Archive className="w-3.5 h-3.5" /></Button>
                                  {isSuperAdmin && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-300 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: job.id, type: 'jobTitles', label: job.name }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {activeAddParent?.id === dept.id && activeAddParent.type === 'dept' && (
                              <div className="col-span-full pt-2">
                                <div className="flex gap-2 p-2 bg-white dark:bg-slate-950 rounded-lg border-2 border-primary shadow-sm">
                                  <Input autoFocus placeholder="Name der Stelle..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateSub()} className="h-8 border-none shadow-none text-[11px] font-bold" />
                                  <Button size="sm" className="h-8 px-4 rounded-md font-bold text-[10px]" onClick={handleCreateSub}>Hinzufügen</Button>
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
                          <Input autoFocus placeholder="Abteilungsname..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateSub()} className="h-10 border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-950 text-xs font-bold" />
                          <Button size="sm" className="h-10 px-6 rounded-md font-bold text-[10px]" onClick={handleCreateSub}>Erstellen</Button>
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

      {/* Tenant Dialog */}
      <Dialog open={isTenantDialogOpen} onOpenChange={setIsTenantDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900 border-b shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary border border-primary/10">
                <Building2 className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                {editingTenant ? 'Mandant konfigurieren' : 'Neuer Mandant'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400">Unternehmensname</Label>
                  <Input value={tenantName} onChange={e => setTenantName(e.target.value)} className="rounded-md h-11 border-slate-200 dark:border-slate-800" placeholder="z.B. Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400">System-Alias (Slug)</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                    <Input value={tenantSlug} onChange={e => setTenantSlug(e.target.value)} className="rounded-md h-11 pl-9 border-slate-200 dark:border-slate-800 font-mono text-sm" placeholder="acme-holding" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400">Regulatorischer Rahmen</Label>
                  <Select value={tenantRegion} onValueChange={setTenantRegion}>
                    <SelectTrigger className="rounded-md h-11 border-slate-200 dark:border-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EU-DSGVO">Europa (GDPR / DSGVO)</SelectItem>
                      <SelectItem value="BSI-IT-Grundschutz">Deutschland (BSI Grundschutz)</SelectItem>
                      <SelectItem value="NIST-USA">USA (NIST / HIPAA)</SelectItem>
                      <SelectItem value="ISO-GLOBAL">International (ISO 27001)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400">Unternehmenslogo (URL)</Label>
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                    <Input value={tenantLogoUrl} onChange={e => setTenantLogoUrl(e.target.value)} className="rounded-md h-11 pl-9 border-slate-200 dark:border-slate-800" placeholder="https://..." />
                  </div>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Label className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-primary" /> KI-Kontext (Unternehmensbeschreibung)
                </Label>
                <Textarea 
                  value={tenantDescription} 
                  onChange={e => setTenantDescription(e.target.value)}
                  placeholder="Beschreiben Sie Branche, Größe und Compliance-Ziele für die KI..."
                  className="min-h-[120px] rounded-lg border-slate-200 dark:border-slate-800 text-xs leading-relaxed"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsTenantDialogOpen(false)} className="rounded-md h-10 px-6 font-bold text-[11px]">Abbrechen</Button>
            <Button onClick={handleCreateTenant} disabled={isSavingTenant || !tenantName} className="rounded-md h-10 px-8 bg-primary text-white font-bold text-[11px] gap-2 shadow-lg shadow-primary/20">
              {isSavingTenant ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-lg w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900 border-b shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Briefcase className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Stelle bearbeiten</DialogTitle>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400">Bezeichnung</Label>
                <Input value={jobName} onChange={e => setJobName(e.target.value)} className="rounded-md h-11 font-bold text-sm border-slate-200 dark:border-slate-800" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400">Stellenbeschreibung</Label>
                <Textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} className="min-h-[150px] rounded-lg p-4 text-xs leading-relaxed border-slate-200 dark:border-slate-800" placeholder="Aufgaben & Kompetenzen..." />
              </div>
              <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg flex items-start gap-3 border border-blue-100 dark:border-blue-900/30">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 italic leading-relaxed">Diese Info nutzt die KI für Least-Privilege Checks.</p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="rounded-md h-10 px-6 font-bold text-[11px]">Abbrechen</Button>
            <Button onClick={saveJobEdits} disabled={isSavingJob} className="rounded-md h-10 px-8 bg-primary text-white font-bold text-[11px] gap-2 shadow-lg shadow-primary/20">
              {isSavingJob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(val) => !val && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-headline font-bold text-red-600 text-center">Permanent löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 font-medium leading-relaxed pt-2 text-center">
              Möchten Sie <strong>{deleteTarget?.label}</strong> wirklich permanent löschen? 
              <br/><br/>
              <span className="text-red-600 font-bold">Achtung:</span> Diese Aktion kann nicht rückgängig gemacht werden. Alle verknüpften Unterelemente (Abteilungen, Stellen) werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 gap-3 sm:justify-center">
            <AlertDialogCancel className="rounded-md font-bold text-xs h-11 px-8">Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white rounded-md font-bold text-xs h-11 px-10 gap-2"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Permanent löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
