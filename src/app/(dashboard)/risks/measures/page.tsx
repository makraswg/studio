
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ClipboardCheck, 
  Plus, 
  Search, 
  Calendar, 
  User as UserIcon, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronRight,
  Filter,
  Loader2,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  X,
  FileCheck,
  Scale,
  Shield,
  Layers,
  Info,
  Save,
  HelpCircle,
  CalendarCheck,
  Link as LinkIcon
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { Risk, RiskMeasure, Resource, ProcessingActivity, DataCategory } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

export default function RiskMeasuresPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isMeasureDialogOpen, setIsMeasureDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMeasure, setSelectedMeasure] = useState<RiskMeasure | null>(null);

  // Form State
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<RiskMeasure['status']>('planned');
  const [effectiveness, setEffectiveness] = useState('3');
  const [description, setDescription] = useState('');
  
  // TOM specific
  const [isTom, setIsTom] = useState(false);
  const [tomCategory, setTomCategory] = useState<RiskMeasure['tomCategory']>('Zugriffskontrolle');
  const [art32Mapping, setArt32Mapping] = useState<string[]>([]);
  const [gdprProtectionGoals, setGdprProtectionGoals] = useState<string[]>([]);
  const [vvtIds, setVvtIds] = useState<string[]>([]);
  const [dataCategories, setDataCategories] = useState<string[]>([]);
  const [isArt9Relevant, setIsArt9Relevant] = useState(false);

  // Audit State
  const [isEffective, setIsEffective] = useState(false);
  const [checkType, setCheckType] = useState<RiskMeasure['checkType']>('Review');
  const [lastCheckDate, setLastCheckDate] = useState('');
  const [evidenceDetails, setEvidenceDetails] = useState('');

  // Pickers search
  const [riskSearch, setRiskSearch] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');

  const { data: measures, isLoading: isMeasuresLoading, refresh } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: vvts } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: globalDataCategories } = usePluggableCollection<DataCategory>('dataCategories');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSaveMeasure = async () => {
    if (!title || selectedRiskIds.length === 0) {
      toast({ variant: "destructive", title: "Fehler", description: "Mindestens ein Risiko und ein Titel sind erforderlich." });
      return;
    }
    setIsSaving(true);
    const id = selectedMeasure?.id || `msr-${Math.random().toString(36).substring(2, 9)}`;
    const measureData: RiskMeasure = {
      ...selectedMeasure,
      id,
      riskIds: selectedRiskIds,
      resourceIds: selectedResourceIds,
      title,
      owner,
      dueDate,
      status,
      effectiveness: parseInt(effectiveness),
      description,
      isTom,
      tomCategory: isTom ? tomCategory : undefined,
      art32Mapping: isTom ? art32Mapping : [],
      gdprProtectionGoals: isTom ? gdprProtectionGoals : [],
      vvtIds: isTom ? vvtIds : [],
      dataCategories: isTom ? dataCategories : [],
      isArt9Relevant: isTom ? isArt9Relevant : false,
      isEffective,
      checkType,
      lastCheckDate,
      evidenceDetails
    };

    try {
      const res = await saveCollectionRecord('riskMeasures', id, measureData, dataSource);
      if (res.success) {
        toast({ title: "Maßnahme gespeichert" });
        setIsMeasureDialogOpen(false);
        resetForm();
        refresh();
      } else throw new Error(res.error || "Fehler beim Speichern");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSaving(false);
    }
  }

  const resetForm = () => {
    setSelectedMeasure(null);
    setSelectedRiskIds([]);
    setSelectedResourceIds([]);
    setTitle('');
    setOwner('');
    setDueDate('');
    setStatus('planned');
    setEffectiveness('3');
    setDescription('');
    setIsTom(false);
    setTomCategory('Zugriffskontrolle');
    setArt32Mapping([]);
    setGdprProtectionGoals([]);
    setVvtIds([]);
    setDataCategories([]);
    setIsArt9Relevant(false);
    setIsEffective(false);
    setCheckType('Review');
    setLastCheckDate('');
    setEvidenceDetails('');
    setRiskSearch('');
    setResourceSearch('');
  };

  const openEdit = (m: RiskMeasure) => {
    setSelectedMeasure(m);
    setSelectedRiskIds(m.riskIds || []);
    setSelectedResourceIds(m.resourceIds || []);
    setTitle(m.title);
    setOwner(m.owner);
    setDueDate(m.dueDate || '');
    setStatus(m.status);
    setEffectiveness(m.effectiveness.toString());
    setDescription(m.description || '');
    setIsTom(!!m.isTom);
    setTomCategory(m.tomCategory || 'Zugriffskontrolle');
    setArt32Mapping(m.art32Mapping || []);
    setGdprProtectionGoals(m.gdprProtectionGoals || []);
    setVvtIds(m.vvtIds || []);
    setDataCategories(m.dataCategories || []);
    setIsArt9Relevant(!!m.isArt9Relevant);
    setIsEffective(!!m.isEffective);
    setCheckType(m.checkType || 'Review');
    setLastCheckDate(m.lastCheckDate || '');
    setEvidenceDetails(m.evidenceDetails || '');
    setIsMeasureDialogOpen(true);
  };

  const filteredRisksForSelection = useMemo(() => {
    if (!risks) return [];
    return risks.filter(r => {
      const matchesTenant = activeTenantId === 'all' || r.tenantId === activeTenantId;
      const matchesSearch = r.title.toLowerCase().includes(riskSearch.toLowerCase());
      return matchesTenant && matchesSearch;
    });
  }, [risks, activeTenantId, riskSearch]);

  const filteredResourcesForSelection = useMemo(() => {
    if (!resources) return [];
    return resources.filter(res => {
      const matchesTenant = activeTenantId === 'all' || res.tenantId === activeTenantId || res.tenantId === 'global';
      const matchesSearch = res.name.toLowerCase().includes(resourceSearch.toLowerCase());
      return matchesTenant && matchesSearch;
    });
  }, [resources, activeTenantId, resourceSearch]);

  const filteredMeasures = useMemo(() => {
    if (!measures) return [];
    return measures.filter(m => {
      const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) || m.owner.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      
      if (activeTenantId !== 'all' && risks) {
        const measureRisks = risks.filter(r => m.riskIds?.includes(r.id));
        return measureRisks.some(r => r.tenantId === activeTenantId);
      }
      return true;
    });
  }, [measures, risks, search, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 flex items-center justify-center border-2 border-emerald-500/20">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Maßnahmen & Kontrollen</h1>
            <p className="text-sm text-muted-foreground mt-1">Multi-Risk-Monitoring der risikomindernden Aktivitäten (TOM).</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setIsMeasureDialogOpen(true); }} className="h-10 font-bold uppercase text-[10px] rounded-none px-6">
          <Plus className="w-4 h-4 mr-2" /> Maßnahme planen
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Maßnahmen oder Verantwortliche suchen..." 
            className="pl-10 h-11 border-2 bg-white dark:bg-slate-950 rounded-none shadow-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="py-4 font-bold uppercase text-[10px]">Maßnahme / Typ</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Frist / Audit</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Verantwortung</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Wirksamkeit</TableHead>
              <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isMeasuresLoading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredMeasures.map((m) => {
              const riskCount = m.riskIds?.length || 0;
              const isOverdue = m.dueDate && new Date(m.dueDate) < new Date() && m.status !== 'completed';
              const lastAudit = m.lastCheckDate ? new Date(m.lastCheckDate).toLocaleDateString() : 'N/A';
              
              return (
                <TableRow key={m.id} className="hover:bg-muted/5 group border-b last:border-0">
                  <TableCell className="py-4">
                    <div className="font-bold text-sm">{m.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {m.isTom && (
                        <Badge className="bg-emerald-50 text-emerald-700 rounded-none text-[8px] font-black border-none px-1.5 h-4.5">
                          TOM: {m.tomCategory}
                        </Badge>
                      )}
                      <Badge variant="outline" className="rounded-none text-[8px] font-bold uppercase border-slate-200">RISIKEN: {riskCount}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className={cn("flex items-center gap-2 text-[10px] font-bold", isOverdue ? "text-red-600" : "text-slate-600")}>
                        <Calendar className="w-3 h-3" /> Deadline: {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '---'}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400">
                        <CalendarCheck className="w-3 h-3" /> Audit: {lastAudit}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold">{m.owner || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {m.isEffective ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-none text-[8px] font-black px-2 h-5">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> WIRKSAM
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-none rounded-none text-[8px] font-black px-2 h-5">
                          OFFEN
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[9px] font-black uppercase bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-none gap-1.5"
                        onClick={() => openEdit(m)}
                      >
                        <CalendarCheck className="w-3 h-3" /> Audit durchführen
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none w-48">
                          <DropdownMenuItem onSelect={() => openEdit(m)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => { if(confirm("Maßnahme löschen?")) deleteCollectionRecord('riskMeasures', m.id, dataSource).then(() => refresh()); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
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

      {/* Measure Editor Dialog */}
      <Dialog open={isMeasureDialogOpen} onOpenChange={setIsMeasureDialogOpen}>
        <DialogContent className="max-w-6xl rounded-none p-0 flex flex-col border-2 shadow-2xl h-[90vh] bg-card overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-5 h-5 text-emerald-500" />
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                {selectedMeasure ? 'Maßnahme bearbeiten / Audit' : 'Neue Maßnahme planen'}
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="base" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b bg-slate-50 shrink-0">
              <TabsList className="h-12 bg-transparent gap-6 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase">1. Allgemein</TabsTrigger>
                <TabsTrigger value="tom" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase flex items-center gap-2">
                  <FileCheck className="w-3.5 h-3.5" /> 2. TOM & DSGVO
                </TabsTrigger>
                <TabsTrigger value="links" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase">3. Verknüpfungen</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase flex items-center gap-2">
                  <CalendarCheck className="w-3.5 h-3.5" /> 4. Wirksamkeit & Audit
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-8">
                <TabsContent value="base" className="mt-0 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Titel der Maßnahme</Label>
                      <p className="text-[9px] text-muted-foreground italic">Kurze, prägnante Bezeichnung (z.B. Monatliche Log-Prüfung).</p>
                      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="..." className="rounded-none h-10 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Verantwortlicher</Label>
                      <p className="text-[9px] text-muted-foreground italic">Wer stellt die Umsetzung sicher?</p>
                      <Input value={owner} onChange={e => setOwner(e.target.value)} className="rounded-none h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Implementierungs-Deadline</Label>
                      <p className="text-[9px] text-muted-foreground italic">Bis wann muss die Maßnahme implementiert sein?</p>
                      <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-none h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Status</Label>
                      <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="planned">Geplant</SelectItem>
                          <SelectItem value="active">In Umsetzung</SelectItem>
                          <SelectItem value="completed">Wirksam (Abgeschlossen)</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Erwartete Risikominderung (1-5)</Label>
                      <p className="text-[9px] text-muted-foreground italic">Wie stark senkt diese Maßnahme das Risiko theoretisch? (1=minimal, 5=eliminierend)</p>
                      <Select value={effectiveness} onValueChange={setEffectiveness}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {[1,2,3,4,5].map(v => <SelectItem key={v} value={v.toString()}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Detailbeschreibung</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Schritte zur Umsetzung..." className="rounded-none min-h-[150px]" />
                  </div>
                </TabsContent>

                <TabsContent value="tom" className="mt-0 space-y-10">
                  <div className="flex items-center justify-between p-4 bg-emerald-50 border-2 border-emerald-100 rounded-none">
                    <div className="space-y-1">
                      <Label className="text-xs font-black uppercase text-emerald-800">Technisch Organisatorische Maßnahme (TOM)</Label>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase">Aktivieren Sie dies, um die DSGVO-relevanten Felder für Art. 32 freizuschalten.</p>
                    </div>
                    <Switch checked={isTom} onCheckedChange={setIsTom} />
                  </div>

                  {isTom && (
                    <div className="space-y-10 animate-in fade-in zoom-in-95">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Scale className="w-4 h-4" /> A) Rechtliche Einordnung
                          </h3>
                          
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">TOM-Kategorie</Label>
                            <Select value={tomCategory} onValueChange={(v: any) => setTomCategory(v)}>
                              <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-none">
                                {['Zugriffskontrolle', 'Zutrittskontrolle', 'Weitergabekontrolle', 'Eingabekontrolle', 'Auftragskontrolle', 'Verfügbarkeitskontrolle', 'Trennungsgebot', 'Verschlüsselung / Pseudonymisierung', 'Wiederherstellbarkeit', 'Wirksamkeitsprüfung'].map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-[10px] font-bold uppercase">Art.-32-Zuordnung</Label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'lit. a', label: 'lit. a (Verschlüsselung)' },
                                { id: 'lit. b', label: 'lit. b (Vertraulichkeit/Belastbarkeit)' },
                                { id: 'lit. c', label: 'lit. c (Wiederherstellbarkeit)' },
                                { id: 'lit. d', label: 'lit. d (Regelm. Überprüfung)' }
                              ].map(lit => (
                                <div key={lit.id} className="flex items-center gap-2 p-2 border bg-white cursor-pointer hover:bg-slate-50" onClick={() => setArt32Mapping(prev => prev.includes(lit.id) ? prev.filter(i => i !== lit.id) : [...prev, lit.id])}>
                                  <Checkbox checked={art32Mapping.includes(lit.id)} className="rounded-none" />
                                  <span className="text-[10px] font-bold uppercase">{lit.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                            <Shield className="w-4 h-4" /> B) Schutzzielbezug (DSGVO)
                          </h3>
                          <div className="grid grid-cols-2 gap-2">
                            {['Vertraulichkeit', 'Integrität', 'Verfügbarkeit', 'Belastbarkeit'].map(goal => (
                              <div key={goal} className="flex items-center gap-2 p-2 border bg-white cursor-pointer hover:bg-slate-50" onClick={() => setGdprProtectionGoals(prev => prev.includes(goal) ? prev.filter(i => i !== goal) : [...prev, goal])}>
                                <Checkbox checked={gdprProtectionGoals.includes(goal)} className="rounded-none" />
                                <span className="text-[10px] font-bold uppercase">{goal}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="links" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-2 border-b pb-2">
                        <AlertTriangle className="w-4 h-4 text-orange-600" /> Verknüpfte Risiken ({selectedRiskIds.length})
                      </Label>
                      <div className="border h-[400px] overflow-hidden flex flex-col bg-slate-50/50">
                        <ScrollArea className="flex-1 p-2 space-y-1">
                          {filteredRisksForSelection.map(r => {
                            const isSelected = selectedRiskIds.includes(r.id);
                            return (
                              <div key={r.id} className={cn("flex items-start gap-3 p-3 cursor-pointer transition-all border border-transparent", isSelected ? "bg-white border-primary/30 shadow-sm" : "hover:bg-white")} onClick={() => setSelectedRiskIds(prev => isSelected ? prev.filter(id => id !== r.id) : [...prev, r.id])}>
                                <Checkbox checked={isSelected} className="mt-0.5 rounded-none" />
                                <div className="min-w-0"><p className="text-xs font-bold truncate">{r.title}</p></div>
                              </div>
                            );
                          })}
                        </ScrollArea>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-2 border-b pb-2">
                        <Layers className="w-4 h-4" /> Verknüpfte IT-Systeme ({selectedResourceIds.length})
                      </Label>
                      <div className="border h-[400px] overflow-hidden flex flex-col bg-slate-50/50">
                        <ScrollArea className="flex-1 p-2 space-y-1">
                          {filteredResourcesForSelection.map(res => {
                            const isSelected = selectedResourceIds.includes(res.id);
                            return (
                              <div key={res.id} className={cn("flex items-start gap-3 p-3 cursor-pointer transition-all border border-transparent", isSelected ? "bg-white border-primary/30 shadow-sm" : "hover:bg-white")} onClick={() => setSelectedResourceIds(prev => isSelected ? prev.filter(id => id !== res.id) : [...prev, res.id])}>
                                <Checkbox checked={isSelected} className="mt-0.5 rounded-none" />
                                <div className="min-w-0"><p className="text-xs font-bold truncate">{res.name}</p></div>
                              </div>
                            );
                          })}
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-blue-50 border-2 border-blue-100 rounded-none">
                        <div className="space-y-1">
                          <Label className="text-xs font-black uppercase text-blue-800">Wirksamkeit bestätigt?</Label>
                          <p className="text-[10px] text-blue-600 font-bold uppercase italic">Ist die Maßnahme im operativen Betrieb greifbar?</p>
                        </div>
                        <Switch checked={isEffective} onCheckedChange={setIsEffective} />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Art der Prüfung</Label>
                        <Select value={checkType} onValueChange={(v: any) => setCheckType(v)}>
                          <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-none">
                            <SelectItem value="Audit">Formales Audit (Intern/Extern)</SelectItem>
                            <SelectItem value="Test">Technischer Test (Pentest/Restore)</SelectItem>
                            <SelectItem value="Review">Operatives Review (Stichprobe)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Letzte Überprüfung am</Label>
                        <Input type="date" value={lastCheckDate} onChange={e => setLastCheckDate(e.target.value)} className="rounded-none h-10" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                        <LinkIcon className="w-3.5 h-3.5 text-blue-500" /> Evidence / Nachweis (Details)
                      </Label>
                      <p className="text-[9px] text-muted-foreground italic">Dokumentieren Sie hier, wie die Wirksamkeit nachgewiesen wurde (z.B. Pfad zum Protokoll oder Ticket-Referenz).</p>
                      <Textarea 
                        value={evidenceDetails} 
                        onChange={e => setEvidenceDetails(e.target.value)} 
                        placeholder="z.B. Siehe Restore-Protokoll vom 15.01. unter //file/compliance/backup_tests.pdf" 
                        className="rounded-none min-h-[180px] text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-muted/20 border-l-4 border-blue-600 text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-3">
                    <Info className="w-5 h-5 text-blue-600" />
                    Regelmäßige Audits sind essentiell für ISMS (ISO 27001) und DSGVO Nachweispflichten.
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="p-6 bg-muted/30 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsMeasureDialogOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleSaveMeasure} disabled={isSaving || selectedRiskIds.length === 0} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Maßnahme speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
