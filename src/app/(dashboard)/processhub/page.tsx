
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
  Calendar, 
  User as UserIcon,
  Tag,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileCode,
  Globe,
  Archive,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { useRouter } from 'next/navigation';
import { createProcessAction } from '@/app/actions/process-actions';
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

export default function ProcessHubOverview() {
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { data: processes, isLoading, refresh } = usePluggableCollection<Process>('processes');

  useEffect(() => { setMounted(true); }, []);

  const handleCreate = async () => {
    if (!user || activeTenantId === 'all') {
      toast({ variant: "destructive", title: "Fehler", description: "Wählen Sie einen Mandanten aus." });
      return;
    }
    setIsCreating(true);
    try {
      const res = await createProcessAction(activeTenantId, "Neuer Prozess", user.id, dataSource);
      if (res.success) {
        toast({ title: "Prozess angelegt" });
        router.push(`/processhub/${res.processId}`);
      }
    } finally {
      setIsCreating(false);
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
            <p className="text-sm text-muted-foreground mt-1">Vibecoding für Geschäftsprozesse & Visualisierung.</p>
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
          placeholder="Nach Prozessen, Tags oder Owner suchen..." 
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
                <TableHead className="font-bold uppercase text-[10px]">Letzte Änderung</TableHead>
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
                    <div className="flex flex-col text-[10px] font-bold text-slate-500">
                      <div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(p.updatedAt).toLocaleDateString()}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); }}><ChevronRight className="w-4 h-4" /></Button>
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
    </div>
  );
}
