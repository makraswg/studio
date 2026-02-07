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
import { AiFormAssistant } from '@/components/ai/form-assistant';

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
  
  // Audit State
  const [isEffective, setIsEffective] = useState(false);
  const [checkType, setCheckType] = useState<RiskMeasure['checkType']>('Review');
  const [lastCheckDate, setLastCheckDate] = useState('');
  const [evidenceDetails, setEvidenceDetails] = useState('');

  const { data: measures, isLoading: isMeasuresLoading, refresh } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');

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
      }
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
    setIsEffective(false);
    setCheckType('Review');
    setLastCheckDate('');
    setEvidenceDetails('');
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
    setIsEffective(!!m.isEffective);
    setCheckType(m.checkType || 'Review');
    setLastCheckDate(m.lastCheckDate || '');
    setEvidenceDetails(m.evidenceDetails || '');
    setIsMeasureDialogOpen(true);
  };

  const applyAiSuggestions = (s: any) => {
    if (s.title) setTitle(s.title);
    if (s.owner) setOwner(s.owner);
    if (s.description) setDescription(s.description);
    if (s.effectiveness) setEffectiveness(String(s.effectiveness));
    if (s.tomCategory) setTomCategory(s.tomCategory);
    if (s.evidenceDetails) setEvidenceDetails(s.evidenceDetails);
    toast({ title: "KI-Vorschläge übernommen" });
  };

  const filteredMeasures = useMemo(() => {
    if (!measures) return [];
    return measures.filter(m => m.title.toLowerCase().includes(search.toLowerCase()) || m.owner.toLowerCase().includes(search.toLowerCase()));
  }, [measures, search]);

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Suchen..." className="pl-10 h-11 border-2 bg-white rounded-none shadow-none" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="py-4 font-bold uppercase text-[10px]">Maßnahme</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Frist / Audit</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Verantwortung</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Wirksamkeit</TableHead>
              <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isMeasuresLoading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredMeasures.map((m) => (
              <TableRow key={m.id} className="hover:bg-muted/5 group border-b last:border-0">
                <TableCell className="py-4">
                  <div className="font-bold text-sm">{m.title}</div>
                  {m.isTom && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[8px] border-none rounded-none uppercase">{m.tomCategory}</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-[10px] font-bold text-slate-600">
                    <span>Deadline: {m.dueDate || '---'}</span>
                    <span className="text-[8px] font-black uppercase text-slate-400">Prüfung: {m.lastCheckDate || '---'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-bold">{m.owner || 'N/A'}</TableCell>
                <TableCell>
                  {m.isEffective ? <Badge className="bg-emerald-50 text-emerald-700 rounded-none text-[8px] font-black uppercase h-5 px-2">WIRKSAM</Badge> : <Badge variant="outline" className="text-[8px] uppercase">OFFEN</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-none w-48">
                      <DropdownMenuItem onSelect={() => openEdit(m)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onSelect={() => { if(confirm("Maßnahme löschen?")) deleteCollectionRecord('riskMeasures', m.id, dataSource).then(() => refresh()); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isMeasureDialogOpen} onOpenChange={setIsMeasureDialogOpen}>
        <DialogContent className="max-w-6xl w-[95vw] md:w-full h-[95vh] md:h-[90vh] rounded-[1.5rem] md:rounded-none p-0 flex flex-col border-2 shadow-2xl bg-white overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 text-emerald-500" />
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">Maßnahme planen / Audit</DialogTitle>
              </div>
              <AiFormAssistant 
                formType="measure" 
                currentData={{ title, description, owner, effectiveness, isTom, tomCategory }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="base" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b bg-slate-50 shrink-0 overflow-x-auto no-scrollbar">
              <TabsList className="h-12 bg-transparent gap-6 p-0 w-max">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-4 text-[10px] font-bold uppercase">Allgemein</TabsTrigger>
                <TabsTrigger value="tom" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 h-full px-4 text-[10px] font-bold uppercase">TOM & DSGVO</TabsTrigger>
                <TabsTrigger value="links" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-4 text-[10px] font-bold uppercase">Links</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full px-4 text-[10px] font-bold uppercase">Audit</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 md:p-8">
                <TabsContent value="base" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-bold uppercase">Titel</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-none h-10 font-bold" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Verantwortlich</Label><Input value={owner} onChange={e => setOwner(e.target.value)} className="rounded-none h-10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Deadline</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-none h-10" /></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Beschreibung</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-none min-h-[100px] md:min-h-[150px]" /></div>
                </TabsContent>

                <TabsContent value="tom" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between p-4 bg-emerald-50 border rounded-none">
                    <Label className="text-xs font-black uppercase text-emerald-800">Technisch Organisatorische Maßnahme (TOM)</Label>
                    <Switch checked={isTom} onCheckedChange={setIsTom} />
                  </div>
                  {isTom && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">TOM-Kategorie</Label>
                        <Select value={tomCategory} onValueChange={(v:any) => setTomCategory(v)}>
                          <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-none">
                            {['Zugriffskontrolle', 'Zutrittskontrolle', 'Weitergabekontrolle', 'Verschlüsselung'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="links" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-bold uppercase text-primary">Risiken ({selectedRiskIds.length})</Label>
                      <ScrollArea className="h-[200px] md:h-[300px] border p-2 bg-slate-50/50">
                        {risks?.filter(r => activeTenantId === 'all' || r.tenantId === activeTenantId).map(r => (
                          <div key={r.id} className="flex items-center gap-2 p-2 bg-white border mb-1 cursor-pointer" onClick={() => setSelectedRiskIds(prev => prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id])}>
                            <Checkbox checked={selectedRiskIds.includes(r.id)} className="rounded-none" />
                            <span className="text-xs font-bold truncate">{r.title}</span>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-bold uppercase text-primary">Systeme ({selectedResourceIds.length})</Label>
                      <ScrollArea className="h-[200px] md:h-[300px] border p-2 bg-slate-50/50">
                        {resources?.filter(res => activeTenantId === 'all' || res.tenantId === activeTenantId || res.tenantId === 'global').map(res => (
                          <div key={res.id} className="flex items-center gap-2 p-2 bg-white border mb-1 cursor-pointer" onClick={() => setSelectedResourceIds(prev => prev.includes(res.id) ? prev.filter(id => id !== res.id) : [...prev, res.id])}>
                            <Checkbox checked={selectedResourceIds.includes(res.id)} className="rounded-none" />
                            <span className="text-xs font-bold truncate">{res.name}</span>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between p-4 bg-blue-50 border rounded-none">
                    <Label className="text-xs font-black uppercase text-blue-800">Wirksamkeit bestätigt?</Label>
                    <Switch checked={isEffective} onCheckedChange={setIsEffective} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Audit Datum</Label><Input type="date" value={lastCheckDate} onChange={e => setLastCheckDate(e.target.value)} className="rounded-none h-10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Audit Typ</Label><Select value={checkType} onValueChange={(v:any) => setCheckType(v)}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="Audit">Formales Audit</SelectItem><SelectItem value="Test">Technischer Test</SelectItem><SelectItem value="Review">Stichprobe</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Evidence / Nachweis</Label><Textarea value={evidenceDetails} onChange={e => setEvidenceDetails(e.target.value)} className="rounded-none h-24 md:h-32" /></div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setIsMeasureDialogOpen(false)} className="w-full sm:w-auto rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleSaveMeasure} disabled={isSaving || selectedRiskIds.length === 0} className="w-full sm:w-auto rounded-none h-10 px-12 font-bold uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Maßnahme speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
