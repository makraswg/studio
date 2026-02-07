"use client";

import { useMemo, useState, useEffect } from 'react';
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
  Download,
  Activity,
  User as UserIcon,
  Layers,
  Shield,
  Loader2,
  Eye,
  RefreshCw,
  FileJson,
  ArrowRight,
  BadgeAlert,
  ClipboardList
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettings } from '@/context/settings-context';
import { exportToExcel } from '@/lib/export-utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AuditLogPage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const { activeTenantId } = useSettings();

  const { data: auditLogs, isLoading, refresh } = usePluggableCollection<any>('auditEvents');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];
    
    let filtered = auditLogs;

    if (activeTenantId !== 'all') {
      filtered = filtered.filter(log => log.tenantId === activeTenantId || log.tenantId === 'global');
    }

    const sorted = [...filtered].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (!search) return sorted;

    const lowerSearch = search.toLowerCase();
    return sorted.filter(log => 
      (log.action || '').toLowerCase().includes(lowerSearch) ||
      (log.actorUid || '').toLowerCase().includes(lowerSearch) ||
      (log.entityId || '').toLowerCase().includes(lowerSearch) ||
      (log.entityType || '').toLowerCase().includes(lowerSearch)
    );
  }, [auditLogs, search, activeTenantId]);

  const handleExport = () => {
    const data = filteredLogs.map(log => ({
      'Zeitpunkt': new Date(log.timestamp).toLocaleString(),
      'Mandant': log.tenantId || 'global',
      'Akteur': log.actorUid,
      'Aktion': log.action,
      'Entität Typ': log.entityType,
      'Entität ID': log.entityId
    }));
    exportToExcel(data, `AuditLog_${new Date().toISOString().split('T')[0]}`);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">System Ledger</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase">Audit Log</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Lückenlose Protokollierung aller Änderungen für {activeTenantId === 'all' ? 'die gesamte Plattform' : activeTenantId}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold uppercase text-[9px] tracking-wider px-4 border-slate-200 hover:bg-slate-50 transition-all active:scale-95" onClick={() => refresh()}>
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Aktualisieren
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold uppercase text-[10px] tracking-wider px-6 bg-slate-900 text-white shadow-sm hover:bg-black transition-all active:scale-95" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Nach Akteur, Aktion oder Ziel suchen..." 
          className="pl-9 h-12 rounded-xl border-slate-200 bg-white shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Journal wird geladen...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mx-auto opacity-50 border border-dashed border-slate-200">
              <ClipboardList className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-xs font-bold uppercase text-slate-400">Keine Audit-Ereignisse gefunden.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="py-4 px-6 font-bold uppercase tracking-widest text-[9px] text-slate-400">Zeitpunkt</TableHead>
                  <TableHead className="font-bold uppercase tracking-widest text-[9px] text-slate-400">Mandant</TableHead>
                  <TableHead className="font-bold uppercase tracking-widest text-[9px] text-slate-400">Akteur</TableHead>
                  <TableHead className="font-bold uppercase tracking-widest text-[9px] text-slate-400">Aktion</TableHead>
                  <TableHead className="text-right px-6 font-bold uppercase tracking-widest text-[9px] text-slate-400">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                    <TableCell className="py-4 px-6">
                      <div className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                        <Activity className="w-3 h-3 opacity-30" />
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full text-[8px] font-black uppercase border-slate-200 text-slate-500 px-2 h-5">
                        {log.tenantId || 'global'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-[9px] font-black text-primary uppercase">
                          {log.actorUid?.charAt(0)}
                        </div>
                        <span className="font-bold text-xs truncate max-w-[120px]">{log.actorUid}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-bold leading-relaxed block max-w-sm group-hover:text-primary transition-colors">{log.action}</span>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-md hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="w-3.5 h-3.5 text-primary" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl w-[95vw] rounded-xl border-none shadow-2xl p-0 overflow-hidden bg-white flex flex-col h-[85vh]">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary shadow-lg">
                <BadgeAlert className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-headline font-bold uppercase tracking-tight">Audit Ereignis</DialogTitle>
                <DialogDescription className="text-slate-400 text-[9px] uppercase font-black tracking-widest mt-0.5 truncate">
                  {selectedLog?.action}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Akteur</p>
                  <p className="text-xs font-bold truncate">{selectedLog?.actorUid}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Mandant</p>
                  <p className="text-xs font-bold uppercase text-primary">{selectedLog?.tenantId || 'global'}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Zeitpunkt</p>
                  <p className="text-xs font-bold">{selectedLog?.timestamp && new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 ml-1">
                    <FileJson className="w-3 h-3 text-slate-300" /> Vorher
                  </h4>
                  <div className="rounded-xl bg-slate-50 p-4 h-60 border border-slate-100">
                    <ScrollArea className="h-full w-full">
                      <pre className="text-[10px] font-mono text-slate-500 leading-relaxed">
                        {selectedLog?.before ? JSON.stringify(selectedLog.before, null, 2) : "// Keine Daten"}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-[9px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-1.5 ml-1">
                    <ArrowRight className="w-3 h-3" /> Nachher
                  </h4>
                  <div className="rounded-xl bg-emerald-50/20 p-4 h-60 border border-emerald-100">
                    <ScrollArea className="h-full w-full">
                      <pre className="text-[10px] font-mono text-emerald-900 leading-relaxed">
                        {selectedLog?.after ? JSON.stringify(selectedLog.after, null, 2) : "// Keine Daten"}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
            <Button size="sm" onClick={() => setSelectedLog(null)} className="w-full sm:w-auto rounded-md h-10 px-8 font-black uppercase text-[10px] tracking-widest shadow-sm">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
