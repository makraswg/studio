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
      // If it's a sub-risk, don't aggregate
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
      } else {
        toast({ variant: "destructive", title: "Fehler beim Speichern", description: res.error || "Unbekannter Fehler" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Systemfehler", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetOverrides = async (risk: Risk) => {
    setIsSaving(true);
    const updatedRisk: Risk = {
      ...risk,
      isImpactOverridden: false,
      isProbabilityOverridden: false,
      isResidualImpactOverridden: false,
      isResidualProbabilityOverridden: false,
    };

    try {
      const res = await saveCollectionRecord('risks', risk.id, updatedRisk, dataSource);
      if (res.success) {
        toast({ title: "Berechnung reaktiviert", description: "Werte werden nun wieder automatisch aggregiert." });
        refresh();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Zurücksetzen", description: e.message });
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
        await logAuditEventAction(dataSource as any, {
          tenantId: reviewRisk.tenantId,
          actorUid: authUser?.email || 'system',
          action: `Risiko-Review durchgeführt: ${reviewRisk.title}`,
          entityType: 'risk',
          entityId: reviewRisk.id,
          after: updatedRisk
        });
        toast({ title: "Review abgeschlossen" });
        setIsReviewDialogOpen(false);
        setReviewRisk(null);
        refresh();
      } else {
        toast({ variant: "destructive", title: "Fehler beim Review", description: res.error || "Unbekannter Fehler" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Systemfehler", description: e.message });
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
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Systemfehler", description: e.message });
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
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Systemfehler", description: e.message });
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

      {showWorkflowGuide && (
        <Card className="rounded-none border-2 border-primary/10 bg-primary/5 shadow-none relative overflow-hidden animate-in fade-in slide-in-from-top-4">
          <button onClick={() => setShowWorkflowGuide(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <GitPullRequest className="w-4 h-4 text-primary" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">GRC Prozess-Lifecycle</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { step: "1. Identifikation", desc: "Über Katalog ableiten oder manuell erfassen.", icon: Library },
                { step: "2. Bewertung", desc: "Brutto-Risiko via 1-5 Scoring festlegen.", icon: Scale },
                { step: "3. Behandlung", desc: "BSI Maßnahmen via Advisor verknüpfen.", icon: Zap },
                { step: "4. Überwachung", desc: "Regelmäßige Reviews & Re-Zertifizierung.", icon: ShieldCheck }
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-start relative">
                  <div className="w-8 h-8 rounded-none bg-white border flex items-center justify-center shrink-0 shadow-sm">
                    <item.icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase mb-0.5">{item.step}</p>
                    <p className="text-[9px] text-muted-foreground leading-tight">{item.desc}</p>
                  </div>
                  {i < 3 && <ArrowRight className="hidden md:block absolute -right-4 top-2 w-3 h-3 text-slate-300" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                
                const showCalcBrutto = hasSubs && !risk.isImpactOverridden && !risk.isProbabilityOverridden;
                const showOverrideBrutto = hasSubs && (risk.isImpactOverridden || risk.isProbabilityOverridden);
                const showCalcNetto = hasSubs && !risk.isResidualImpactOverridden && !risk.isResidualProbabilityOverridden;
                const showOverrideNetto = hasSubs && (risk.isResidualImpactOverridden || risk.isResidualProbabilityOverridden);

                const isAnyOverridden = !!(risk.isImpactOverridden || risk.isProbabilityOverridden || risk.isResidualImpactOverridden || risk.isResidualProbabilityOverridden);

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
                        {showCalcBrutto && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild><Calculator className="w-3 h-3 text-indigo-400" /></TooltipTrigger>
                              <TooltipContent className="text-[10px] uppercase font-bold">Berechnet aus Sub-Risiken</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {showOverrideBrutto && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild><AlertCircle className="w-3 h-3 text-orange-400" /></TooltipTrigger>
                              <TooltipContent className="text-[10px] uppercase font-bold">Manuell überschrieben</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                        <div className={cn("inline-flex items-center px-2 py-0.5 border font-black text-xs", scoreRes >= 8 ? "text-orange-600 bg-orange-50" : "text-emerald-600 bg-emerald-50")}>
                          {scoreRes || '-'}
                        </div>
                        {showCalcNetto && <Calculator className="w-3 h-3 text-indigo-400" />}
                        {showOverrideNetto && <AlertCircle className="w-3 h-3 text-orange-400" />}
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
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-5 text-[8px] font-black uppercase bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-none gap-1 px-1.5 w-fit"
                          onClick={() => { setAdvisorRisk(risk); setCustomMeasureTitle(''); setIsAdvisorOpen(true); }}
                        >
                          <Zap className="w-2.5 h-2.5 fill-current" /> Maßnahmen hinzufügen
                        </Button>
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
                            {hasSubs && isAnyOverridden && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => handleResetOverrides(risk)} className="text-indigo-600 font-bold">
                                  <RotateCcw className="w-3.5 h-3.5 mr-2" /> Berechnung reaktivieren
                                </DropdownMenuItem>
                              </>
                            )}
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
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">Risiko-Erfassung</DialogTitle>
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
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Übergeordnetes Risiko (Haupt-Risiko)</Label>
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">Keines (Dies ist ein Haupt-Risiko)</SelectItem>
                      {risks?.filter(r => !r.parentId && r.id !== selectedRisk?.id).map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Asset-Bezug</Label>
                  <Select value={assetId} onValueChange={setAssetId}>
                    <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">Global / Kein System</SelectItem>
                      {resources?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Gefährdungs-Bezug (Katalog)</Label>
                  <Select value={hazardId || 'none'} onValueChange={(v) => setHazardId(v === 'none' ? undefined : v)}>
                    <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">Kein Katalog-Bezug</SelectItem>
                      {hazards?.map(h => <SelectItem key={h.id} value={h.id}>{h.code}: {h.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
              </div>

              <div className="bg-slate-50 border-y py-4 px-6 -mx-8">
                <Collapsible open={showScoringHelp} onOpenChange={setShowScoringHelp}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                      <HelpCircle className="w-3.5 h-3.5 text-primary" />
                      Bewertungshilfe (1-5 Skala)
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold uppercase gap-1">
                        {showScoringHelp ? <><ChevronUp className="w-3 h-3" /> Ausblenden</> : <><ChevronDown className="w-3 h-3" /> Einblenden</>}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase text-primary border-b pb-1">Wahrscheinlichkeit</p>
                        <div className="space-y-1.5">
                          <p className="text-[10px] leading-tight"><strong>1 (Sehr selten):</strong> <span className="text-muted-foreground">Theoretisch denkbar, tritt alle 10+ Jahre auf.</span></p>
                          <p className="text-[10px] leading-tight"><strong>3 (Gelegentlich):</strong> <span className="text-muted-foreground">Tritt ca. alle 1-2 Jahre im Branchenumfeld auf.</span></p>
                          <p className="text-[10px] leading-tight"><strong>5 (Sehr häufig):</strong> <span className="text-muted-foreground">Tritt fast täglich oder wöchentlich auf.</span></p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase text-red-600 border-b pb-1">Schadenshöhe</p>
                        <div className="space-y-1.5">
                          <p className="text-[10px] leading-tight"><strong>1 (Sehr gering):</strong> <span className="text-muted-foreground">Vernachlässigbarer Aufwand zur Behebung.</span></p>
                          <p className="text-[10px] leading-tight"><strong>3 (Mittel):</strong> <span className="text-muted-foreground">Spürbare Auswirkungen auf Geschäftsprozesse.</span></p>
                          <p className="text-[10px] leading-tight"><strong>5 (Sehr hoch):</strong> <span className="text-muted-foreground">Existenzbedrohend, massiver Imageverlust.</span></p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
              
              <div className="grid grid-cols-2 gap-8 border-t pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-1">
                    <h3 className="text-[10px] font-black uppercase text-red-600">Brutto-Risiko (Anfangszustand)</h3>
                    {parentId === 'none' && getSubRisks(selectedRisk?.id || '').length > 0 && (
                      <Badge variant="outline" className="text-[8px] font-black bg-indigo-50 text-indigo-700 border-none rounded-none">AGGREGIERT</Badge>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit (1-5)</Label>
                        {parentId === 'none' && getSubRisks(selectedRisk?.id || '').length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("h-5 px-1.5 text-[8px] font-bold uppercase gap-1", isProbabilityOverridden ? "text-orange-600" : "text-indigo-600")}
                            onClick={() => setIsProbabilityOverridden(!isProbabilityOverridden)}
                          >
                            {isProbabilityOverridden ? <><RotateCcw className="w-2.5 h-2.5" /> Reset auf Berechnung</> : <><AlertCircle className="w-2.5 h-2.5" /> Manuell anpassen</>}
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {['1','2','3','4','5'].map(v => (
                          <button 
                            key={v} 
                            onClick={() => { setProbability(v); if(parentId === 'none' && getSubRisks(selectedRisk?.id || '').length > 0) setIsProbabilityOverridden(true); }} 
                            className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", probability === v ? "bg-red-600 text-white" : "bg-muted/30")}
                          >{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[9px] font-bold uppercase">Auswirkung (1-5)</Label>
                        {parentId === 'none' && getSubRisks(selectedRisk?.id || '').length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("h-5 px-1.5 text-[8px] font-bold uppercase gap-1", isImpactOverridden ? "text-orange-600" : "text-indigo-600")}
                            onClick={() => setIsImpactOverridden(!isImpactOverridden)}
                          >
                            {isImpactOverridden ? <><RotateCcw className="w-2.5 h-2.5" /> Reset auf Berechnung</> : <><AlertCircle className="w-2.5 h-2.5" /> Manuell anpassen</>}
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {['1','2','3','4','5'].map(v => (
                          <button 
                            key={v} 
                            onClick={() => { setImpact(v); if(parentId === 'none' && getSubRisks(selectedRisk?.id || '').length > 0) setIsImpactOverridden(true); }} 
                            className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", impact === v ? "bg-red-600 text-white" : "bg-muted/30")}
                          >{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Begründung Brutto-Bewertung</Label>
                      <Textarea value={bruttoReason} onChange={e => setBruttoReason(e.target.value)} placeholder="Warum diese Einstufung?" className="rounded-none min-h-[80px] text-xs" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-1">
                    <h3 className="text-[10px] font-black uppercase text-emerald-600">Netto-Risiko (Restrisiko)</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit (Netto)</Label>
                        {parentId === 'none' && getSubRisks(selectedRisk?.id || '').length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("h-5 px-1.5 text-[8px] font-bold uppercase gap-1", isResProbabilityOverridden ? "text-orange-600" : "text-indigo-600")}
                            onClick={() => setIsResProbabilityOverridden(!isResProbabilityOverridden)}
                          >
                            {isResProbabilityOverridden ? <><RotateCcw className="w-2.5 h-2.5" /> Reset</> : <><AlertCircle className="w-2.5 h-2.5" /> Override</>}
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {['1','2','3','4','5'].map(v => (
                          <button 
                            key={v} 
                            onClick={() => { setResProbability(v); if(parentId === 'none' && getSubRisks(selectedRisk?.id || '').length > 0) setIsResProbabilityOverridden(true); }} 
                            className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", resProbability === v ? "bg-emerald-600 text-white" : "bg-muted/30")}
                          >{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[9px] font-bold uppercase">Auswirkung (Netto)</Label>
                        {parentId === 'none' && getSubRisks(selectedRisk?.id || '').length > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("h-5 px-1.5 text-[8px] font-bold uppercase gap-1", isResImpactOverridden ? "text-orange-600" : "text-indigo-600")}
                            onClick={() => setIsResImpactOverridden(!isResImpactOverridden)}
                          >
                            {isResImpactOverridden ? <><RotateCcw className="w-2.5 h-2.5" /> Reset</> : <><AlertCircle className="w-2.5 h-2.5" /> Override</>}
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {['1','2','3','4','5'].map(v => (
                          <button 
                            key={v} 
                            onClick={() => { setResImpact(v); if(parentId === 'none' && getSubRisks(selectedRisk?.id || '').length > 0) setIsResImpactOverridden(true); }} 
                            className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", resImpact === v ? "bg-emerald-600 text-white" : "bg-muted/30")}
                          >{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Begründung Netto-Bewertung</Label>
                      <Textarea value={nettoReason} onChange={e => setNettoReason(e.target.value)} placeholder="Wie wirken die Maßnahmen?" className="rounded-none min-h-[80px] text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-6 border-t">
                <Label className="text-[10px] font-bold uppercase">Beschreibung des Szenarios</Label>
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

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-3xl rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-2xl">
          <DialogHeader className="p-6 bg-emerald-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <CalendarCheck className="w-5 h-5 text-emerald-400" />
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">Risiko-Review & Re-Zertifizierung</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-8 space-y-8 bg-white">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase">Zu prüfendes Risiko:</p>
              <h4 className="font-bold text-base leading-tight">{reviewRisk?.title}</h4>
              <Badge variant="outline" className="rounded-none uppercase text-[8px] font-bold mt-1">{reviewRisk?.category}</Badge>
            </div>

            {reviewRisk && getSubRisks(reviewRisk.id).length > 0 && (
              <Alert variant="destructive" className="rounded-none border-orange-200 bg-orange-50 text-orange-800">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-[10px] font-black uppercase">Haupt-Risiko mit Sub-Risiken</AlertTitle>
                <AlertDescription className="text-[10px] leading-relaxed">
                  Dieses Risiko aggregiert Werte aus {getSubRisks(reviewRisk.id).length} Sub-Risiken. Manuelle Änderungen während des Reviews überschreiben die automatische Berechnung (Override). 
                  Sie können die Berechnung jederzeit über den <strong>"Reset"</strong> Button wieder aktivieren.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-8 pt-6 border-t">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-1">
                  <h3 className="text-[10px] font-black uppercase text-red-600">Brutto-Risiko (Review)</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit</Label>
                      {reviewRisk && !reviewRisk.parentId && getSubRisks(reviewRisk.id).length > 0 && (
                        <Button 
                          variant="ghost" size="sm" className="h-5 px-1 text-[8px] uppercase gap-1"
                          onClick={() => setRevIsProbOverridden(!revIsProbOverridden)}
                        >
                          {revIsProbOverridden ? <><RotateCcw className="w-2.5 h-2.5" /> Reset</> : <><AlertCircle className="w-2.5 h-2.5" /> Override</>}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => { setRevProbability(v); if(reviewRisk && !reviewRisk.parentId && getSubRisks(reviewRisk.id).length > 0) setRevIsProbOverridden(true); }} className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", revProbability === v ? "bg-red-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] font-bold uppercase">Auswirkung</Label>
                      {reviewRisk && !reviewRisk.parentId && getSubRisks(reviewRisk.id).length > 0 && (
                        <Button 
                          variant="ghost" size="sm" className="h-5 px-1 text-[8px] uppercase gap-1"
                          onClick={() => setRevIsImpactOverridden(!revIsImpactOverridden)}
                        >
                          {revIsImpactOverridden ? <><RotateCcw className="w-2.5 h-2.5" /> Reset</> : <><AlertCircle className="w-2.5 h-2.5" /> Override</>}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => { setRevImpact(v); if(reviewRisk && !reviewRisk.parentId && getSubRisks(reviewRisk.id).length > 0) setRevIsImpactOverridden(true); }} className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", revImpact === v ? "bg-red-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase">Begründung Brutto</Label>
                    <Textarea value={revBruttoReason} onChange={e => setRevBruttoReason(e.target.value)} className="rounded-none min-h-[60px] text-xs" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-1">
                  <h3 className="text-[10px] font-black uppercase text-emerald-600">Netto-Risiko (Review)</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit (Netto)</Label>
                      {reviewRisk && !reviewRisk.parentId && getSubRisks(reviewRisk.id).length > 0 && (
                        <Button 
                          variant="ghost" size="sm" className="h-5 px-1 text-[8px] uppercase gap-1"
                          onClick={() => setRevIsResProbOverridden(!revIsResProbOverridden)}
                        >
                          {revIsResProbOverridden ? <><RotateCcw className="w-2.5 h-2.5" /> Reset</> : <><AlertCircle className="w-2.5 h-2.5" /> Override</>}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => { setRevResProbability(v); if(reviewRisk && !reviewRisk.parentId && getSubRisks(reviewRisk.id).length > 0) setRevIsResProbOverridden(true); }} className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", revResProbability === v ? "bg-emerald-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] font-bold uppercase">Auswirkung (Netto)</Label>
                      {reviewRisk && !reviewRisk.parentId && getSubRisks(reviewRisk.id).length > 0 && (
                        <Button 
                          variant="ghost" size="sm" className="h-5 px-1 text-[8px] uppercase gap-1"
                          onClick={() => setRevIsResImpactOverridden(!revIsResImpactOverridden)}
                        >
                          {revIsResImpactOverridden ? <><RotateCcw className="w-2.5 h-2.5" /> Reset</> : <><AlertCircle className="w-2.5 h-2.5" /> Override</>}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => { setRevResImpact(v); if(reviewRisk && !reviewRisk.parentId && getSubRisks(reviewRisk.id).length > 0) setRevIsResImpactOverridden(true); }} className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", revResImpact === v ? "bg-emerald-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase">Begründung Netto</Label>
                    <Textarea value={revNettoReason} onChange={e => setRevNettoReason(e.target.value)} className="rounded-none min-h-[60px] text-xs" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
              <Info className="w-4 h-4 text-emerald-600 mt-0.5" />
              <p className="text-[10px] text-emerald-800 leading-relaxed font-bold uppercase">
                Mit dem Abschluss des Reviews bestätigen Sie die oben gewählten Werte. Das Review-Datum wird auf den heutigen Tag gesetzt.
              </p>
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

      {/* Measures View Dialog */}
      <Dialog open={isMeasuresViewOpen} onOpenChange={setIsMeasuresViewOpen}>
        <DialogContent className="max-w-2xl rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-5 h-5 text-emerald-500" />
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">Verknüpfte Maßnahmen</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-white">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase">Maßnahmen für Risiko:</p>
              <h4 className="font-bold text-base leading-tight">{viewMeasuresRisk?.title}</h4>
            </div>
            
            <ScrollArea className="h-64 border rounded-none p-4 bg-slate-50">
              <div className="space-y-3">
                {viewMeasuresRisk && getMeasuresForRisk(viewMeasuresRisk.id).map(m => (
                  <div key={m.id} className="p-3 bg-white border border-slate-200 flex items-center justify-between group">
                    <div>
                      <p className="text-xs font-bold">{m.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'N/A'}
                        </span>
                        <Badge variant="outline" className="text-[8px] font-black uppercase rounded-none h-4 px-1.5 bg-slate-50">{m.status}</Badge>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => router.push(`/risks/measures?search=${m.title}`)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {viewMeasuresRisk && getMeasuresForRisk(viewMeasuresRisk.id).length === 0 && (
                  <div className="py-10 text-center text-xs text-muted-foreground italic">Keine Maßnahmen direkt verknüpft.</div>
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex justify-between items-center px-6">
            <Button variant="ghost" onClick={() => router.push('/risks/measures')} className="text-[10px] font-bold uppercase gap-2">
              <ClipboardCheck className="w-3.5 h-3.5" /> Alle Maßnahmen verwalten
            </Button>
            <Button onClick={() => setIsMeasuresViewOpen(false)} className="rounded-none h-9 px-8 font-bold uppercase text-[10px]">Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Measures Advisor Sheet */}
      <Sheet open={isAdvisorOpen} onOpenChange={setIsAdvisorOpen}>
        <SheetContent className="w-[450px] sm:max-w-[500px] p-0 flex flex-col rounded-none border-l-4 border-l-blue-600">
          <SheetHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-none">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <SheetTitle className="text-white uppercase font-black text-sm tracking-widest">Maßnahmen hinzufügen</SheetTitle>
                <SheetDescription className="text-slate-400 text-[10px] uppercase font-bold">IT-Grundschutz Empfehlungen & Eigene Maßnahmen</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
            <div className="p-6 border-b bg-white">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Analysiertes Risiko:</p>
              <h4 className="font-bold text-sm text-slate-900 leading-tight">{advisorRisk?.title}</h4>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-red-50 text-red-700 border-none rounded-none text-[8px] font-black">
                  SCORE: {(advisorRisk?.impact || 0) * (advisorRisk?.probability || 0)}
                </Badge>
                <Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none border-slate-200">
                  {hazards?.find(h => h.id === advisorRisk?.hazardId)?.code || 'Kein Bezug'}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                    <ClipboardCheck className="w-3.5 h-3.5" /> Passende Kontrollen aus Kreuztabelle:
                  </p>
                  
                  {!advisorRisk?.hazardId ? (
                    <div className="py-10 text-center space-y-4 border-2 border-dashed bg-white p-6">
                      <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase">Kein Gefährdungs-Bezug</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Um BSI-Vorschläge zu erhalten, muss das Risiko mit einer Gefährdung aus dem Katalog verknüpft sein.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-none text-[9px] font-black uppercase w-full"
                        onClick={() => { setIsAdvisorOpen(false); if(advisorRisk) openEdit(advisorRisk); }}
                      >
                        Bezug jetzt herstellen
                      </Button>
                    </div>
                  ) : suggestedMeasures.length === 0 ? (
                    <div className="py-10 text-center space-y-4 bg-white border p-6">
                      <Info className="w-10 h-10 text-slate-200 mx-auto" />
                      <p className="text-[10px] text-muted-foreground font-medium italic">Keine spezifischen BSI-Maßnahmen für diesen Code gefunden.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {suggestedMeasures.map((m: any) => (
                        <Card key={m.id} className="rounded-none border shadow-sm bg-white hover:border-blue-400 transition-colors group">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-slate-100 text-slate-600 rounded-none text-[8px] font-black px-1.5 h-4.5 border-none">{m.code}</Badge>
                                  <span className="text-[8px] font-black text-blue-600 uppercase">Baustein: {m.baustein}</span>
                                </div>
                                <p className="text-[11px] font-bold leading-snug group-hover:text-blue-700 transition-colors">{m.title}</p>
                              </div>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 rounded-none hover:bg-emerald-50 hover:text-emerald-600 text-emerald-600 shrink-0"
                                onClick={() => handleAdoptMeasure(m)}
                                disabled={adoptingId === m.id}
                              >
                                {adoptingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Pencil className="w-3.5 h-3.5" /> Eigene Maßnahme hinzufügen
                  </p>
                  <div className="p-4 bg-white border space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400">Titel der Maßnahme</Label>
                      <Input 
                        placeholder="z.B. Monatliche Schulung..." 
                        className="rounded-none h-9 text-xs" 
                        value={customMeasureTitle}
                        onChange={e => setCustomMeasureTitle(e.target.value)}
                      />
                    </div>
                    <Button 
                      className="w-full h-9 rounded-none font-black uppercase text-[9px] gap-2"
                      onClick={handleAddCustomMeasure}
                      disabled={isAddingCustom || !customMeasureTitle}
                    >
                      {isAddingCustom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Maßnahme Planen
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="p-6 border-t bg-white space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-none">
                <p className="text-[9px] text-blue-800 leading-relaxed font-bold uppercase italic">
                  Tipp: Mit dem "+" Button übernehmen Sie die BSI-Empfehlung direkt als geplante Maßnahme für dieses Risiko.
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-none h-10 uppercase font-black text-[10px]" 
                  onClick={() => router.push('/risks/measures')}
                >
                  Alle Maßnahmen
                </Button>
                <Button 
                  className="flex-1 rounded-none h-10 uppercase font-black text-[10px]" 
                  onClick={() => setIsAdvisorOpen(false)}
                >
                  Schließen
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
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
