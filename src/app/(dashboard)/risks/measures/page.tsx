
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
  ArrowRight
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
import { Risk, RiskMeasure } from '@/lib/types';

export default function RiskMeasuresPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isMeasureDialogOpen, setIsMeasureDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMeasure, setSelectedMeasure] = useState<RiskMeasure | null>(null);

  // Form State
  const [riskId, setRiskId] = useState('');
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<RiskMeasure['status']>('planned');
  const [effectiveness, setEffectiveness] = useState('3');
  const [description, setDescription] = useState('');

  const { data: measures, isLoading: isMeasuresLoading, refresh } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: risks, isLoading: isRisksLoading } = usePluggableCollection<Risk>('risks');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSaveMeasure = async () => {
    if (!title || !riskId) {
      toast({ variant: "destructive", title: "Fehler", description: "Risiko und Titel sind erforderlich." });
      return;
    }
    setIsSaving(true);
    const id = selectedMeasure?.id || `msr-${Math.random().toString(36).substring(2, 9)}`;
    const measureData: RiskMeasure = {
      id,
      riskId,
      title,
      owner,
      dueDate,
      status,
      effectiveness: parseInt(effectiveness),
      description
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
    setRiskId('');
    setTitle('');
    setOwner('');
    setDueDate('');
    setStatus('planned');
    setEffectiveness('3');
    setDescription('');
  };

  const openEdit = (m: RiskMeasure) => {
    setSelectedMeasure(m);
    setRiskId(m.riskId);
    setTitle(m.title);
    setOwner(m.owner);
    setDueDate(m.dueDate || '');
    setStatus(m.status);
    setEffectiveness(m.effectiveness.toString());
    setDescription(m.description || '');
    setIsMeasureDialogOpen(true);
  };

  const handleDeleteMeasure = async (id: string) => {
    if (!confirm("Maßnahme permanent löschen?")) return;
    try {
      await deleteCollectionRecord('riskMeasures', id, dataSource);
      toast({ title: "Maßnahme entfernt" });
      refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  const filteredRisksForSelection = useMemo(() => {
    if (!risks) return [];
    return risks.filter(r => activeTenantId === 'all' || r.tenantId === activeTenantId);
  }, [risks, activeTenantId]);

  const filteredMeasures = useMemo(() => {
    if (!measures) return [];
    return measures.filter(m => {
      // Wenn Risiken noch laden, zeigen wir alle an, anstatt sie wegzufiltern
      if (!risks) return true;
      const risk = risks.find(r => r.id === m.riskId);
      if (activeTenantId !== 'all' && risk && risk.tenantId !== activeTenantId) return false;
      return m.title.toLowerCase().includes(search.toLowerCase()) || m.owner.toLowerCase().includes(search.toLowerCase());
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
            <p className="text-sm text-muted-foreground mt-1">Überwachung der risikomindernden Aktivitäten und deren Wirksamkeit.</p>
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
        <div className="flex border bg-card h-11 p-1 gap-1">
          <Button variant="ghost" size="sm" className="h-full text-[9px] font-bold uppercase px-4 rounded-none border-r"><Filter className="w-3 h-3 mr-2" /> Filter</Button>
          <Button variant="ghost" size="sm" className="h-full text-[9px] font-bold uppercase px-4 rounded-none bg-muted/20">Alle Status</Button>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="py-4 font-bold uppercase text-[10px]">Maßnahme / Risiko-Bezug</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Frist / Deadline</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Verantwortung</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Wirksamkeit</TableHead>
              <TableHead className="text-right font-bold uppercase text-[10px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isMeasuresLoading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredMeasures.map((m) => {
              const risk = risks?.find(r => r.id === m.riskId);
              const isOverdue = m.dueDate && new Date(m.dueDate) < new Date() && m.status !== 'completed';
              
              return (
                <TableRow key={m.id} className="hover:bg-muted/5 group border-b last:border-0">
                  <TableCell className="py-4">
                    <div className="font-bold text-sm">{m.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground font-bold uppercase">
                      <ArrowRight className="w-2.5 h-2.5" /> Bezug: {risk?.title || 'Unbekanntes Risiko'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={cn("flex items-center gap-2 text-xs font-bold", isOverdue ? "text-red-600" : "text-slate-600")}>
                      <Calendar className="w-3.5 h-3.5" />
                      {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'Keine Frist'}
                      {isOverdue && <AlertCircle className="w-3 h-3 animate-pulse" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-bold">{m.owner}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={cn("w-2 h-2 rounded-full", i < m.effectiveness ? "bg-emerald-500" : "bg-slate-200")} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Badge variant="outline" className={cn(
                        "rounded-none uppercase text-[8px] font-bold border-none px-2",
                        m.status === 'completed' ? "bg-emerald-50 text-emerald-700" : 
                        m.status === 'active' ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {m.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none w-48">
                          <DropdownMenuItem onSelect={() => openEdit(m)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => handleDeleteMeasure(m.id)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isMeasuresLoading && filteredMeasures.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-20 text-center text-xs text-muted-foreground italic">Keine Maßnahmen gefunden.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Measure Editor Dialog */}
      <Dialog open={isMeasureDialogOpen} onOpenChange={setIsMeasureDialogOpen}>
        <DialogContent className="max-w-2xl rounded-none p-0 flex flex-col border-2 shadow-2xl bg-card">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-5 h-5 text-emerald-500" />
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                {selectedMeasure ? 'Maßnahme bearbeiten' : 'Neue Maßnahme / Kontrolle planen'}
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="p-8 space-y-6 bg-card">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Zugeordnetes Risiko</Label>
              <Select value={riskId} onValueChange={setRiskId}>
                <SelectTrigger className="rounded-none h-10 border-2 bg-background">
                  <SelectValue placeholder={isRisksLoading ? "Lade Risiken..." : "Risiko auswählen..."} />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {filteredRisksForSelection.length > 0 ? (
                    filteredRisksForSelection.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>Keine Risiken verfügbar</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Titel der Maßnahme</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Einführung von 2FA für alle Administrator-Logins" className="rounded-none h-10 font-bold border-2 bg-background" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Verantwortlicher (Implementierung)</Label>
                <Input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Name oder Team" className="rounded-none h-10 border-2 bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Frist (Deadline)</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-none h-10 border-2 bg-background" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="rounded-none h-10 border-2 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="planned">Geplant</SelectItem>
                    <SelectItem value="active">In Umsetzung</SelectItem>
                    <SelectItem value="completed">Abgeschlossen (Wirksam)</SelectItem>
                    <SelectItem value="on_hold">Pausiert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Geplante Wirksamkeit (1-5)</Label>
                <Select value={effectiveness} onValueChange={setEffectiveness}>
                  <SelectTrigger className="rounded-none h-10 border-2 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="1">1 - Sehr Gering</SelectItem>
                    <SelectItem value="2">2 - Gering</SelectItem>
                    <SelectItem value="3">3 - Mittel</SelectItem>
                    <SelectItem value="4">4 - Hoch</SelectItem>
                    <SelectItem value="5">5 - Sehr Hoch (Eliminiert Risiko)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Detailbeschreibung / Schritte</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Welche technischen oder organisatorischen Schritte werden unternommen?" className="rounded-none min-h-[100px] border-2 bg-background" />
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsMeasureDialogOpen(false)} className="rounded-none h-10 px-8">Abbrechen</Button>
            <Button onClick={handleSaveMeasure} disabled={isSaving} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Maßnahme speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
