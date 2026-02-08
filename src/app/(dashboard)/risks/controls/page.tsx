"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  Loader2, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  CalendarCheck,
  ClipboardList,
  Target,
  Clock,
  MoreHorizontal,
  Pencil, 
  Trash2, 
  Filter,
  Save,
  Info,
  BadgeCheck,
  ChevronRight,
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { RiskControl, RiskMeasure } from '@/lib/types';
import { cn } from '@/lib/utils';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export default function RiskControlsPage() {
  const { dataSource } = useSettings();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedControl, setSelectedControl] = useState<RiskControl | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<RiskControl['status']>('scheduled');
  const [isEffective, setIsEffective] = useState(false);
  const [checkType, setCheckType] = useState<RiskControl['checkType']>('Review');
  const [lastCheckDate, setLastCheckDate] = useState('');
  const [nextCheckDate, setNextCheckDate] = useState('');
  const [evidenceDetails, setEvidenceDetails] = useState('');
  const [measureId, setMeasureId] = useState('');

  const { data: controls, isLoading, refresh } = usePluggableCollection<RiskControl>('riskControls');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');

  useEffect(() => { setMounted(true); }, []);

  const handleSave = async () => {
    if (!title || !measureId) {
      toast({ variant: "destructive", title: "Fehler", description: "Titel und Maßnahmenbezug erforderlich." });
      return;
    }
    setIsSaving(true);
    const id = selectedControl?.id || `ctrl-${Math.random().toString(36).substring(2, 9)}`;
    const data: RiskControl = {
      ...selectedControl,
      id,
      measureId,
      title,
      description,
      owner,
      status,
      isEffective,
      checkType,
      lastCheckDate,
      nextCheckDate,
      evidenceDetails
    };

    const res = await saveCollectionRecord('riskControls', id, data, dataSource);
    if (res.success) {
      toast({ title: "Kontrolle gespeichert" });
      setIsDialogOpen(false);
      refresh();
    }
    setIsSaving(false);
  };

  const openEdit = (c: RiskControl) => {
    setSelectedControl(c);
    setTitle(c.title);
    setMeasureId(c.measureId);
    setDesc(c.description || '');
    setOwner(c.owner);
    setStatus(c.status);
    setIsEffective(!!c.isEffective);
    setCheckType(c.checkType);
    setLastCheckDate(c.lastCheckDate || '');
    setNextCheckDate(c.nextCheckDate || '');
    setEvidenceDetails(c.evidenceDetails || '');
    setIsDialogOpen(true);
  };

  const filteredControls = useMemo(() => {
    if (!controls) return [];
    return controls.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  }, [controls, search]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 flex items-center justify-center rounded-xl border border-indigo-500/10 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-indigo-100 text-indigo-700 text-[9px] font-bold border-none uppercase tracking-wider">Compliance Verification</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Kontroll-Monitoring</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Operative Überwachung der Wirksamkeit von Sicherheitsmaßnahmen.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs" onClick={() => router.push('/risks/measures')}>
            <ClipboardList className="w-3.5 h-3.5 mr-2 text-emerald-600" /> Maßnahmenplan
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-95" onClick={() => { setSelectedControl(null); setIsDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Neue Prüfung planen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="rounded-xl border shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400">Geprüfte Kontrollen</p>
              <h3 className="text-2xl font-black text-slate-900">{controls?.length || 0}</h3>
            </div>
            <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><Activity className="w-5 h-5" /></div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-emerald-600">Wirksam (Effective)</p>
              <h3 className="text-2xl font-black text-emerald-700">{controls?.filter(c => c.isEffective).length || 0}</h3>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600"><BadgeCheck className="w-5 h-5" /></div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-red-600">Lücken / Ineffektiv</p>
              <h3 className="text-2xl font-black text-red-700">{controls?.filter(c => !c.isEffective && c.status === 'completed').length || 0}</h3>
            </div>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-600"><AlertTriangle className="w-5 h-5" /></div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Prüfgegenstand / Kontrolle</TableHead>
              <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Typ</TableHead>
              <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Letzter Check</TableHead>
              <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Wirksamkeit</TableHead>
              <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredControls.map((c) => {
              const measure = measures?.find(m => m.id === c.measureId);
              return (
                <TableRow key={c.id} className="group hover:bg-slate-50 border-b last:border-0">
                  <TableCell className="py-4 px-6">
                    <div>
                      <div className="font-bold text-sm text-slate-800">{c.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[8px] font-black h-4 px-1 border-slate-200 text-slate-400 uppercase">Ref: {measure?.title || 'Global'}</Badge>
                        <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1"><UserIcon className="w-2.5 h-2.5" /> {c.owner}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-bold h-5 px-2 uppercase text-indigo-600 border-indigo-100 bg-indigo-50/30">{c.checkType}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-[10px] font-bold text-slate-600">
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 opacity-30" /> {c.lastCheckDate || 'Noch nie'}</span>
                      <span className="text-[8px] font-black uppercase text-slate-400 mt-0.5 italic">Nächster Check: {c.nextCheckDate || 'offen'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.isEffective ? (
                      <Badge className="bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black h-5 px-3 border-none shadow-sm inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> EFFEKTIV
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={cn("text-[9px] font-bold rounded-full px-3 h-5 border-none shadow-sm", c.status === 'completed' ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400")}>
                        {c.status === 'completed' ? 'LÜCKENHAFT' : 'PENDING'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-white shadow-sm"><MoreHorizontal className="w-4 h-4 text-slate-400" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 rounded-xl border p-1 shadow-xl">
                        <DropdownMenuItem className="gap-2 font-bold" onSelect={() => openEdit(c)}><Pencil className="w-3.5 h-3.5 text-primary" /> Prüfung bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 gap-2 font-bold" onSelect={() => deleteCollectionRecord('riskControls', c.id, dataSource).then(() => refresh())}><Trash2 className="w-3.5 h-3.5" /> Löschen</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] md:h-auto md:max-h-[85vh] rounded-2xl p-0 overflow-hidden flex flex-col shadow-2xl border-none">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-10">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary border border-white/10 shadow-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-headline font-bold uppercase tracking-tight">{selectedControl ? 'Prüfprozess aktualisieren' : 'Neue Prüfung planen'}</DialogTitle>
                <DialogDescription className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">Operative Governance-Instanz</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 bg-slate-50/30">
            <div className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Bezeichnung der Kontrolle</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl h-12 font-bold border-slate-200 bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Zugehörige Maßnahme</Label>
                  <Select value={measureId} onValueChange={setMeasureId}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>
                      {measures?.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Verantwortliche Stelle (Prüfer)</Label>
                  <Input value={owner} onChange={e => setOwner(e.target.value)} className="rounded-xl h-11 border-slate-200 bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Prüf-Intervall / Typ</Label>
                  <Select value={checkType} onValueChange={(v:any) => setCheckType(v)}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Review', 'Audit', 'Test', 'Automatischer Check'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Letzter Check</Label>
                  <Input type="date" value={lastCheckDate} onChange={e => setLastCheckDate(e.target.value)} className="rounded-xl h-11 bg-white" />
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 bg-blue-50 border border-blue-100 rounded-2xl shadow-sm">
                  <div className="space-y-1">
                    <Label className="text-sm font-black uppercase text-blue-800">Wirksamkeit bestätigt?</Label>
                    <p className="text-[10px] font-bold text-blue-600 italic">Wurde das Schutzziel bei der letzten Prüfung erreicht?</p>
                  </div>
                  <Switch checked={isEffective} onCheckedChange={setIsEffective} className="data-[state=checked]:bg-emerald-600" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Audit Evidence / Nachweisdetails</Label>
                  <Textarea value={evidenceDetails} onChange={e => setEvidenceDetails(e.target.value)} className="rounded-2xl min-h-[150px] p-5 border-slate-200 text-xs font-medium bg-white" placeholder="Link zum Bericht, Test-Ergebnis oder Stichproben-Log..." />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold text-[10px] uppercase">Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSaving} className="rounded-xl h-11 px-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase shadow-lg gap-2 active:scale-95 transition-all">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kontrolle speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
