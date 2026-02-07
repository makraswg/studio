"use client";

import { useState, useMemo, useEffect } from 'react';
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
  Layers
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { useRouter } from 'next/navigation';
import { createProcessAction, deleteProcessAction } from '@/app/actions/process-actions';
import { usePlatformAuth } from '@/context/auth-context';
import { toast } from '@/hooks/use-toast';
import { Process } from '@/lib/types';
import { cn } from '@/lib/utils';
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

export default function ProcessHubOverview() {
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [processToDelete, setProcessToDelete] = useState<string | null>(null);

  const { data: processes, isLoading, refresh } = usePluggableCollection<Process>('processes');

  useEffect(() => { setMounted(true); }, []);

  const handleCreate = async () => {
    if (!user || activeTenantId === 'all') {
      toast({ variant: "destructive", title: "Fehler", description: "Wählen Sie einen Mandanten aus (oben rechts)." });
      return;
    }
    setIsCreating(true);
    try {
      const res = await createProcessAction(activeTenantId, "Neuer Prozess", user.id, dataSource);
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
      const matchesTenant = activeTenantId === 'all' || p.tenantId === activeTenantId;
      const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
      return matchesTenant && matchesSearch;
    });
  }, [processes, search, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-lg border shadow-sm">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">Workflow Engine</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase">ProcessHub</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Strukturierte Geschäftsprozesse & ISO 9001 Dokumentation.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold uppercase text-[9px] tracking-wider px-4 border-blue-200 text-blue-700 bg-blue-50 transition-all" onClick={() => router.push('/processhub/map')}>
            <Network className="w-3.5 h-3.5 mr-2" /> Prozesslandkarte
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={isCreating} className="h-9 rounded-md font-bold uppercase text-[10px] tracking-wider px-6 bg-primary hover:bg-primary/90 text-white shadow-sm transition-all">
            {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
            Prozess anlegen
          </Button>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Nach Prozessen suchen..." 
          className="pl-9 h-12 rounded-xl border-slate-200 bg-white shadow-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Katalog wird geladen...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mx-auto opacity-50 border border-dashed border-slate-200">
              <Layers className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-xs font-bold uppercase text-slate-400">Keine Prozesse gefunden.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold uppercase tracking-widest text-[9px] text-slate-400">Bezeichnung</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[9px] text-slate-400">Status</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[9px] text-slate-400">Version</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[9px] text-slate-400">Änderung</TableHead>
                <TableHead className="text-right px-6 font-bold uppercase tracking-widest text-[9px] text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer" onClick={() => router.push(`/processhub/${p.id}`)}>
                  <TableCell className="py-4 px-6">
                    <div>
                      <div className="font-bold text-xs text-slate-800 group-hover:text-primary transition-colors">{p.title}</div>
                      <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                        <Tag className="w-2.5 h-2.5" /> {p.tags || 'Keine Tags'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "rounded-full text-[8px] font-black uppercase px-2 h-5 border-none",
                      p.status === 'published' ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"
                    )}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] font-black text-slate-700">V{p.currentVersion}.0</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                      <Clock className="w-3 h-3 opacity-50" /> 
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-all" onClick={() => router.push(`/processhub/${p.id}`)}>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 transition-all"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-xl border">
                          <DropdownMenuItem className="rounded-md py-2 gap-2 text-xs font-bold" onSelect={() => router.push(`/processhub/${p.id}`)}><Workflow className="w-3.5 h-3.5" /> Designer</DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem className="text-red-600 rounded-md py-2 gap-2 text-xs font-bold" onSelect={() => setProcessToDelete(p.id)}>
                            <Trash2 className="w-3.5 h-3.5" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!processToDelete} onOpenChange={val => !val && setProcessToDelete(null)}>
        <AlertDialogContent className="rounded-xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-headline font-bold text-red-600 uppercase tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" /> Prozess löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 font-medium leading-relaxed pt-1">
              Dies löscht den Prozess und alle Revisionen permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel className="rounded-md font-bold uppercase text-[9px] h-10 px-6">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 rounded-md font-black uppercase text-[9px] h-10 px-8" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
