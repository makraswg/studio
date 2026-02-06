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
  Download
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
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(true);
  
  // Modals
  const [isRiskDialogOpen, setIsRiskDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [showScoringHelp, setShowScoringHelp] = useState(false);

  // Review State
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewRisk, setReviewRisk] = useState<Risk | null>(null);
  const [revImpact, setRevImpact] = useState('3');
  const [revProbability, setRevProbability] = useState('3');
  const [revResImpact, setRevResImpact] = useState('2');
  const [revResProbability, setRevResProbability] = useState('2');
  const [revBruttoReason, setRevBruttoReason] = useState('');
  const [revNettoReason, setRevNettoReason] = useState('');
  const [revIsImpactOverridden, setRevIsImpactOverridden] = useState(false);
  const [revIsProbOverridden, setRevIsProbOverridden] = useState(false);
  const [revIsResImpactOverridden, setRevIsResImpactOverridden] = useState(false);
  const [revIsResProbOverridden, setRevIsResProbOverridden] = useState(false);

  // Advisor State
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [advisorRisk, setAdvisorRisk] = useState<Risk | null>(null);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [customMeasureTitle, setCustomMeasureTitle] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // Linked Measures State
  const [isMeasuresViewOpen, setIsMeasuresViewOpen] = useState(false);
  const [viewMeasuresRisk, setViewMeasuresRisk] = useState<Risk | null>(null);

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
  const [isImpactOverridden, setIsImpactOverridden] = useState(false);
  const [isProbabilityOverridden, setIsProbabilityOverridden] = useState(false);
  const [isResImpactOverridden, setIsResImpactOverridden] = useState(false);
  const [isResProbabilityOverridden, setIsResProbabilityOverridden] = useState(false);
  const [owner, setOwner] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'mitigated' | 'accepted' | 'closed'>('active');

  const { data: risks, isLoading, refresh } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: hazards } = usePluggableCollection<Hazard>('hazards');
  const { data: allMeasures } = usePluggableCollection<any>('hazardMeasures');
  const { data: relations } = usePluggableCollection<any>('hazardMeasureRelations');
  const { data: riskMeasures, refresh: refreshMeasures } = usePluggableCollection<RiskMeasure>('riskMeasures');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculation Logic for Parent Risks
  const getSubRisks = (riskId: string) => risks?.filter(r => r.parentId === riskId) || [];

  const getCalculatedValue = (riskId: string, field: 'impact' | 'probability' | 'residualImpact' | 'residualProbability') => {
    const subs = getSubRisks(riskId);
    if (subs.length === 0) return null;
    return Math.max(...subs.map(s => (s[field] as number) || 0));
  };

  // Logic for the Main Risk Dialog
  useEffect(() => {
    if (isRiskDialogOpen && parentId !== 'none') {
      return;
    }
    
    if (isRiskDialogOpen && parentId === 'none') {
      const riskId = selectedRisk?.id || '';
      if (!riskId) return;

      const calcImpact = getCalculatedValue(riskId, 'impact');
      if (calcImpact !== null && !isImpactOverridden) setImpact(calcImpact.toString());

      const calcProb = getCalculatedValue(riskId, 'probability');
      if (calcProb !== null && !isProbabilityOverridden) setProbability(calcProb.toString());

      const calcResImpact = getCalculatedValue(riskId, 'residualImpact');
      if (calcResImpact !== null && !isResImpactOverridden) setResImpact(calcResImpact.toString());

      const calcResProb = getCalculatedValue(riskId, 'residualProbability');
      if (calcResProb !== null && !isResProbabilityOverridden) setResProbability(calcResProb.toString());
    }
  }, [parentId, isImpactOverridden, isProbabilityOverridden, isResImpactOverridden, isResProbabilityOverridden, selectedRisk, isRiskDialogOpen]);

  // Logic for the Review Dialog
  useEffect(() => {
    if (isReviewDialogOpen && reviewRisk && !reviewRisk.parentId) {
      const calcImpact = getCalculatedValue(reviewRisk.id, 'impact');
      if (calcImpact !== null && !revIsImpactOverridden) setRevImpact(calcImpact.toString());

      const calcProb = getCalculatedValue(reviewRisk.id, 'probability');
      if (calcProb !== null && !revIsProbOverridden) setRevProbability(calcProb.toString());

      const calcResImpact = getCalculatedValue(reviewRisk.id, 'residualImpact');
      if (calcResImpact !== null && !revIsResImpactOverridden) setRevResImpact(calcResImpact.toString());

      const calcResProb = getCalculatedValue(reviewRisk.id, 'residualProbability');
      if (calcResProb !== null && !revIsResProbOverridden) setRevResProbability(calcResProb.toString());
    }
  }, [isReviewDialogOpen, revIsImpactOverridden, revIsProbOverridden, revIsResImpactOverridden, revIsResProbOverridden, reviewRisk]);

  // Effekt für die Ableitung aus dem Katalog
  useEffect(() => {
    const deriveId = searchParams.get('derive');
    if (deriveId && hazards && hazards.length > 0 && !isRiskDialogOpen && !selectedRisk) {
      const hazard = hazards.find(h => h.id === deriveId);
      if (hazard) {
        resetForm();
        setTitle(hazard.title);
        setDescription(hazard.description);
        setHazardId(hazard.id);
        setIsRiskDialogOpen(true);
        
        const params = new URLSearchParams(searchParams.toString());
        params.delete('derive');
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, hazards, isRiskDialogOpen, selectedRisk, pathname]);

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
      isImpactOverridden,
      isProbabilityOverridden,
      isResidualImpactOverridden: isResImpactOverridden,
      isResidualProbabilityOverridden: isResProbabilityOverridden,
      owner,
      description,
      status,
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

  const openReviewDialog = (risk: Risk) => {
    setReviewRisk(risk);
    setRevImpact(risk.impact.toString());
    setRevProbability(risk.probability.toString());
    setRevResImpact(risk.residualImpact?.toString() || '2');
    setRevResProbability(risk.residualProbability?.toString() || '2');
    setRevBruttoReason(risk.bruttoReason || '');
    setRevNettoReason(risk.nettoReason || '');
    setRevIsImpactOverridden(!!risk.isImpactOverridden);
    setRevIsProbOverridden(!!risk.isProbabilityOverridden);
    setRevIsResImpactOverridden(!!risk.isResidualImpactOverridden);
    setRevIsResProbOverridden(!!risk.isResidualProbabilityOverridden);
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
      lastReviewDate: now,
      isImpactOverridden: revIsImpactOverridden,
      isProbabilityOverridden: revIsProbOverridden,
      isResidualImpactOverridden: revIsResImpactOverridden,
      isResidualProbabilityOverridden: revIsResProbOverridden,
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

  const handleAdoptMeasure = async (measure: any) => {
    if (!advisorRisk) return;
    setAdoptingId(measure.id);
    const msrId = `msr-adopt-${Math.random().toString(36).substring(2, 9)}`;
    
    const newMeasure: RiskMeasure = {
      id: msrId,
      riskIds: [advisorRisk.id],
      title: `${measure.code}: ${measure.title}`,
      description: `Vorgeschlagene IT-Grundschutz Maßnahme aus Baustein ${measure.baustein}.`,
      owner: advisorRisk.owner || 'Noch offen',
      dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'planned',
      effectiveness: 3
    };

    try {
      const res = await saveCollectionRecord('riskMeasures', msrId, newMeasure, dataSource);
      if (res.success) {
        toast({ title: "Maßnahme übernommen" });
        refreshMeasures();
        refresh();
      }
    } finally {
      setAdoptingId(null);
    }
  };

  const handleAddCustomMeasure = async () => {
    if (!advisorRisk || !customMeasureTitle) return;
    setIsAddingCustom(true);
    const msrId = `msr-custom-${Math.random().toString(36).substring(2, 9)}`;
    
    const newMeasure: RiskMeasure = {
      id: msrId,
      riskIds: [advisorRisk.id],
      title: customMeasureTitle,
      description: 'Manuell im Advisor erstellte Maßnahme.',
      owner: authUser?.displayName || advisorRisk.owner || 'Noch offen',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'planned',
      effectiveness: 3
    };

    try {
      const res = await saveCollectionRecord('riskMeasures', msrId, newMeasure, dataSource);
      if (res.success) {
        toast({ title: "Maßnahme erstellt" });
        setCustomMeasureTitle('');
        refreshMeasures();
        refresh();
      }
    } finally {
      setIsAddingCustom(false);
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
    setIsImpactOverridden(false);
    setIsProbabilityOverridden(false);
    setIsResImpactOverridden(false);
    setIsResProbabilityOverridden(false);
    setOwner('');
    setDescription('');
    setStatus('active');
    setShowScoringHelp(false);
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
    setIsImpactOverridden(!!risk.isImpactOverridden);
    setIsProbabilityOverridden(!!risk.isProbabilityOverridden);
    setIsResImpactOverridden(!!risk.isResidualImpactOverridden);
    setIsResProbabilityOverridden(!!risk.isResidualProbabilityOverridden);
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

  const suggestedMeasures = useMemo(() => {
    if (!advisorRisk?.hazardId || !relations || !allMeasures) return [];
    const hazard = hazards?.find(h => h.id === advisorRisk.hazardId);
    if (!hazard) return [];
    
    const matchingRelIds = relations
      .filter((r: any) => r.hazardCode === hazard.code)
      .map((r: any) => r.measureId);
    
    return allMeasures.filter((m: any) => matchingRelIds.includes(m.id));
  }, [advisorRisk, hazards, relations, allMeasures]);

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

  const applyAiSuggestionsReview = (s: any) => {
    if (s.impact) setRevImpact(String(s.impact));
    if (s.probability) setRevProbability(String(s.probability));
    if (s.residualImpact) setRevResImpact(String(s.residualImpact));
    if (s.residualProbability) setRevResProbability(String(s.residualProbability));
    if (s.bruttoReason) setRevBruttoReason(s.bruttoReason);
    if (s.nettoReason) setRevNettoReason(s.nettoReason);
    toast({ title: "KI-Review Vorschläge übernommen" });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-500/10 text-orange-600 flex items-center justify-center border-2 border-orange-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Risikoinventar</h1>
            <p className="text-sm text-muted-foreground mt-1">Zentrale Steuerung und Überwachung der Unternehmensrisiken.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 font-bold uppercase text-[10px] rounded-none border-primary/20 text-primary bg-primary/5" onClick={() => exportRisksExcel(hierarchicalRisks, resources || [])}>
            <Download className="w-4 h-4 mr-2" /> Excel Export
          </Button>
          <Button variant="outline" onClick={() => router.push('/risks/catalog')} className="h-10 font-bold uppercase text-[10px] rounded-none px-6 border-blue-200 text-blue-700 bg-blue-50">
            <Library className="w-4 h-4 mr-2" /> Gefährdungskatalog
          </Button>
          <Button onClick={() => { resetForm(); setIsRiskDialogOpen(true); }} className="h-10 font-bold uppercase text-[10px] rounded-none px-6 bg-orange-600 hover:bg-orange-700 text-white border-none shadow-lg">
            <Plus className="w-4 h-4 mr-2" /> Risiko anlegen
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Risiken durchsuchen..." 
              className="pl-10 h-11 border-2 bg-white dark:bg-slate-900 rounded-none shadow-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex border bg-card h-11 p-1 gap-1">
            <Filter className="w-3.5 h-3.5 ml-3 my-auto text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="border-none shadow-none h-full rounded-none bg-transparent min-w-[160px] text-[10px] font-bold uppercase">
                <SelectValue placeholder="Alle" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all">Alle Kategorien</SelectItem>
                <SelectItem value="IT-Sicherheit">IT-Sicherheit</SelectItem>
                <SelectItem value="Datenschutz">Datenschutz</SelectItem>
                <SelectItem value="Rechtlich">Rechtlich</SelectItem>
                <SelectItem value="Betrieblich">Betrieblich</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="admin-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-4 font-bold uppercase text-[10px]">Risiko / Bezug</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Brutto-Score</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Netto-Score</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Maßnahmen</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : hierarchicalRisks.map((risk) => {
                const isSub = !!risk.parentId;
                const scoreRaw = risk.impact * risk.probability;
                const scoreRes = (risk.residualImpact || 0) * (risk.residualProbability || 0);
                const asset = resources?.find(r => r.id === risk.assetId);
                const lastReview = risk.lastReviewDate ? new Date(risk.lastReviewDate).toLocaleDateString() : 'N/A';
                const assignedMeasures = getMeasuresForRisk(risk.id);
                const subs = getSubRisks(risk.id);
                const hasSubs = subs.length > 0;
                
                return (
                  <TableRow key={risk.id} className={cn("hover:bg-muted/5 group border-b last:border-0", isSub && "bg-slate-50/50")}>
                    <TableCell className="py-4">
                      <div className={cn("flex items-start gap-2", isSub && "pl-8")}>
                        {isSub && <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300 mt-1" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{risk.title}</div>
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-2 text-[9px] font-bold uppercase text-muted-foreground">
                              {risk.category} 
                              {asset && <><span className="text-slate-300">|</span> <Layers className="w-2.5 h-2.5" /> {asset.name}</>}
                              {hasSubs && <Badge className="bg-indigo-50 text-indigo-700 border-none rounded-none text-[8px] h-4 px-1.5">{subs.length} SUB-RISIKEN</Badge>}
                            </div>
                            <div className="flex items-center gap-1 text-[8px] font-black uppercase text-slate-400">
                              <Clock className="w-2.5 h-2.5" /> Letzte Prüfung: {lastReview}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className={cn("inline-flex items-center px-2 py-0.5 border font-black text-xs", scoreRaw >= 15 ? "text-red-600 bg-red-50" : "text-orange-600 bg-orange-50")}>
                          {scoreRaw}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                        <div className={cn("inline-flex items-center px-2 py-0.5 border font-black text-xs", scoreRes >= 8 ? "text-orange-600 bg-orange-50" : "text-emerald-600 bg-emerald-50")}>
                          {scoreRes || '-'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        {assignedMeasures.length > 0 ? (
                          <Badge 
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer rounded-none text-[8px] font-black border-none px-1.5 h-4.5 w-fit"
                            onClick={() => { setViewMeasuresRisk(risk); setIsMeasuresViewOpen(true); }}
                          >
                            <ClipboardCheck className="w-2.5 h-2.5 mr-1" /> {assignedMeasures.length} GEPLANT
                          </Badge>
                        ) : (
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">Keine Maßnahmen</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-none gap-1.5"
                          onClick={() => openReviewDialog(risk)}
                          disabled={isSaving}
                        >
                          <CalendarCheck className="w-3 h-3" /> Review
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-none w-56">
                            {!risk.parentId && (
                              <DropdownMenuItem onSelect={() => openCreateSubRisk(risk)}>
                                <Plus className="w-3.5 h-3.5 mr-2" /> Sub-Risiko erstellen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => openEdit(risk)}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setViewMeasuresRisk(risk); setIsMeasuresViewOpen(true); }}>
                              <ClipboardCheck className="w-3.5 h-3.5 mr-2" /> Maßnahmen anzeigen
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onSelect={() => { if(confirm("Risiko permanent löschen?")) deleteCollectionRecord('risks', risk.id, dataSource).then(() => refresh()); }}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen
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
      </div>

      <Dialog open={isRiskDialogOpen} onOpenChange={(val) => { if(!val) { setIsRiskDialogOpen(false); setSelectedRisk(null); } }}>
        <DialogContent className="max-w-4xl rounded-none p-0 overflow-hidden flex flex-col h-[85vh] border-2 shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-orange-500" />
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">Risiko-Erfassung</DialogTitle>
              </div>
              <AiFormAssistant 
                formType="risk" 
                currentData={{ title, category, assetId, description, impact, probability }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-white dark:bg-slate-950">
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Risiko-Bezeichnung</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-none h-11 text-base font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Kategorie</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="IT-Sicherheit">IT-Sicherheit</SelectItem>
                      <SelectItem value="Datenschutz">Datenschutz</SelectItem>
                      <SelectItem value="Rechtlich">Rechtlich</SelectItem>
                      <SelectItem value="Betrieblich">Betrieblich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Übergeordnetes Risiko</Label>
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">Haupt-Risiko</SelectItem>
                      {risks?.filter(r => !r.parentId && r.id !== selectedRisk?.id).map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-red-600 border-b pb-1">Brutto-Risiko</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit (1-5)</Label>
                      <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setProbability(v)} className={cn("flex-1 h-8 border text-[10px] font-bold", probability === v ? "bg-red-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Auswirkung (1-5)</Label>
                      <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setImpact(v)} className={cn("flex-1 h-8 border text-[10px] font-bold", impact === v ? "bg-red-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Begründung</Label>
                      <Textarea value={bruttoReason} onChange={e => setBruttoReason(e.target.value)} className="rounded-none min-h-[80px] text-xs" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-emerald-600 border-b pb-1">Netto-Risiko</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit (Netto)</Label>
                      <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setResProbability(v)} className={cn("flex-1 h-8 border text-[10px] font-bold", resProbability === v ? "bg-emerald-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Auswirkung (Netto)</Label>
                      <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setResImpact(v)} className={cn("flex-1 h-8 border text-[10px] font-bold", resImpact === v ? "bg-emerald-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Begründung</Label>
                      <Textarea value={nettoReason} onChange={e => setNettoReason(e.target.value)} className="rounded-none min-h-[80px] text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-6 border-t">
                <Label className="text-[10px] font-bold uppercase">Szenario Beschreibung</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-none min-h-[120px]" />
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsRiskDialogOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleSaveRisk} disabled={isSaving} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] bg-orange-600 hover:bg-orange-700 text-white">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-3xl rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-2xl">
          <DialogHeader className="p-6 bg-emerald-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-3">
                <CalendarCheck className="w-5 h-5 text-emerald-400" />
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">Risiko-Review & Re-Zertifizierung</DialogTitle>
              </div>
              <AiFormAssistant 
                formType="risk" 
                currentData={{ title: reviewRisk?.title, category: reviewRisk?.category, impact: revImpact, probability: revProbability }} 
                onApply={applyAiSuggestionsReview} 
              />
            </div>
          </DialogHeader>
          <div className="p-8 space-y-8 bg-white">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase">Zu prüfendes Risiko:</p>
              <h4 className="font-bold text-base leading-tight">{reviewRisk?.title}</h4>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-6 border-t">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-red-600 border-b pb-1">Brutto-Review</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit</Label>
                    <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setRevProbability(v)} className={cn("flex-1 h-8 border text-[10px] font-bold", revProbability === v ? "bg-red-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase">Auswirkung</Label>
                    <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setRevImpact(v)} className={cn("flex-1 h-8 border text-[10px] font-bold", revImpact === v ? "bg-red-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-emerald-600 border-b pb-1">Netto-Review</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit (Netto)</Label>
                    <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setRevResProbability(v)} className={cn("flex-1 h-8 border text-[10px] font-bold", revResProbability === v ? "bg-emerald-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase">Auswirkung (Netto)</Label>
                    <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setRevResImpact(v)} className={cn("flex-1 h-8 border text-[10px] font-bold", revResImpact === v ? "bg-emerald-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleReviewSubmit} disabled={isSaving} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Review Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMeasuresViewOpen} onOpenChange={setIsMeasuresViewOpen}>
        <DialogContent className="max-w-2xl rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-5 h-5 text-emerald-500" />
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">Verknüpfte Maßnahmen</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-white">
            <ScrollArea className="h-64 border rounded-none p-4 bg-slate-50">
              <div className="space-y-3">
                {viewMeasuresRisk && getMeasuresForRisk(viewMeasuresRisk.id).map(m => (
                  <div key={m.id} className="p-3 bg-white border border-slate-200 flex items-center justify-between group">
                    <div>
                      <p className="text-xs font-bold">{m.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{m.status}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/risks/measures?search=${m.title}`)}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex justify-end px-6">
            <Button onClick={() => setIsMeasuresViewOpen(false)} className="rounded-none h-9 px-8 font-bold uppercase text-[10px]">Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RiskDashboardPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-40"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <RiskDashboardContent />
    </Suspense>
  );
}
