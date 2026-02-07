"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Pencil, 
  FileCheck,
  ShieldCheck,
  Calendar,
  Building2,
  Info,
  Scale,
  ClipboardList,
  RefreshCw,
  Eye,
  FileText,
  BadgeAlert,
  Save,
  Layers,
  History,
  GitBranch,
  Copy,
  ArrowRight,
  Clock,
  Download,
  MoreVertical,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessingActivity, Resource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportGdprExcel } from '@/lib/export-utils';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { Card, CardContent } from '@/components/ui/card';

export default function GdprPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  // Modals
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Selection
  const [selectedActivity, setSelectedActivity] = useState<ProcessingActivity | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0');
  const [description, setDescription] = useState('');
  const [responsibleDepartment, setResponsibleDepartment] = useState('');
  const [legalBasis, setLegalBasis] = useState('Art. 6 Abs. 1 lit. b (Vertrag)');
  const [retentionPeriod, setRetentionPeriod] = useState('10 Jahre (Steuerrecht)');
  const [status, setStatus] = useState<ProcessingActivity['status']>('active');
  const [resourceIds, setResourceIds] = useState<string[]>([]);

  const { data: activities, isLoading, refresh } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: resources } = usePluggableCollection<Resource>('resources');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = async (isNewVersion = false) => {
    if (!name) return;
    setIsSaving(true);
    
    const id = isNewVersion 
      ? `vvt-${Math.random().toString(36).substring(2, 9)}`
      : (selectedActivity?.id || `vvt-${Math.random().toString(36).substring(2, 9)}`);
    
    const originalId = isNewVersion 
      ? (selectedActivity?.originalId || selectedActivity?.id)
      : (selectedActivity?.originalId || id);

    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;

    const data: ProcessingActivity = {
      ...selectedActivity,
      id,
      originalId,
      tenantId: targetTenantId,
      name,
      version: isNewVersion ? `${(parseFloat(version) + 0.1).toFixed(1)}` : version,
      description,
      responsibleDepartment,
      legalBasis,
      dataCategories: [],
      subjectCategories: [],
      recipientCategories: '',
      retentionPeriod,
      status: isNewVersion ? 'draft' : status,
      lastReviewDate: new Date().toISOString(),
      resourceIds
    };

    try {
      const res = await saveCollectionRecord('processingActivities', id, data, dataSource);
      if (res.success) {
        toast({ title: isNewVersion ? "Neue Version angelegt" : "VVT-Eintrag gespeichert" });
        setIsDialogOpen(false);
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (act: ProcessingActivity) => {
    setSelectedActivity(act);
    setName(act.name);
    setVersion(act.version || '1.0');
    setDescription(act.description || '');
    setResponsibleDepartment(act.responsibleDepartment || '');
    setLegalBasis(act.legalBasis || '');
    setRetentionPeriod(act.retentionPeriod || '');
    setStatus(act.status);
    setResourceIds(act.resourceIds || []);
    setIsDialogOpen(true);
  };

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    const map = new Map<string, ProcessingActivity>();
    activities.forEach(act => {
      const key = act.originalId || act.id;
      const existing = map.get(key);
      if (!existing || parseFloat(act.version) > parseFloat(existing.version)) {
        if (activeTenantId === 'all' || act.tenantId === activeTenantId) {
          map.set(key, act);
        }
      }
    });
    return Array.from(map.values()).filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
  }, [activities, search, activeTenantId]);

  const applyAiSuggestions = (s: any) => {
    if (s.name) setName(s.name);
    if (s.description) setDescription(s.description);
    if (s.responsibleDepartment) setResponsibleDepartment(s.responsibleDepartment);
    if (s.legalBasis) setLegalBasis(s.legalBasis);
    if (s.retentionPeriod) setRetentionPeriod(s.retentionPeriod);
    toast({ title: "KI-Vorschläge übernommen" });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-10 pb-20">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 flex items-center justify-center rounded-2xl border-2 border-emerald-500/20 shadow-xl shadow-emerald-500/5">
            <FileCheck className="w-9 h-9" />
          </div>
          <div>
            <Badge className="mb-2 rounded-full px-3 py-0 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest border-none">Compliance Hub</Badge>
            <h1 className="text-4xl font-headline font-bold tracking-tight text-slate-900 dark:text-white uppercase">Datenschutz (VVT)</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Verarbeitungsverzeichnis gemäß Art. 30 DSGVO.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-6 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all" onClick={() => exportGdprExcel(filteredActivities)}>
            <Download className="w-4 h-4 mr-2 text-primary" /> Excel Export
          </Button>
          <Button onClick={() => { setSelectedActivity(null); setIsDialogOpen(true); setVersion('1.0'); setResourceIds([]); }} className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-none transition-all">
            <Plus className="w-4 h-4 mr-2" /> Neue Tätigkeit
          </Button>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
        <Input 
          placeholder="Nach Tätigkeiten oder Abteilungen suchen..." 
          className="pl-11 h-14 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 focus:bg-white transition-all shadow-xl shadow-slate-200/20 dark:shadow-none"
          value={search}
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Analysiere Datenschutz-Register...</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredActivities.map((act) => (
              <Card key={act.id} className="border-none shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-slate-900 group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="rounded-full text-[8px] font-black uppercase border-emerald-100 bg-emerald-50 text-emerald-700 h-5">V{act.version}</Badge>
                        <span className="text-[9px] font-black uppercase text-slate-400">{act.responsibleDepartment}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white leading-tight" onClick={() => openEdit(act)}>{act.name}</h3>
                    </div>
                    <Badge variant="outline" className="rounded-full uppercase text-[8px] font-bold border-slate-200 dark:border-slate-800 text-slate-500 h-5">
                      {act.status}
                    </Badge>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl mb-6">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Rechtsgrundlage</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 italic">"{act.legalBasis}"</p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200 dark:border-slate-800" onClick={() => openEdit(act)}>
                      Bearbeiten
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-10 h-10 p-0 rounded-xl border-slate-200 dark:border-slate-800"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl p-2 w-56 shadow-2xl">
                        <DropdownMenuItem onSelect={() => openEdit(act)} className="rounded-xl py-2.5 gap-3"><Pencil className="w-4 h-4" /> Bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { if(confirm("Eintrag löschen?")) deleteCollectionRecord('processingActivities', act.id, dataSource).then(() => refresh()); }} className="text-red-600 rounded-xl py-2.5 gap-3">
                          <Trash2 className="w-4 h-4" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                  <TableHead className="py-6 px-8 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Tätigkeit / Rechtsgrundlage</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Version</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Abteilung</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Status</TableHead>
                  <TableHead className="text-right px-8 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.map((act) => (
                  <TableRow key={act.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-colors">
                    <TableCell className="py-5 px-8">
                      <div>
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 transition-colors cursor-pointer" onClick={() => openEdit(act)}>{act.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1 italic">{act.legalBasis}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-none font-black text-[9px] h-6 px-3">V{act.version}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{act.responsibleDepartment}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full uppercase text-[9px] font-black h-6 px-3 border-slate-200 dark:border-slate-800">{act.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right px-8">
                      <div className="flex justify-end items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 rounded-xl text-[10px] font-black uppercase tracking-wider gap-2 opacity-0 group-hover:opacity-100 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 transition-all"
                          onClick={() => openEdit(act)}
                        >
                          Bearbeiten
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><MoreHorizontal className="w-5 h-5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-slate-100 dark:border-slate-800">
                            <DropdownMenuItem onSelect={() => openEdit(act)} className="rounded-xl py-2.5 gap-3"><Pencil className="w-4 h-4 text-emerald-600" /> Bearbeiten</DropdownMenuItem>
                            <DropdownMenuSeparator className="my-2" />
                            <DropdownMenuItem className="text-red-600 dark:text-red-400 rounded-xl py-2.5 gap-3" onSelect={() => { if(confirm("Eintrag löschen?")) deleteCollectionRecord('processingActivities', act.id, dataSource).then(() => refresh()); }}>
                              <Trash2 className="w-4 h-4" /> Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* GDPR Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[95vh] md:h-[90vh] rounded-[2rem] md:rounded-[3rem] p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 md:p-10 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 shadow-xl">
                  <ShieldCheck className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl md:text-2xl font-headline font-bold uppercase tracking-tight truncate">Verarbeitungstätigkeit bearbeiten</DialogTitle>
                  <DialogDescription className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 md:mt-1.5">Art. 30 DSGVO Dokumentation</DialogDescription>
                </div>
              </div>
              <AiFormAssistant 
                formType="gdpr" 
                currentData={{ name, description, responsibleDepartment, legalBasis, retentionPeriod, status }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 md:px-10 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <TabsList className="h-12 md:h-14 bg-transparent gap-4 md:gap-8 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent h-full px-0 gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-emerald-600">
                  <FileText className="w-3.5 md:w-4 h-3.5 md:h-4" /> Stammdaten
                </TabsTrigger>
                <TabsTrigger value="systems" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent h-full px-0 gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-emerald-600">
                  <Layers className="w-3.5 md:w-4 h-3.5 md:h-4" /> IT-Systeme
                </TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6 md:p-10">
                <TabsContent value="base" className="mt-0 space-y-8 md:space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Bezeichnung der Tätigkeit</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} className="rounded-2xl h-12 md:h-14 text-base md:text-lg font-bold border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Verantwortliche Abteilung</Label>
                      <Input value={responsibleDepartment} onChange={e => setResponsibleDepartment(e.target.value)} className="rounded-2xl h-12 md:h-14 border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Rechtsgrundlage</Label>
                      <Select value={legalBasis} onValueChange={setLegalBasis}>
                        <SelectTrigger className="rounded-2xl h-12 md:h-14 border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="Art. 6 Abs. 1 lit. a (Einwilligung)">Einwilligung</SelectItem>
                          <SelectItem value="Art. 6 Abs. 1 lit. b (Vertrag)">Vertragserfüllung</SelectItem>
                          <SelectItem value="Art. 6 Abs. 1 lit. f (Berechtigtes Interesse)">Berechtigtes Interesse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Löschfrist / Aufbewahrung</Label>
                      <Input value={retentionPeriod} onChange={e => setRetentionPeriod(e.target.value)} className="rounded-2xl h-12 md:h-14 border-slate-200" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Zweck & Beschreibung</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-[1.5rem] md:rounded-[2rem] min-h-[120px] md:min-h-[150px] p-4 md:p-6 border-slate-200 leading-relaxed" />
                  </div>
                </TabsContent>
                <TabsContent value="systems" className="mt-0">
                  <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                    <Label className="text-[9px] md:text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-4 md:mb-6 block ml-2">Involvierte IT-Assets</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {resources?.map(res => (
                        <div 
                          key={res.id} 
                          className={cn(
                            "flex items-center gap-4 p-4 bg-white dark:bg-slate-950 border rounded-2xl cursor-pointer transition-all shadow-sm",
                            resourceIds.includes(res.id) ? "border-emerald-500 ring-4 ring-emerald-500/5" : "border-slate-100 hover:border-slate-300"
                          )} 
                          onClick={() => setResourceIds(prev => resourceIds.includes(res.id) ? prev.filter(id => id !== res.id) : [...prev, res.id])}
                        >
                          <Checkbox checked={resourceIds.includes(res.id)} className="rounded-lg h-5 w-5" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{res.name}</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{res.assetType}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto rounded-xl font-black uppercase text-[10px] px-8 h-12">Abbrechen</Button>
            <Button onClick={() => handleSave(false)} disabled={isSaving || !name} className="w-full sm:w-auto rounded-2xl font-black uppercase text-[10px] tracking-widest px-12 h-12 md:h-14 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl shadow-emerald-200 dark:shadow-none transition-all gap-3">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Dokumentation Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
