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
  Download
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

export default function GdprPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  // Modals
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Selection
  const [selectedActivity, setSelectedActivity] = useState<ProcessingActivity | null>(null);
  const [historyBaseId, setHistoryBaseId] = useState<string | null>(null);

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
    
    // Logic: If new version, create new ID but keep originalId
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
      } else throw new Error(res.error || "Fehler beim Speichern");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
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

  const openHistory = (originalId: string) => {
    setHistoryBaseId(originalId);
    setIsHistoryOpen(true);
  };

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    
    // Normal View: Only latest per originalId
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

  const historyEntries = useMemo(() => {
    if (!activities || !historyBaseId) return [];
    return activities
      .filter(a => a.originalId === historyBaseId || a.id === historyBaseId)
      .sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
  }, [activities, historyBaseId]);

  if (!mounted) return null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 flex items-center justify-center border-2 border-emerald-500/20">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Datenschutz Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Verarbeitungsverzeichnis (VVT) gemäß Art. 30 DSGVO.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 font-bold uppercase text-[10px] rounded-none border-primary/20 text-primary bg-primary/5" onClick={() => exportGdprExcel(filteredActivities)}>
            <Download className="w-4 h-4 mr-2" /> Excel Export
          </Button>
          <Button onClick={() => { setSelectedActivity(null); setIsDialogOpen(true); setVersion('1.0'); setResourceIds([]); }} className="h-10 font-bold uppercase text-[10px] rounded-none bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Neue Tätigkeit erfassen
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Aktive Tätigkeiten durchsuchen..." 
          className="pl-10 h-11 border-2 bg-white dark:bg-slate-900 rounded-none shadow-none"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="py-4 font-bold uppercase text-[10px]">Verarbeitungstätigkeit</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Aktuelle Version</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Verantwortlich</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">IT-Systeme</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
              <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredActivities.map((act) => {
              const linkedCount = (act.resourceIds || []).length;
              return (
                <TableRow key={act.id} className="hover:bg-muted/5 group border-b last:border-0">
                  <TableCell className="py-4">
                    <div className="font-bold text-sm">{act.name}</div>
                    <div className="text-[9px] text-muted-foreground uppercase font-black truncate max-w-xs">{act.legalBasis}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-none bg-slate-50 text-slate-600 text-[9px] font-black uppercase border-none h-5 px-2">
                        V{act.version || '1.0'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openHistory(act.originalId || act.id)}>
                        <History className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-bold uppercase">
                    {act.responsibleDepartment}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-blue-500" />
                      <span className="text-xs font-bold">{linkedCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "rounded-none uppercase text-[8px] font-black border-none px-2",
                      act.status === 'active' ? "bg-emerald-50 text-emerald-700" : act.status === 'draft' ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                    )}>
                      {act.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none w-56">
                        <DropdownMenuItem onSelect={() => openEdit(act)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openHistory(act.originalId || act.id)}><History className="w-3.5 h-3.5 mr-2" /> Versionen anzeigen</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onSelect={() => { if(confirm("Eintrag löschen?")) deleteCollectionRecord('processingActivities', act.id, dataSource).then(() => refresh()); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
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
        <DialogContent className="max-w-5xl rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-2xl h-[90vh]">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-3">
                <FileCheck className="w-5 h-5 text-emerald-500" />
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">Verarbeitungstätigkeit bearbeiten</DialogTitle>
              </div>
              <Badge className="bg-emerald-600 border-none rounded-none text-[10px] font-black h-6">Version {version}</Badge>
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="base" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b bg-slate-50 shrink-0">
              <TabsList className="h-12 bg-transparent gap-6 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase">1. Allgemein</TabsTrigger>
                <TabsTrigger value="systems" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent h-full px-4 text-[10px] font-bold uppercase">2. IT-Systeme Zuordnung</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-white">
              <div className="p-8">
                <TabsContent value="base" className="mt-0 space-y-8">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2 col-span-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Name der Tätigkeit</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Lohnabrechnung durchführen" className="rounded-none h-10 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-blue-500" /> Version
                      </Label>
                      <Input value={version} disabled className="rounded-none h-10 font-mono bg-muted/20" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beschreibung des Prozesses</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Was genau passiert hier?" className="rounded-none min-h-[80px]" />
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-6 border-t">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Verantwortliche Abteilung</Label>
                      <Input value={responsibleDepartment} onChange={e => setResponsibleDepartment(e.target.value)} className="rounded-none h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Rechtsgrundlage</Label>
                      <Select value={legalBasis} onValueChange={setLegalBasis}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="Art. 6 Abs. 1 lit. a (Einwilligung)">Einwilligung</SelectItem>
                          <SelectItem value="Art. 6 Abs. 1 lit. b (Vertrag)">Vertragserfüllung</SelectItem>
                          <SelectItem value="Art. 6 Abs. 1 lit. c (Rechtl. Verpflichtung)">Rechtliche Verpflichtung</SelectItem>
                          <SelectItem value="Art. 6 Abs. 1 lit. f (Berechtigte Interessen)">Berechtigte Interessen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Löschfrist / Aufbewahrung</Label>
                      <Input value={retentionPeriod} onChange={e => setRetentionPeriod(e.target.value)} className="rounded-none h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Status</Label>
                      <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                        <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="draft">Entwurf</SelectItem>
                          <SelectItem value="active">Aktiv</SelectItem>
                          <SelectItem value="archived">Archiviert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="systems" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-[10px] font-bold uppercase text-blue-600 flex items-center gap-2">
                        <Layers className="w-4 h-4" /> IT-Systeme Zuordnung ({resourceIds.length} gewählt)
                      </Label>
                      <p className="text-[9px] text-muted-foreground italic mt-1">Wählen Sie alle IT-Systeme aus dem Ressourcenkatalog aus, die in diesem Prozess Daten verarbeiten.</p>
                    </div>
                  </div>

                  <div className="border bg-slate-50 p-4 rounded-none min-h-[300px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {resources?.filter(r => activeTenantId === 'all' || r.tenantId === activeTenantId || r.tenantId === 'global').map(res => {
                        const isSelected = resourceIds.includes(res.id);
                        return (
                          <div 
                            key={res.id} 
                            className={cn(
                              "flex items-start gap-3 p-3 bg-white border cursor-pointer transition-all hover:border-emerald-500 hover:shadow-sm",
                              isSelected ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500" : "border-slate-200"
                            )}
                            onClick={() => {
                              setResourceIds(prev => isSelected ? prev.filter(id => id !== res.id) : [...prev, res.id]);
                            }}
                          >
                            <Checkbox checked={isSelected} className="mt-0.5 rounded-none" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{res.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[8px] font-black uppercase rounded-none h-4 px-1">{res.assetType}</Badge>
                                <span className="text-[8px] text-muted-foreground uppercase">{res.operatingModel}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {(!resources || resources.length === 0) && (
                        <div className="col-span-2 py-20 text-center space-y-4">
                          <Layers className="w-10 h-10 text-slate-200 mx-auto" />
                          <p className="text-xs font-bold text-muted-foreground uppercase">Keine IT-Systeme im Katalog gefunden.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0 flex items-center justify-between">
            <div className="flex gap-2">
              {selectedActivity && (
                <Button 
                  variant="outline" 
                  onClick={() => handleSave(true)} 
                  disabled={isSaving} 
                  className="rounded-none h-10 px-6 font-bold uppercase text-[10px] gap-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                >
                  <Copy className="w-3.5 h-3.5" /> Neue Version erstellen
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
              <Button onClick={() => handleSave(false)} disabled={isSaving || !name} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4" />} Speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Sheet / Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-4xl rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-2xl h-[70vh]">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-emerald-500" />
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">Versionsverlauf</DialogTitle>
                <DialogDescription className="text-slate-400 text-[10px] uppercase font-bold">Chronologische Liste aller Revisionen</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-slate-50">
            <div className="p-6">
              <div className="space-y-4">
                {historyEntries.map((entry, idx) => (
                  <div key={entry.id} className="bg-white border rounded-none p-4 flex items-center justify-between group">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
                        #{historyEntries.length - idx}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{entry.name}</span>
                          <Badge className="rounded-none bg-slate-900 text-white text-[9px] font-black h-5">V{entry.version}</Badge>
                          {idx === 0 && <Badge className="bg-emerald-600 text-white rounded-none text-[8px] h-4">AKTUELL</Badge>}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Geändert: {new Date(entry.lastReviewDate).toLocaleDateString()}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Status: {entry.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[9px] font-black uppercase gap-2 hover:bg-emerald-50"
                      onClick={() => { setIsHistoryOpen(false); openEdit(entry); }}
                    >
                      <Eye className="w-3.5 h-3.5" /> Details anzeigen
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-4 bg-white border-t">
            <Button onClick={() => setIsHistoryOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Fenster Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
