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
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div>
          <Badge className="mb-2 rounded-full px-3 py-0 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border-none">System Ledger</Badge>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-slate-900 dark:text-white uppercase">Audit Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Lückenlose Protokollierung aller Änderungen für {activeTenantId === 'all' ? 'die gesamte Plattform' : activeTenantId}.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-6 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-95" onClick={() => refresh()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Aktualisieren
          </Button>
          <Button className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-8 bg-slate-900 text-white shadow-xl hover:bg-black transition-all active:scale-95" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Log Exportieren
          </Button>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Nach Akteur, Aktion oder Ziel suchen..." 
          className="pl-11 h-14 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 focus:bg-white transition-all shadow-xl shadow-slate-200/20 dark:shadow-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Synchronisiere Journal...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-40 text-center space-y-6">
            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center mx-auto opacity-50 border-2 border-dashed border-slate-200 dark:border-slate-700">
              <ClipboardList className="w-10 h-10 text-slate-400" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-black uppercase text-slate-400 tracking-[0.2em]">Keine Einträge</p>
              <p className="text-xs text-slate-400 font-bold uppercase">Für diesen Zeitraum oder Mandanten liegen keine Audit-Ereignisse vor.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                  <TableHead className="py-6 px-10 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Zeitpunkt</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Mandant</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Akteur</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Aktion</TableHead>
                  <TableHead className="text-right px-10 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-colors">
                    <TableCell className="py-5 px-10">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 opacity-30" />
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-3 h-6">
                        {log.tenantId || 'global'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-primary">
                          {log.actorUid?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-xs truncate max-w-[150px]">{log.actorUid}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-bold leading-relaxed block max-w-md group-hover:text-primary transition-colors">{log.action}</span>
                    </TableCell>
                    <TableCell className="text-right px-10">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-slate-700 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="w-4 h-4 text-primary" />
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
        <DialogContent className="max-w-4xl w-[95vw] md:w-full rounded-[2rem] md:rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 h-[90vh] md:h-[85vh] flex flex-col">
          <DialogHeader className="p-6 md:p-10 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-xl">
                <BadgeAlert className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl md:text-2xl font-headline font-bold uppercase tracking-tight">Audit Ereignis Details</DialogTitle>
                <DialogDescription className="text-slate-400 text-[9px] md:text-[10px] uppercase font-black tracking-[0.2em] mt-1.5 truncate">
                  {selectedLog?.action}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 md:p-10 space-y-8 md:space-y-10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Akteur</p>
                  <p className="text-xs md:text-sm font-bold truncate">{selectedLog?.actorUid}</p>
                </div>
                <div className="p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Mandant</p>
                  <p className="text-xs md:text-sm font-bold uppercase text-primary">{selectedLog?.tenantId || 'global'}</p>
                </div>
                <div className="p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Zeitpunkt</p>
                  <p className="text-xs md:text-sm font-bold">{selectedLog?.timestamp && new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-4">
                  <h4 className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 ml-2">
                    <FileJson className="w-3.5 md:w-4 h-3.5 md:h-4 text-slate-300" /> Vorheriger Zustand
                  </h4>
                  <div className="rounded-[1.5rem] md:rounded-[2.5rem] bg-slate-50 dark:bg-slate-900/50 p-4 md:p-8 h-60 md:h-80 border border-slate-100 dark:border-slate-800">
                    <ScrollArea className="h-full w-full">
                      <pre className="text-[10px] md:text-[11px] font-mono text-slate-500 leading-relaxed">
                        {selectedLog?.before ? JSON.stringify(selectedLog.before, null, 2) : "// Keine Daten verfügbar"}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[9px] md:text-[10px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2 ml-2">
                    <ArrowRight className="w-3.5 md:w-4 h-3.5 md:h-4" /> Neuer Zustand
                  </h4>
                  <div className="rounded-[1.5rem] md:rounded-[2.5rem] bg-emerald-50/20 dark:bg-emerald-900/10 p-4 md:p-8 h-60 md:h-80 border border-emerald-100 dark:border-emerald-900/20">
                    <ScrollArea className="h-full w-full">
                      <pre className="text-[10px] md:text-[11px] font-mono text-emerald-900 dark:text-emerald-400 leading-relaxed">
                        {selectedLog?.after ? JSON.stringify(selectedLog.after, null, 2) : "// Keine Daten verfügbar"}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
            <Button onClick={() => setSelectedLog(null)} className="w-full md:w-auto rounded-xl h-12 px-12 font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
