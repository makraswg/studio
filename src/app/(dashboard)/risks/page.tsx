
"use client";

import { useState, useMemo, useEffect } from 'react';
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
  Filter
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
import { Risk, RiskCategorySetting } from '@/lib/types';
import { usePlatformAuth } from '@/context/auth-context';
import { BSI_CATALOG, BsiModule, BsiThreat } from '@/lib/bsi-catalog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

export default function RiskDashboardPage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = usePlatformAuth();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Modals
  const [isRiskDialogOpen, setIsRiskDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isBsiDialogOpen, setIsBsiDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  // Form State Risk
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('IT-Sicherheit');
  const [impact, setImpact] = useState('3');
  const [probability, setProbability] = useState('3');
  const [owner, setOwner] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'mitigated' | 'accepted' | 'closed'>('active');
  const [reviewCycleDays, setReviewCycleDays] = useState<string>('');

  // Review State
  const [reviewImpact, setReviewImpact] = useState('3');
  const [reviewProbability, setReviewProbability] = useState('3');
  const [reviewNotes, setReviewNotes] = useState('');

  // BSI Search State
  const [bsiSearch, setBsiSearch] = useState('');
  const [selectedBsiModule, setSelectedBsiModule] = useState<string>('all');

  const { data: risks, isLoading, refresh } = usePluggableCollection<Risk>('risks');
  const { data: categorySettings } = usePluggableCollection<RiskCategorySetting>('riskCategorySettings');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getRiskColor = (score: number) => {
    if (score >= 15) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 8) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  const getRiskStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-red-500 rounded-none uppercase text-[8px]">Kritisch</Badge>;
      case 'mitigated': return <Badge className="bg-emerald-500 rounded-none uppercase text-[8px]">Behandelt</Badge>;
      case 'accepted': return <Badge className="bg-blue-500 rounded-none uppercase text-[8px]">Akzeptiert</Badge>;
      default: return <Badge variant="outline" className="rounded-none uppercase text-[8px]">Inaktiv</Badge>;
    }
  };

  const handleSaveRisk = async () => {
    if (!title) return;
    setIsSaving(true);
    const id = selectedRisk?.id || `risk-${Math.random().toString(36).substring(2, 9)}`;
    const isNew = !selectedRisk;
    
    const riskData: Risk = {
      id,
      tenantId: activeTenantId === 'all' ? 't1' : activeTenantId,
      title,
      category,
      impact: parseInt(impact),
      probability: parseInt(probability),
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

  const handleRunReview = async () => {
    if (!selectedRisk) return;
    setIsSaving(true);
    
    const now = new Date().toISOString();
    const updatedRisk: Risk = {
      ...selectedRisk,
      impact: parseInt(reviewImpact),
      probability: parseInt(reviewProbability),
      lastReviewDate: now
    };

    const reviewRecord = {
      id: `rev-${Math.random().toString(36).substring(2, 9)}`,
      riskId: selectedRisk.id,
      date: now,
      reviewer: authUser?.displayName || authUser?.email || 'system',
      prevScore: selectedRisk.impact * selectedRisk.probability,
      newScore: parseInt(reviewImpact) * parseInt(reviewProbability),
      notes: reviewNotes
    };

    try {
      await saveCollectionRecord('risks', selectedRisk.id, updatedRisk, dataSource);
      // Optional: Persist review record if table exists
      await saveCollectionRecord('riskReviews', reviewRecord.id, reviewRecord, dataSource).catch(() => {});

      await logAuditEventAction(dataSource, {
        tenantId: selectedRisk.tenantId,
        actorUid: authUser?.email || 'system',
        action: `Risiko-Review abgeschlossen: Score von ${reviewRecord.prevScore} auf ${reviewRecord.newScore}`,
        entityType: 'risk',
        entityId: selectedRisk.id,
        after: updatedRisk,
        before: selectedRisk
      });

      toast({ title: "Review erfolgreich abgeschlossen" });
      setIsReviewDialogOpen(false);
      setReviewNotes('');
      refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Review fehlgeschlagen", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedRisk(null);
    setTitle('');
    setCategory('IT-Sicherheit');
    setImpact('3');
    setProbability('3');
    setOwner('');
    setDescription('');
    setStatus('active');
    setReviewCycleDays('');
  };

  const openEdit = (risk: Risk) => {
    setSelectedRisk(risk);
    setTitle(risk.title);
    setCategory(risk.category);
    setImpact(risk.impact.toString());
    setProbability(risk.probability.toString());
    setOwner(risk.owner);
    setDescription(risk.description || '');
    setStatus(risk.status);
    setReviewCycleDays(risk.reviewCycleDays?.toString() || '');
    setIsRiskDialogOpen(true);
  };

  const openReview = (risk: Risk) => {
    setSelectedRisk(risk);
    setReviewImpact(risk.impact.toString());
    setReviewProbability(risk.probability.toString());
    setReviewNotes('');
    setIsReviewDialogOpen(true);
  };

  const applyBsiThreat = (threat: BsiThreat, module: BsiModule) => {
    setTitle(threat.title);
    setCategory(module.category);
    setDescription(threat.description);
    setIsBsiDialogOpen(false);
    toast({ title: "BSI Vorlage übernommen" });
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

  const filteredBsiCatalog = useMemo(() => {
    const flatCatalog: { module: BsiModule; threat: BsiThreat }[] = [];
    BSI_CATALOG.forEach(module => {
      if (selectedBsiModule !== 'all' && module.id !== selectedBsiModule) return;
      module.threats.forEach(threat => {
        const matchesSearch = 
          threat.title.toLowerCase().includes(bsiSearch.toLowerCase()) || 
          threat.description.toLowerCase().includes(bsiSearch.toLowerCase()) ||
          module.title.toLowerCase().includes(bsiSearch.toLowerCase());
        if (matchesSearch) {
          flatCatalog.push({ module, threat });
        }
      });
    });
    return flatCatalog;
  }, [bsiSearch, selectedBsiModule]);

  const stats = useMemo(() => {
    if (!filteredRisks) return { high: 0, medium: 0, low: 0, pendingReviews: 0 };
    const now = Date.now();

    const pending = filteredRisks.filter(r => {
      const catSetting = categorySettings?.find(s => s.id === r.category);
      const cycleDays = r.reviewCycleDays || catSetting?.defaultReviewDays || 90;
      const threshold = cycleDays * 24 * 60 * 60 * 1000;
      return !r.lastReviewDate || (now - new Date(r.lastReviewDate).getTime()) > threshold;
    }).length;

    return {
      high: filteredRisks.filter(r => (r.impact * r.probability) >= 15).length,
      medium: filteredRisks.filter(r => (r.impact * r.probability) >= 8 && (r.impact * r.probability) < 15).length,
      low: filteredRisks.filter(r => (r.impact * r.probability) < 8).length,
      pendingReviews: pending
    };
  }, [filteredRisks, categorySettings]);

  if (!mounted) return null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-500/10 text-orange-600 flex items-center justify-center border-2 border-orange-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Compliance Risikomanagement</h1>
            <p className="text-sm text-muted-foreground mt-1">Zentrale Steuerung und revisionssichere Dokumentation von Risiken.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { resetForm(); setIsRiskDialogOpen(true); setIsBsiDialogOpen(true); }} className="h-10 font-bold uppercase text-[10px] rounded-none px-6 border-blue-200 text-blue-700 bg-blue-50">
            <Library className="w-4 h-4 mr-2" /> BSI Grundschutz Katalog
          </Button>
          <Button onClick={() => { resetForm(); setIsRiskDialogOpen(true); }} className="h-10 font-bold uppercase text-[10px] rounded-none px-6 bg-orange-600 hover:bg-orange-700 shadow-lg text-white border-none">
            <Plus className="w-4 h-4 mr-2" /> Risiko identifizieren
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-none border-l-4 border-l-red-600 shadow-none bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <p className="text-[9px] font-bold uppercase text-muted-foreground">Kritische Risiken</p>
            <h3 className="text-3xl font-bold mt-1">{stats.high}</h3>
          </CardContent>
        </Card>
        <Card className="rounded-none border-l-4 border-l-orange-500 shadow-none bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <p className="text-[9px] font-bold uppercase text-muted-foreground">Mittlere Risiken</p>
            <h3 className="text-3xl font-bold mt-1">{stats.medium}</h3>
          </CardContent>
        </Card>
        <Card className="rounded-none border-l-4 border-l-emerald-500 shadow-none bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <p className="text-[9px] font-bold uppercase text-muted-foreground">Geringe Risiken</p>
            <h3 className="text-3xl font-bold mt-1">{stats.low}</h3>
          </CardContent>
        </Card>
        <Card className="rounded-none border-l-4 border-l-blue-500 shadow-none bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <p className="text-[9px] font-bold uppercase text-muted-foreground">Fällige Reviews</p>
            <h3 className={cn("text-3xl font-bold mt-1", stats.pendingReviews > 0 ? "text-blue-600" : "text-slate-400")}>
              {stats.pendingReviews}
            </h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 rounded-none border shadow-none bg-slate-50/50 dark:bg-slate-900/50">
          <CardHeader className="border-b bg-white dark:bg-slate-900 py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-orange-600" /> Risiko-Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-6 gap-1.5 aspect-square">
              <div className="col-span-1 row-span-5 flex flex-col justify-between text-[8px] font-bold text-muted-foreground uppercase py-2">
                <span>Hoch</span>
                <span>Mittel</span>
                <span>Niedrig</span>
              </div>
              <div className="col-span-5 grid grid-cols-5 grid-rows-5 gap-1.5">
                {Array.from({ length: 25 }).map((_, i) => {
                  const x = (i % 5) + 1;
                  const y = 5 - Math.floor(i / 5);
                  const score = x * y;
                  const risksInCell = filteredRisks.filter(r => r.impact === y && r.probability === x).length;
                  
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "flex items-center justify-center border text-[10px] font-bold transition-all",
                        score >= 15 ? "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800" : score >= 8 ? "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800" : "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
                        risksInCell > 0 ? "shadow-inner ring-1 ring-inset ring-black/5" : "opacity-40"
                      )}
                    >
                      {risksInCell > 0 && (
                        <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[9px] animate-in zoom-in">
                          {risksInCell}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="col-start-2 col-span-5 flex justify-between text-[8px] font-bold text-muted-foreground uppercase px-2">
                <span>Selten</span>
                <span>Mittel</span>
                <span>Häufig</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Risiken oder Verantwortliche suchen..." 
                className="pl-10 h-11 border-2 bg-white dark:bg-slate-900 rounded-none shadow-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex border bg-card h-11 p-1 gap-1">
              <div className="flex items-center px-3 border-r">
                <Filter className="w-3.5 h-3.5 text-muted-foreground mr-2" />
                <span className="text-[10px] font-bold uppercase text-muted-foreground mr-2">Bereich:</span>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="border-none shadow-none h-full rounded-none bg-transparent min-w-[140px] text-[10px] font-bold uppercase">
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
                  <TableHead className="py-4 font-bold uppercase text-[10px]">Risiko / Bereich</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Score</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredRisks.map((risk) => {
                  const score = risk.impact * risk.probability;
                  const catSetting = categorySettings?.find(s => s.id === risk.category);
                  const cycleDays = risk.reviewCycleDays || catSetting?.defaultReviewDays || 90;
                  const now = Date.now();
                  const isReviewDue = !risk.lastReviewDate || (now - new Date(risk.lastReviewDate).getTime()) > (cycleDays * 24 * 60 * 60 * 1000);
                  
                  return (
                    <TableRow key={risk.id} className="hover:bg-muted/5 group border-b last:border-0">
                      <TableCell className="py-4">
                        <div className="font-bold text-sm">{risk.title}</div>
                        <div className="flex items-center gap-2 mt-1 text-[9px] font-bold uppercase text-muted-foreground">
                          {risk.category} <span className="text-slate-300">|</span> 
                          <span className={cn(isReviewDue ? "text-red-600 font-black flex items-center gap-1" : "text-muted-foreground")}>
                            {isReviewDue && <Clock className="w-2.5 h-2.5" />}
                            Review: {risk.lastReviewDate ? new Date(risk.lastReviewDate).toLocaleDateString() : 'Ausstehend'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={cn("inline-flex items-center px-2 py-0.5 border font-black text-xs", getRiskColor(score))}>
                          {score}
                        </div>
                      </TableCell>
                      <TableCell>{getRiskStatusBadge(risk.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn(
                              "h-8 text-[9px] font-bold uppercase gap-1.5 transition-all",
                              isReviewDue ? "bg-blue-600 text-white hover:bg-blue-700" : "hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"
                            )}
                            onClick={() => openReview(risk)}
                          >
                            <CalendarCheck className="w-3.5 h-3.5" /> {isReviewDue ? 'Jetzt Prüfen' : 'Review'}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-none w-48">
                              <DropdownMenuItem onSelect={() => openEdit(risk)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onSelect={() => {
                                if (confirm("Dieses Risiko permanent löschen?")) {
                                  deleteCollectionRecord('risks', risk.id, dataSource).then(() => refresh());
                                }
                              }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
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
      </div>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-xl rounded-none p-0 overflow-hidden border-2 shadow-2xl flex flex-col">
          <DialogHeader className="p-6 bg-blue-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <CalendarCheck className="w-5 h-5 text-blue-400" />
              <div className="flex-1">
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">Risiko-Review durchführen</DialogTitle>
                <DialogDescription className="text-blue-200 text-[10px] font-bold uppercase mt-1">Statusprüfung: {selectedRisk?.title}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8 space-y-8 bg-white dark:bg-slate-950 flex-1">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase">Wahrscheinlichkeit (1-5)</Label>
                    <AssessmentGuide category="probability" />
                  </div>
                  <div className="flex gap-1">
                    {['1', '2', '3', '4', '5'].map(v => (
                      <button key={v} onClick={() => setReviewProbability(v)} className={cn("flex-1 h-8 text-[10px] font-bold border", reviewProbability === v ? "bg-orange-600 border-orange-600 text-white" : "bg-muted/30")}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase">Schadenshöhe (1-5)</Label>
                    <AssessmentGuide category="impact" />
                  </div>
                  <div className="flex gap-1">
                    {['1', '2', '3', '4', '5'].map(v => (
                      <button key={v} onClick={() => setReviewImpact(v)} className={cn("flex-1 h-8 text-[10px] font-bold border", reviewImpact === v ? "bg-red-600 border-red-600 text-white" : "bg-muted/30")}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed flex flex-col items-center justify-center p-4">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">Neuer Risiko-Score</p>
                <div className={cn("text-5xl font-black", parseInt(reviewImpact)*parseInt(reviewProbability) >= 15 ? "text-red-600" : "text-blue-600")}>
                  {parseInt(reviewImpact) * parseInt(reviewProbability)}
                </div>
                <p className="text-[8px] uppercase font-bold mt-2 text-muted-foreground">Vorher: {selectedRisk ? selectedRisk.impact * selectedRisk.probability : '-'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <MessageSquare className="w-3 h-3" /> Review-Notizen / Begründung
              </Label>
              <Textarea 
                value={reviewNotes} 
                onChange={e => setReviewNotes(e.target.value)} 
                placeholder="Warum hat sich das Risiko verändert? Welche Maßnahmen greifen aktuell?" 
                className="rounded-none min-h-[120px] leading-relaxed" 
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)} className="rounded-none h-10 px-8">Abbrechen</Button>
            <Button onClick={handleRunReview} disabled={isSaving || !reviewNotes} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] tracking-widest bg-blue-600 hover:bg-blue-700 text-white border-none">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Review abschließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk Edit Dialog */}
      <Dialog open={isRiskDialogOpen} onOpenChange={setIsRiskDialogOpen}>
        <DialogContent className="max-w-3xl rounded-none p-0 overflow-hidden flex flex-col h-[90vh] border-2 shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                  Risiko-Stammdaten pflegen
                </DialogTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsBsiDialogOpen(true)} className="h-8 bg-blue-600 border-none text-white hover:bg-blue-700 text-[9px] font-bold uppercase">
                <Library className="w-3.5 h-3.5 mr-1.5" /> Aus BSI Katalog wählen
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white dark:bg-slate-950">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2 col-span-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Risiko-Bezeichnung</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Kurz & prägnant" className="rounded-none h-11 text-base font-bold" />
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
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Verantwortlich (Owner)</Label>
                <Input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Abteilung oder Name" className="rounded-none h-10" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 border-t pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase">Eintrittswahrscheinlichkeit (1-5)</Label>
                    <AssessmentGuide category="probability" />
                  </div>
                  <div className="flex gap-1">
                    {['1', '2', '3', '4', '5'].map(v => (
                      <button key={v} onClick={() => setProbability(v)} className={cn("flex-1 h-8 text-[10px] font-bold border", probability === v ? "bg-orange-600 border-orange-600 text-white" : "bg-muted/30")}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase">Schadenshöhe (1-5)</Label>
                    <AssessmentGuide category="impact" />
                  </div>
                  <div className="flex gap-1">
                    {['1', '2', '3', '4', '5'].map(v => (
                      <button key={v} onClick={() => setImpact(v)} className={cn("flex-1 h-8 text-[10px] font-bold border", impact === v ? "bg-red-600 border-red-600 text-white" : "bg-muted/30")}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed flex flex-col items-center justify-center p-4">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">Risiko-Score (Brutto)</p>
                <div className={cn("text-5xl font-black", parseInt(impact)*parseInt(probability) >= 15 ? "text-red-600" : "text-blue-600")}>
                  {parseInt(impact) * parseInt(probability)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 border-t pt-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Review-Zyklus (Tage)</Label>
                <Input 
                  type="number" 
                  value={reviewCycleDays} 
                  onChange={e => setReviewCycleDays(e.target.value)} 
                  placeholder="Standardwert überschreiben..." 
                  className="rounded-none h-10" 
                />
                <p className="text-[8px] text-muted-foreground uppercase">Leer lassen, um Kategorie-Standard zu nutzen.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="active">Aktiv / Kritisch</SelectItem>
                    <SelectItem value="mitigated">Behandelt (Maßnahmen aktiv)</SelectItem>
                    <SelectItem value="accepted">Akzeptiert (Restrisiko)</SelectItem>
                    <SelectItem value="closed">Abgeschlossen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-6 border-t">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Szenario / Beschreibung</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Wie entsteht das Risiko? Was sind die Folgen?" className="rounded-none min-h-[120px] leading-relaxed" />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsRiskDialogOpen(false)} className="rounded-none h-10 px-8">Abbrechen</Button>
            <Button onClick={handleSaveRisk} disabled={isSaving} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] tracking-widest bg-orange-600 hover:bg-orange-700 text-white border-none">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BSI Catalog Browser Dialog */}
      <Dialog open={isBsiDialogOpen} onOpenChange={setIsBsiDialogOpen}>
        <DialogContent className="max-w-4xl rounded-none p-0 overflow-hidden flex flex-col h-[85vh] border-2 shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 bg-blue-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <Library className="w-5 h-5 text-blue-400" />
              <div className="flex-1">
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">BSI IT-Grundschutz Gefährdungskatalog</DialogTitle>
                <DialogDescription className="text-blue-200 text-[10px] font-bold uppercase mt-1">Standardisierte Bedrohungszenarien für den IT-Betrieb</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 border-b flex gap-4 bg-muted/10">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Suche im Katalog (z.B. Backup, Server, Cloud)..." 
                className="pl-10 h-10 rounded-none bg-white dark:bg-slate-900 border-2"
                value={bsiSearch}
                onChange={e => setBsiSearch(e.target.value)}
              />
            </div>
            <Select value={selectedBsiModule} onValueChange={setSelectedBsiModule}>
              <SelectTrigger className="w-64 h-10 rounded-none border-2 bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all">Alle Module</SelectItem>
                {BSI_CATALOG.map(mod => <SelectItem key={mod.id} value={mod.id}>{mod.id}: {mod.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-4">
              {filteredBsiCatalog.map(({ module, threat }) => (
                <div 
                  key={threat.id} 
                  className="p-4 border group hover:border-blue-500 hover:bg-blue-50/10 transition-all cursor-pointer relative"
                  onClick={() => applyBsiThreat(threat, module)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 pr-12">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-none text-[8px] font-black border-blue-200 text-blue-600 bg-blue-50">{threat.id}</Badge>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{threat.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{threat.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-bold uppercase text-slate-400">Modul: {module.title}</span>
                        <span className="text-slate-200">|</span>
                        <span className="text-[9px] font-bold uppercase text-slate-400">Bereich: {module.category}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-5 h-5 text-blue-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredBsiCatalog.length === 0 && (
                <div className="text-center py-20 text-muted-foreground italic">Keine passenden Katalog-Einträge gefunden.</div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 bg-muted/20 border-t flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            <p className="text-[9px] font-bold uppercase text-muted-foreground">
              Tipp: Der vollständige BSI Katalog kann über die Import-Schnittstelle im Admin-Bereich geladen werden.
            </p>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t shrink-0">
            <Button variant="ghost" onClick={() => setIsBsiDialogOpen(false)} className="rounded-none font-bold uppercase text-[10px]">Abbrechen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssessmentGuide({ category }: { category: 'impact' | 'probability' }) {
  const guide = category === 'impact' ? ASSESSMENT_GUIDE.impact : ASSESSMENT_GUIDE.probability;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1">
          <Info className="w-3 h-3" /> Bewertungshilfe
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-none p-0 border-2 shadow-2xl z-[150]">
        <div className="p-3 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest">
          {category === 'impact' ? 'Schadenshöhe Definition' : 'Wahrscheinlichkeit Definition'}
        </div>
        <div className="p-4 space-y-3">
          {guide.map((item) => (
            <div key={item.level} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center bg-muted font-black text-[10px] border">{item.level}</span>
                <span className="font-bold text-xs">{item.title}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed pl-7">{item.desc}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
