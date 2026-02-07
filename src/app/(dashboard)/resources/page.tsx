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
  GitGraph,
  AlertTriangle,
  Link as LinkIcon,
  User as UserIcon,
  FileText,
  Lock,
  Globe,
  Database,
  Fingerprint,
  ChevronRight,
  Shield,
  RefreshCw,
  Eye,
  CheckCircle2,
  FileCheck,
  Server,
  Monitor,
  Layout,
  HardDrive,
  Save,
  HelpCircle,
  ClipboardList,
  ClipboardCheck,
  Archive,
  RotateCcw,
  Download,
  X
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  deleteDocumentNonBlocking, 
  setDocumentNonBlocking,
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { Entitlement, Tenant, Resource, Risk, RiskMeasure, ProcessingActivity, DataSubjectGroup } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { exportResourcesExcel } from '@/lib/export-utils';

export default function ResourcesPage() {
  const db = useFirestore();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isEntitlementListOpen, setIsEntitlementListOpen] = useState(false);

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

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
  const [hasSpecialCategoryData, setHasSpecialCategoryData] = useState(false);
  const [affectedGroups, setAffectedGroups] = useState<string[]>([]);
  const [processingPurpose, setProcessingPurpose] = useState('');
  const [dataLocation, setDataLocation] = useState('');
  const [vvtIds, setVvtIds] = useState<string[]>([]);
  
  // Architektur & Risiko
  const [isInternetExposed, setIsInternetExposed] = useState(false);
  const [isBusinessCritical, setIsBusinessCritical] = useState(false);
  const [isSpof, setIsSpof] = useState(false);
  const [measureIds, setMeasureIds] = useState<string[]>([]);
  
  // Verantwortung
  const [systemOwner, setSystemOwner] = useState('');
  const [operatorId, setOperatorId] = useState('internal');
  const [riskOwner, setRiskOwner] = useState('');
  const [dataOwner, setDataOwner] = useState('');
  
  // IAM
  const [mfaType, setMfaType] = useState<Resource['mfaType']>('none');
  const [authMethod, setAuthMethod] = useState('direct');
  
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
  const { data: subjectGroups } = usePluggableCollection<DataSubjectGroup>('dataSubjectGroups');
  const { data: vvts } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: allMeasures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: entitlements, refresh: refreshEnts } = usePluggableCollection<Entitlement>('entitlements');

  useEffect(() => {
    setMounted(true);
  }, []);

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
      hasSpecialCategoryData,
      affectedGroups,
      processingPurpose,
      dataLocation,
      vvtIds,
      measureIds,
      isInternetExposed,
      isBusinessCritical,
      isSpof,
      systemOwner,
      operatorId,
      riskOwner,
      dataOwner,
      mfaType,
      authMethod,
      url: resUrl || '#',
      documentationUrl: resDocUrl,
      notes,
      createdAt: selectedResource?.createdAt || new Date().toISOString()
    };

    try {
      const res = await saveCollectionRecord('resources', id, data, dataSource);
      if (res.success) {
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
    const data: Entitlement = {
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
      toast({ title: newStatus === 'archived' ? "System archiviert" : "System reaktiviert" });
      refreshResources();
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
    setHasSpecialCategoryData(!!res.hasSpecialCategoryData);
    setAffectedGroups(res.affectedGroups || []);
    setProcessingPurpose(res.processingPurpose || '');
    setDataLocation(res.dataLocation || '');
    setVvtIds(res.vvtIds || []);
    setMeasureIds(res.measureIds || []);
    setIsInternetExposed(!!res.isInternetExposed);
    setIsBusinessCritical(!!res.isBusinessCritical);
    setIsSpof(!!res.isSpof);
    setSystemOwner(res.systemOwner || '');
    setOperatorId(res.operatorId || 'internal');
    setRiskOwner(res.riskOwner || '');
    setDataOwner(res.dataOwner || '');
    setMfaType(res.mfaType || 'none');
    setAuthMethod(res.authMethod || 'direct');
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
    setHasSpecialCategoryData(false);
    setAffectedGroups([]);
    setProcessingPurpose('');
    setDataLocation('');
    setVvtIds([]);
    setMeasureIds([]);
    setIsInternetExposed(false);
    setIsBusinessCritical(false);
    setIsSpof(false);
    setSystemOwner('');
    setOperatorId('internal');
    setRiskOwner('');
    setDataOwner('');
    setMfaType('none');
    setAuthMethod('direct');
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
    if (s.dataLocation) setDataLocation(s.dataLocation);
    toast({ title: "KI-Vorschläge übernommen" });
  };

  const applyAiSuggestionsEnt = (s: any) => {
    if (s.name) setEntName(s.name);
    if (s.description) setEntDesc(s.description);
    if (s.riskLevel) setEntRisk(s.riskLevel);
    toast({ title: "KI-Rollen Vorschläge übernommen" });
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
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ressourcenkatalog</h1>
          <p className="text-sm text-muted-foreground">Compliance- & Risiko-Inventar für {activeTenantId === 'all' ? 'alle Firmen' : getTenantSlug(activeTenantId)}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[9px] rounded-none border-primary/20 text-primary bg-primary/5" onClick={() => exportResourcesExcel(filteredResources)}>
            <Download className="w-3.5 h-3.5 mr-2" /> Excel Export
          </Button>
          <Button variant="ghost" size="sm" className="h-9 font-bold uppercase text-[9px] rounded-none gap-2" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {showArchived ? 'Aktive' : 'Archiv'}
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { resetResourceForm(); setIsResourceDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> System registrieren
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Systeme oder Besitzer suchen..." 
          className="pl-10 h-10 border border-input bg-white dark:bg-slate-950 rounded-none" 
          value={search} onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-4 font-bold uppercase text-[10px]">Anwendung / Asset</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Kategorie / CIA</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">DSGVO</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Owner</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.map((resource) => (
                <TableRow key={resource.id} className={cn("hover:bg-muted/5 border-b", resource.status === 'archived' && "opacity-60")}>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-600 rounded-none border"><Server className="w-4 h-4" /></div>
                      <div>
                        <div className="font-bold text-sm">{resource.name}</div>
                        <div className="text-[9px] text-muted-foreground uppercase font-black">{resource.assetType} | {resource.operatingModel}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none py-0 h-4 bg-muted/20 w-fit">{resource.category}</Badge>
                      <span className="text-[8px] font-black uppercase text-slate-400">CIA: {resource.confidentialityReq?.charAt(0)}|{resource.integrityReq?.charAt(0)}|{resource.availabilityReq?.charAt(0)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {resource.hasPersonalData ? <FileCheck className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-slate-300" />}
                  </TableCell>
                  <TableCell className="text-xs font-bold uppercase">{resource.systemOwner || '---'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 rounded-none">
                        <DropdownMenuItem onSelect={() => { setSelectedResource(resource); setIsEntitlementListOpen(true); }}><Settings2 className="w-3.5 h-3.5 mr-2" /> Rollen verwalten</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openResourceEdit(resource)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className={resource.status === 'archived' ? "text-emerald-600" : "text-red-600"} onSelect={() => handleStatusChange(resource, resource.status === 'archived' ? 'active' : 'archived')}>
                          {resource.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
                          {resource.status === 'archived' ? 'Reaktivieren' : 'Archivieren'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isResourceDialogOpen} onOpenChange={setIsResourceDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] md:w-full h-[95vh] md:h-[90vh] rounded-[1.5rem] md:rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-3">
                <Network className="w-5 h-5 text-primary" />
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">System registrieren</DialogTitle>
              </div>
              <AiFormAssistant 
                formType="resource" 
                currentData={{ name, assetType, category, operatingModel, criticality }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b bg-slate-50 shrink-0 overflow-x-auto no-scrollbar">
              <TabsList className="h-12 bg-transparent gap-6 p-0 w-max">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-4 text-[10px] font-bold uppercase">Stammdaten</TabsTrigger>
                <TabsTrigger value="risk" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-4 text-[10px] font-bold uppercase">Risiko & Schutzbedarf</TabsTrigger>
                <TabsTrigger value="gdpr" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-4 text-[10px] font-bold uppercase">DSGVO</TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6 md:p-8">
                <TabsContent value="base" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-bold uppercase">Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="rounded-none h-10 font-bold" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Asset-Typ</Label><Select value={assetType} onValueChange={(v:any) => setAssetType(v)}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="Hardware">Hardware</SelectItem><SelectItem value="Software">Software</SelectItem><SelectItem value="SaaS">SaaS</SelectItem><SelectItem value="Infrastruktur">Infrastruktur</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Kategorie</Label><Select value={category} onValueChange={(v:any) => setCategory(v)}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="Fachanwendung">Fachanwendung</SelectItem><SelectItem value="Infrastruktur">Infrastruktur</SelectItem><SelectItem value="Sicherheitskomponente">Sicherheitskomponente</SelectItem><SelectItem value="Support-Tool">Support-Tool</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Modell</Label><Select value={operatingModel} onValueChange={(v:any) => setOperatingModel(v)}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="On-Prem">On-Prem</SelectItem><SelectItem value="Cloud">Cloud</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Owner</Label><Input value={systemOwner} onChange={e => setSystemOwner(e.target.value)} className="rounded-none h-10" /></div>
                  </div>
                </TabsContent>
                <TabsContent value="risk" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Vertraulichkeit</Label><Select value={confReq} onValueChange={(v:any) => setConfReq(v)}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="low">Niedrig</SelectItem><SelectItem value="medium">Mittel</SelectItem><SelectItem value="high">Hoch</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Integrität</Label><Select value={intReq} onValueChange={(v:any) => setIntReq(v)}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="low">Niedrig</SelectItem><SelectItem value="medium">Mittel</SelectItem><SelectItem value="high">Hoch</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Verfügbarkeit</Label><Select value={availReq} onValueChange={(v:any) => setAvailReq(v)}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="low">Niedrig</SelectItem><SelectItem value="medium">Mittel</SelectItem><SelectItem value="high">Hoch</SelectItem></SelectContent></Select></div>
                  </div>
                </TabsContent>
                <TabsContent value="gdpr" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-none bg-slate-50">
                    <Label className="text-[10px] font-bold uppercase">Personenbezogene Daten</Label>
                    <Switch checked={hasPersonalData} onCheckedChange={setHasPersonalData} />
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Zweck der Verarbeitung</Label><Textarea value={processingPurpose} onChange={e => setProcessingPurpose(e.target.value)} className="rounded-none min-h-[100px]" /></div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setIsResourceDialogOpen(false)} className="w-full sm:w-auto rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleSaveResource} disabled={isSaving || !name} className="w-full sm:w-auto rounded-none h-10 px-12 font-bold uppercase text-[10px] bg-slate-900 text-white gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Asset Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntitlementListOpen} onOpenChange={setIsEntitlementListOpen}>
        <DialogContent className="max-w-4xl w-[95vw] md:w-full rounded-[1.5rem] md:rounded-none h-[90vh] md:h-[80vh] p-0 overflow-hidden flex flex-col border-2 shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-emerald-500" />
                <DialogTitle className="text-sm font-bold uppercase">Rollen für {selectedResource?.name}</DialogTitle>
              </div>
              <Button size="sm" onClick={() => { setSelectedEnt(null); setEntName(''); setEntDesc(''); setEntRisk('low'); setEntIsAdmin(false); setEntMapping(''); setIsEntDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-2" /> Neue Rolle
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-2">
              {entitlements?.filter(e => e.resourceId === selectedResource?.id).map(e => (
                <div key={e.id} className="p-4 border bg-white flex items-center justify-between group hover:border-emerald-500 transition-all">
                  <div>
                    <p className="font-bold text-sm flex items-center gap-2">
                      {e.isAdmin && <ShieldAlert className="w-3.5 h-3.5 text-red-600" />}
                      {e.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">{e.riskLevel} RISIKO</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedEnt(e); setEntName(e.name); setEntDesc(e.description); setEntRisk(e.riskLevel); setEntIsAdmin(!!e.isAdmin); setEntMapping(e.externalMapping || ''); setIsEntDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => { if(confirm("Rolle löschen?")) deleteCollectionRecord('entitlements', e.id, dataSource).then(() => refreshEnts()); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
            <Button onClick={() => setIsEntitlementListOpen(false)} className="w-full sm:w-auto rounded-none h-10 px-8">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntDialogOpen} onOpenChange={setIsEntDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] md:w-full rounded-[1.5rem] md:rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-xl bg-white">
          <DialogHeader className="p-6 bg-slate-100 shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-emerald-600" />
                <DialogTitle className="text-xs font-black uppercase">{selectedEnt ? 'Rolle bearbeiten' : 'Neue Rolle'}</DialogTitle>
              </div>
              <AiFormAssistant 
                formType="gdpr" 
                currentData={{ name: entName, description: entDesc, riskLevel: entRisk }} 
                onApply={applyAiSuggestionsEnt} 
              />
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Bezeichnung</Label><Input value={entName} onChange={e => setEntName(e.target.value)} className="rounded-none h-10" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Risiko-Level</Label><Select value={entRisk} onValueChange={(v:any) => setEntRisk(v)}><SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
              <div className="flex items-center justify-between p-3 border rounded-none bg-slate-50">
                <Label className="text-[10px] font-bold uppercase">Admin-Rolle</Label>
                <Switch checked={entIsAdmin} onCheckedChange={setEntIsAdmin} />
              </div>
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Beschreibung</Label><Textarea value={entDesc} onChange={e => setEntDesc(e.target.value)} className="rounded-none h-24" /></div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsEntDialogOpen(false)} className="w-full sm:w-auto rounded-none">Abbrechen</Button>
            <Button onClick={handleSaveEnt} disabled={isSaving || !entName} className="w-full sm:w-auto rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[10px] h-10">Rolle Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
