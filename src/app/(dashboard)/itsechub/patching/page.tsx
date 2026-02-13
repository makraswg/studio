
"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Loader2, 
  RefreshCw, 
  Search, 
  Filter, 
  ShieldCheck, 
  AlertTriangle, 
  Workflow, 
  Clock, 
  ChevronRight, 
  Layers,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
  Info,
  BadgeCheck,
  ClipboardList,
  Save,
  Cpu
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Resource, Process, ResourceUpdateProcess, Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';

export default function PatchingMonitorPage() {
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState('all');

  const { data: resources, isLoading: isResLoading } = usePluggableCollection<Resource>('resources');
  const { data: updateLinks } = usePluggableCollection<ResourceUpdateProcess>('resource_update_processes');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: tasks } = usePluggableCollection<Task>('tasks');

  useEffect(() => { setMounted(true); }, []);

  const patchData = useMemo(() => {
    if (!resources) return [];
    
    return resources.filter(res => {
      const isGlobal = res.tenantId === 'global' || !res.tenantId;
      const matchesTenant = activeTenantId === 'all' || isGlobal || res.tenantId === activeTenantId;
      const requiresUpdates = !!(res.updatesRequired === true || res.updatesRequired === 1);
      const matchesSearch = res.name.toLowerCase().includes(search.toLowerCase());
      const matchesCrit = criticalityFilter === 'all' || res.criticality === criticalityFilter;
      
      return matchesTenant && requiresUpdates && matchesSearch && matchesCrit && res.status !== 'archived';
    }).map(res => {
      const linkedUpdates = updateLinks?.filter(l => l.resourceId === res.id).map(l => processes?.find(p => p.id === l.processId)).filter(Boolean) || [];
      const resTasks = tasks?.filter(t => t.entityId === res.id && t.entityType === 'resource' && (t.title.toLowerCase().includes('patch') || t.title.toLowerCase().includes('update')));
      const openTasks = resTasks?.filter(t => t.status !== 'done') || [];
      
      return {
        ...res,
        linkedUpdates,
        openTasksCount: openTasks.length,
        status: openTasks.length > 0 ? 'pending' : 'up-to-date'
      };
    });
  }, [resources, updateLinks, processes, tasks, search, criticalityFilter, activeTenantId]);

  const stats = useMemo(() => {
    const total = patchData.length;
    const pending = patchData.filter(d => d.status === 'pending').length;
    const secure = total - pending;
    const percent = total > 0 ? Math.floor((secure * 100) / total) : 100;
    
    return { total, pending, secure, percent };
  }, [patchData]);

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-600 flex items-center justify-center rounded-xl border border-blue-500/10 shadow-sm">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-blue-100 text-blue-700 text-[9px] font-bold border-none uppercase tracking-widest">ITSecHub / Vulnerability</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Patching & Version Monitor</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Überwachung kritischer Softwarestände und Patch-Workflows.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold text-[10px] uppercase gap-2 border-slate-200">
            <RefreshCw className="w-3.5 h-3.5" /> Scan anfordern
          </Button>
          <Button size="sm" className="h-9 rounded-xl font-bold text-[10px] uppercase gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg active:scale-95 transition-all">
            <ShieldCheck className="w-3.5 h-3.5" /> Audit-Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-2 border-blue-500/20 shadow-sm bg-white overflow-hidden relative group">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 shadow-sm">
                <BadgeCheck className="w-6 h-6" />
              </div>
              <Badge variant="outline" className="text-blue-600 border-blue-200 font-black text-[9px] uppercase tracking-widest">Patch Integrity</Badge>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-black text-slate-900">{stats.percent}%</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System-Absicherung</p>
            </div>
            <div className="space-y-3">
              <Progress value={stats.percent} className="h-2 bg-slate-100" />
              <p className="text-[9px] text-slate-400 italic">Anteil der Systeme ohne offene Patch-Aufgaben.</p>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden group hover:border-orange-200 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Offene Updates</p>
                <h3 className={cn("text-2xl font-black", stats.pending > 0 ? "text-orange-600" : "text-slate-900")}>{stats.pending}</h3>
                <div className="flex items-center gap-1.5 text-[9px] text-orange-600 font-bold uppercase mt-1">
                  <Clock className="w-3 h-3" /> Fällige Wartung
                </div>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 shadow-inner group-hover:rotate-3 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden group hover:border-blue-200 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Überwachte Assets</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.total}</h3>
                <p className="text-[9px] text-slate-500 font-medium italic">Mit Patch-Bedarf</p>
              </div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shadow-inner group-hover:text-blue-600 transition-colors">
                <Server className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border shadow-xl overflow-hidden flex flex-col">
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <Input 
              placeholder="IT-System suchen..." 
              className="pl-10 h-11 rounded-xl bg-white border-slate-200 shadow-none focus:ring-blue-500/20"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
              <SelectTrigger className="h-11 w-44 rounded-xl bg-white border-slate-200 text-xs font-bold uppercase tracking-widest shadow-sm">
                <Filter className="w-3.5 h-3.5 mr-2 text-slate-400" />
                <SelectValue placeholder="Kritikalität" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Alle Kritikalitäten</SelectItem>
                <SelectItem value="high">Hoch (Kritisch)</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="py-4 px-8 text-[10px] font-black uppercase tracking-widest text-slate-400">IT-System / Plattform</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Patch-Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Kritikalität</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Update-Workflow (Leitfaden)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aufgaben</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isResLoading ? (
                <TableRow><TableCell colSpan={5} className="h-40 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 opacity-20" /></TableCell></TableRow>
              ) : patchData.map(item => (
                <TableRow key={item.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer" onClick={() => router.push(`/resources/${item.id}`)}>
                  <TableCell className="py-5 px-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center text-blue-600 shadow-sm border-blue-100"><Cpu className="w-5 h-5" /></div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5 mt-0.5"><Layers className="w-3 h-3 opacity-50" /> {item.assetType}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn(
                      "rounded-full text-[9px] font-black uppercase px-3 h-5 border-none shadow-sm",
                      item.status === 'up-to-date' ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
                    )}>
                      {item.status === 'up-to-date' ? 'Vollständig' : 'Wartung fällig'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "rounded-md text-[9px] font-black h-5 px-2 border-none uppercase shadow-sm",
                      item.criticality === 'high' ? "bg-red-600 text-white" : item.criticality === 'medium' ? "bg-orange-500 text-white" : "bg-emerald-500 text-white"
                    )}>
                      {item.criticality}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {item.linkedUpdates.length > 0 ? item.linkedUpdates.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-2 text-primary hover:underline font-bold text-[10px]" onClick={(e) => { e.stopPropagation(); router.push(`/processhub/view/${p.id}`); }}>
                          <Workflow className="w-3 h-3" /> {p.title}
                        </div>
                      )) : <span className="text-[10px] text-slate-300 italic">Kein Prozess verknüpft</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-8">
                    <div className="flex justify-end">
                      {item.openTasksCount > 0 ? (
                        <button 
                          className="flex items-center gap-2 px-2 py-1 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                          onClick={(e) => { e.stopPropagation(); router.push(`/tasks?search=${item.name}`); }}
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black">{item.openTasksCount} offen</span>
                        </button>
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 opacity-20" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {patchData.length === 0 && !isResLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-24 text-center opacity-30 italic text-xs uppercase tracking-widest">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
                    System-Integrität bestätigt
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-xl flex flex-col md:flex-row items-center gap-8 border-l-8 border-blue-500">
        <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center shrink-0">
          <Info className="w-8 h-8 text-blue-400" />
        </div>
        <div className="space-y-2 text-center md:text-left">
          <h4 className="text-lg font-headline font-bold uppercase tracking-tight">Vulnerability Management</h4>
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            Dieses Cockpit zeigt alle Systeme, für die in den Stammdaten ein Patch-Bedarf aktiviert wurde. 
            Verknüpfen Sie IT-Systeme mit <strong>Update-Prozessen</strong> im Ressourcenkatalog, um hier den operativen Leitfaden anzuzeigen.
          </p>
        </div>
      </div>
    </div>
  );
}
