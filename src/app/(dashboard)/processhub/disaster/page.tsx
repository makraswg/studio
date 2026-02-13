
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  FlameKindling
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { createProcessAction, deleteProcessAction } from '@/app/actions/process-actions';
import { usePlatformAuth } from '@/context/auth-context';
import { toast } from '@/hooks/use-toast';
import { Process, ProcessVersion, Department } from '@/lib/types';
import { cn } from '@/lib/utils';
import { calculateProcessMaturity } from '@/lib/process-utils';
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
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DisasterProcessesPage() {
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<string | null>(null);

  const { data: processes, isLoading, refresh } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: media } = usePluggableCollection<any>('media');
  const { data: departments } = usePluggableCollection<Department>('departments');

  useEffect(() => { setMounted(true); }, []);

  const handleCreate = async () => {
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    
    if (!user) {
      toast({ variant: "destructive", title: "Fehler", description: "Keine aktive Sitzung gefunden." });
      return;
    }

    setIsCreating(true);
    try {
      // Create a process with pt-disaster type
      const res = await createProcessAction(targetTenantId, "Neuer Notfallprozess", '', dataSource);
      if (res.success) {
        // Important: Immediately set the process type to disaster
        const { updateProcessMetadataAction } = await import('@/app/actions/process-actions');
        await updateProcessMetadataAction(res.processId, { process_type_id: 'pt-disaster' }, dataSource);
        
        toast({ title: "Notfallprozess angelegt" });
        router.push(`/processhub/${res.processId}`);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!processToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteProcessAction(processToDelete, dataSource);
      if (res.success) {
        toast({ title: "Notfallprozess gelöscht" });
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
      // Nur Notfallprozesse anzeigen
      if (p.process_type_id !== 'pt-disaster') return false;

      const matchesTenant = activeTenantId === 'all' || p.tenantId === activeTenantId;
      const matchesSearch = (p.title || '').toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === 'all' || p.responsibleDepartmentId === deptFilter;
      return matchesTenant && matchesSearch && matchesDept;
    });
  }, [processes, search, deptFilter, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-10 w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-red-100 text-red-700 text-[9px] font-bold border-none uppercase tracking-widest">Business Continuity (BCM)</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Notfallprozesse</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Rückfall-Workflows für den Ernstfall (Desaster Recovery).</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-lg font-bold text-[11px] px-4 border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm" onClick={() => router.push('/processhub')}>
            <ChevronRight className="w-3.5 h-3.5 mr-2 rotate-180" /> Standardprozesse
          </Button>
          <Button size="sm" className="h-9 rounded-lg font-bold text-[11px] px-6 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 transition-all active:scale-95" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
            Notfallplan erstellen
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-red-600 transition-colors" />
          <Input 
            placeholder="Notfallplan suchen..." 
            className="pl-9 h-9 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 h-9 shrink-0">
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
            <Loader2 className="w-8 h-8 animate-spin text-red-600 opacity-20" />
            <p className="text-[11px] font-bold text-slate-400">Lade Notfallpläne...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-dashed border-slate-200 opacity-50">
              <ShieldAlert className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Keine Notfallprozesse definiert</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Szenario / Plan</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Abteilung</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Reifegrad</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 text-center">Status</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const version = versions?.find(v => v.process_id === p.id && v.version === p.currentVersion);
                const pMedia = media?.filter((m: any) => m.entityId === p.id).length || 0;
                const maturity = calculateProcessMaturity(p, version, pMedia);
                const dept = departments?.find(d => d.id === p.responsibleDepartmentId);

                return (
                  <TableRow key={p.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shadow-inner border border-red-100">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800 group-hover:text-red-600 transition-colors">{p.title}</div>
                          <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1.5 mt-0.5 uppercase tracking-widest">
                            <Clock className="w-2.5 h-2.5" /> Rev. {version?.revision || 0}
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
                      <div className="w-full max-w-[140px] space-y-1.5 mx-auto">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-tighter">
                          <span className="text-red-600">{maturity.totalPercent}%</span>
                        </div>
                        <Progress value={maturity.totalPercent} className="h-1 rounded-full bg-slate-100" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "rounded-full text-[9px] font-black px-2 h-5 border-none",
                        p.status === 'published' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                      )}>{p.status.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-right px-6" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white shadow-sm" onClick={() => router.push(`/processhub/${p.id}`)}>
                          <FileEdit className="w-4 h-4 text-red-600" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 transition-all" onClick={e => e.stopPropagation()}><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 shadow-xl border">
                            <DropdownMenuItem className="rounded-lg py-2 gap-2 text-xs font-bold" onSelect={() => router.push(`/processhub/view/${p.id}`)}><Eye className="w-3.5 h-3.5 text-primary" /> Ansehen</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg py-2 gap-2 text-xs font-bold" onSelect={() => router.push(`/processhub/${p.id}`)}><FileEdit className="w-3.5 h-3.5 text-primary" /> Designer</DropdownMenuItem>
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

      <AlertDialog open={!!processToDelete} onOpenChange={val => !val && setProcessToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-headline font-bold text-red-600 text-center uppercase">Notfallplan löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 font-medium leading-relaxed pt-2 text-center">
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Verknüpfungen in den Standardprozessen werden ungültig.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 gap-3 sm:justify-center">
            <AlertDialogCancel className="rounded-lg font-bold text-xs h-11 px-8">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs h-11 px-10 gap-2 shadow-lg" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
