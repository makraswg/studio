
"use client";

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
  ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useState, useEffect } from 'react';

export default function AuditLogPage() {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');

  const auditQuery = useMemoFirebase(() => {
    return query(collection(db, 'auditEvents'), orderBy('timestamp', 'desc'));
  }, [db]);

  const { data: auditLogs, isLoading } = useCollection(auditQuery);

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

  const filteredLogs = auditLogs?.filter(log => 
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.actorUid.toLowerCase().includes(search.toLowerCase()) ||
    log.entityId.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Unveränderlicher Verlauf aller Sicherheitsaktionen.</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 font-semibold">
          <Download className="w-4 h-4 mr-2" /> Exportieren
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Akteur, Aktion oder Entitäts-ID suchen..." 
          className="pl-10 h-10 shadow-none border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
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
              {filteredLogs?.map((log) => (
                <TableRow key={log.id} className="group hover:bg-muted/5 border-b">
                  <TableCell className="py-4 text-xs font-medium text-muted-foreground">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold">
                        {log.actorUid.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-xs truncate max-w-[100px]">{log.actorUid}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-xs font-bold">{log.action}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-slate-100">{getEntityIcon(log.entityType)}</div>
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
              {!isLoading && filteredLogs?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground italic">Keine Protokolle.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
