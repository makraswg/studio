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
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AuditLogPage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: auditLogs, isLoading, refresh } = usePluggableCollection<any>('auditEvents');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'resource': return <Layers className="w-3.5 h-3.5" />;
      case 'entitlement': return <Shield className="w-3.5 h-3.5" />;
      case 'assignment': return <UserIcon className="w-3.5 h-3.5" />;
      case 'user': return <UserIcon className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];
    
    // Zuerst sortieren nach Zeitstempel absteigend
    const sorted = [...auditLogs].sort((a, b) => 
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
  }, [auditLogs, search]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Unveränderlicher Verlauf aller Sicherheitsaktionen.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => refresh()}>
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Aktualisieren
          </Button>
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none">
            <Download className="w-4 h-4 mr-2" /> Exportieren
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Akteur, Aktion oder Entitäts-ID suchen..." 
          className="pl-10 h-10 shadow-none border-border rounded-none bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Lade Protokolle...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Zeitpunkt</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Akteur</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Aktion</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Entität</TableHead>
                <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="group hover:bg-muted/5 border-b">
                  <TableCell className="py-4 text-xs font-medium text-muted-foreground">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-none bg-slate-100 flex items-center justify-center text-[10px] font-bold">
                        {(log.actorUid || 'A').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-xs truncate max-w-[100px]">{log.actorUid}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-xs font-bold">{log.action}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-none bg-slate-100">{getEntityIcon(log.entityType)}</div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{log.entityType}</span>
                        <span className="text-[9px] text-muted-foreground truncate max-w-[100px]">{log.entityId}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 rounded-none"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="w-3.5 h-3.5 text-primary" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filteredLogs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground italic">Keine Protokolle gefunden.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl rounded-none border shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-primary" />
              <div>
                <DialogTitle className="text-lg font-bold uppercase tracking-wider">Audit Ereignis Details</DialogTitle>
                <DialogDescription className="text-slate-400 text-xs uppercase font-bold">
                  {selectedLog?.action} • {selectedLog?.timestamp && new Date(selectedLog.timestamp).toLocaleString()}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="admin-card p-4 bg-muted/20">
                <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Akteur</p>
                <p className="text-xs font-bold">{selectedLog?.actorUid}</p>
              </div>
              <div className="admin-card p-4 bg-muted/20">
                <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Entitätstyp</p>
                <p className="text-xs font-bold uppercase">{selectedLog?.entityType}</p>
              </div>
              <div className="admin-card p-4 bg-muted/20">
                <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Entitäts-ID</p>
                <p className="text-[10px] font-mono truncate">{selectedLog?.entityId}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-2">
                  <FileJson className="w-3.5 h-3.5" /> Vor der Änderung (Before)
                </h4>
                <div className="border rounded-none bg-slate-50 p-3 h-64">
                  <ScrollArea className="h-full w-full">
                    <pre className="text-[10px] font-mono leading-relaxed">
                      {selectedLog?.before 
                        ? JSON.stringify(selectedLog.before, null, 2) 
                        : "// Keine Daten verfügbar"}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase text-emerald-600 tracking-widest flex items-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5" /> Nach der Änderung (After)
                </h4>
                <div className="border rounded-none bg-emerald-50/30 p-3 h-64 border-emerald-100">
                  <ScrollArea className="h-full w-full">
                    <pre className="text-[10px] font-mono leading-relaxed">
                      {selectedLog?.after 
                        ? JSON.stringify(selectedLog.after, null, 2) 
                        : "// Keine Daten verfügbar"}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t flex justify-end">
            <Button variant="outline" className="rounded-none h-10 px-8" onClick={() => setSelectedLog(null)}>
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
