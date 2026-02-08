
"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  ClipboardCheck, 
  Plus, 
  Search, 
  Clock, 
  User as UserIcon, 
  CheckCircle2, 
  MoreHorizontal,
  Pencil, 
  Trash2, 
  Filter,
  Loader2,
  ShieldCheck,
  Save,
  Info,
  CalendarCheck,
  ShieldAlert,
  Zap,
  Target
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
import { Risk, RiskMeasure, Resource, RiskControl } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';

function RiskMeasuresContent() {
  const { dataSource, activeTenantId } = useSettings();
  const { user: platformUser } = usePlatformAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMeasure, setSelectedMeasure] = useState<RiskMeasure | null>(null);

  // Control Planning State
  const [isPlanningControl, setIsPlanningControl] = useState(false);
  const [plannedControlTitle, setPlannedControlTitle] = useState('');
  const [plannedControlOwner, setPlannedControlOwner] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<RiskMeasure['status']>('planned');
  const [isTom, setIsTom] = useState(false);
  const [tomCategory, setTomCategory] = useState<RiskMeasure['tomCategory']>('Zugriffskontrolle');
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  const { data: measures, isLoading, refresh } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: controls } = usePluggableCollection<RiskControl>('riskControls');

  useEffect(() => { setMounted(true); }, []);

  const handleSave = async () => {
    if (!title || selectedRiskIds.length === 0) {
      toast({ variant: "destructive", title: "Fehler", description: "Titel und Risikobezug erforderlich." });
      return;
    }
    setIsSaving(true);
    const id = selectedMeasure?.id || `msr-${Math.random().toString(36).substring(2, 9)}`;
    const data: RiskMeasure = {
      ...selectedMeasure,
      id,
      title,
      description,
      owner,
      dueDate,
      status,
      isTom,
      tomCategory: isTom ? tomCategory : undefined,
      riskIds: selectedRiskIds,
      resourceIds: selectedResourceIds,
      effectiveness: selectedMeasure?.effectiveness || 3
    };

    const res = await saveCollectionRecord('riskMeasures', id, data, dataSource);
    if (res.success) {
      toast({ title: "Maßnahme gespeichert" });
      setIsDialogOpen(false);
      refresh();
    }
    setIsSaving(false);
  };

  const handlePlanControl = async () => {
    if (!selectedMeasure || !plannedControlTitle) return;
    setIsSaving(true);
    const controlId = `ctrl-${Math.random().toString(36).substring(2, 9)}`;
    const controlData: RiskControl = {
      id: controlId,
      measureId: selectedMeasure.id,
      title: plannedControlTitle,
      owner: plannedControlOwner || platformUser?.displayName || 'N/A',
      status: 'scheduled',
      isEffective: false,
      checkType: 'Review',
      nextCheckDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    const res = await saveCollectionRecord('riskControls', controlId, controlData, dataSource);
    if (res.success) {
      toast({ title: "Prüfprozess (Kontrolle) geplant", description: "Sie finden diesen nun im Kontroll-Monitoring." });
      setIsPlanningControl(false);
      router.push('/risks/controls');
    }
    setIsSaving(false);
  };

  const filteredMeasures = useMemo(() => {
    if (!measures) return [];
    return measures.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));
  }, [measures, search]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 flex items-center justify-center rounded-xl border border-emerald-500/10 shadow-sm">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-emerald-100 text-emerald-700 text-[9px] font-bold border-none uppercase tracking-wider">Mitigation Action</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Maßnahmenplan</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Strategische Schritte zur Risikominderung.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs" onClick={() => router.push('/risks/controls')}>
            <ShieldCheck className="w-3.5 h-3.5 mr-2 text-primary" /> Kontroll-Monitoring
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-accent hover:bg-accent/90 text-white shadow-sm" onClick={() => { setSelectedMeasure(null); setIsDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Neue Maßnahme
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Maßnahme</TableHead>
              <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Status</TableHead>
              <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Verantwortung</TableHead>
              <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Kontrollen</TableHead>
              <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMeasures.map((m) => {
              const measureControls = controls?.filter(c => c.measureId === m.id) || [];
              return (
                <TableRow key={m.id} className="group hover:bg-slate-50 border-b last:border-0">
                  <TableCell className="py-4 px-6">
                    <div>
                      <div className="font-bold text-sm text-slate-800">{m.title}</div>
                      {m.isTom && <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full text-[8px] font-black h-4 px-1.5 mt-1 uppercase">TOM: {m.tomCategory}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[9px] font-bold h-5 px-2 uppercase border-slate-200">{m.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <UserIcon className="w-3.5 h-3.5 text-slate-300" /> {m.owner}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-none font-black text-[10px] h-5 px-2">
                        {measureControls.length} Aktiv
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-md"><MoreHorizontal className="w-4 h-4 text-slate-400" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 rounded-xl border p-1 shadow-xl">
                        <DropdownMenuItem className="text-indigo-600 font-bold gap-2" onSelect={() => { setSelectedMeasure(m); setPlannedControlTitle(`Prüfung: ${m.title}`); setIsPlanningControl(true); }}>
                          <ShieldCheck className="w-3.5 h-3.5" /> Kontrolle starten
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" onSelect={() => openEdit(m)}><Pencil className="w-3.5 h-3.5" /> Bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 gap-2" onSelect={() => deleteCollectionRecord('riskMeasures', m.id, dataSource).then(() => refresh())}><Trash2 className="w-3.5 h-3.5" /> Löschen</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Plan Control Dialog */}
      <Dialog open={isPlanningControl} onOpenChange={setIsPlanningControl}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 bg-indigo-600 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center border border-white/10">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-headline font-bold uppercase tracking-tight">Kontrolle planen</DialogTitle>
                <DialogDescription className="text-[10px] text-white/60 font-bold uppercase">Maßnahme: {selectedMeasure?.title}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Bezeichnung des Prüfprozesses</Label>
              <Input value={plannedControlTitle} onChange={e => setPlannedControlTitle(e.target.value)} className="h-11 rounded-xl font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Prüfverantwortlicher</Label>
              <Input value={plannedControlOwner} onChange={e => setPlannedControlOwner(e.target.value)} placeholder="Name..." className="h-11 rounded-xl" />
            </div>
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-indigo-700 italic leading-relaxed">
                Dies erstellt einen dauerhaften Prüfpunkt im Kontroll-Monitoring, um die Wirksamkeit der Maßnahme regelmäßig zu validieren.
              </p>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsPlanningControl(false)} className="rounded-xl font-bold text-[10px] uppercase">Abbrechen</Button>
            <Button onClick={handlePlanControl} disabled={isSaving || !plannedControlTitle} className="rounded-xl h-11 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase shadow-lg shadow-indigo-200 transition-all active:scale-95 gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Prüfung aktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Measure Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col shadow-2xl border-none">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-10">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-500/10 shadow-sm">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate uppercase tracking-tight">{selectedMeasure ? 'Maßnahme bearbeiten' : 'Maßnahme planen'}</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Strategische Risikominderung</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 bg-slate-50/30">
            <div className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Titel der Maßnahme</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl h-12 font-bold border-slate-200 bg-white shadow-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Verantwortlich</Label>
                  <Input value={owner} onChange={e => setOwner(e.target.value)} className="rounded-xl h-11 border-slate-200 bg-white shadow-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Status</Label>
                  <Select value={status} onValueChange={(v:any) => setStatus(v)}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['planned', 'active', 'completed', 'on_hold'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Strategische Beschreibung</Label>
                  <Textarea value={description} onChange={e => setDesc(e.target.value)} className="rounded-2xl min-h-[120px] p-4 text-xs font-medium bg-white" placeholder="Was soll erreicht werden?..." />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase text-indigo-600 tracking-widest flex items-center gap-2">
                    <Target className="w-3 h-3" /> Risikobezug
                  </Label>
                  <ScrollArea className="h-48 rounded-xl border bg-white p-2">
                    <div className="space-y-1">
                      {risks?.map(r => (
                        <div key={r.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-all" onClick={() => setSelectedRiskIds(prev => selectedRiskIds.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id])}>
                          <Checkbox checked={selectedRiskIds.includes(r.id)} />
                          <span className="text-[11px] font-bold text-slate-700 truncate">{r.title}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase text-indigo-600 tracking-widest flex items-center gap-2">
                    <Layers className="w-3 h-3" /> Systembezug
                  </Label>
                  <ScrollArea className="h-48 rounded-xl border bg-white p-2">
                    <div className="space-y-1">
                      {resources?.map(res => (
                        <div key={res.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-all" onClick={() => setSelectedResourceIds(prev => selectedResourceIds.includes(res.id) ? prev.filter(id => id !== res.id) : [...prev, res.id])}>
                          <Checkbox checked={selectedResourceIds.includes(res.id)} />
                          <span className="text-[11px] font-bold text-slate-700 truncate">{res.name}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold text-[10px] uppercase">Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSaving} className="rounded-xl h-11 px-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase shadow-lg shadow-emerald-200 gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RiskMeasuresPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 opacity-20" /></div>}>
      <RiskMeasuresContent />
    </Suspense>
  );
}
