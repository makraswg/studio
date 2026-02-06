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
import { AiFormAssistant } from '@/components/ai/form-assistant';

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
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 flex items-center justify-center border-2 border-emerald-500/20"><FileCheck className="w-6 h-6" /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase">Datenschutz Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Verarbeitungsverzeichnis (VVT) gemäß Art. 30 DSGVO.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 font-bold uppercase text-[10px] rounded-none border-primary/20 text-primary bg-primary/5" onClick={() => exportGdprExcel(filteredActivities)}>
            <Download className="w-4 h-4 mr-2" /> Excel Export
          </Button>
          <Button onClick={() => { setSelectedActivity(null); setIsDialogOpen(true); setVersion('1.0'); setResourceIds([]); }} className="h-10 font-bold uppercase text-[10px] rounded-none bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Neue Tätigkeit
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Suchen..." className="pl-10 h-11 border-2 bg-white rounded-none" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="py-4 font-bold uppercase text-[10px]">Tätigkeit</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Version</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Abteilung</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
              <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredActivities.map((act) => (
              <TableRow key={act.id} className="hover:bg-muted/5 border-b last:border-0">
                <TableCell className="py-4"><div className="font-bold text-sm">{act.name}</div><div className="text-[9px] text-muted-foreground uppercase">{act.legalBasis}</div></TableCell>
                <TableCell><Badge variant="outline" className="rounded-none bg-slate-50 text-slate-600 text-[9px] font-black h-5">V{act.version}</Badge></TableCell>
                <TableCell className="text-xs font-bold uppercase">{act.responsibleDepartment}</TableCell>
                <TableCell><Badge variant="outline" className="rounded-none uppercase text-[8px] font-black">{act.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-none w-56">
                      <DropdownMenuItem onSelect={() => openEdit(act)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onSelect={() => { if(confirm("Eintrag löschen?")) deleteCollectionRecord('processingActivities', act.id, dataSource).then(() => refresh()); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
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
              <AiFormAssistant 
                formType="gdpr" 
                currentData={{ name, description, responsibleDepartment, legalBasis, retentionPeriod, status }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b bg-slate-50 shrink-0">
              <TabsList className="h-12 bg-transparent gap-6 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 h-full px-4 text-[10px] font-bold uppercase">Allgemein</TabsTrigger>
                <TabsTrigger value="systems" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 h-full px-4 text-[10px] font-bold uppercase">IT-Systeme</TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="flex-1 bg-white">
              <div className="p-8">
                <TabsContent value="base" className="mt-0 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-2"><Label className="text-[10px] font-bold uppercase">Bezeichnung</Label><Input value={name} onChange={e => setName(e.target.value)} className="rounded-none h-10 font-bold" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Abteilung</Label><Input value={responsibleDepartment} onChange={e => setResponsibleDepartment(e.target.value)} className="rounded-none h-10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Rechtsgrundlage</Label><Select value={legalBasis} onValueChange={setLegalBasis}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="Art. 6 Abs. 1 lit. a (Einwilligung)">Einwilligung</SelectItem><SelectItem value="Art. 6 Abs. 1 lit. b (Vertrag)">Vertragserfüllung</SelectItem><SelectItem value="Art. 6 Abs. 1 lit. f (Berechtigtes Interesse)">Berechtigtes Interesse</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Löschfrist</Label><Input value={retentionPeriod} onChange={e => setRetentionPeriod(e.target.value)} className="rounded-none h-10" /></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Beschreibung</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-none h-32" /></div>
                </TabsContent>
                <TabsContent value="systems" className="mt-0">
                  <Label className="text-[10px] font-bold uppercase mb-4 block">Zugeordnete IT-Systeme</Label>
                  <div className="grid grid-cols-2 gap-2 border p-4 bg-slate-50">
                    {resources?.map(res => (
                      <div key={res.id} className={cn("flex items-center gap-3 p-2 bg-white border cursor-pointer", resourceIds.includes(res.id) && "border-emerald-500 bg-emerald-50")} onClick={() => setResourceIds(prev => resourceIds.includes(res.id) ? prev.filter(id => id !== res.id) : [...prev, res.id])}>
                        <Checkbox checked={resourceIds.includes(res.id)} className="rounded-none" />
                        <span className="text-xs font-bold">{res.name}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={() => handleSave(false)} disabled={isSaving || !name} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
