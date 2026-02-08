"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { exportRisksExcel } from '@/lib/export-utils';
import { Risk, Resource, Hazard, Task, PlatformUser, RiskMeasure } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { saveTaskAction } from '@/app/actions/task-actions';
import { toast } from '@/hooks/use-toast';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { usePlatformAuth } from '@/context/auth-context';
import { Separator } from '@/components/ui/separator';

function RiskDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = usePlatformAuth();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  
  // UI States
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isRiskDialogOpen, setIsRiskDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  // Task Creation States
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskTargetRisk, setTaskTargetRisk] = useState<Risk | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [assetId, setAssetId] = useState('');
  const [category, setCategory] = useState('IT-Sicherheit');
  const [impact, setImpact] = useState('3');
  const [probability, setProbability] = useState('3');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<Risk['status']>('active');
  const [hazardId, setHazardId] = useState('');

  // Catalog Browser State (Quick Add Measure)
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogSuggestions, setCatalogSuggestions] = useState<any[]>([]);

  const { data: risks, isLoading, refresh } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: hazards } = usePluggableCollection<Hazard>('hazards');
  const { data: pUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: allMeasures, refresh: refreshMeasures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: hMeasures } = usePluggableCollection<any>('hazardMeasures');
  const { data: hRelations } = usePluggableCollection<any>('hazardMeasureRelations');

  useEffect(() => { 
    setMounted(true); 
    const deriveFrom = searchParams.get('derive');
    if (deriveFrom && hazards) {
      const hazard = hazards.find(h => h.id === deriveFrom);
      if (hazard) {
        resetForm();
        setTitle(`Risiko: ${hazard.title}`);
        setDescription(hazard.description);
        setCategory('IT-Sicherheit');
        setHazardId(hazard.id);
        setIsRiskDialogOpen(true);
      }
    }
  }, [searchParams, hazards]);

  const filteredRisks = useMemo(() => {
    if (!risks) return [];
    return risks.filter(r => {
      const matchesTenant = activeTenantId === 'all' || r.tenantId === activeTenantId;
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase());
      return matchesTenant && matchesCategory && matchesSearch;
    }).sort((a, b) => (b.impact * b.probability) - (a.impact * a.probability));
  }, [risks, search, categoryFilter, activeTenantId]);

  const linkedMeasures = useMemo(() => {
    if (!selectedRisk || !allMeasures) return [];
    return allMeasures.filter(m => m.riskIds?.includes(selectedRisk.id));
  }, [selectedRisk, allMeasures]);

  const handleSaveRisk = async () => {
    if (!title) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte einen Titel angeben." });
      return;
    }
    setIsSaving(true);
    const id = selectedRisk?.id || `risk-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;

    const riskData: Risk = {
      ...selectedRisk,
      id,
      tenantId: targetTenantId,
      assetId: assetId === 'none' ? undefined : assetId,
      hazardId: hazardId || undefined,
      title,
      category,
      impact: parseInt(impact),
      probability: parseInt(probability),
      description,
      owner: owner || user?.displayName || 'N/A',
      status,
      createdAt: selectedRisk?.createdAt || new Date().toISOString()
    } as Risk;

    try {
      const res = await saveCollectionRecord('risks', id, riskData, dataSource);
      if (res.success) {
        toast({ title: selectedRisk ? "Risiko aktualisiert" : "Risiko gespeichert" });
        setIsRiskDialogOpen(false);
        resetForm();
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskTitle || !taskAssigneeId || !taskTargetRisk) {
      toast({ variant: "destructive", title: "Fehler", description: "Titel und Verantwortlicher sind erforderlich." });
      return;
    }
    setIsSavingTask(true);
    try {
      const res = await saveTaskAction({
        tenantId: taskTargetRisk.tenantId || activeTenantId || 'global',
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        assigneeId: taskAssigneeId,
        dueDate: taskDueDate,
        entityType: 'risk',
        entityId: taskTargetRisk.id,
        creatorId: user?.id || 'system',
        status: 'todo'
      }, dataSource, user?.email || 'system');

      if (res.success) {
        toast({ title: "Aufgabe erstellt" });
        setIsTaskDialogOpen(false);
        setTaskTitle('');
        setTaskDesc('');
        setTaskAssigneeId('');
      }
    } finally {
      setIsSavingTask(false);
    }
  };

  const loadCatalogSuggestions = async () => {
    if (!hazardId || !hMeasures || !hRelations) {
      toast({ variant: "destructive", title: "Keine Katalogdaten", description: "Dieses Risiko ist nicht mit einer Katalog-Gefährdung verknüpft." });
      return;
    }
    
    setIsCatalogLoading(true);
    const hazard = hazards?.find(h => h.id === hazardId);
    if (!hazard) return;

    const relations = hRelations.filter((r: any) => r.hazardCode === hazard.code);
    const suggestedMeasures = relations.map((rel: any) => hMeasures.find((m: any) => m.id === rel.measureId)).filter(Boolean);
    
    setCatalogSuggestions(suggestedMeasures);
    setIsCatalogLoading(false);
    if (suggestedMeasures.length === 0) {
      toast({ title: "Keine Vorschläge", description: "Für diesen Code sind keine BSI-Maßnahmen im Katalog hinterlegt." });
    }
  };

  const applyCatalogMeasure = async (catMeasure: any) => {
    if (!selectedRisk) return;
    
    const measureId = `msr-cat-${Math.random().toString(36).substring(2, 7)}`;
    const data: RiskMeasure = {
      id: measureId,
      riskIds: [selectedRisk.id],
      resourceIds: selectedRisk.assetId ? [selectedRisk.assetId] : [],
      title: `${catMeasure.code}: ${catMeasure.title}`,
      description: `Automatisch abgeleitet aus BSI Baustein ${catMeasure.baustein}.`,
      owner: user?.displayName || 'N/A',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 Tage
      status: 'planned',
      effectiveness: 3,
      isTom: true,
      tomCategory: 'Verschlüsselung' // Default
    };

    const res = await saveCollectionRecord('riskMeasures', measureId, data, dataSource);
    if (res.success) {
      toast({ title: "Maßnahme übernommen", description: catMeasure.title });
      refreshMeasures();
    }
  };

  const resetForm = () => {
    setSelectedRisk(null);
    setTitle('');
    setAssetId('');
    setCategory('IT-Sicherheit');
    setImpact('3');
    setProbability('3');
    setDescription('');
    setOwner('');
    setStatus('active');
    setHazardId('');
    setCatalogSuggestions([]);
  };

  const openEdit = (risk: Risk) => {
    setSelectedRisk(risk);
    setTitle(risk.title);
    setAssetId(risk.assetId || 'none');
    setCategory(risk.category);
    setImpact(risk.impact.toString());
    setProbability(risk.probability.toString());
    setDescription(risk.description || '');
    setOwner(risk.owner || '');
    setStatus(risk.status);
    setHazardId(risk.hazardId || '');
    setCatalogSuggestions([]);
    setIsRiskDialogOpen(true);
  };

  const openTaskDialog = (risk: Risk) => {
    setTaskTargetRisk(risk);
    setTaskTitle(`Maßnahme für Risiko: ${risk.title}`);
    setTaskDesc(`Detaillierte Klärung und Absicherung für das Risiko-Szenario.`);
    setIsTaskDialogOpen(true);
  };

  const applyAiSuggestions = (s: any) => {
    if (s.title) setTitle(s.title);
    if (s.description) setDescription(s.description);
    if (s.impact) setImpact(String(s.impact));
    if (s.probability) setProbability(String(s.probability));
    if (s.category) setCategory(s.category);
    toast({ title: "KI-Vorschläge übernommen" });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/10 text-accent flex items-center justify-center rounded-xl border border-accent/10 shadow-sm transition-transform hover:scale-105">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-accent/10 text-accent text-[9px] font-bold border-none uppercase tracking-wider">RiskHub Governance</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Risikoinventar</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zentrale Bedrohungslage für {activeTenantId === 'all' ? 'alle Standorte' : activeTenantId}.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200 hover:bg-slate-50 transition-all active:scale-95" onClick={() => exportRisksExcel(filteredRisks, resources || [])}>
            <Download className="w-3.5 h-3.5 mr-2" /> Excel Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/risks/catalog')} className="h-9 rounded-md font-bold text-xs px-4 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all active:scale-95">
            <Library className="w-3.5 h-3.5 mr-2" /> Gefährdungskatalog
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 transition-all active:scale-95" onClick={() => { resetForm(); setIsRiskDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Risiko erfassen
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-accent transition-colors" />
          <Input 
            placeholder="Risiken oder Assets suchen..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="border-none shadow-none h-full rounded-sm bg-transparent text-[10px] font-bold min-w-[160px] hover:bg-white/50 transition-all">
              <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-xs">Alle Kategorien</SelectItem>
              <SelectItem value="IT-Sicherheit" className="text-xs">IT-Sicherheit</SelectItem>
              <SelectItem value="Datenschutz" className="text-xs">Datenschutz</SelectItem>
              <SelectItem value="Rechtlich" className="text-xs">Rechtlich</SelectItem>
              <SelectItem value="Betrieblich" className="text-xs">Betrieblich</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent opacity-20" />
            <p className="text-[10px] font-bold text-slate-400">Inventar wird geladen...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Risiko / Bezug</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 text-center uppercase tracking-widest">Score</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Kategorie</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Status</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRisks.map((risk) => {
                const score = risk.impact * risk.probability;
                const asset = resources?.find(r => r.id === risk.assetId);
                return (
                  <TableRow key={risk.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer" onClick={() => openEdit(risk)}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-inner", 
                          score >= 15 ? "bg-red-50 text-red-600 border-red-100" : score >= 8 ? "bg-orange-50 text-orange-600 border-orange-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 group-hover:text-accent transition-colors">{risk.title}</div>
                          {asset && <p className="text-[9px] text-slate-400 font-bold mt-0.5 flex items-center gap-1.5"><Layers className="w-3 h-3 opacity-50" /> {asset.name}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "rounded-md font-bold text-[10px] h-6 min-w-[32px] justify-center shadow-sm border-none", 
                        score >= 15 ? "bg-red-600 text-white" : score >= 8 ? "bg-accent text-white" : "bg-emerald-600 text-white"
                      )}>{score}</Badge>
                    </TableCell>
                    <TableCell className="p-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{risk.category}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full text-[8px] font-bold border-slate-200 text-slate-400 px-2 h-5 uppercase">
                        {risk.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm" onClick={() => openEdit(risk)}>
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-white transition-all shadow-sm">
                              <MoreVertical className="w-4 h-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-56 p-1 shadow-2xl border">
                            <DropdownMenuItem onSelect={() => openEdit(risk)} className="rounded-lg py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5 text-primary" /> Bearbeiten</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openTaskDialog(risk)} className="rounded-lg py-2 gap-2 text-xs font-bold text-indigo-600"><ClipboardList className="w-3.5 h-3.5" /> Aufgabe erstellen</DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem className="text-red-600 rounded-lg py-2 gap-2 text-xs font-bold" onSelect={() => { if(confirm("Risiko unwiderruflich löschen?")) deleteCollectionRecord('risks', risk.id, dataSource).then(() => refresh()); }}>
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
        )}
      </div>

      {/* Enterprise Risk Dialog */}
      <Dialog open={isRiskDialogOpen} onOpenChange={setIsRiskDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-10">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent border border-accent/10 shadow-sm">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate uppercase tracking-tight">{selectedRisk ? 'Risiko aktualisieren' : 'Neues Risiko erfassen'}</DialogTitle>
                  <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Identifikation & Bewertung von Bedrohungen</DialogDescription>
                </div>
              </div>
              <AiFormAssistant 
                formType="risk" 
                currentData={{ title, description, category, impact, probability, assetId }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 bg-white border-b shrink-0">
              <TabsList className="h-12 bg-transparent gap-8 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-accent transition-all">Stammdaten</TabsTrigger>
                <TabsTrigger value="measures" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-emerald-600 transition-all">Maßnahmen & TOM</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-slate-50/30">
              <div className="p-8 space-y-10">
                <TabsContent value="base" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2 md:col-span-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Bezeichnung des Risikos</Label>
                      <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl h-12 text-sm font-bold border-slate-200 bg-white shadow-sm focus:border-accent" placeholder="z.B. Datendiebstahl durch ungesicherte Schnittstellen..." />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Kategorie</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {['IT-Sicherheit', 'Datenschutz', 'Rechtlich', 'Betrieblich', 'Finanziell'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Betroffenes IT-Asset</Label>
                      <Select value={assetId} onValueChange={setAssetId}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue placeholder="System wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="none">Kein spezifisches Asset (Global)</SelectItem>
                          {resources?.filter(res => activeTenantId === 'all' || res.tenantId === activeTenantId || res.tenantId === 'global').map(res => (
                            <SelectItem key={res.id} value={res.id}>{res.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="p-6 bg-white border rounded-2xl md:col-span-2 shadow-sm space-y-8">
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                        <Activity className="w-4 h-4 text-accent" /> Quantitative Bewertung (Brutto)
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center px-1">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Eintrittswahrscheinlichkeit</Label>
                            <Badge className="bg-slate-100 text-slate-700 border-none font-black h-5 px-2">{probability}</Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-slate-300">Selten</span>
                            <input type="range" min="1" max="5" step="1" value={probability} onChange={e => setProbability(e.target.value)} className="flex-1 accent-accent h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" />
                            <span className="text-[10px] font-bold text-slate-300">Häufig</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center px-1">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Schadensausmaß (Impact)</Label>
                            <Badge className="bg-slate-100 text-slate-700 border-none font-black h-5 px-2">{impact}</Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-slate-300">Gering</span>
                            <input type="range" min="1" max="5" step="1" value={impact} onChange={e => setImpact(e.target.value)} className="flex-1 accent-accent h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" />
                            <span className="text-[10px] font-bold text-slate-300">Kritisch</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black uppercase text-slate-400">Gesamt-Score</p>
                          <p className="text-sm font-bold text-slate-500 italic">Impact × Wahrscheinlichkeit</p>
                        </div>
                        <div className={cn(
                          "w-20 h-20 rounded-2xl flex flex-col items-center justify-center shadow-lg border-4 border-white",
                          parseInt(impact) * parseInt(probability) >= 15 ? "bg-red-600 text-white" : parseInt(impact) * parseInt(probability) >= 8 ? "bg-accent text-white" : "bg-emerald-600 text-white"
                        )}>
                          <span className="text-3xl font-black">{parseInt(impact) * parseInt(probability)}</span>
                          <span className="text-[8px] font-black uppercase tracking-widest">Points</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Szenariobeschreibung & Kontext</Label>
                      <Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-2xl min-h-[100px] p-5 border-slate-200 text-xs font-medium leading-relaxed bg-white shadow-inner" placeholder="Detaillierte Beschreibung der Bedrohung und potenziellen Auswirkungen..." />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Risiko-Eigner (Owner)</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input value={owner} onChange={e => setOwner(e.target.value)} className="rounded-xl h-11 pl-9 border-slate-200 bg-white" placeholder="z.B. IT-Sicherheitsbeauftragter" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Status der Bearbeitung</Label>
                      <Select value={status} onValueChange={(v:any) => setStatus(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="active">Aktiv / In Analyse</SelectItem>
                          <SelectItem value="mitigated">Gemindert (Mitigated)</SelectItem>
                          <SelectItem value="accepted">Akzeptiert (Accepted)</SelectItem>
                          <SelectItem value="closed">Geschlossen (Closed)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="measures" className="mt-0 space-y-8">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 bg-emerald-50 border border-emerald-100 rounded-2xl shadow-sm">
                    <div className="space-y-1">
                      <Label className="text-sm font-black uppercase text-emerald-800">Verknüpfte Maßnahmen & TOMs</Label>
                      <p className="text-[10px] font-bold text-emerald-600 italic">Kontrollen zur Reduzierung des Restrisikos.</p>
                    </div>
                    <div className="flex gap-2">
                      {hazardId && (
                        <Button variant="outline" size="sm" className="h-9 rounded-xl border-emerald-200 bg-white text-emerald-700 font-black text-[9px] uppercase tracking-widest shadow-sm" onClick={loadCatalogSuggestions} disabled={isCatalogLoading}>
                          {isCatalogLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Library className="w-3.5 h-3.5 mr-2" />} BSI Katalog-Vorschläge
                        </Button>
                      )}
                      <Button size="sm" className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-widest shadow-lg" onClick={() => router.push('/risks/measures')}>
                        <Plus className="w-3.5 h-3.5 mr-2" /> Maßnahme planen
                      </Button>
                    </div>
                  </div>

                  {catalogSuggestions.length > 0 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 ml-1">
                        <Zap className="w-3.5 h-3.5 fill-current" /> Katalog-Vorschläge (Gefährdung {hazards?.find(h => h.id === hazardId)?.code})
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {catalogSuggestions.map((cm, i) => (
                          <div key={i} className="p-4 bg-white border rounded-xl flex items-center justify-between group shadow-sm hover:border-blue-300 transition-all">
                            <div className="flex items-center gap-4">
                              <Badge className="bg-blue-50 text-blue-700 border-none font-black text-[9px] h-5 px-2">{cm.code}</Badge>
                              <span className="text-xs font-bold text-slate-700">{cm.title}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all" onClick={() => applyCatalogMeasure(cm)}>
                              Übernehmen
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 ml-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Aktive Verknüpfungen ({linkedMeasures.length})
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      {linkedMeasures.map(m => (
                        <div key={m.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shadow-inner border",
                              m.isEffective ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                            )}>
                              {m.isTom ? <FileCheck className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{m.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[8px] font-black uppercase border-none bg-slate-50 text-slate-400">{m.status}</Badge>
                                {m.isEffective && <span className="text-[8px] font-black text-emerald-600 uppercase flex items-center gap-1"><Zap className="w-2 h-2 fill-current" /> Wirksam</span>}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-all" onClick={() => router.push('/risks/measures')}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {linkedMeasures.length === 0 && (
                        <div className="py-12 text-center border-2 border-dashed rounded-2xl opacity-30 shadow-inner">
                          <Shield className="w-10 h-10 mx-auto mb-3" />
                          <p className="text-xs font-bold uppercase">Keine Maßnahmen verknüpft</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsRiskDialogOpen(false)} className="w-full sm:w-auto rounded-xl font-bold text-[10px] px-8 h-11 tracking-widest text-slate-400 hover:bg-white transition-all">Abbrechen</Button>
            <Button size="sm" onClick={handleSaveRisk} disabled={isSaving || !title} className="w-full sm:w-auto rounded-xl font-bold text-[10px] tracking-widest px-12 h-11 bg-accent hover:bg-accent/90 text-white shadow-lg transition-all active:scale-95 gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Risiko speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Standardized Task Creation Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] h-[90vh] md:h-auto md:max-h-[85vh] rounded-xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-10">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/10 shadow-sm">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate uppercase tracking-tight">Aufgabe für Risiko erstellen</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Referenz: {taskTargetRisk?.title}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-white">
            <div className="p-6 md:p-8 space-y-8">
              <div className="space-y-2">
                <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Titel der Aufgabe</Label>
                <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="rounded-xl h-12 text-sm font-bold border-slate-200 bg-white" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Verantwortlicher</Label>
                  <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {pUsers?.map(u => <SelectItem key={u.id} value={u.id} className="text-xs font-bold">{u.displayName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Deadline</Label>
                  <Input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="rounded-xl h-11 border-slate-200 bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Priorität</Label>
                  <Select value={taskPriority} onValueChange={(v: any) => setPriority(v)}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low" className="text-xs font-bold">Niedrig</SelectItem>
                      <SelectItem value="medium" className="text-xs font-bold">Mittel</SelectItem>
                      <SelectItem value="high" className="text-xs font-bold">Hoch</SelectItem>
                      <SelectItem value="critical" className="text-xs font-bold text-red-600">Kritisch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Anweisungen / Details</Label>
                <Textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className="rounded-2xl min-h-[100px] text-xs font-medium border-slate-200 bg-slate-50/30 p-4 leading-relaxed" placeholder="Genaue Beschreibung der Maßnahme..." />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsTaskDialogOpen(false)} className="rounded-xl font-bold text-[10px] px-8 h-11 text-slate-400 hover:bg-white uppercase tracking-widest">Abbrechen</Button>
            <Button onClick={handleCreateTask} disabled={isSavingTask || !taskTitle || !taskAssigneeId} className="rounded-xl font-bold text-[10px] tracking-widest px-12 h-11 bg-primary hover:bg-primary/90 text-white shadow-lg gap-2 uppercase active:scale-95 transition-all">
              {isSavingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Aufgabe erstellen
            </Button>
          </DialogFooter>
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
