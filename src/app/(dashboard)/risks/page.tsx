
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
  X
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
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

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

  // Advisor State
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [advisorRisk, setAdvisorRisk] = useState<Risk | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('IT-Sicherheit');
  const [assetId, setAssetId] = useState('none');
  const [hazardId, setHazardId] = useState<string | undefined>();
  const [impact, setImpact] = useState('3');
  const [probability, setProbability] = useState('3');
  const [resImpact, setResImpact] = useState('2');
  const [resProbability, setResProbability] = useState('2');
  const [owner, setOwner] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'mitigated' | 'accepted' | 'closed'>('active');

  const { data: risks, isLoading, refresh } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: hazards } = usePluggableCollection<Hazard>('hazards');
  const { data: allMeasures } = usePluggableCollection<any>('hazardMeasures');
  const { data: relations } = usePluggableCollection<any>('hazardMeasureRelations');

  useEffect(() => {
    setMounted(true);
  }, []);

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
        
        // WICHTIG: Entferne den Parameter aus der URL, damit beim Schließen des Dialogs 
        // dieser Effekt nicht sofort erneut triggert (Endlosschleife verhindern).
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
      id,
      tenantId: activeTenantId === 'all' ? 't1' : activeTenantId,
      assetId: assetId === 'none' ? undefined : assetId,
      hazardId,
      title,
      category,
      impact: parseInt(impact),
      probability: parseInt(probability),
      residualImpact: parseInt(resImpact),
      residualProbability: parseInt(resProbability),
      owner,
      description,
      status,
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

  const handleAdoptMeasure = async (measure: any) => {
    if (!advisorRisk) return;
    const msrId = `msr-adopt-${Math.random().toString(36).substring(2, 9)}`;
    
    const newMeasure: RiskMeasure = {
      id: msrId,
      riskId: advisorRisk.id,
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
        toast({ title: "Maßnahme übernommen", description: "Sie wurde dem Risiko als geplante Maßnahme hinzugefügt." });
      }
    } catch (e) {}
  };

  const resetForm = () => {
    setSelectedRisk(null);
    setTitle('');
    setCategory('IT-Sicherheit');
    setAssetId('none');
    setHazardId(undefined);
    setImpact('3');
    setProbability('3');
    setResImpact('2');
    setResProbability('2');
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
    setImpact(risk.impact.toString());
    setProbability(risk.probability.toString());
    setResImpact(risk.residualImpact?.toString() || '2');
    setResProbability(risk.residualProbability?.toString() || '2');
    setOwner(risk.owner);
    setDescription(risk.description || '');
    setStatus(risk.status);
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

  const filteredRisks = useMemo(() => {
    if (!risks) return [];
    return risks.filter(r => {
      const matchesTenant = activeTenantId === 'all' || r.tenantId === activeTenantId;
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.owner.toLowerCase().includes(search.toLowerCase());
      return matchesTenant && matchesCategory && matchesSearch;
    }).sort((a, b) => (b.impact * b.probability) - (a.impact * a.probability));
  }, [risks, search, categoryFilter, activeTenantId]);

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
                <TableHead className="font-bold uppercase text-[10px]">Inhärent</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Restrisiko</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Maßnahmen</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredRisks.map((risk) => {
                const scoreRaw = risk.impact * risk.probability;
                const scoreRes = (risk.residualImpact || 0) * (risk.residualProbability || 0);
                const asset = resources?.find(r => r.id === risk.assetId);
                
                return (
                  <TableRow key={risk.id} className="hover:bg-muted/5 group border-b last:border-0">
                    <TableCell className="py-4">
                      <div className="font-bold text-sm">{risk.title}</div>
                      <div className="flex items-center gap-2 mt-1 text-[9px] font-bold uppercase text-muted-foreground">
                        {risk.category} 
                        {asset && <><span className="text-slate-300">|</span> <Layers className="w-2.5 h-2.5" /> {asset.name}</>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={cn("inline-flex items-center px-2 py-0.5 border font-black text-xs", scoreRaw >= 15 ? "text-red-600 bg-red-50" : "text-orange-600 bg-orange-50")}>
                        {scoreRaw}
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
                      {risk.hazardId && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[9px] font-black uppercase bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-none gap-1.5"
                          onClick={() => { setAdvisorRisk(risk); setIsAdvisorOpen(true); }}
                        >
                          <Zap className="w-3 h-3 fill-current" /> Vorschläge
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none w-48">
                          <DropdownMenuItem onSelect={() => openEdit(risk)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => { if(confirm("Risiko permanent löschen?")) deleteCollectionRecord('risks', risk.id, dataSource).then(() => refresh()); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
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
              
              <div className="grid grid-cols-2 gap-8 border-t pt-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-red-600 border-b pb-1">Brutto-Risiko (Inhärent)</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit (1-5)</Label>
                      <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setProbability(v)} className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", probability === v ? "bg-red-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Auswirkung (1-5)</Label>
                      <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setImpact(v)} className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", impact === v ? "bg-red-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-emerald-600 border-b pb-1">Netto-Risiko (Restrisiko)</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Wahrscheinlichkeit (Netto)</Label>
                      <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setResProbability(v)} className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", resProbability === v ? "bg-emerald-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Auswirkung (Netto)</Label>
                      <div className="flex gap-1">{['1','2','3','4','5'].map(v => <button key={v} onClick={() => setResImpact(v)} className={cn("flex-1 h-8 border text-[10px] font-bold transition-all", resImpact === v ? "bg-emerald-600 text-white" : "bg-muted/30")}>{v}</button>)}</div>
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

      {/* Measures Advisor Sheet */}
      <Sheet open={isAdvisorOpen} onOpenChange={setIsAdvisorOpen}>
        <SheetContent className="w-[450px] sm:max-w-[500px] p-0 flex flex-col rounded-none border-l-4 border-l-blue-600">
          <SheetHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-none">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <SheetTitle className="text-white uppercase font-black text-sm tracking-widest">Maßnahmen-Advisor</SheetTitle>
                <SheetDescription className="text-slate-400 text-[10px] uppercase font-bold">IT-Grundschutz Empfehlungen</SheetDescription>
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
                  {hazards?.find(h => h.id === advisorRisk?.hazardId)?.code}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                  <ClipboardCheck className="w-3.5 h-3.5" /> Passende Kontrollen aus Kreuztabelle:
                </p>
                
                {suggestedMeasures.length === 0 ? (
                  <div className="py-20 text-center space-y-3">
                    <Info className="w-10 h-10 text-slate-200 mx-auto" />
                    <p className="text-xs text-muted-foreground font-medium italic px-10">Keine spezifischen Maßnahmen-Relationen für diesen Gefährdungscode in der Kreuztabelle gefunden.</p>
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
                              className="h-8 w-8 rounded-none hover:bg-emerald-50 hover:text-emerald-600 text-slate-300"
                              onClick={() => handleAdoptMeasure(m)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-6 border-t bg-white space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-none">
                <p className="text-[9px] text-blue-800 leading-relaxed font-bold uppercase italic">
                  Hinweis: Diese Vorschläge basieren auf der offiziellen BSI-Kreuztabelle (2023). Prüfen Sie die fachliche Eignung für Ihr konkretes Szenario.
                </p>
              </div>
              <Button variant="outline" className="w-full rounded-none h-10 uppercase font-black text-[10px]" onClick={() => setIsAdvisorOpen(false)}>
                Advisor Schließen
              </Button>
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
