"use client";

import { useState, useMemo, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle, 
  Plus, 
  Search, 
  Loader2, 
  Library, 
  Filter,
  Layers,
  ShieldAlert,
  Download,
  MoreVertical,
  Activity,
  ArrowRight,
  Pencil,
  Trash2,
  Save,
  User as UserIcon,
  Shield,
  Info,
  ClipboardList,
  CalendarDays,
  CheckCircle2,
  Zap,
  PlusCircle,
  FileCheck,
  ChevronRight,
  CornerDownRight,
  Split,
  X,
  BrainCircuit,
  ShieldCheck,
  Target,
  ExternalLink,
  ClipboardCheck,
  AlertCircle,
  Workflow,
  Eye
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { exportRisksExcel } from '@/lib/export-utils';
import { Risk, Resource, Hazard, Task, PlatformUser, RiskMeasure, Process } from '@/lib/types';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { usePlatformAuth } from '@/context/auth-context';
import { Switch } from '@/components/ui/switch';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { saveTaskAction } from '@/app/actions/task-actions';
import { toast } from '@/hooks/use-toast';
import { getRiskAdvice, RiskAdvisorOutput } from '@/ai/flows/risk-advisor-flow';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function RiskDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = usePlatformAuth();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const processedDerive = useRef<string | null>(null);
  
  // UI States
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isRiskDialogOpen, setIsRiskDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  // Form Search States
  const [assetSearch, setAssetSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');

  // AI Advisor State
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<RiskAdvisorOutput | null>(null);

  // Quick Assessment State
  const [isQuickAssessmentOpen, setIsQuickAssessmentOpen] = useState(false);
  const [assessmentType, setAssessmentType] = useState<'resource' | 'process'>('resource');
  const [assessmentData, setAssessmentData] = useState<Record<string, { impact: string, probability: string, comment: string }>>({});

  // Task Creation States
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [taskTargetRisk, setTaskTargetRisk] = useState<Risk | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [assetId, setAssetId] = useState('none');
  const [processId, setProcessId] = useState('none');
  const [parentId, setParentId] = useState('none');
  const [category, setCategory] = useState('IT-Sicherheit');
  const [impact, setImpact] = useState('3');
  const [probability, setProbability] = useState('3');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<Risk['status']>('active');
  const [treatmentStrategy, setTreatmentStrategy] = useState<Risk['treatmentStrategy']>('mitigate');
  const [hazardId, setHazardId] = useState('');

  const { data: risks, isLoading, refresh } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: hazards } = usePluggableCollection<Hazard>('hazards');
  const { data: pUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: allMeasures, refresh: refreshMeasures } = usePluggableCollection<RiskMeasure>('riskMeasures');

  useEffect(() => { 
    setMounted(true); 
  }, []);

  useEffect(() => {
    if (!mounted || !hazards) return;
    
    const deriveId = searchParams.get('derive');
    if (deriveId && deriveId !== processedDerive.current) {
      const hazard = hazards.find(h => h.id === deriveId);
      if (hazard) {
        processedDerive.current = deriveId;
        setSelectedRisk(null);
        setTitle(`Risiko: ${hazard.title}`);
        setAssetId('none');
        setProcessId('none');
        setParentId('none');
        setDescription(hazard.description);
        setCategory('IT-Sicherheit');
        setImpact('3');
        setProbability('3');
        setTreatmentStrategy('mitigate');
        setHazardId(hazard.id);
        setIsRiskDialogOpen(true);
        const url = new URL(window.location.href);
        url.searchParams.delete('derive');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [hazards, mounted, searchParams]);

  const { topLevelRisks, subRisksMap } = useMemo(() => {
    if (!risks) return { topLevelRisks: [], subRisksMap: {} };
    const filtered = risks.filter(r => {
      const matchesTenant = activeTenantId === 'all' || r.tenantId === activeTenantId;
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase());
      return matchesTenant && matchesCategory && matchesSearch;
    });
    const top = filtered.filter(r => !r.parentId || r.parentId === 'none' || r.parentId === '');
    const subMap: Record<string, Risk[]> = {};
    filtered.filter(r => r.parentId && r.parentId !== 'none' && r.parentId !== '').forEach(r => {
      if (!subMap[r.parentId!]) subMap[r.parentId!] = [];
      subMap[r.parentId!].push(r);
    });
    return { topLevelRisks: top.sort((a, b) => (b.impact * b.probability) - (a.impact * a.probability)), subRisksMap: subMap };
  }, [risks, search, categoryFilter, activeTenantId]);

  const handleSaveRisk = async () => {
    if (!title) { toast({ variant: "destructive", title: "Fehler", description: "Bitte einen Titel angeben." }); return; }
    setIsSaving(true);
    const id = selectedRisk?.id || `risk-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    const riskData: Risk = {
      ...selectedRisk, id, tenantId: targetTenantId,
      assetId: assetId === 'none' ? undefined : assetId,
      processId: processId === 'none' ? undefined : processId,
      hazardId: hazardId || undefined, parentId: parentId === 'none' ? undefined : parentId,
      title, category, impact: parseInt(impact), probability: parseInt(probability),
      description, owner: owner || user?.displayName || 'N/A', status, treatmentStrategy,
      createdAt: selectedRisk?.createdAt || new Date().toISOString()
    } as Risk;
    try {
      const res = await saveCollectionRecord('risks', id, riskData, dataSource);
      if (res.success) { toast({ title: selectedRisk ? "Risiko aktualisiert" : "Risiko gespeichert" }); setIsRiskDialogOpen(false); refresh(); }
    } finally { setIsSaving(false); }
  };

  const openEdit = (risk: Risk) => {
    setSelectedRisk(risk); setTitle(risk.title); setAssetId(risk.assetId || 'none');
    setProcessId(risk.processId || 'none'); setParentId(risk.parentId || 'none');
    setCategory(risk.category); setImpact(risk.impact.toString()); setProbability(risk.probability.toString());
    setDescription(risk.description || ''); setOwner(risk.owner || ''); setStatus(risk.status);
    setTreatmentStrategy(risk.treatmentStrategy || 'mitigate'); setHazardId(risk.hazardId || '');
    setAssetSearch(''); setParentSearch(''); setIsRiskDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedRisk(null); setTitle(''); setAssetId('none'); setProcessId('none'); setParentId('none');
    setCategory('IT-Sicherheit'); setImpact('3'); setProbability('3'); setTreatmentStrategy('mitigate');
    setDescription(''); setOwner(user?.displayName || ''); setStatus('active'); setHazardId('');
    setAssetSearch(''); setParentSearch('');
  };

  const RiskRow = ({ risk, isSub = false }: { risk: Risk, isSub?: boolean }) => {
    const score = risk.impact * risk.probability;
    const asset = resources?.find(r => r.id === risk.assetId);
    const process = processes?.find(p => p.id === risk.processId);
    const measureCount = allMeasures?.filter(m => m.riskIds?.includes(risk.id)).length || 0;
    return (
      <>
        <TableRow key={risk.id} className={cn("group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer", isSub && "bg-slate-50/30")} onClick={() => router.push(`/risks/${risk.id}`)}>
          <TableCell className="py-4 px-6">
            <div className="flex items-start gap-3">
              {isSub && <div className="w-8 flex justify-center pt-1 shrink-0 text-slate-300"><CornerDownRight className="w-4 h-4" /></div>}
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-inner", score >= 15 ? "bg-red-50 text-red-600 border-red-100" : score >= 8 ? "bg-orange-50 text-orange-600 border-orange-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}><AlertTriangle className="w-4 h-4" /></div>
              <div className="min-w-0"><div className="font-bold text-sm text-slate-800 group-hover:text-accent transition-colors">{risk.title}</div><div className="flex items-center gap-2 mt-0.5">{asset && <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1.5"><Layers className="w-3 h-3 opacity-50" /> {asset.name}</span>}{process && <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1.5"><Workflow className="w-3 h-3 opacity-50" /> {process.title}</span>}{isSub && <Badge className="h-3 px-1 text-[7px] bg-slate-200 text-slate-600 border-none font-black uppercase">Sub-Risiko</Badge>}</div></div>
            </div>
          </TableCell>
          <TableCell className="text-center"><Badge className={cn("rounded-md font-bold text-[10px] h-6 min-w-[32px] justify-center shadow-sm border-none", score >= 15 ? "bg-red-600 text-white" : score >= 8 ? "bg-accent text-white" : "bg-emerald-600 text-white")}>{score}</Badge></TableCell>
          <TableCell className="text-center"><Badge variant="outline" className={cn("rounded-full font-bold text-[9px] px-2 h-5 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 transition-all cursor-pointer", measureCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "text-slate-400")} onClick={(e) => { e.stopPropagation(); router.push(`/risks/measures?riskId=${risk.id}`); }}><ClipboardCheck className="w-2.5 h-2.5 mr-1" /> {measureCount}</Badge></TableCell>
          <TableCell className="p-4"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{risk.category}</span></TableCell>
          <TableCell><Badge variant="outline" className="rounded-full text-[8px] font-bold border-slate-200 text-slate-400 px-2 h-5 uppercase">{risk.status}</Badge></TableCell>
          <TableCell className="p-4 px-6 text-right" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm" onClick={() => router.push(`/risks/${risk.id}`)}><Eye className="w-3.5 h-3.5 text-primary" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm" onClick={() => openEdit(risk)}><Pencil className="w-3.5 h-3.5 text-slate-400" /></Button>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-white transition-all shadow-sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-xl w-64 p-1 shadow-2xl border"><DropdownMenuItem onSelect={() => openEdit(risk)} className="rounded-lg py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5" /> Bearbeiten</DropdownMenuItem><DropdownMenuSeparator className="my-1" /><DropdownMenuItem className="text-red-600 rounded-lg py-2 gap-2 text-xs font-bold" onSelect={() => { if(confirm("Risiko unwiderruflich löschen?")) deleteCollectionRecord('risks', risk.id, dataSource).then(() => refresh()); }}><Trash2 className="w-3.5 h-3.5" /> Löschen</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            </div>
          </TableCell>
        </TableRow>
        {subRisksMap[risk.id]?.map(sub => <RiskRow key={sub.id} risk={sub} isSub={true} />)}
      </>
    );
  };

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-10 max-w-[1800px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/10 text-accent flex items-center justify-center rounded-xl border border-accent/10 shadow-sm transition-transform hover:scale-105"><ShieldAlert className="w-6 h-6" /></div>
          <div><Badge className="mb-1 rounded-full px-2 py-0 bg-accent/10 text-accent text-[9px] font-bold border-none uppercase tracking-wider">RiskHub Governance</Badge><h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Risikoinventar</h1><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zentrale Bedrohungslage.</p></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200 active:scale-95" onClick={() => exportRisksExcel(risks || [], resources || [])}><Download className="w-3.5 h-3.5 mr-2" /> Excel</Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20" onClick={() => { resetForm(); setIsRiskDialogOpen(true); }}><Plus className="w-3.5 h-3.5 mr-2" /> Risiko erfassen</Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-accent" /><Input placeholder="Risiken oder Assets suchen..." className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 h-9 shrink-0"><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="border-none shadow-none h-full rounded-sm bg-transparent text-[10px] font-bold min-w-[160px]"><Filter className="w-3 h-3 mr-1.5 text-slate-400" /><SelectValue placeholder="Kategorie" /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="all">Alle Kategorien</SelectItem><SelectItem value="IT-Sicherheit">IT-Sicherheit</SelectItem><SelectItem value="Datenschutz">Datenschutz</SelectItem><SelectItem value="Rechtlich">Rechtlich</SelectItem><SelectItem value="Betrieblich">Betrieblich</SelectItem></SelectContent></Select></div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-accent opacity-20 mx-auto" /></div> : (
          <Table><TableHeader className="bg-slate-50/50"><TableRow className="border-b"><TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Risiko / Bezug</TableHead><TableHead className="font-bold text-[11px] text-slate-400 text-center uppercase tracking-widest">Score</TableHead><TableHead className="font-bold text-[11px] text-slate-400 text-center uppercase tracking-widest">Kontrollen</TableHead><TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Kategorie</TableHead><TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Status</TableHead><TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead></TableRow></TableHeader><TableBody>{topLevelRisks.map(risk => <RiskRow key={risk.id} risk={risk} />)}</TableBody></Table>
        )}
      </div>

      <Dialog open={isRiskDialogOpen} onOpenChange={setIsRiskDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] md:h-auto md:max-h-[85vh] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-10">
            <div className="flex items-center gap-5"><div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent border border-accent/10"><ShieldAlert className="w-6 h-6" /></div><div className="min-w-0"><DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate uppercase tracking-tight">{selectedRisk ? 'Risiko aktualisieren' : 'Neues Risiko erfassen'}</DialogTitle><DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Identifikation & Bewertung von Bedrohungen</DialogDescription></div></div>
          </DialogHeader>
          <ScrollArea className="flex-1 bg-slate-50/30">
            <div className="p-8 space-y-10 pb-20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 md:col-span-2"><Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1">Bezeichnung des Risikos</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl h-12 text-sm font-bold border-slate-200 bg-white" placeholder="z.B. Datendiebstahl..." /></div>
                <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Kategorie</Label><Select value={category} onValueChange={setCategory}><SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl">{['IT-Sicherheit', 'Datenschutz', 'Rechtlich', 'Betrieblich', 'Finanziell'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Betroffenes IT-Asset</Label>
                  <div className="relative group mb-1.5">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <Input placeholder="Assets filtern..." value={assetSearch} onChange={e => setAssetSearch(e.target.value)} className="h-8 pl-8 text-[10px] rounded-lg" />
                  </div>
                  <Select value={assetId} onValueChange={setAssetId}><SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue placeholder="System wählen..." /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none">Global (Alle Assets)</SelectItem>{resources?.filter(res => res.name.toLowerCase().includes(assetSearch.toLowerCase())).map(res => <SelectItem key={res.id} value={res.id}>{res.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Übergeordnetes Risiko</Label>
                  <div className="relative group mb-1.5">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <Input placeholder="Risiken filtern..." value={parentSearch} onChange={e => setParentSearch(e.target.value)} className="h-8 pl-8 text-[10px] rounded-lg" />
                  </div>
                  <Select value={parentId} onValueChange={setParentId}><SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue placeholder="Wählen..." /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none">Top-Level Risiko</SelectItem>{risks?.filter(r => r.id !== selectedRisk?.id && r.title.toLowerCase().includes(parentSearch.toLowerCase())).map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="p-6 bg-white border rounded-2xl md:col-span-2 shadow-sm space-y-8">
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /> Quantitative Bewertung</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                    <div className="space-y-4"><div className="flex justify-between items-center"><Label className="text-[10px] font-bold uppercase text-slate-500">Eintrittswahrscheinlichkeit</Label><Badge className="bg-slate-100 text-slate-700">{probability}</Badge></div><input type="range" min="1" max="5" value={probability} onChange={e => setProbability(e.target.value)} className="flex-1 accent-accent h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="space-y-4"><div className="flex justify-between items-center"><Label className="text-[10px] font-bold uppercase text-slate-500">Schadensausmaß (Impact)</Label><Badge className="bg-slate-100 text-slate-700">{impact}</Badge></div><input type="range" min="1" max="5" value={impact} onChange={e => setImpact(e.target.value)} className="flex-1 accent-accent h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" /></div>
                  </div>
                  <div className="pt-6 border-t flex items-center justify-between"><div className="space-y-0.5"><p className="text-[10px] font-black uppercase text-slate-400">Brutto-Score</p><p className="text-xs font-bold text-slate-500 italic">Impact × Wahrscheinlichkeit</p></div><div className={cn("w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-lg border-4 border-white", parseInt(impact) * parseInt(probability) >= 15 ? "bg-red-600 text-white" : parseInt(impact) * parseInt(probability) >= 8 ? "bg-accent text-white" : "bg-emerald-600 text-white")}><span className="text-2xl font-black">{parseInt(impact) * parseInt(probability)}</span></div></div>
                </div>
                <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Szenariobeschreibung</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-2xl min-h-[100px] p-5 border-slate-200 text-xs font-medium bg-white" /></div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2"><Button variant="ghost" size="sm" onClick={() => setIsRiskDialogOpen(false)} className="rounded-xl font-bold text-[10px] px-8 h-11 uppercase">Abbrechen</Button><Button size="sm" onClick={handleSaveRisk} disabled={isSaving || !title} className="rounded-xl h-11 px-12 bg-accent hover:bg-accent/90 text-white font-bold text-[10px] uppercase shadow-lg gap-2">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RiskDashboardPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-accent opacity-20" /></div>}>
      <RiskDashboardContent />
    </Suspense>
  );
}
