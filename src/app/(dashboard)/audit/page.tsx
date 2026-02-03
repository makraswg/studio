
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
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';

export default function AuditLogPage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');

  const { data: auditLogs, isLoading, refresh } = usePluggableCollection<any>('auditEvents');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'resource': return <Layers className="w-3.5 h-3.5" />;
      case 'entitlement': return <Shield className="w-3.5 h-3.5" />;
      case 'assignment': return <UserIcon className="w-3.5 h-3.5" />;
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
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px]" onClick={() => refresh()}>
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Aktualisieren
          </Button>
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px]">
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
                    <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5 text-primary" /></Button>
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
    </div>
  );
}
