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
  Download
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

  const { data: resources, isLoading, refresh: refreshResources } = usePluggableCollection<Resource>('resources');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: subjectGroups } = usePluggableCollection<DataSubjectGroup>('dataSubjectGroups');
  const { data: vvts } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: allMeasures } = usePluggableCollection<RiskMeasure>('riskMeasures');

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
      } else throw new Error(res.error || "Fehler beim Speichern");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
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

  const getAssetIcon = (type: string) => {
    switch(type) {
      case 'Hardware': return <HardDrive className="w-4 h-4" />;
      case 'Software': return <Monitor className="w-4 h-4" />;
      case 'SaaS': return <Globe className="w-4 h-4" />;
      case 'Infrastruktur': return <Server className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

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
            {showArchived ? 'Aktive anzeigen' : 'Archiv anzeigen'}
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { resetResourceForm(); setIsResourceDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> System registrieren
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Nach Systemen, Assets oder Besitzern suchen..." 
          className="pl-10 h-10 border border-input bg-white dark:bg-slate-950 px-3 text-sm focus:outline-none rounded-none" 
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
                <TableHead className="font-bold uppercase text-[10px]">Kategorie / Typ</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Compliance & DSGVO</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Owner</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.map((resource) => (
                <TableRow key={resource.id} className={cn("group hover:bg-muted/5 border-b", resource.status === 'archived' && "opacity-60 grayscale-[50%]")}>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-600 rounded-none border">
                        {getAssetIcon(resource.assetType)}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{resource.name}</div>
                        <div className="text-[9px] text-muted-foreground uppercase font-black">{resource.operatingModel} | {resource.dataLocation}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none py-0 h-4 bg-muted/20 w-fit">{resource.category}</Badge>
                      <Badge variant="outline" className={cn("text-[8px] font-bold uppercase rounded-none py-0 h-4 w-fit", resource.criticality === 'high' ? "bg-red-50 text-red-700" : "bg-slate-50")}>{resource.criticality}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        {resource.hasPersonalData && (
                          <Tooltip>
                            <TooltipTrigger asChild><FileCheck className="w-4 h-4 text-emerald-600 cursor-help" /></TooltipTrigger>
                            <TooltipContent className="text-[10px] font-bold uppercase">DSGVO Relevanz: Personenbezogene Daten</TooltipContent>
                          </Tooltip>
                        )}
                        {resource.isInternetExposed && (
                          <Tooltip>
                            <TooltipTrigger asChild><Globe className="w-4 h-4 text-orange-600 cursor-help" /></TooltipTrigger>
                            <TooltipContent className="text-[10px] font-bold uppercase">Internet-Exponiert</TooltipContent>
                          </Tooltip>
                        )}
                        {resource.isSpof && (
                          <Tooltip>
                            <TooltipTrigger asChild><AlertTriangle className="w-4 h-4 text-red-600 cursor-help" /></TooltipTrigger>
                            <TooltipContent className="text-[10px] font-bold uppercase">Single Point of Failure</TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">Schutzbedarf (CIA):</span>
                        <span className="text-[8px] font-black uppercase text-slate-400">{resource.confidentialityReq?.charAt(0)}|{resource.integrityReq?.charAt(0)}|{resource.availabilityReq?.charAt(0)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-bold">{resource.systemOwner || '---'}</div>
                    <div className="text-[9px] text-muted-foreground uppercase font-black">Mandant: {getTenantSlug(resource.tenantId)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 rounded-none">
                        <DropdownMenuItem onSelect={() => { setSelectedResource(resource); setIsEntitlementListOpen(true); }}><Settings2 className="w-3.5 h-3.5 mr-2" /> Rollen verwalten</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openResourceEdit(resource)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className={resource.status === 'archived' ? "text-emerald-600 font-bold" : "text-red-600"}
                          onSelect={() => handleStatusChange(resource, resource.status === 'archived' ? 'active' : 'archived')}
                        >
                          {resource.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
                          {resource.status === 'archived' ? 'Reaktivieren' : 'Archivieren'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredResources.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={5} className="py-20 text-center text-xs text-muted-foreground italic">Keine Einträge für diese Ansicht gefunden.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Resource Edit Dialog */}
      <Dialog open={isResourceDialogOpen} onOpenChange={(v) => { if(!v) setIsResourceDialogOpen(false); }}>
        <DialogContent className="max-w-5xl rounded-none border shadow-2xl p-0 overflow-hidden flex flex-col h-[90vh]">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-3">
                <Network className="w-5 h-5 text-primary" />
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                  {selectedResource ? 'System bearbeiten' : 'System registrieren'}
                </DialogTitle>
              </div>
              <AiFormAssistant 
                formType="resource" 
                currentData={{ name, assetType, category, operatingModel, criticality }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="base" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b bg-slate-50 shrink-0">
              <TabsList className="h-12 bg-transparent gap-6 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase">1. Stammdaten</TabsTrigger>
                <TabsTrigger value="risk" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase">2. Risiko & Schutzbedarf</TabsTrigger>
                <TabsTrigger value="gdpr" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase">3. Datenschutz (DSGVO)</TabsTrigger>
                <TabsTrigger value="mgmt" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase">4. Verantwortung & IAM</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-8">
                <TabsContent value="base" className="mt-0 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Name der Ressource</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. SAP S/4HANA" className="rounded-none h-10 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Asset-Typ</Label>
                      <Select value={assetType} onValueChange={(v: any) => setAssetType(v)}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="Hardware">Hardware (Server, PCs)</SelectItem>
                          <SelectItem value="Software">Software (Lokal installiert)</SelectItem>
                          <SelectItem value="SaaS">SaaS (Web-Anwendung)</SelectItem>
                          <SelectItem value="Infrastruktur">Infrastruktur (Netz, Cloud)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">System-Kategorie</Label>
                      <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="Fachanwendung">Fachanwendung</SelectItem>
                          <SelectItem value="Infrastruktur">Infrastruktur</SelectItem>
                          <SelectItem value="Sicherheitskomponente">Sicherheitskomponente</SelectItem>
                          <SelectItem value="Support-Tool">Support-Tool</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Betriebsmodell</Label>
                      <Select value={operatingModel} onValueChange={(v: any) => setOperatingModel(v)}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="On-Prem">On-Prem (Eigenes RZ)</SelectItem>
                          <SelectItem value="Private Cloud">Private Cloud</SelectItem>
                          <SelectItem value="Cloud">Cloud (Externer Provider)</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Datenklassifikation</Label>
                      <Select value={dataClassification} onValueChange={(v: any) => setDataClassification(v)}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="public">Öffentlich</SelectItem>
                          <SelectItem value="internal">Intern</SelectItem>
                          <SelectItem value="confidential">Vertraulich</SelectItem>
                          <SelectItem value="strictly_confidential">Streng vertraulich</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="risk" className="mt-0 space-y-8">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-blue-600">Soll-Schutzbedarf: Vertraulichkeit</Label>
                      <Select value={confReq} onValueChange={(v: any) => setConfReq(v)}>
                        <SelectTrigger className="rounded-none h-10 border-blue-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="low">Niedrig</SelectItem>
                          <SelectItem value="medium">Mittel</SelectItem>
                          <SelectItem value="high">Hoch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-emerald-600">Soll-Schutzbedarf: Integrität</Label>
                      <Select value={intReq} onValueChange={(v: any) => setIntReq(v)}>
                        <SelectTrigger className="rounded-none h-10 border-emerald-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="low">Niedrig</SelectItem>
                          <SelectItem value="medium">Mittel</SelectItem>
                          <SelectItem value="high">Hoch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-orange-600">Soll-Schutzbedarf: Verfügbarkeit</Label>
                      <Select value={availReq} onValueChange={(v: any) => setAvailReq(v)}>
                        <SelectTrigger className="rounded-none h-10 border-orange-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="low">Niedrig</SelectItem>
                          <SelectItem value="medium">Mittel</SelectItem>
                          <SelectItem value="high">Hoch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 pt-6 border-t">
                    <div className="flex items-center justify-between p-4 border bg-orange-50/20 rounded-none">
                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase block">Internet-exponiert</Label>
                      </div>
                      <Switch checked={!!isInternetExposed} onCheckedChange={setIsInternetExposed} />
                    </div>
                    <div className="flex items-center justify-between p-4 border bg-red-50/20 rounded-none">
                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase block">Geschäftskritisch</Label>
                      </div>
                      <Switch checked={!!isBusinessCritical} onCheckedChange={setIsBusinessCritical} />
                    </div>
                    <div className="flex items-center justify-between p-4 border bg-slate-50/50 rounded-none">
                      <div className="space-y-0.5">
                        <Label className="text-[10px] font-bold uppercase block">Single Point of Failure</Label>
                      </div>
                      <Switch checked={!!isSpof} onCheckedChange={setIsSpof} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="gdpr" className="mt-0 space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 border bg-emerald-50/20 rounded-none">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-bold uppercase block">Personenbezogene Daten</Label>
                        </div>
                        <Switch checked={!!hasPersonalData} onCheckedChange={setHasPersonalData} />
                      </div>
                      <div className="flex items-center justify-between p-4 border bg-red-50/20 rounded-none">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-bold uppercase block">Besondere Daten (Art. 9)</Label>
                        </div>
                        <Switch checked={!!hasSpecialCategoryData} onCheckedChange={setHasSpecialCategoryData} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-bold uppercase">Betroffene Personengruppen</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {subjectGroups?.filter(g => activeTenantId === 'all' || g.tenantId === activeTenantId).map(group => (
                          <div key={group.id} className="flex items-center gap-2 p-2 border bg-white">
                            <Checkbox 
                              checked={affectedGroups.includes(group.name)} 
                              onCheckedChange={(checked) => {
                                setAffectedGroups(prev => checked ? [...prev, group.name] : prev.filter(g => g !== group.name));
                              }}
                            />
                            <span className="text-[10px] font-bold uppercase">{group.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 pt-6 border-t">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase flex items-center gap-2 text-primary">
                        <ClipboardList className="w-3.5 h-3.5" /> Verknüpfte Verarbeitungstätigkeiten (VVT)
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border p-4 bg-slate-50/50">
                        {vvts?.filter(v => activeTenantId === 'all' || v.tenantId === activeTenantId).map(v => (
                          <div key={v.id} className="flex items-center gap-3 p-2 bg-white border">
                            <Checkbox 
                              checked={vvtIds.includes(v.id)} 
                              onCheckedChange={(checked) => {
                                setVvtIds(prev => checked ? [...prev, v.id] : prev.filter(id => id !== v.id));
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold truncate">{v.name}</p>
                              <p className="text-[8px] text-muted-foreground uppercase font-black">Version: {v.version}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="mgmt" className="mt-0 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">System Owner (Fachlich)</Label>
                      <Input value={systemOwner} onChange={e => setSystemOwner(e.target.value)} className="rounded-none h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Risk Owner</Label>
                      <Input value={riskOwner} onChange={e => setRiskOwner(e.target.value)} className="rounded-none h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Data Owner (Datenschutz)</Label>
                      <Input value={dataOwner} onChange={e => setDataOwner(e.target.value)} className="rounded-none h-10" />
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t">
                    <Label className="text-[10px] font-bold uppercase flex items-center gap-2 text-emerald-600">
                      <ClipboardCheck className="w-4 h-4" /> Verknüpfte Maßnahmen & TOMs ({measureIds.length})
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border p-4 bg-slate-50/50 max-h-64 overflow-y-auto">
                      {allMeasures?.map(m => {
                        const isSelected = measureIds.includes(m.id);
                        return (
                          <div key={m.id} className={cn("flex items-center gap-3 p-2 bg-white border cursor-pointer hover:border-emerald-500", isSelected && "border-emerald-500 ring-1 ring-emerald-500")} onClick={() => setMeasureIds(prev => isSelected ? prev.filter(id => id !== m.id) : [...prev, m.id])}>
                            <Checkbox checked={isSelected} className="rounded-none" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold truncate">{m.title}</p>
                              {m.isTom && <Badge className="bg-emerald-50 text-emerald-700 rounded-none text-[7px] h-3.5 px-1 border-none">TOM</Badge>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsResourceDialogOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleSaveResource} disabled={isSaving || !name} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] gap-2 tracking-widest bg-slate-900 text-white">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Asset Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
