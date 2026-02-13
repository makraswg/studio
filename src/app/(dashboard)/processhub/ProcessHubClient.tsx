"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Search, 
  Plus, 
  Workflow, 
  Loader2, 
  ChevronRight, 
  Clock,
  Tag,
  MoreVertical,
  Trash2,
  AlertTriangle,
  Network,
  Filter,
  Layers,
  Eye,
  FileEdit,
  Activity,
  Zap,
  Building2,
  Info,
  ShieldAlert,
  FileDown,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { createProcessAction, deleteProcessAction } from '@/app/actions/process-actions';
import { usePlatformAuth } from '@/context/auth-context';
import { toast } from '@/hooks/use-toast';
import { Process, ProcessVersion, Department, Tenant, JobTitle, Resource, Feature } from '@/lib/types';
import { cn } from '@/lib/utils';
import { calculateProcessMaturity } from '@/lib/process-utils';
import { exportProcessManualPdf } from '@/lib/export-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function ProcessHubClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportOnlyPublished, setExportOnlyPublished] = useState(true);
  const [isExportingManual, setIsExportingManual] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<string | null>(null);

  const { data: processes, isLoading, refresh } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: media } = usePluggableCollection<any>('media');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');

  useEffect(() => { setMounted(true); }, []);

  const handleCreate = async () => {
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    
    if (!user) {
      toast({ variant: "destructive", title: "Fehler", description: "Keine aktive Sitzung gefunden." });
      return;
    }

    setIsCreating(true);
    try {
      const res = await createProcessAction(targetTenantId, "Neuer Prozess", '', dataSource);
      if (res.success) {
        toast({ title: "Prozess angelegt" });
        router.push(`/processhub/${res.processId}`);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsCreating(false);
    }
  };

  const executeExportManual = async () => {
    if (!processes || !versions || !tenants || !departments || !jobTitles) return;
    setIsExportingManual(true);
    setIsExportDialogOpen(false);
    try {
      const tenant = tenants.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId)) || tenants[0];
      const targetProcesses = exportOnlyPublished 
        ? processes.filter(p => p.status === 'published' && (activeTenantId === 'all' || p.tenantId === activeTenantId))
        : processes.filter(p => (activeTenantId === 'all' || p.tenantId === activeTenantId));
      
      if (targetProcesses.length === 0) {
        toast({ variant: "destructive", title: "Export nicht möglich", description: "Keine passenden Prozesse für den Export gefunden." });
        return;
      }

      await exportProcessManualPdf(
        targetProcesses, 
        versions, 
        tenant, 
        departments, 
        jobTitles,
        resources || [],
        allFeatures || []
      );
      toast({ title: "Handbuch generiert", description: "Alle selektierten Prozesse wurden exportiert." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export Fehler", description: e.message });
    } finally {
      setIsExportingManual(false);
    }
  };

  const handleDelete = async () => {
    if (!processToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteProcessAction(processToDelete, dataSource);
      if (res.success) {
        toast({ title: "Prozess gelöscht" });
        refresh();
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsDeleting(false);
      setProcessToDelete(null);
    }
  };

  const filtered = useMemo(() => {
    if (!processes) return [];
    return processes.filter(p => {
      if (p.process_type_id === 'pt-disaster') return false;
      const matchesTenant = activeTenantId === 'all' || p.tenantId === activeTenantId;
      const matchesSearch = (p.title || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesDept = deptFilter === 'all' || p.responsibleDepartmentId === deptFilter;
      return matchesTenant && matchesSearch && matchesStatus && matchesDept;
    });
  }, [processes, search, statusFilter, deptFilter, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-10 w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none uppercase tracking-widest">WorkflowHub</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Prozessübersicht</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Strukturierte Geschäftsprozesse, Qualitätsmonitoring und Reifegrad.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-lg font-bold text-[11px] px-4 border-slate-200 hover:bg-emerald-50 text-emerald-600 transition-all active:scale-95 shadow-sm" onClick={() => setIsExportDialogOpen(true)} disabled={isExportingManual}>
            {isExportingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <FileDown className="w-3.5 h-3.5 mr-2" />} Handbuch generieren
          </Button>
          <Button variant="outline" size="sm" className="h-9 rounded-lg font-bold text-[11px] px-4 border-slate-200 hover:bg-blue-50 text-blue-600 transition-all active:scale-95 shadow-sm" onClick={() => router.push('/processhub/map')}>
            <Network className="w-3.5 h-3.5 mr-2" /> Prozesslandkarte
          </Button>
          <Button size="sm" className="h-9 rounded-lg font-bold text-[11px] px-6 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-95" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
            Prozess anlegen
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Prozess suchen..." 
            className="pl-9 h-9 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-none shadow-none h-full rounded-sm bg-transparent text-[10px] font-bold min-w-[120px]">
              <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Alle Status</SelectItem>
              <SelectItem value="draft" className="text-xs">Entwurf</SelectItem>
              <SelectItem value="published" className="text-xs">Freigegeben</SelectItem>
              <SelectItem value="archived" className="text-xs">Archiv</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 my-auto mx-1" />
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="border-none shadow-none h-full rounded-sm bg-transparent text-[10px] font-bold min-w-[140px]">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Abteilung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Alle Abteilungen</SelectItem>
              {departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(d => (
                <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            <p className="text-[11px] font-bold text-slate-400">Lade WorkflowHub...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-dashed border-slate-200 opacity-50">
              <Layers className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-xs font-bold text-slate-400">Keine Prozesse gefunden</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Bezeichnung</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Abteilung</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Reifegrad</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 text-center">Status</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Geändert</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const version = versions?.find(v => v.process_id === p.id && v.version === p.currentVersion);
                const pMedia = media?.filter((m: any) => m.entityId === p.id).length || 0;
                const maturity = calculateProcessMaturity(p, version, pMedia);
                const dept = departments?.find(d => d.id === p.responsibleDepartmentId);
                const hasEmergencyFallback = !!p.emergencyProcessId && p.emergencyProcessId !== 'none';

                return (
                  <TableRow key={p.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner border border-slate-200">
                          <Workflow className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors">{p.title}</div>
                            {hasEmergencyFallback && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="p-1 rounded-md bg-red-50 text-red-600 animate-pulse">
                                      <ShieldAlert className="w-3 h-3" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-red-600 text-white font-bold text-[10px] uppercase border-none shadow-xl">
                                    Notfallprozess (BCM) hinterlegt
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 mt-0.5">
                            <Tag className="w-2.5 h-2.5" /> {p.tags || 'Standard'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                        <Building2 className="w-3.5 h-3.5 text-slate-300" /> {dept?.name || '---'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="w-full max-w-[140px] space-y-1.5 mx-auto">
                              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-tighter">
                                <span className="text-primary">{maturity.levelLabel}</span>
                                <span className="text-slate-400">{maturity.totalPercent}%</span>
                              </div>
                              <Progress value={maturity.totalPercent} className="h-1.5 rounded-full bg-slate-100" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="p-3 max-w-[200px] rounded-xl border-none shadow-2xl bg-slate-900 text-white">
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Zap className="w-3 h-3 fill-current" /> Maturity Details
                              </p>
                              <div className="space-y-1">
                                {maturity.dimensions.map(d => (
                                  <div key={d.name} className="flex items-center justify-between text-[8px] font-bold uppercase">
                                    <span className="text-slate-400">{d.name}</span>
                                    <span className={d.status === 'complete' ? 'text-emerald-400' : 'text-amber-400'}>
                                      {d.score}/{d.maxScore}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn(
                        "rounded-full text-[9px] font-bold px-2 h-5 border-none",
                        p.status === 'published' ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      )}>{p.status.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <Clock className="w-3.5 h-3.5 opacity-50" /> 
                        {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '---'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => { e.stopPropagation(); router.push(`/processhub/view/${p.id}`); }}>
                          <Eye className="w-4 h-4 text-slate-400" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 transition-all" onClick={e => e.stopPropagation()}><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 shadow-xl border">
                            <DropdownMenuItem className="rounded-lg py-2 gap-2 text-xs font-bold" onSelect={() => router.push(`/processhub/view/${p.id}`)}><Eye className="w-3.5 h-3.5 text-emerald-600" /> Prozess ansehen</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg py-2 gap-2 text-xs font-bold" onSelect={() => router.push(`/processhub/${p.id}`)}><FileEdit className="w-3.5 h-3.5 text-primary" /> Designer öffnen</DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem className="text-red-600 rounded-lg py-2 gap-2 text-xs font-bold" onSelect={() => setProcessToDelete(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" /> Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Export Options Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 border border-white/10 shadow-lg">
                <FileDown className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-headline font-bold uppercase tracking-tight">Handbuch Export</DialogTitle>
                <DialogDescription className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">Konfiguration der Prozess-Dokumentation</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-slate-900">Nur freigegebene Prozesse</Label>
                <p className="text-[10px] text-slate-400 font-medium italic">Filtert Entwürfe und Archiv aus.</p>
              </div>
              <Switch checked={exportOnlyPublished} onCheckedChange={setExportOnlyPublished} />
            </div>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 shadow-sm">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                Der Export generiert ein vollständiges PDF inklusive Deckblatt, Inhaltsverzeichnis, grafischer Landkarte und operativem Leitfaden.
              </p>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsExportDialogOpen(false)} className="rounded-xl font-bold text-[10px] px-8 uppercase">Abbrechen</Button>
            <Button onClick={executeExportManual} disabled={isExportingManual} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-12 h-11 shadow-lg gap-2 uppercase">
              {isExportingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Export starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!processToDelete} onOpenChange={val => !val && setProcessToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-headline font-bold text-red-600 text-center">Prozess permanent löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 font-medium leading-relaxed pt-2 text-center">
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Versionen dieses Prozesses werden unwiderruflich entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 gap-3 sm:justify-center">
            <AlertDialogCancel className="rounded-lg font-bold text-xs h-11 px-8 border-slate-200">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs h-11 px-10 gap-2 shadow-lg shadow-red-200" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
