"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle, 
  Plus, 
  Search, 
  Clock, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Info, 
  Loader2, 
  Scale, 
  Library, 
  Save, 
  Filter,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  HelpCircle,
  ClipboardCheck,
  Check,
  Zap,
  Sparkles,
  X,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  GitPullRequest,
  Calculator,
  AlertCircle,
  ChevronRight as ChevronRightIcon,
  RotateCcw,
  Download,
  MoreVertical,
  Activity,
  History,
  FileCheck,
  BadgeAlert
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { toast } from '@/hooks/use-toast';
import { Risk, Hazard, Resource, RiskMeasure } from '@/lib/types';
import { usePlatformAuth } from '@/context/auth-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { exportRisksExcel } from '@/lib/export-utils';
import { AiFormAssistant } from '@/components/ai/form-assistant';

function RiskDashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = usePlatformAuth();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Modals
  const [isRiskDialogOpen, setIsRiskDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  // Workflow Modal
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [riskToApprove, setRiskToApprove] = useState<Risk | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Review State
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewRisk, setReviewRisk] = useState<Risk | null>(null);
  const [revImpact, setRevImpact] = useState('3');
  const [revProbability, setRevProbability] = useState('3');
  const [revResImpact, setRevResImpact] = useState('2');
  const [revResProbability, setRevResProbability] = useState('2');
  const [revBruttoReason, setRevBruttoReason] = useState('');
  const [revNettoReason, setRevNettoReason] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('IT-Sicherheit');
  const [assetId, setAssetId] = useState('none');
  const [hazardId, setHazardId] = useState<string | undefined>();
  const [parentId, setParentId] = useState<string>('none');
  const [impact, setImpact] = useState('3');
  const [probability, setProbability] = useState('3');
  const [resImpact, setResImpact] = useState('2');
  const [resProbability, setResProbability] = useState('2');
  const [bruttoReason, setBruttoReason] = useState('');
  const [nettoReason, setNettoReason] = useState('');
  const [owner, setOwner] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'mitigated' | 'accepted' | 'closed'>('active');

  const { data: risks, isLoading, refresh } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: hazards } = usePluggableCollection<Hazard>('hazards');
  const { data: riskMeasures, refresh: refreshMeasures } = usePluggableCollection<RiskMeasure>('riskMeasures');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getSubRisks = (riskId: string) => risks?.filter(r => r.parentId === riskId) || [];

  const handleSaveRisk = async () => {
    if (!title) return;
    setIsSaving(true);
    const id = selectedRisk?.id || `risk-${Math.random().toString(36).substring(2, 9)}`;
    
    const riskData: Risk = {
      ...selectedRisk,
      id,
      tenantId: activeTenantId === 'all' ? 't1' : activeTenantId,
      assetId: assetId === 'none' ? undefined : assetId,
      hazardId,
      parentId: parentId === 'none' ? undefined : parentId,
      title,
      category,
      impact: parseInt(impact),
      probability: parseInt(probability),
      residualImpact: parseInt(resImpact),
      residualProbability: parseInt(resProbability),
      bruttoReason,
      nettoReason,
      owner,
      description,
      status,
      acceptanceStatus: selectedRisk?.acceptanceStatus || 'draft',
      createdAt: selectedRisk?.createdAt || new Date().toISOString(),
      lastReviewDate: selectedRisk?.lastReviewDate || new Date().toISOString()
    };

    try {
      const res = await saveCollectionRecord('risks', id, riskData, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource as any, {
          tenantId: riskData.tenantId,
          actorUid: authUser?.email || 'system',
          action: selectedRisk ? `Risiko aktualisiert: ${title}` : `Neues Risiko angelegt: ${title}`,
          entityType: 'risk',
          entityId: id,
          after: riskData
        });
        toast({ title: "Risiko gespeichert" });
        setIsRiskDialogOpen(false);
        resetForm();
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleWorkflowAction = async (risk: Risk, action: 'request' | 'approve' | 'reject') => {
    setIsSaving(true);
    let newStatus: Risk['acceptanceStatus'] = risk.acceptanceStatus;
    let logAction = '';

    if (action === 'request') {
      newStatus = 'pending';
      logAction = 'Abnahme für Risiko angefordert';
    } else if (action === 'approve') {
      newStatus = 'approved';
      logAction = 'Risikobewertung formal abgenommen';
    } else if (action === 'reject') {
      newStatus = 'rejected';
      logAction = 'Risikobewertung abgelehnt / Überarbeitung gefordert';
    }

    const updatedRisk: Risk = {
      ...risk,
      acceptanceStatus: newStatus,
      acceptanceComment: action !== 'request' ? approvalComment : risk.acceptanceComment,
      lastReviewDate: new Date().toISOString()
    };

    try {
      const res = await saveCollectionRecord('risks', risk.id, updatedRisk, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource as any, {
          tenantId: risk.tenantId,
          actorUid: authUser?.email || 'system',
          action: `${logAction}: ${risk.title}`,
          entityType: 'risk',
          entityId: risk.id,
          after: updatedRisk
        });
        toast({ title: "Workflow aktualisiert" });
        setIsApprovalOpen(false);
        setApprovalComment('');
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openReviewDialog = (risk: Risk) => {
    setReviewRisk(risk);
    setRevImpact(risk.impact.toString());
    setRevProbability(risk.probability.toString());
    setRevResImpact(risk.residualImpact?.toString() || '2');
    setRevResProbability(risk.residualProbability?.toString() || '2');
    setRevBruttoReason(risk.bruttoReason || '');
    setRevNettoReason(risk.nettoReason || '');
    setIsReviewDialogOpen(true);
  };

  const handleReviewSubmit = async () => {
    if (!reviewRisk) return;
    setIsSaving(true);
    const now = new Date().toISOString();
    
    const updatedRisk: Risk = {
      ...reviewRisk,
      impact: parseInt(revImpact),
      probability: parseInt(revProbability),
      residualImpact: parseInt(revResImpact),
      residualProbability: parseInt(revResProbability),
      bruttoReason: revBruttoReason,
      nettoReason: revNettoReason,
      lastReviewDate: now
    };

    try {
      const res = await saveCollectionRecord('risks', reviewRisk.id, updatedRisk, dataSource);
      if (res.success) {
        toast({ title: "Review abgeschlossen" });
        setIsReviewDialogOpen(false);
        setReviewRisk(null);
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedRisk(null);
    setTitle('');
    setCategory('IT-Sicherheit');
    setAssetId('none');
    setHazardId(undefined);
    setParentId('none');
    setImpact('3');
    setProbability('3');
    setResImpact('2');
    setResProbability('2');
    setBruttoReason('');
    setNettoReason('');
    setOwner('');
    setDescription('');
    setStatus('active');
  };

  const openEdit = (risk: Risk) => {
    setSelectedRisk(risk);
    setTitle(risk.title);
    setCategory(risk.category);
    setAssetId(risk.assetId || 'none');
    setHazardId(risk.hazardId);
    setParentId(risk.parentId || 'none');
    setImpact(risk.impact.toString());
    setProbability(risk.probability.toString());
    setResImpact(risk.residualImpact?.toString() || '2');
    setResProbability(risk.residualProbability?.toString() || '2');
    setBruttoReason(risk.bruttoReason || '');
    setNettoReason(risk.nettoReason || '');
    setOwner(risk.owner);
    setDescription(risk.description || '');
    setStatus(risk.status);
    setIsRiskDialogOpen(true);
  };

  const openCreateSubRisk = (parentRisk: Risk) => {
    resetForm();
    setParentId(parentRisk.id);
    setCategory(parentRisk.category);
    setIsRiskDialogOpen(true);
  };

  const hierarchicalRisks = useMemo(() => {
    if (!risks) return [];
    const filtered = risks.filter(r => {
      const matchesTenant = activeTenantId === 'all' || r.tenantId === activeTenantId;
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.owner.toLowerCase().includes(search.toLowerCase());
      return matchesTenant && matchesCategory && matchesSearch;
    });

    const parents = filtered.filter(r => !r.parentId);
    const result: Risk[] = [];

    parents.sort((a, b) => (b.impact * b.probability) - (a.impact * a.probability)).forEach(parent => {
      result.push(parent);
      const children = filtered.filter(r => r.parentId === parent.id);
      children.forEach(child => result.push(child));
    });

    return result;
  }, [risks, search, categoryFilter, activeTenantId]);

  const getMeasuresForRisk = (riskId: string) => {
    if (!riskMeasures) return [];
    return riskMeasures.filter(m => m.riskIds?.includes(riskId));
  };

  const applyAiSuggestions = (s: any) => {
    if (s.title) setTitle(s.title);
    if (s.category) setCategory(s.category);
    if (s.description) setDescription(s.description);
    if (s.impact) setImpact(String(s.impact));
    if (s.probability) setProbability(String(s.probability));
    if (s.residualImpact) setResImpact(String(s.residualImpact));
    if (s.residualProbability) setResProbability(String(s.residualProbability));
    if (s.bruttoReason) setBruttoReason(s.bruttoReason);
    if (s.nettoReason) setNettoReason(s.nettoReason);
    toast({ title: "KI-Vorschläge übernommen" });
  };

  const getAcceptanceBadge = (status?: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-amber-500 text-white border-none rounded-none text-[8px] font-black uppercase h-4.5 px-1.5 animate-pulse">PRÜFUNG</Badge>;
      case 'approved': return <Badge className="bg-emerald-600 text-white border-none rounded-none text-[8px] font-black uppercase h-4.5 px-1.5">ABGENOMMEN</Badge>;
      case 'rejected': return <Badge className="bg-red-600 text-white border-none rounded-none text-[8px] font-black uppercase h-4.5 px-1.5">REVISION</Badge>;
      default: return <Badge variant="outline" className="text-[8px] font-black uppercase h-4.5 px-1.5 border-slate-200">ENTWURF</Badge>;
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-accent/10 text-accent flex items-center justify-center rounded-2xl border-2 border-accent/20 shadow-xl shadow-accent/5">
            <AlertTriangle className="w-9 h-9" />
          </div>
          <div>
            <Badge className="mb-2 rounded-full px-3 py-0 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest border-none">GRC Module</Badge>
            <h1 className="text-4xl font-headline font-bold tracking-tight text-slate-900 dark:text-white">Risikoinventar</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Überwachung der Bedrohungslage für {activeTenantId === 'all' ? 'alle Standorte' : activeTenantId}.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-6 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900" onClick={() => exportRisksExcel(hierarchicalRisks, resources || [])}>
            <Download className="w-4 h-4 mr-2 text-primary" /> Excel Export
          </Button>
          <Button variant="outline" onClick={() => router.push('/risks/catalog')} className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-6 border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
            <Library className="w-4 h-4 mr-2" /> Kataloge
          </Button>
          <Button onClick={() => { resetForm(); setIsRiskDialogOpen(true); }} className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-8 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 transition-all">
            <Plus className="w-4 h-4 mr-2" /> Risiko erfassen
          </Button>
        </div>
      </div>

      {/* Filter Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="lg:col-span-8 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors" />
          <Input 
            placeholder="Risiken oder Verantwortliche suchen..." 
            className="pl-11 h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white transition-all shadow-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="lg:col-span-4 flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="border-none shadow-none h-9 rounded-lg bg-transparent text-[10px] font-black uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 mr-2 text-slate-400" />
              <SelectValue placeholder="Alle Kategorien" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-100">
              <SelectItem value="all">Alle Kategorien</SelectItem>
              <SelectItem value="IT-Sicherheit">IT-Sicherheit</SelectItem>
              <SelectItem value="Datenschutz">Datenschutz</SelectItem>
              <SelectItem value="Rechtlich">Rechtlich</SelectItem>
              <SelectItem value="Betrieblich">Betrieblich</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-accent opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Lade Risikodaten...</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {hierarchicalRisks.map((risk) => {
              const isSub = !!risk.parentId;
              const scoreRaw = risk.impact * risk.probability;
              const scoreRes = (risk.residualImpact || 0) * (risk.residualProbability || 0);
              const asset = resources?.find(r => r.id === risk.assetId);
              const assignedMeasures = getMeasuresForRisk(risk.id);
              
              return (
                <Card key={risk.id} className={cn(
                  "border-none shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-slate-900 group",
                  isSub && "ml-6 scale-95 border-l-4 border-l-slate-200 dark:border-l-slate-800"
                )}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          {getAcceptanceBadge(risk.acceptanceStatus)}
                          <Badge variant="outline" className="rounded-full text-[8px] font-black uppercase border-slate-200 dark:border-slate-800 text-slate-400 h-5">
                            {risk.category}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white leading-tight" onClick={() => openEdit(risk)}>{risk.title}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge className={cn(
                          "rounded-xl border-none px-2 text-[10px] font-black",
                          scoreRaw >= 15 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                        )}>
                          {scoreRaw}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl mb-6 space-y-3">
                      {asset && (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                          <Layers className="w-3.5 h-3.5" /> {asset.name}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                        <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {risk.lastReviewDate ? new Date(risk.lastReviewDate).toLocaleDateString() : 'Ausstehend'}</span>
                        <span className="flex items-center gap-1.5"><ClipboardCheck className="w-3 h-3" /> {assignedMeasures.length} Maßnahmen</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200 dark:border-slate-800" onClick={() => openReviewDialog(risk)}>
                        Review
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-10 h-10 p-0 rounded-xl border-slate-200 dark:border-slate-800"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl p-2 w-56 shadow-2xl">
                          {risk.acceptanceStatus === 'pending' && (
                            <DropdownMenuItem onSelect={() => { setRiskToApprove(risk); setIsApprovalOpen(true); }} className="rounded-xl py-2.5 gap-3 font-bold text-emerald-600"><FileCheck className="w-4 h-4" /> Formale Abnahme</DropdownMenuItem>
                          )}
                          {risk.acceptanceStatus !== 'pending' && risk.acceptanceStatus !== 'approved' && (
                            <DropdownMenuItem onSelect={() => handleWorkflowAction(risk, 'request')} className="rounded-xl py-2.5 gap-3"><BadgeAlert className="w-4 h-4 text-amber-500" /> Abnahme anfordern</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="my-2" />
                          {!risk.parentId && <DropdownMenuItem onSelect={() => openCreateSubRisk(risk)} className="rounded-xl py-2.5 gap-3"><Plus className="w-4 h-4" /> Sub-Risiko erstellen</DropdownMenuItem>}
                          <DropdownMenuItem onSelect={() => openEdit(risk)} className="rounded-xl py-2.5 gap-3"><Pencil className="w-4 h-4 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuSeparator className="my-2" />
                          <DropdownMenuItem className="text-red-600 rounded-xl py-2.5 gap-3" onSelect={() => { if(confirm("Risiko löschen?")) deleteCollectionRecord('risks', risk.id, dataSource).then(() => refresh()); }}>
                            <Trash2 className="w-4 h-4" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                  <TableHead className="py-6 px-8 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Risiko / Bezug</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500 text-center">Score</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Workflow</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Maßnahmen</TableHead>
                  <TableHead className="text-right px-8 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hierarchicalRisks.map((risk) => {
                  const isSub = !!risk.parentId;
                  const scoreRaw = risk.impact * risk.probability;
                  const scoreRes = (risk.residualImpact || 0) * (risk.residualProbability || 0);
                  const asset = resources?.find(r => r.id === risk.assetId);
                  const assignedMeasures = getMeasuresForRisk(risk.id);
                  const subs = getSubRisks(risk.id);
                  
                  return (
                    <TableRow key={risk.id} className={cn("group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-colors", isSub && "bg-slate-50/30 dark:bg-slate-950/30")}>
                      <TableCell className="py-5 px-8">
                        <div className={cn("flex items-start gap-4", isSub && "pl-10")}>
                          <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                            scoreRaw >= 15 ? "bg-red-50 text-red-600 border-red-100" : "bg-orange-50 text-orange-600 border-orange-100"
                          )}>
                            {isSub ? <GitPullRequest className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-accent transition-colors cursor-pointer" onClick={() => openEdit(risk)}>{risk.title}</div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{risk.category}</span>
                              {asset && <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><Layers className="w-3 h-3" /> {asset.name}</span>}
                              {subs.length > 0 && <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black h-4 px-1.5 uppercase">{subs.length} Sub-Risiken</Badge>}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={cn(
                          "inline-flex items-center px-3 py-1 rounded-xl font-black text-xs shadow-sm",
                          scoreRaw >= 15 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                        )}>
                          {scoreRaw}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getAcceptanceBadge(risk.acceptanceStatus)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className="bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer rounded-full text-[9px] font-black px-3 h-6 border-slate-200 dark:border-slate-800 gap-1.5 uppercase tracking-wider"
                          onClick={() => { setViewMeasuresRisk(risk); setIsMeasuresViewOpen(true); }}
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" /> {assignedMeasures.length} Measures
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <div className="flex justify-end items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-9 rounded-xl text-[10px] font-black uppercase tracking-wider gap-2 opacity-0 group-hover:opacity-100 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 transition-all active:scale-95"
                            onClick={() => openReviewDialog(risk)}
                          >
                            <CalendarCheck className="w-4 h-4" /> Review
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform"><MoreHorizontal className="w-5 h-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-slate-100 dark:border-slate-800">
                              {risk.acceptanceStatus === 'pending' && (
                                <DropdownMenuItem onSelect={() => { setRiskToApprove(risk); setIsApprovalOpen(true); }} className="rounded-xl py-2.5 gap-3 font-bold text-emerald-600"><FileCheck className="w-4 h-4" /> Formale Abnahme</DropdownMenuItem>
                              )}
                              {risk.acceptanceStatus !== 'pending' && risk.acceptanceStatus !== 'approved' && (
                                <DropdownMenuItem onSelect={() => handleWorkflowAction(risk, 'request')} className="rounded-xl py-2.5 gap-3"><BadgeAlert className="w-4 h-4 text-amber-500" /> Abnahme anfordern</DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="my-2" />
                              {!risk.parentId && <DropdownMenuItem onSelect={() => openCreateSubRisk(risk)} className="rounded-xl py-2.5 gap-3"><Plus className="w-4 h-4" /> Sub-Risiko erstellen</DropdownMenuItem>}
                              <DropdownMenuItem onSelect={() => openEdit(risk)} className="rounded-xl py-2.5 gap-3"><Pencil className="w-4 h-4 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                              <DropdownMenuSeparator className="my-2" />
                              <DropdownMenuItem className="text-red-600 dark:text-red-400 rounded-xl py-2.5 gap-3" onSelect={() => { if(confirm("Risiko permanent löschen?")) deleteCollectionRecord('risks', risk.id, dataSource).then(() => refresh()); }}>
                                <Trash2 className="w-4 h-4" /> Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Risk Dialog */}
      <Dialog open={isRiskDialogOpen} onOpenChange={(val) => { if(!val) { setIsRiskDialogOpen(false); setSelectedRisk(null); } }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[95vh] md:h-[85vh] rounded-[2rem] md:rounded-[3rem] p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 md:p-10 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-accent/20 rounded-2xl flex items-center justify-center text-accent shadow-xl">
                  <ShieldAlert className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl md:text-2xl font-headline font-bold uppercase tracking-tight truncate">Risiko-Erfassung</DialogTitle>
                  <DialogDescription className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 md:mt-1.5">Analyse & Szenario Definition</DialogDescription>
                </div>
              </div>
              <AiFormAssistant 
                formType="risk" 
                currentData={{ title, category, assetId, description, impact, probability }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 md:p-10 space-y-8 md:space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Risiko-Bezeichnung</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-2xl h-12 md:h-14 text-base md:text-lg font-bold border-slate-200 focus:border-accent" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Kategorie</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="rounded-2xl h-12 md:h-14 border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="IT-Sicherheit">IT-Sicherheit</SelectItem>
                      <SelectItem value="Datenschutz">Datenschutz</SelectItem>
                      <SelectItem value="Rechtlich">Rechtlich</SelectItem>
                      <SelectItem value="Betrieblich">Betrieblich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Bezug (Asset)</Label>
                  <Select value={assetId} onValueChange={setAssetId}>
                    <SelectTrigger className="rounded-2xl h-12 md:h-14 border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="none">Organisationsweites Risiko</SelectItem>
                      {resources?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                <div className="p-6 md:p-8 bg-red-50 dark:bg-red-950/20 rounded-[1.5rem] md:rounded-[2rem] border border-red-100 dark:border-red-900/30 space-y-4 md:space-y-6">
                  <h3 className="text-[10px] md:text-xs font-black uppercase text-red-600 tracking-[0.2em] flex items-center gap-2"><Scale className="w-3.5 md:w-4 h-3.5 md:h-4" /> Brutto-Risiko</h3>
                  <div className="space-y-4 md:space-y-6">
                    <div className="space-y-2 md:space-y-3">
                      <Label className="text-[8px] md:text-[10px] font-bold uppercase text-slate-500">Wahrscheinlichkeit (1-5)</Label>
                      <div className="flex gap-1 md:gap-2">
                        {['1','2','3','4','5'].map(v => (
                          <button key={v} onClick={() => setProbability(v)} className={cn(
                            "flex-1 h-10 md:h-12 rounded-xl border-2 font-black text-xs md:text-sm transition-all",
                            probability === v ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-200" : "bg-white border-slate-100 text-slate-400 hover:border-red-200"
                          )}>{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 md:space-y-3">
                      <Label className="text-[8px] md:text-[10px] font-bold uppercase text-slate-500">Schadenshöhe (1-5)</Label>
                      <div className="flex gap-1 md:gap-2">
                        {['1','2','3','4','5'].map(v => (
                          <button key={v} onClick={() => setImpact(v)} className={cn(
                            "flex-1 h-10 md:h-12 rounded-xl border-2 font-black text-xs md:text-sm transition-all",
                            impact === v ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-200" : "bg-white border-slate-100 text-slate-400 hover:border-red-200"
                          )}>{v}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 md:p-8 bg-emerald-50 dark:bg-emerald-950/20 rounded-[1.5rem] md:rounded-[2rem] border border-emerald-100 dark:border-emerald-900/30 space-y-4 md:space-y-6">
                  <h3 className="text-[10px] md:text-xs font-black uppercase text-emerald-600 tracking-[0.2em] flex items-center gap-2"><ShieldCheck className="w-3.5 md:w-4 h-3.5 md:h-4" /> Netto-Risiko</h3>
                  <div className="space-y-4 md:space-y-6">
                    <div className="space-y-2 md:space-y-3">
                      <Label className="text-[8px] md:text-[10px] font-bold uppercase text-slate-500">Wahrscheinlichkeit (Netto)</Label>
                      <div className="flex gap-1 md:gap-2">
                        {['1','2','3','4','5'].map(v => (
                          <button key={v} onClick={() => setResProbability(v)} className={cn(
                            "flex-1 h-10 md:h-12 rounded-xl border-2 font-black text-xs md:text-sm transition-all",
                            resProbability === v ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200" : "bg-white border-slate-100 text-slate-400 hover:border-emerald-200"
                          )}>{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 md:space-y-3">
                      <Label className="text-[8px] md:text-[10px] font-bold uppercase text-slate-500">Schadenshöhe (Netto)</Label>
                      <div className="flex gap-1 md:gap-2">
                        {['1','2','3','4','5'].map(v => (
                          <button key={v} onClick={() => setResImpact(v)} className={cn(
                            "flex-1 h-10 md:h-12 rounded-xl border-2 font-black text-xs md:text-sm transition-all",
                            resImpact === v ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200" : "bg-white border-slate-100 text-slate-400 hover:border-emerald-200"
                          )}>{v}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Szenario Beschreibung</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-[1.5rem] md:rounded-[2rem] min-h-[120px] md:min-h-[150px] p-4 md:p-6 border-slate-200 leading-relaxed" placeholder="Beschreiben Sie das Bedrohungsszenario im Detail..." />
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsRiskDialogOpen(false)} className="w-full sm:w-auto rounded-xl font-black uppercase text-[10px] px-8 h-12">Abbrechen</Button>
            <Button onClick={handleSaveRisk} disabled={isSaving} className="w-full sm:w-auto rounded-2xl font-black uppercase text-[10px] tracking-widest px-12 h-12 md:h-14 bg-accent hover:bg-accent/90 text-white shadow-2xl shadow-accent/20 transition-all gap-3">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Risiko Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] md:w-full rounded-[2rem] md:rounded-[2.5rem] p-0 overflow-hidden bg-white dark:bg-slate-950 border-none shadow-2xl flex flex-col h-[90vh] md:h-auto">
          <DialogHeader className="p-6 md:p-8 bg-emerald-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <CalendarCheck className="w-6 h-6 md:w-8 md:h-8 text-emerald-400" />
              <DialogTitle className="text-lg md:text-xl font-headline font-bold uppercase tracking-tight">Regelmäßiger Review</DialogTitle>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 md:p-8 space-y-6 md:space-y-8">
              <div className="p-4 md:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <Label className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Aktuelles Risiko</Label>
                <p className="font-bold text-sm md:text-base text-slate-800 dark:text-slate-100">{reviewRisk?.title}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-4">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Brutto Score</Label>
                  <div className="flex gap-2"><Input value={revProbability} onChange={e => setRevProbability(e.target.value)} type="number" className="rounded-xl h-12" /><Input value={revImpact} onChange={e => setRevImpact(e.target.value)} type="number" className="rounded-xl h-12" /></div>
                </div>
                <div className="space-y-4">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Netto Score</Label>
                  <div className="flex gap-2"><Input value={revResProbability} onChange={e => setRevResProbability(e.target.value)} type="number" className="rounded-xl h-12" /><Input value={revResImpact} onChange={e => setRevResImpact(e.target.value)} type="number" className="rounded-xl h-12" /></div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsReviewDialogOpen(false)} className="w-full sm:w-auto rounded-xl text-[10px] font-black uppercase">Abbrechen</Button>
            <Button onClick={handleReviewSubmit} disabled={isSaving} className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] h-12 shadow-lg">Review Abschließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Approval Dialog */}
      <Dialog open={isApprovalOpen} onOpenChange={setIsApprovalOpen}>
        <DialogContent className="max-w-lg w-[95vw] md:w-full rounded-[2rem] md:rounded-[2.5rem] p-0 overflow-hidden bg-white dark:bg-slate-900 border-none shadow-2xl flex flex-col h-[90vh] md:h-auto">
          <DialogHeader className="p-6 md:p-8 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <FileCheck className="w-6 h-6 md:w-8 md:h-8 text-primary" />
              <DialogTitle className="text-lg md:text-xl font-headline font-bold uppercase">Risiko-Abnahme</DialogTitle>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 md:p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Anmerkungen zur Abnahme</Label>
                <Textarea 
                  value={approvalComment} 
                  onChange={e => setApprovalComment(e.target.value)} 
                  placeholder="Begründung für die Abnahme oder Ablehnung..."
                  className="rounded-xl min-h-[120px] border-slate-200"
                />
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 rounded-xl">
                <p className="text-[9px] md:text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase leading-relaxed italic">
                  Hinweis: Mit der Abnahme bestätigen Sie die Korrektheit der Szenario-Bewertung und die Angemessenheit der Netto-Schätzung.
                </p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t shrink-0 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button variant="outline" onClick={() => handleWorkflowAction(riskToApprove!, 'reject')} disabled={isSaving} className="flex-1 rounded-xl h-12 font-black uppercase text-red-600 border-red-100 hover:bg-red-50">
                <X className="w-4 h-4 mr-2" /> Ablehnen
              </Button>
              <Button onClick={() => handleWorkflowAction(riskToApprove!, 'approve')} disabled={isSaving} className="flex-1 rounded-xl h-12 font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} Abnehmen
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setIsApprovalOpen(false)} className="w-full rounded-xl text-[10px] font-black uppercase text-slate-400">Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RiskDashboardPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-accent opacity-20" /><p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Lade Dashboard...</p></div>}>
      <RiskDashboardContent />
    </Suspense>
  );
}
