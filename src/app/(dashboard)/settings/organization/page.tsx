
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  ShieldAlert
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { toast } from '@/hooks/use-toast';
import { Tenant, Department, JobTitle, Entitlement, Resource } from '@/lib/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import { usePlatformAuth } from '@/context/auth-context';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const dynamic = 'force-dynamic';

function escapeXml(unsafe: any) {
  if (unsafe === null || unsafe === undefined) return '';
  return unsafe.toString().replace(/[<>&"']/g, (c: string) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}

function generateOrgChartXml(tenants: Tenant[], depts: Department[], jobs: JobTitle[]) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const NODE_W = 180;
  const NODE_H = 60;
  const GAP_X = 250;
  const GAP_Y = 120;

  tenants.forEach((tenant, tIdx) => {
    const tX = 50;
    const tY = 50 + (tIdx * 400);
    xml += `<mxCell id="${tenant.id}" value="${escapeXml(tenant.name)}" style="rounded=1;fillColor=#0f172a;strokeColor=#1e293b;fontColor=#ffffff;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="${tX}" y="${tY}" width="${NODE_W}" height="${NODE_H}" as="geometry"/></mxCell>`;

    const tDepts = depts.filter(d => d.tenantId === tenant.id);
    tDepts.forEach((dept, dIdx) => {
      const dX = tX + GAP_X;
      const dY = tY + (dIdx * 150);
      xml += `<mxCell id="${dept.id}" value="${escapeXml(dept.name)}" style="rounded=1;fillColor=#f0fdf4;strokeColor=#166534;fontColor=#166534;fontStyle=1;fontSize=11;" vertex="1" parent="1"><mxGeometry x="${dX}" y="${dY}" width="${NODE_W}" height="${NODE_H}" as="geometry"/></mxCell>`;
      xml += `<mxCell id="edge-t-d-${dept.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#94a3b8;strokeWidth=1.5;endArrow=none;" edge="1" parent="1" source="${tenant.id}" target="${dept.id}"><mxGeometry relative="1" as="geometry"/></mxCell>`;

      const dJobs = jobs.filter(j => j.departmentId === dept.id);
      dJobs.forEach((job, jIdx) => {
        const jX = dX + GAP_X;
        const jY = dY + (jIdx * 70);
        xml += `<mxCell id="${job.id}" value="${escapeXml(job.name)}" style="rounded=1;fillColor=#ffffff;strokeColor=#3b82f6;fontColor=#1e40af;fontSize=10;" vertex="1" parent="1"><mxGeometry x="${jX}" y="${jY}" width="${NODE_W}" height="40" as="geometry"/></mxCell>`;
        xml += `<mxCell id="edge-d-j-${job.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#cbd5e1;strokeWidth=1.5;endArrow=none;" edge="1" parent="1" source="${dept.id}" target="${job.id}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
      });
    });
  });

  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function UnifiedOrganizationPage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [isIframeReady, setIsIframeReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  
  const [activeAddParent, setActiveAddParent] = useState<{ id: string, type: 'tenant' | 'dept' } | null>(null);
  const [newName, setNewName] = useState('');

  // Tenant Editor State
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Partial<Tenant> | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantRegion, setTenantRegion] = useState('EU-DSGVO');
  const [tenantDescription, setTenantDescription] = useState('');
  const [isSavingTenant, setIsSavingTenant] = useState(false);

  // Job Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobTitle | null>(null);
  const [jobName, setJobName] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobEntitlementIds, setJobEntitlementIds] = useState<string[]>([]);
  const [isSavingJob, setIsSavingJob] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');

  // Deletion State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'tenants' | 'departments' | 'jobTitles', label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: tenants, refresh: refreshTenants, isLoading: tenantsLoading } = usePluggableCollection<Tenant>('tenants');
  const { data: departments, refresh: refreshDepts, isLoading: deptsLoading } = usePluggableCollection<Department>('departments');
  const { data: jobTitles, refresh: refreshJobs, isLoading: jobsLoading } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');

  useEffect(() => { setMounted(true); }, []);

  const isSuperAdmin = user?.role === 'superAdmin';

  const groupedData = useMemo(() => {
    if (!tenants) return [];
    
    const jobsMap = new Map<string, JobTitle[]>();
    (jobTitles || []).forEach(j => {
      const matchStatus = showArchived ? j.status === 'archived' : j.status !== 'archived';
      if (!matchStatus) return;
      if (!jobsMap.has(j.departmentId)) jobsMap.set(j.departmentId, []);
      jobsMap.get(j.departmentId)?.push(j);
    });

    const deptsMap = new Map<string, any[]>();
    (departments || []).forEach(d => {
      const matchStatus = showArchived ? d.status === 'archived' : d.status !== 'archived';
      if (!matchStatus) return;
      if (!deptsMap.has(d.tenantId)) deptsMap.set(d.tenantId, []);
      deptsMap.get(d.tenantId)?.push({
        ...d,
        jobs: jobsMap.get(d.id) || []
      });
    });

    return tenants
      .filter(t => (showArchived ? t.status === 'archived' : t.status !== 'archived'))
      .map(tenant => ({
        ...tenant,
        departments: deptsMap.get(tenant.id) || []
      }))
      .filter(t => {
        if (!search) return true;
        const s = search.toLowerCase();
        return t.name.toLowerCase().includes(s) || 
               t.departments.some((d: any) => d.name.toLowerCase().includes(s) || d.jobs.some((j: any) => j.name.toLowerCase().includes(s)));
      });
  }, [tenants, departments, jobTitles, search, showArchived]);

  const syncChart = useCallback(() => {
    if (!iframeRef.current || !isIframeReady) return;
    const xml = generateOrgChartXml(tenants || [], departments || [], jobTitles || []);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 1 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 500);
  }, [tenants, departments, jobTitles, isIframeReady]);

  useEffect(() => {
    if (activeTab === 'chart' && isIframeReady) syncChart();
  }, [activeTab, isIframeReady, syncChart]);

  const handleSaveTenant = async () => {
    if (!tenantName) return;
    setIsSavingTenant(true);
    const id = editingTenant?.id || `t-${Math.random().toString(36).substring(2, 7)}`;
    const data: Tenant = {
      ...editingTenant,
      id,
      name: tenantName,
      slug: tenantSlug || tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      region: tenantRegion,
      companyDescription: tenantDescription,
      status: editingTenant?.status || 'active',
      createdAt: editingTenant?.createdAt || new Date().toISOString(),
    } as Tenant;

    const res = await saveCollectionRecord('tenants', id, data, dataSource);
    if (res.success) {
      setIsTenantDialogOpen(false);
      refreshTenants();
      toast({ title: "Mandant gespeichert" });
    }
    setIsSavingTenant(false);
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

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deleteCollectionRecord(deleteTarget.type, deleteTarget.id, dataSource);
    if (res.success) {
      toast({ title: "Eintrag permanent gelöscht" });
      if (deleteTarget.type === 'tenants') refreshTenants();
      if (deleteTarget.type === 'departments') refreshDepts();
      if (deleteTarget.type === 'jobTitles') refreshJobs();
      setDeleteTarget(null);
    }
    setIsDeleting(false);
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
    const updatedJob = { ...editingJob, name: jobName, description: jobDesc, entitlementIds: jobEntitlementIds };
    const res = await saveCollectionRecord('jobTitles', editingJob.id, updatedJob, dataSource);
    if (res.success) {
      setIsEditorOpen(false);
      refreshJobs();
      toast({ title: "Rollenprofil (Blueprint) gespeichert" });
    }
    setIsSavingJob(false);
  };

  const filteredEntitlements = useMemo(() => {
    if (!entitlements || !resources) return [];
    return entitlements.filter(e => {
      const res = resources.find(r => r.id === e.resourceId);
      if (activeTenantId !== 'all' && res?.tenantId !== activeTenantId && res?.tenantId !== 'global') return false;
      return e.name.toLowerCase().includes(roleSearch.toLowerCase()) || res?.name.toLowerCase().includes(roleSearch.toLowerCase());
    });
  }, [entitlements, resources, roleSearch, activeTenantId]);

  useEffect(() => {
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') setIsIframeReady(true);
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none uppercase tracking-widest">Organisationsstruktur</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Mandanten &amp; Rollenplan</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zentrale Verwaltung der Standorte, Abteilungen und Rollen-Blueprints.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 h-10 rounded-xl border gap-1">
          <button className={cn("px-4 rounded-lg text-[10px] font-bold uppercase transition-all", activeTab === 'list' ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")} onClick={() => setActiveTab('list')}>Liste</button>
          <button className={cn("px-4 rounded-lg text-[10px] font-bold uppercase transition-all", activeTab === 'chart' ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")} onClick={() => setActiveTab('chart')}>Stammbaum</button>
        </div>
      </div>

      {activeTab === 'list' ? (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="relative group max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="Suchen..." className="pl-9 h-10 rounded-md border-slate-200 bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)} className="h-9 font-bold text-[10px] uppercase">{showArchived ? 'Aktive' : 'Archiv'}</Button>
              <Button size="sm" className="h-9 font-bold text-[10px] uppercase px-6" onClick={() => { setEditingTenant(null); setTenantName(''); setTenantSlug(''); setIsTenantDialogOpen(true); }}><Plus className="w-3.5 h-3.5 mr-2" /> Neuer Mandant</Button>
            </div>
          </div>

          <div className="space-y-4">
            {(tenantsLoading || deptsLoading || jobsLoading) ? (
              <div className="py-20 text-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20 mx-auto" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Synchronisiere Struktur...</p>
              </div>
            ) : groupedData.map(tenant => (
              <Card key={tenant.id} className="border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/80 border-b p-4 px-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary border shadow-sm">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold">{tenant.name}</CardTitle>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingTenant(tenant); setTenantName(tenant.name); setTenantSlug(tenant.slug); setTenantRegion(tenant.region || 'EU-DSGVO'); setTenantDescription(tenant.companyDescription || ''); setIsTenantDialogOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold hover:bg-primary/5 gap-1.5" onClick={() => setActiveAddParent({ id: tenant.id, type: 'tenant' })}>
                      <PlusCircle className="w-3.5 h-3.5 text-primary" /> Abteilung
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => handleStatusChange('tenants', tenant, tenant.status === 'active' ? 'archived' : 'active')}><Archive className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tenant.departments.map((dept: any) => (
                      <div key={dept.id}>
                        <div className="flex items-center justify-between p-4 px-8 hover:bg-slate-50 transition-colors group">
                          <div className="flex items-center gap-3"><Layers className="w-4 h-4 text-emerald-600" /><h4 className="text-xs font-bold">{dept.name}</h4></div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={() => setActiveAddParent({ id: dept.id, type: 'dept' })}><Plus className="w-3 h-3" /> Rolle</Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300" onClick={() => handleStatusChange('departments', dept, dept.status === 'active' ? 'archived' : 'active')}><Archive className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                        <div className="bg-slate-50/30 px-8 pb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-10 border-l-2 ml-4">
                            {dept.jobs?.map((job: any) => (
                              <div key={job.id} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm group hover:border-primary/30 cursor-pointer" onClick={() => openJobEditor(job)}>
                                <div className="flex items-center gap-2 truncate">
                                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                  <div>
                                    <p className="text-[11px] font-bold text-slate-700 truncate">{job.name}</p>
                                    <p className="text-[8px] text-slate-400 font-black uppercase">{job.entitlementIds?.length || 0} Rechte</p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); openJobEditor(job); }}><Pencil className="w-3.5 h-3.5" /></Button>
                              </div>
                            ))}
                            {activeAddParent?.id === dept.id && activeAddParent.type === 'dept' && (
                              <div className="col-span-full pt-2 flex gap-2">
                                <Input autoFocus placeholder="Bezeichnung der Rolle..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateSub()} className="h-8 text-[11px]" />
                                <Button size="sm" className="h-8 px-4 text-[10px]" onClick={handleCreateSub}>Hinzufügen</Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveAddParent(null)}><X className="w-3.5 h-3.5" /></Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {activeAddParent?.id === tenant.id && activeAddParent.type === 'tenant' && (
                      <div className="p-4 px-8 bg-primary/5 flex items-center gap-3">
                        <Input autoFocus placeholder="Name der Abteilung..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateSub()} className="h-10 text-xs" />
                        <Button size="sm" className="h-10 px-6" onClick={handleCreateSub}>Erstellen</Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setActiveAddParent(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white border rounded-2xl h-[calc(100vh-250px)] relative overflow-hidden">
          <div className="absolute top-6 right-6 z-10 bg-white/95 backdrop-blur-md shadow-2xl border rounded-xl p-1.5 flex flex-col gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => setIsLocked(!isLocked)} className={cn("h-9 w-9", isLocked && "bg-amber-50 text-amber-600")}><Lock className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={syncChart} className="h-9 w-9"><RefreshCw className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*')} className="h-9 w-9"><Maximize2 className="w-4 h-4" /></Button>
          </div>
          <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
        </div>
      )}

      {/* Tenant Dialog */}
      <Dialog open={isTenantDialogOpen} onOpenChange={setIsTenantDialogOpen}>
        <DialogContent className="max-w-md rounded-xl shadow-2xl border-none">
          <DialogHeader>
            <DialogTitle>{editingTenant ? 'Mandant bearbeiten' : 'Neuer Mandant'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5"><Label>Name</Label><Input value={tenantName} onChange={e => setTenantName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Slug</Label><Input value={tenantSlug} onChange={e => setTenantSlug(e.target.value)} placeholder="alias-id" /></div>
            <div className="space-y-1.5"><Label>Regulatorik</Label>
              <Select value={tenantRegion} onValueChange={setTenantRegion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="EU-DSGVO">EU-DSGVO</SelectItem><SelectItem value="BSI-Grundschutz">BSI Grundschutz</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>KI-Kontext (Firma)</Label><Textarea value={tenantDescription} onChange={e => setTenantDescription(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsTenantDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveTenant} disabled={isSavingTenant}>{isSavingTenant ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4 mr-2" />} Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Editor (Blueprint) */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-10">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary border border-white/10 shadow-lg"><Briefcase className="w-6 h-6" /></div>
                <div><DialogTitle className="text-lg font-bold">Rollenprofil (Blueprint)</DialogTitle><DialogDescription className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">Soll-Berechtigungen für {jobName}</DialogDescription></div>
              </div>
              <AiFormAssistant formType="gdpr" currentData={{ jobName, jobDesc }} onApply={(s) => { if(s.name) setJobName(s.name); if(s.description) setJobDesc(s.description); }} />
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-white border-b h-12 px-6 justify-start rounded-none gap-8">
              <TabsTrigger value="base" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Stammdaten</TabsTrigger>
              <TabsTrigger value="roles" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Berechtigungen</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1 bg-slate-50/30">
              <div className="p-8 space-y-8">
                <TabsContent value="base" className="mt-0 space-y-6">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Bezeichnung</Label><Input value={jobName} onChange={e => setJobName(e.target.value)} className="h-11 font-bold text-sm bg-white" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Stellenbeschreibung (für KI Audit)</Label><Textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} className="min-h-[150px] p-4 text-xs leading-relaxed bg-white" /></div>
                </TabsContent>
                <TabsContent value="roles" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Standard-Rechte ({jobEntitlementIds.length} gewählt)</Label>
                    <div className="relative group"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" /><Input placeholder="Rollen filtern..." value={roleSearch} onChange={e => setRoleSearch(e.target.value)} className="h-8 pl-8 text-[10px] w-48 bg-white" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {filteredEntitlements.map(ent => {
                      const res = resources?.find(r => r.id === ent.resourceId);
                      const isSelected = jobEntitlementIds.includes(ent.id);
                      return (
                        <div key={ent.id} className={cn("p-3 border rounded-xl flex items-center gap-3 transition-all cursor-pointer shadow-sm", isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/10" : "bg-white border-slate-100 hover:border-slate-200")} onClick={() => setJobEntitlementIds(prev => isSelected ? prev.filter(id => id !== ent.id) : [...prev, ent.id])}>
                          <Checkbox checked={isSelected} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-slate-800 truncate">{ent.name}</p>
                            <p className="text-[8px] font-black uppercase text-slate-400">{res?.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-4 bg-slate-50 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="rounded-xl font-bold text-[10px] uppercase h-11 px-8">Abbrechen</Button>
            <Button onClick={saveJobEdits} disabled={isSavingJob} className="rounded-xl font-bold text-[10px] uppercase h-11 px-12 bg-primary text-white shadow-lg gap-2">{isSavingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />} Blueprint speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Permanent löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">Möchten Sie <strong>{deleteTarget?.label}</strong> wirklich unwiderruflich entfernen? Alle untergeordneten Verknüpfungen gehen verloren.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white" disabled={isDeleting}>{isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Löschen'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
