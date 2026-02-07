"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Pencil, 
  Network,
  ShieldAlert,
  Settings2,
  Info,
  Layers,
  ChevronRight,
  Shield,
  RefreshCw,
  Server,
  Save,
  Archive,
  RotateCcw,
  Download,
  X,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking,
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { Entitlement, Tenant, Resource, Risk, RiskMeasure, ProcessingActivity, DataSubjectGroup } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { exportResourcesExcel } from '@/lib/export-utils';
import { usePlatformAuth } from '@/context/auth-context';

export default function ResourcesPage() {
  const db = useFirestore();
  const { user } = usePlatformAuth();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isEntitlementListOpen, setIsEntitlementListOpen] = useState(false);

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'resources' | 'entitlements', label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Resource Form State
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<Resource['assetType']>('Software');
  const [category, setCategory] = useState<Resource['category']>('Fachanwendung');
  const [operatingModel, setOperatingModel] = useState<Resource['operatingModel']>('Cloud');
  const [criticality, setCriticality] = useState<Resource['criticality']>('medium');
  const [dataClassification, setDataClassification] = useState<Resource['dataClassification']>('internal');
  
  // Schutzbedarf
  const [confReq, setConfReq] = useState<Resource['confidentialityReq']>('medium');
  const [intReq, setIntReq] = useState<Resource['integrityReq']>('medium');
  const [availReq, setAvailReq] = useState<Resource['availabilityReq']>('medium');
  
  // DSGVO
  const [hasPersonalData, setHasPersonalData] = useState(false);
  const [processingPurpose, setProcessingPurpose] = useState('');
  const [systemOwner, setSystemOwner] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resDocUrl, setResDocUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Entitlement Form State
  const [isEntDialogOpen, setIsEntDialogOpen] = useState(false);
  const [selectedEnt, setSelectedEnt] = useState<Entitlement | null>(null);
  const [entName, setEntName] = useState('');
  const [entDesc, setEntDesc] = useState('');
  const [entRisk, setEntRisk] = useState<'low' | 'medium' | 'high'>('low');
  const [entIsAdmin, setEntIsAdmin] = useState(false);
  const [entMapping, setEntMapping] = useState('');

  const { data: resources, isLoading, refresh: refreshResources } = usePluggableCollection<Resource>('resources');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: entitlements, refresh: refreshEnts } = usePluggableCollection<Entitlement>('entitlements');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperAdmin = user?.role === 'superAdmin';

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'global' || id === 'all') return 'global';
    const tenant = tenants?.find(t => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const handleSaveResource = async () => {
    if (!name) return;
    setIsSaving(true);
    const id = selectedResource?.id || `res-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    const isNew = !selectedResource;

    const data: Resource = {
      ...selectedResource,
      id,
      tenantId: targetTenantId,
      name,
      status: selectedResource?.status || 'active',
      assetType,
      category,
      operatingModel,
      criticality,
      dataClassification,
      confidentialityReq: confReq,
      integrityReq: intReq,
      availabilityReq: availReq,
      hasPersonalData,
      processingPurpose,
      systemOwner,
      url: resUrl || '#',
      documentationUrl: resDocUrl,
      notes,
      createdAt: selectedResource?.createdAt || new Date().toISOString()
    } as Resource;

    try {
      const res = await saveCollectionRecord('resources', id, data, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: targetTenantId,
          actorUid: user?.email || 'system',
          action: isNew ? `System registriert: ${name}` : `System aktualisiert: ${name}`,
          entityType: 'resource',
          entityId: id,
          before: isNew ? null : selectedResource,
          after: data
        });

        toast({ title: "System gespeichert" });
        setIsResourceDialogOpen(false);
        refreshResources();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEnt = async () => {
    if (!entName || !selectedResource) return;
    setIsSaving(true);
    const id = selectedEnt?.id || `ent-${Math.random().toString(36).substring(2, 9)}`;
    const isNew = !selectedEnt;
    const data: Entitlement = {
      ...selectedEnt,
      id,
      resourceId: selectedResource.id,
      name: entName,
      description: entDesc,
      riskLevel: entRisk,
      isAdmin: entIsAdmin,
      externalMapping: entMapping,
      tenantId: selectedResource.tenantId
    };

    try {
      const res = await saveCollectionRecord('entitlements', id, data, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: selectedResource.tenantId || 'global',
          actorUid: user?.email || 'system',
          action: isNew ? `Rolle definiert: ${entName} (System: ${selectedResource.name})` : `Rolle aktualisiert: ${entName}`,
          entityType: 'entitlement',
          entityId: id,
          before: isNew ? null : selectedEnt,
          after: data
        });

        toast({ title: "Rolle gespeichert" });
        setIsEntDialogOpen(false);
        refreshEnts();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (res: Resource, newStatus: 'active' | 'archived') => {
    const updated = { ...res, status: newStatus };
    const result = await saveCollectionRecord('resources', res.id, updated, dataSource);
    if (result.success) {
      await logAuditEventAction(dataSource, {
        tenantId: res.tenantId || 'global',
        actorUid: user?.email || 'system',
        action: `${newStatus === 'archived' ? 'System archiviert' : 'System reaktiviert'}: ${res.name}`,
        entityType: 'resource',
        entityId: res.id,
        after: updated
      });

      toast({ title: newStatus === 'archived' ? "System archiviert" : "System reaktiviert" });
      refreshResources();
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
          entityType: deleteTarget.type === 'resources' ? 'resource' : 'entitlement',
          entityId: deleteTarget.id
        });

        toast({ title: "Eintrag permanent gelöscht" });
        if (deleteTarget.type === 'resources') refreshResources();
        if (deleteTarget.type === 'entitlements') refreshEnts();
        setDeleteTarget(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const openResourceEdit = (res: Resource) => {
    setSelectedResource(res);
    setName(res.name);
    setAssetType(res.assetType || 'Software');
    setCategory(res.category || 'Fachanwendung');
    setOperatingModel(res.operatingModel || 'Cloud');
    setCriticality(res.criticality || 'medium');
    setDataClassification(res.dataClassification || 'internal');
    setConfReq(res.confidentialityReq || 'medium');
    setIntReq(res.integrityReq || 'medium');
    setAvailReq(res.availabilityReq || 'medium');
    setHasPersonalData(!!res.hasPersonalData);
    setProcessingPurpose(res.processingPurpose || '');
    setSystemOwner(res.systemOwner || '');
    setResUrl(res.url);
    setResDocUrl(res.documentationUrl || '');
    setNotes(res.notes || '');
    setIsResourceDialogOpen(true);
  };

  const resetResourceForm = () => {
    setSelectedResource(null);
    setName('');
    setAssetType('Software');
    setCategory('Fachanwendung');
    setOperatingModel('Cloud');
    setCriticality('medium');
    setDataClassification('internal');
    setConfReq('medium');
    setIntReq('medium');
    setAvailReq('medium');
    setHasPersonalData(false);
    setProcessingPurpose('');
    setSystemOwner('');
    setResUrl('');
    setResDocUrl('');
    setNotes('');
  };

  const applyAiSuggestions = (s: any) => {
    if (s.name) setName(s.name);
    if (s.assetType) setAssetType(s.assetType);
    if (s.category) setCategory(s.category);
    if (s.operatingModel) setOperatingModel(s.operatingModel);
    if (s.criticality) setCriticality(s.criticality);
    if (s.confidentialityReq) setConfReq(s.confidentialityReq);
    if (s.integrityReq) setIntReq(s.integrityReq);
    if (s.availabilityReq) setAvailReq(s.availabilityReq);
    if (s.processingPurpose) setProcessingPurpose(s.processingPurpose);
    if (s.dataClassification) setDataClassification(s.dataClassification);
    if (s.systemOwner) setSystemOwner(s.systemOwner);
    toast({ title: "KI-Vorschläge übernommen" });
  };

  const applyAiSuggestionsEnt = (s: any) => {
    if (s.name) setEntName(s.name);
    if (s.description) setEntDesc(s.description);
    if (s.riskLevel) setEntRisk(s.riskLevel as any);
    toast({ title: "KI-Vorschläge übernommen" });
  };

  const filteredResources = useMemo(() => {
    if (!resources) return [];
    return resources.filter(res => {
      const isGlobal = res.tenantId === 'global' || !res.tenantId;
      if (activeTenantId !== 'all' && !isGlobal && res.tenantId !== activeTenantId) return false;
      const matchSearch = res.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = showArchived ? res.status === 'archived' : res.status !== 'archived';
      return matchSearch && matchStatus;
    });
  }, [resources, search, activeTenantId, showArchived]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">Plattform Core</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Ressourcenkatalog</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sicherheits- & Compliance-Inventar für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs border-slate-200" onClick={() => exportResourcesExcel(filteredResources)}>
            <Download className="w-3.5 h-3.5 mr-2" /> Export
          </Button>
          <Button variant="ghost" size="sm" className="h-9 rounded-md font-bold text-xs gap-2" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
            {showArchived ? 'Aktive' : 'Archiv'}
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs" onClick={() => { resetResourceForm(); setIsResourceDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> System registrieren
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Nach Name oder Besitzer suchen..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          <button 
            className={cn("px-6 h-full text-[10px] font-bold rounded-sm transition-all whitespace-nowrap", !showArchived ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
            onClick={() => setShowArchived(false)}
          >
            Aktiv
          </button>
          <button 
            className={cn("px-6 h-full text-[10px] font-bold rounded-sm transition-all whitespace-nowrap", showArchived ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
            onClick={() => setShowArchived(true)}
          >
            Archiv
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Anwendung / Asset</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Kategorie / CIA</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">DSGVO</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Owner</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.map((resource) => (
                <TableRow key={resource.id} className={cn("group hover:bg-slate-50 transition-colors border-b last:border-0", resource.status === 'archived' && "opacity-60")}>
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-800">{resource.name}</div>
                        <div className="text-[9px] text-slate-400 font-medium">{resource.assetType} • {resource.operatingModel}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="text-[8px] font-bold h-4 px-1.5 border-slate-200 text-slate-500 w-fit">{resource.category}</Badge>
                      <span className="text-[8px] font-bold text-slate-400">CIA: {resource.confidentialityReq?.charAt(0)}|{resource.integrityReq?.charAt(0)}|{resource.availabilityReq?.charAt(0)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {resource.hasPersonalData ? <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none rounded-full text-[7px] font-bold h-4 px-1.5">DSGVO</Badge> : <span className="text-[8px] text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-700">{resource.systemOwner || '---'}</TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-all" onClick={() => { setSelectedResource(resource); setIsEntitlementListOpen(true); }}>
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-xl border">
                          <DropdownMenuItem onSelect={() => openResourceEdit(resource)} className="rounded-md py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem className={resource.status === 'archived' ? "text-emerald-600 font-bold" : "text-red-600 font-bold"} onSelect={() => handleStatusChange(resource, resource.status === 'archived' ? 'active' : 'archived')}>
                            {resource.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
                            {resource.status === 'archived' ? 'Reaktivieren' : 'Archivieren'}
                          </DropdownMenuItem>
                          {isSuperAdmin && (
                            <DropdownMenuItem className="text-red-600 font-bold" onSelect={() => setDeleteTarget({ id: resource.id, type: 'resources', label: resource.name })}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Permanent löschen
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Resource Edit Dialog */}
      <Dialog open={isResourceDialogOpen} onOpenChange={setIsResourceDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] rounded-xl p-0 overflow-hidden flex flex-col border shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-8">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Network className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold text-slate-900">{selectedResource ? 'System bearbeiten' : 'System registrieren'}</DialogTitle>
                  <DialogDescription className="text-[10px] text-slate-400 font-bold mt-0.5">Stammdaten & Schutzbedarf</DialogDescription>
                </div>
              </div>
              <AiFormAssistant 
                formType="resource" 
                currentData={{ name, assetType, category, operatingModel, criticality }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b shrink-0 overflow-x-auto no-scrollbar">
              <TabsList className="h-10 bg-transparent gap-6 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 text-[10px] font-bold">Stammdaten</TabsTrigger>
                <TabsTrigger value="risk" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 text-[10px] font-bold">Schutzbedarf</TabsTrigger>
                <TabsTrigger value="gdpr" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 text-[10px] font-bold">Datenschutz</TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                <TabsContent value="base" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[11px] font-bold text-slate-400 ml-1">Bezeichnung</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} className="rounded-md h-11 border-slate-200 font-bold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-400 ml-1">Asset-Typ</Label>
                      <Select value={assetType} onValueChange={(v:any) => setAssetType(v)}>
                        <SelectTrigger className="rounded-md h-11 border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-md">
                          <SelectItem value="Hardware" className="text-xs">Hardware</SelectItem>
                          <SelectItem value="Software" className="text-xs">Software</SelectItem>
                          <SelectItem value="SaaS" className="text-xs">SaaS</SelectItem>
                          <SelectItem value="Infrastruktur" className="text-xs">Infrastruktur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-400 ml-1">Kategorie</Label>
                      <Select value={category} onValueChange={(v:any) => setCategory(v)}>
                        <SelectTrigger className="rounded-md h-11 border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-md">
                          <SelectItem value="Fachanwendung" className="text-xs">Fachanwendung</SelectItem>
                          <SelectItem value="Infrastruktur" className="text-xs">Infrastruktur</SelectItem>
                          <SelectItem value="Sicherheitskomponente" className="text-xs">Sicherheitskomponente</SelectItem>
                          <SelectItem value="Support-Tool" className="text-xs">Support-Tool</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-400 ml-1">Modell</Label>
                      <Select value={operatingModel} onValueChange={(v:any) => setOperatingModel(v)}>
                        <SelectTrigger className="rounded-md h-11 border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-md">
                          <SelectItem value="On-Prem" className="text-xs">On-Prem</SelectItem>
                          <SelectItem value="Cloud" className="text-xs">Cloud</SelectItem>
                          <SelectItem value="Hybrid" className="text-xs">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-400 ml-1">System Owner</Label>
                      <Input value={systemOwner} onChange={e => setSystemOwner(e.target.value)} className="rounded-md h-11 border-slate-200 text-sm" placeholder="Name..." />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="risk" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-400 ml-1">Vertraulichkeit</Label>
                      <Select value={confReq} onValueChange={(v:any) => setConfReq(v)}>
                        <SelectTrigger className="rounded-md h-11 border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-md">
                          <SelectItem value="low" className="text-xs">Niedrig</SelectItem>
                          <SelectItem value="medium" className="text-xs">Mittel</SelectItem>
                          <SelectItem value="high" className="text-xs">Hoch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-400 ml-1">Integrität</Label>
                      <Select value={intReq} onValueChange={(v:any) => setIntReq(v)}>
                        <SelectTrigger className="rounded-md h-11 border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-md">
                          <SelectItem value="low" className="text-xs">Niedrig</SelectItem>
                          <SelectItem value="medium" className="text-xs">Mittel</SelectItem>
                          <SelectItem value="high" className="text-xs">Hoch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-400 ml-1">Verfügbarkeit</Label>
                      <Select value={availReq} onValueChange={(v:any) => setAvailReq(v)}>
                        <SelectTrigger className="rounded-md h-11 border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-md">
                          <SelectItem value="low" className="text-xs">Niedrig</SelectItem>
                          <SelectItem value="medium" className="text-xs">Mittel</SelectItem>
                          <SelectItem value="high" className="text-xs">Hoch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="gdpr" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Verarbeitung personenbezogener Daten</Label>
                      <p className="text-[10px] text-slate-400 font-medium">Betrifft die DSGVO-Relevanz dieses Systems.</p>
                    </div>
                    <Switch checked={hasPersonalData} onCheckedChange={setHasPersonalData} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-400 ml-1">Zweck der Verarbeitung</Label>
                    <Textarea value={processingPurpose} onChange={e => setProcessingPurpose(e.target.value)} className="rounded-md min-h-[100px] text-xs leading-relaxed" placeholder="Warum werden diese Daten verarbeitet?" />
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsResourceDialogOpen(false)} className="rounded-md h-10 px-6 font-bold text-[11px]">Abbrechen</Button>
            <Button onClick={handleSaveResource} disabled={isSaving || !name} className="rounded-md h-10 px-8 bg-primary text-white font-bold text-[11px] gap-2 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entitlement Management List */}
      <Dialog open={isEntitlementListOpen} onOpenChange={setIsEntitlementListOpen}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-xl h-[85vh] p-0 overflow-hidden flex flex-col border shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-inner">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">Rollen verwalten</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold text-slate-400 mt-0.5">{selectedResource?.name}</DialogDescription>
                </div>
              </div>
              <Button size="sm" className="h-9 rounded-md font-bold text-[10px] px-6" onClick={() => { setSelectedEnt(null); setEntName(''); setEntDesc(''); setEntRisk('low'); setEntIsAdmin(false); setEntMapping(''); setIsEntDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-2" /> Neue Rolle
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6 bg-slate-50/30">
            <div className="grid grid-cols-1 gap-2">
              {entitlements?.filter(e => e.resourceId === selectedResource?.id).map(e => (
                <div key={e.id} className="p-4 bg-white border border-slate-100 rounded-lg flex items-center justify-between group hover:border-primary/20 transition-all shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", e.isAdmin ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600")}>
                      {e.isAdmin ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800">{e.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{e.riskLevel} Risiko</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => { setSelectedEnt(e); setEntName(e.name); setEntDesc(e.description || ''); setEntRisk(e.riskLevel as any || 'low'); setEntIsAdmin(!!e.isAdmin); setEntMapping(e.externalMapping || ''); setIsEntDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => { 
                      if (isSuperAdmin) {
                        setDeleteTarget({ id: e.id, type: 'entitlements', label: e.name });
                      } else if(confirm("Rolle permanent löschen?")) {
                        deleteCollectionRecord('entitlements', e.id, dataSource).then(() => {
                          logAuditEventAction(dataSource, {
                            tenantId: selectedResource?.tenantId || 'global',
                            actorUid: user?.email || 'system',
                            action: `Rolle gelöscht: ${e.name} (System: ${selectedResource?.name})`,
                            entityType: 'entitlement',
                            entityId: e.id
                          });
                          refreshEnts();
                        });
                      } 
                    }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
              {entitlements?.filter(e => e.resourceId === selectedResource?.id).length === 0 && (
                <div className="py-20 text-center space-y-4 opacity-30 border-2 border-dashed rounded-xl">
                  <Shield className="w-12 h-12 mx-auto" />
                  <p className="text-xs font-bold">Keine Rollen definiert</p>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
            <Button onClick={() => setIsEntitlementListOpen(false)} className="rounded-md h-10 px-8 font-bold text-[11px]">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Edit Dialog - Unified with Roles Management */}
      <Dialog open={isEntDialogOpen} onOpenChange={setIsEntDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900 border-b shrink-0 pr-8">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedEnt ? 'Rolle bearbeiten' : 'Neue Rolle definieren'}
                  </DialogTitle>
                  <DialogDescription className="text-[10px] text-slate-400 font-bold mt-0.5">Berechtigungsumfang & System-Mapping</DialogDescription>
                </div>
              </div>
              <AiFormAssistant 
                formType="gdpr" 
                currentData={{ name: entName, description: entDesc, riskLevel: entRisk, isAdmin: entIsAdmin }} 
                onApply={applyAiSuggestionsEnt} 
              />
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400 ml-1">Bezeichnung der Rolle</Label>
                <Input value={entName} onChange={e => setEntName(e.target.value)} className="rounded-md h-11 border-slate-200 dark:border-slate-800 font-bold text-sm" placeholder="z.B. IT-Admin, Buchhalter..." />
              </div>
              
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400 ml-1">Zugehöriges System (Ressource)</Label>
                <div className="p-3 border rounded-md bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" /> {selectedResource?.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 ml-1">Risiko-Level</Label>
                  <Select value={entRisk} onValueChange={(v: any) => setEntRisk(v)}>
                    <SelectTrigger className="rounded-md h-11 border-slate-200 dark:border-slate-800 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low" className="text-xs">Niedrig (Low)</SelectItem>
                      <SelectItem value="medium" className="text-xs">Mittel (Medium)</SelectItem>
                      <SelectItem value="high" className="text-xs">Hoch (High)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <div className="flex items-center justify-between p-3 border rounded-md bg-slate-50 dark:bg-slate-900 h-11">
                    <Label className="text-[10px] font-bold text-slate-500">Admin-Recht</Label>
                    <Switch checked={entIsAdmin} onCheckedChange={setEntIsAdmin} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400 ml-1">Beschreibung / Berechtigungsumfang</Label>
                <Textarea value={entDesc} onChange={e => setEntDesc(e.target.value)} className="min-h-[100px] rounded-lg border-slate-200 dark:border-slate-800 text-xs leading-relaxed" placeholder="Was darf dieser Nutzer im System?" />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400 ml-1">Technisches Mapping (External ID)</Label>
                <Input value={entMapping} onChange={e => setEntMapping(e.target.value)} className="rounded-md h-11 border-slate-200 dark:border-slate-800 font-mono text-xs" placeholder="role_admin_prod" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsEntDialogOpen(false)} className="rounded-md h-10 px-6 font-bold text-[11px]">Abbrechen</Button>
            <Button onClick={handleSaveEnt} disabled={isSaving || !entName} className="rounded-md h-10 px-8 bg-primary text-white font-bold text-[11px] gap-2 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Rolle speichern
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
              <span className="text-red-600 font-bold">Achtung:</span> Diese Aktion kann nicht rückgängig gemacht werden. Alle verknüpften Daten werden unwiderruflich entfernt.
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
