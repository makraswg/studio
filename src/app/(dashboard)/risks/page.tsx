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
        toast({ title: "Risiko gespeichert" });
        setIsRiskDialogOpen(false);
        resetForm();
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

  const openReviewDialog = (risk: Risk) => {
    setReviewRisk(risk);
    setRevImpact(risk.impact.toString());
    setRevProbability(risk.probability.toString());
    setRevResImpact(risk.residualImpact?.toString() || '2');
    setRevResProbability(risk.residualProbability?.toString() || '2');
    setIsReviewDialogOpen(true);
  };

  const hierarchicalRisks = useMemo(() => {
    if (!risks) return [];
    return risks.filter(r => {
      const matchesTenant = activeTenantId === 'all' || r.tenantId === activeTenantId;
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.owner.toLowerCase().includes(search.toLowerCase());
      return matchesTenant && matchesCategory && matchesSearch;
    }).sort((a, b) => (b.impact * b.probability) - (a.impact * a.probability));
  }, [risks, search, categoryFilter, activeTenantId]);

  const getAcceptanceBadge = (status?: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-amber-500 text-white border-none rounded-none text-[7px] font-black uppercase h-4 px-1">PRÜFUNG</Badge>;
      case 'approved': return <Badge className="bg-emerald-600 text-white border-none rounded-none text-[7px] font-black uppercase h-4 px-1">ABGENOMMEN</Badge>;
      default: return <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1 border-slate-200">ENTWURF</Badge>;
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/10 text-accent flex items-center justify-center rounded-lg border shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-accent/10 text-accent text-[9px] font-black uppercase tracking-wider">GRC Module</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase">Risikoinventar</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Überwachung der Bedrohungslage für {activeTenantId === 'all' ? 'alle Standorte' : activeTenantId}.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold uppercase text-[9px] tracking-wider px-4 border-slate-200" onClick={() => exportRisksExcel(hierarchicalRisks, resources || [])}>
            <Download className="w-3.5 h-3.5 mr-2 text-primary" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/risks/catalog')} className="h-9 rounded-md font-bold uppercase text-[9px] tracking-wider px-4 border-blue-200 text-blue-700 bg-blue-50">
            <Library className="w-3.5 h-3.5 mr-2" /> Kataloge
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setIsRiskDialogOpen(true); }} className="h-9 rounded-md font-bold uppercase text-[10px] tracking-wider px-6 bg-accent hover:bg-accent/90 text-white shadow-sm transition-all">
            <Plus className="w-3.5 h-3.5 mr-2" /> Risiko erfassen
          </Button>
        </div>
      </div>

      {/* Filter Area - Single Row */}
      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-accent transition-colors" />
          <Input 
            placeholder="Risiken oder Verantwortliche suchen..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="border-none shadow-none h-full rounded-sm bg-transparent text-[9px] font-black uppercase min-w-[150px]">
              <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Alle Kategorien" />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="all" className="text-xs">Alle Kategorien</SelectItem>
              <SelectItem value="IT-Sicherheit" className="text-xs">IT-Sicherheit</SelectItem>
              <SelectItem value="Datenschutz" className="text-xs">Datenschutz</SelectItem>
              <SelectItem value="Rechtlich" className="text-xs">Rechtlich</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent opacity-20" />
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Risikodaten werden geladen...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold uppercase tracking-widest text-[9px] text-slate-400">Risiko / Bezug</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[9px] text-slate-400 text-center">Score</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[9px] text-slate-400">Workflow</TableHead>
                <TableHead className="text-right px-6 font-bold uppercase tracking-widest text-[9px] text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hierarchicalRisks.map((risk) => {
                const scoreRaw = risk.impact * risk.probability;
                const asset = resources?.find(r => r.id === risk.assetId);
                
                return (
                  <TableRow key={risk.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                    <TableCell className="py-4 px-6">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                          scoreRaw >= 15 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                        )}>
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-800 truncate cursor-pointer hover:text-accent" onClick={() => openEdit(risk)}>{risk.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8px] font-black uppercase text-slate-400">{risk.category}</span>
                            {asset && <span className="text-[8px] font-bold text-slate-500 uppercase flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> {asset.name}</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "rounded-md font-black text-[10px] h-6 px-2",
                        scoreRaw >= 15 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                      )}>
                        {scoreRaw}
                      </Badge>
                    </TableCell>
                    <TableCell>{getAcceptanceBadge(risk.acceptanceStatus)}</TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end items-center gap-1.5">
                        <Button variant="ghost" size="sm" className="h-8 rounded-md text-[9px] font-black uppercase tracking-wider gap-1.5 opacity-0 group-hover:opacity-100 hover:bg-emerald-50 active:scale-95" onClick={() => openReviewDialog(risk)}>
                          Review
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-xl border">
                            <DropdownMenuItem onSelect={() => openEdit(risk)} className="rounded-md py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem className="text-red-600 rounded-md py-2 gap-2 text-xs font-bold" onSelect={() => { if(confirm("Risiko permanent löschen?")) deleteCollectionRecord('risks', risk.id, dataSource).then(() => refresh()); }}>
                              <Trash2 className="w-3.5 h-3.5" /> Löschen
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
      )}

      {/* Risk Dialog */}
      <Dialog open={isRiskDialogOpen} onOpenChange={(val) => { if(!val) { setIsRiskDialogOpen(false); setSelectedRisk(null); } }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] rounded-xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center text-accent shadow-md">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-headline font-bold uppercase tracking-tight">Risiko-Analyse</DialogTitle>
                  <DialogDescription className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Szenario Definition & Bewertung</DialogDescription>
                </div>
              </div>
              <AiFormAssistant 
                formType="risk" 
                currentData={{ title, category, assetId, description, impact, probability }} 
                onApply={(s) => {
                  if (s.title) setTitle(s.title);
                  if (s.description) setDescription(s.description);
                  if (s.impact) setImpact(String(s.impact));
                  if (s.probability) setProbability(String(s.probability));
                  toast({ title: "KI-Vorschläge übernommen" });
                }} 
              />
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Risiko-Bezeichnung</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-md h-11 text-sm font-bold border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Kategorie</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="rounded-md h-11 text-xs border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-md">
                      <SelectItem value="IT-Sicherheit" className="text-xs">IT-Sicherheit</SelectItem>
                      <SelectItem value="Datenschutz" className="text-xs">Datenschutz</SelectItem>
                      <SelectItem value="Rechtlich" className="text-xs">Rechtlich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Bezug (Asset)</Label>
                  <Select value={assetId} onValueChange={setAssetId}>
                    <SelectTrigger className="rounded-md h-11 text-xs border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-md">
                      <SelectItem value="none" className="text-xs">Organisationsweit</SelectItem>
                      {resources?.map(r => <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-red-50 rounded-lg border border-red-100 space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-red-600 flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> Brutto-Risiko</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[8px] font-bold uppercase text-slate-500">Wahrscheinlichkeit (1-5)</Label>
                      <div className="flex gap-1">
                        {['1','2','3','4','5'].map(v => (
                          <button key={v} onClick={() => setProbability(v)} className={cn(
                            "flex-1 h-9 rounded-md border font-black text-xs transition-all",
                            probability === v ? "bg-red-600 border-red-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-red-200"
                          )}>{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[8px] font-bold uppercase text-slate-500">Schadenshöhe (1-5)</Label>
                      <div className="flex gap-1">
                        {['1','2','3','4','5'].map(v => (
                          <button key={v} onClick={() => setImpact(v)} className={cn(
                            "flex-1 h-9 rounded-md border font-black text-xs transition-all",
                            impact === v ? "bg-red-600 border-red-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-red-200"
                          )}>{v}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-emerald-50 rounded-lg border border-emerald-100 space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Netto-Risiko</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[8px] font-bold uppercase text-slate-500">Wahrscheinlichkeit (Netto)</Label>
                      <div className="flex gap-1">
                        {['1','2','3','4','5'].map(v => (
                          <button key={v} onClick={() => setResProbability(v)} className={cn(
                            "flex-1 h-9 rounded-md border font-black text-xs transition-all",
                            resProbability === v ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-emerald-200"
                          )}>{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[8px] font-bold uppercase text-slate-500">Schadenshöhe (Netto)</Label>
                      <div className="flex gap-1">
                        {['1','2','3','4','5'].map(v => (
                          <button key={v} onClick={() => setResImpact(v)} className={cn(
                            "flex-1 h-9 rounded-md border font-black text-xs transition-all",
                            resImpact === v ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-emerald-200"
                          )}>{v}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Szenario Beschreibung</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-lg min-h-[100px] p-4 border-slate-200 text-xs leading-relaxed" placeholder="Beschreibung der Bedrohung..." />
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsRiskDialogOpen(false)} className="w-full sm:w-auto rounded-md font-black uppercase text-[9px] px-6">Abbrechen</Button>
            <Button size="sm" onClick={handleSaveRisk} disabled={isSaving} className="w-full sm:w-auto rounded-md font-black uppercase text-[10px] tracking-widest px-10 h-11 bg-accent hover:bg-accent/90 text-white shadow-sm gap-2">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern
            </Button>
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
