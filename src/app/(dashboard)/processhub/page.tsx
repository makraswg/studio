
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
  AlertTriangle
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
  DropdownMenuTrigger
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
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center border-2 border-primary/20">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">ProcessHub</h1>
            <p className="text-sm text-muted-foreground mt-1">Strukturierte Geschäftsprozesse & Visualisierung.</p>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={isCreating} className="h-10 font-bold uppercase text-[10px] rounded-none px-6">
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Neuer Prozess
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Nach Prozessen suchen..." 
          className="pl-10 h-11 border-2 bg-white rounded-none shadow-none"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-4 font-bold uppercase text-[10px]">Bezeichnung</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Version</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Änderung</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/5 border-b cursor-pointer" onClick={() => router.push(`/processhub/${p.id}`)}>
                  <TableCell className="py-4">
                    <div className="font-bold text-sm">{p.title}</div>
                    <div className="text-[9px] text-muted-foreground uppercase flex items-center gap-2 mt-1">
                      <Tag className="w-2.5 h-2.5" /> {p.tags || 'Keine Tags'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "rounded-none text-[8px] font-black uppercase px-2",
                      p.status === 'published' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600"
                    )}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-bold">V{p.currentVersion}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <Clock className="w-2.5 h-2.5" /> {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/processhub/${p.id}`)}><ChevronRight className="w-4 h-4" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none">
                          <DropdownMenuItem className="text-red-600" onSelect={() => setProcessToDelete(p.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-20 text-center text-xs text-muted-foreground italic">Keine Prozesse gefunden.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!processToDelete} onOpenChange={val => !val && setProcessToDelete(null)}>
        <AlertDialogContent className="rounded-none border-2 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 uppercase font-black tracking-wider text-sm">
              <AlertTriangle className="w-5 h-5" /> Prozess löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium leading-relaxed">
              Sind Sie sicher? Diese Aktion löscht den gesamten Prozess inklusive aller Versionen und grafischen Daten permanent. Dies kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none uppercase text-[10px] font-bold">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 rounded-none text-[10px] font-bold uppercase" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
              Prozess permanent löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
