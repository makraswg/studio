
"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  CalendarCheck, 
  Library, 
  Save, 
  MessageSquare, 
  Filter,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  HelpCircle
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
import { Risk, RiskCategorySetting, Hazard, Resource } from '@/lib/types';
import { usePlatformAuth } from '@/context/auth-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ASSESSMENT_GUIDE = {
  impact: [
    { level: 1, title: 'Vernachlässigbar', desc: 'Keine finanziellen Folgen, Image unbeeinträchtigt.' },
    { level: 2, title: 'Gering', desc: 'Kleiner finanzieller Verlust (< 10k), interne Aufregung.' },
    { level: 3, title: 'Mittel', desc: 'Spürbarer Verlust (< 100k), lokale Medienberichterstattung.' },
    { level: 4, title: 'Hoch', desc: 'Großer Verlust (> 100k), massiver Image-Schaden.' },
    { level: 5, title: 'Existenzbedrohend', desc: 'Insolvenzrisiko, Entzug von Lizenzen.' }
  ],
  probability: [
    { level: 1, title: 'Sehr Selten', desc: 'Einmal in 10 Jahren oder seltener.' },
    { level: 2, title: 'Selten', desc: 'Einmal in 5 Jahren.' },
    { level: 3, title: 'Gelegentlich', desc: 'Einmal pro Jahr.' },
    { level: 4, title: 'Häufig', desc: 'Mehrmals pro Jahr.' },
    { level: 5, title: 'Sehr Häufig', desc: 'Monatlich oder öfter.' }
  ]
};

function RiskDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = usePlatformAuth();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Modals
  const [isRiskDialogOpen, setIsRiskDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

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
  const [reviewCycleDays, setReviewCycleDays] = useState<string>('');

  const { data: risks, isLoading, refresh } = usePluggableCollection<Risk>('risks');
  const { data: categorySettings } = usePluggableCollection<RiskCategorySetting>('riskCategorySettings');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: hazards } = usePluggableCollection<Hazard>('hazards');

  useEffect(() => {
    setMounted(true);
    const deriveId = searchParams.get('derive');
    if (deriveId && hazards) {
      const hazard = hazards.find(h => h.id === deriveId);
      if (hazard) {
        resetForm();
        setTitle(hazard.title);
        setDescription(hazard.description);
        setHazardId(hazard.id);
        setIsRiskDialogOpen(true);
      }
    }
  }, [searchParams, hazards]);

  const handleSaveRisk = async () => {
    if (!title) return;
    setIsSaving(true);
    const id = selectedRisk?.id || `risk-${Math.random().toString(36).substring(2, 9)}`;
    const isNew = !selectedRisk;
    
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
      reviewCycleDays: reviewCycleDays ? parseInt(reviewCycleDays) : undefined,
      createdAt: selectedRisk?.createdAt || new Date().toISOString(),
      lastReviewDate: selectedRisk?.lastReviewDate || new Date().toISOString()
    };

    try {
      const res = await saveCollectionRecord('risks', id, riskData, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: riskData.tenantId,
          actorUid: authUser?.email || 'system',
          action: isNew ? 'Risiko identifiziert' : 'Risiko-Bewertung aktualisiert',
          entityType: 'risk',
          entityId: id,
          after: riskData,
          before: selectedRisk || undefined
        });
        toast({ title: "Risiko gespeichert" });
        setIsRiskDialogOpen(false);
        resetForm();
        refresh();
      } else throw new Error(res.error || "Fehler beim Speichern");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
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
    setImpact('3');
    setProbability('3');
    setResImpact('2');
    setResProbability('2');
    setOwner('');
    setDescription('');
    setStatus('active');
    setReviewCycleDays('');
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
    setReviewCycleDays(risk.reviewCycleDays?.toString() || '');
    setIsRiskDialogOpen(true);
  };

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
            <p className="text-sm text-muted-foreground mt-1">Bewertung von inhärenten Risiken und Identifikation von Restrisiken.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-12 space-y-4">
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
                  <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
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
                          {risk.hazardId && <Badge className="bg-blue-50 text-blue-700 border-none rounded-none h-4 px-1 text-[7px] font-black">CAT</Badge>}
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
                        <Badge variant="outline" className="rounded-none uppercase text-[8px] font-bold border-slate-200">
                          {risk.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-none w-48">
                            <DropdownMenuItem onSelect={() => openEdit(risk)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onSelect={() => { if(confirm("Löschen?")) deleteCollectionRecord('risks', risk.id, dataSource).then(() => refresh()); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
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
      </div>

      <Dialog open={isRiskDialogOpen} onOpenChange={setIsRiskDialogOpen}>
        <DialogContent className="max-w-4xl rounded-none p-0 overflow-hidden flex flex-col h-[90vh] border-2 shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-orange-500" />
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">Risiko-Detailerfassung</DialogTitle>
              </div>
              {hazardId && <Badge className="bg-blue-600 rounded-none text-[9px] font-black tracking-widest">AUS KATALOG ABGELEITET</Badge>}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white dark:bg-slate-950">
            {/* Basis-Informationen */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2 col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Risiko-Bezeichnung</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-[10px] font-bold uppercase">Geben Sie dem Risiko einen Namen, der das Bedrohungsszenario kurz beschreibt.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-none h-11 text-base font-bold" placeholder="z.B. Datenverlust durch Ransomware" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Betroffenes IT-System (Asset)</Label>
                <Select value={assetId} onValueChange={setAssetId}>
                  <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Asset wählen..." /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="none">Kein spezifisches Asset (Global)</SelectItem>
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
                    <SelectItem value="Datenschutz">Datenschutz (DSGVO)</SelectItem>
                    <SelectItem value="Rechtlich">Rechtlich / Verträge</SelectItem>
                    <SelectItem value="Betrieblich">Betrieblich / Verfügbarkeit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Risiko-Matrix */}
            <div className="grid grid-cols-2 gap-12 border-t pt-6">
              {/* Inhärent */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-red-600">1. Inhärentes Risiko (Brutto)</h3>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><HelpCircle className="w-3.5 h-3.5 text-red-400 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-[10px] font-bold uppercase">Risiko-Level OHNE Berücksichtigung von Sicherheitsmaßnahmen.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase">Wahrscheinlichkeit</Label>
                      <Popover>
                        <PopoverTrigger asChild><button className="text-[9px] font-black text-red-600 uppercase underline">Definitionen</button></PopoverTrigger>
                        <PopoverContent className="w-64 rounded-none p-0">
                          <div className="p-3 bg-red-600 text-white font-black text-[10px] uppercase">Häufigkeit-Stufen</div>
                          <div className="p-2 space-y-2">
                            {ASSESSMENT_GUIDE.probability.map(p => (
                              <div key={p.level} className="text-[9px] border-b pb-1 last:border-0">
                                <span className="font-black text-red-600 mr-1">{p.level}: {p.title}</span>
                                <p className="text-muted-foreground italic mt-0.5">{p.desc}</p>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex gap-1">
                      {['1', '2', '3', '4', '5'].map(v => (
                        <button key={v} onClick={() => setProbability(v)} className={cn("flex-1 h-8 text-[10px] font-bold border transition-colors", probability === v ? "bg-red-600 border-red-600 text-white" : "bg-muted/30 hover:bg-muted/50")}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase">Schadenshöhe</Label>
                      <Popover>
                        <PopoverTrigger asChild><button className="text-[9px] font-black text-red-600 uppercase underline">Definitionen</button></PopoverTrigger>
                        <PopoverContent className="w-64 rounded-none p-0">
                          <div className="p-3 bg-red-600 text-white font-black text-[10px] uppercase">Schaden-Stufen</div>
                          <div className="p-2 space-y-2">
                            {ASSESSMENT_GUIDE.impact.map(i => (
                              <div key={i.level} className="text-[9px] border-b pb-1 last:border-0">
                                <span className="font-black text-red-600 mr-1">{i.level}: {i.title}</span>
                                <p className="text-muted-foreground italic mt-0.5">{i.desc}</p>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex gap-1">
                      {['1', '2', '3', '4', '5'].map(v => (
                        <button key={v} onClick={() => setImpact(v)} className={cn("flex-1 h-8 text-[10px] font-bold border transition-colors", impact === v ? "bg-red-600 border-red-600 text-white" : "bg-muted/30 hover:bg-muted/50")}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 border-2 border-red-100 flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-red-700">Brutto Score:</span>
                    <span className="text-3xl font-black text-red-700">{parseInt(impact) * parseInt(probability)}</span>
                  </div>
                </div>
              </div>

              {/* Restrisiko */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600">2. Restrisiko (Netto)</h3>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><HelpCircle className="w-3.5 h-3.5 text-emerald-400 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-[10px] font-bold uppercase">Das verbleibende Risiko NACH Umsetzung wirksamer Schutzmaßnahmen.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Wahrscheinlichkeit (Mit Maßnahmen)</Label>
                    <div className="flex gap-1">
                      {['1', '2', '3', '4', '5'].map(v => (
                        <button key={v} onClick={() => setResProbability(v)} className={cn("flex-1 h-8 text-[10px] font-bold border transition-colors", resProbability === v ? "bg-emerald-600 border-emerald-600 text-white" : "bg-muted/30 hover:bg-muted/50")}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase">Schadenshöhe (Mit Maßnahmen)</Label>
                    <div className="flex gap-1">
                      {['1', '2', '3', '4', '5'].map(v => (
                        <button key={v} onClick={() => setResImpact(v)} className={cn("flex-1 h-8 text-[10px] font-bold border transition-colors", resImpact === v ? "bg-emerald-600 border-emerald-600 text-white" : "bg-muted/30 hover:bg-muted/50")}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-100 flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-emerald-700">Netto Score:</span>
                    <span className="text-3xl font-black text-emerald-700">{parseInt(resImpact) * parseInt(resProbability)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Beschreibung & Maßnahmen */}
            <div className="space-y-2 pt-6 border-t">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Szenario & Kontroll-Effektivität</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild><HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs text-[10px] font-bold uppercase">Begründen Sie hier, warum das Risiko besteht und wie die getroffenen Maßnahmen das Risiko konkret senken.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Beschreiben Sie hier, warum das Risiko besteht und wie die Maßnahmen das Risiko senken." className="rounded-none min-h-[120px] leading-relaxed" />
            </div>
          </div>
          
          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsRiskDialogOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleSaveRisk} disabled={isSaving} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] tracking-widest bg-orange-600 hover:bg-orange-700 text-white border-none shadow-xl">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Risiko Speichern
            </Button>
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
