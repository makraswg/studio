
"use client";

import { useState, useEffect, useMemo } from 'react';
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
  Loader2,
  RefreshCw,
  BrainCircuit,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { 
  useFirestore, 
  updateDocumentNonBlocking, 
  useUser 
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { getAccessAdvice } from '@/ai/flows/access-advisor-flow';

export default function AccessReviewsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [search, setSearch] = useState('');

  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [selectedReviewItem, setSelectedReviewItem] = useState<any>(null);

  const { data: assignments, isLoading, refresh: refreshAssignments } = usePluggableCollection<any>('assignments');
  const { data: users } = usePluggableCollection<any>('users');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: resources } = usePluggableCollection<any>('resources');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredAssignments = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter(a => {
      if (activeTenantId !== 'all' && a.tenantId !== activeTenantId) return false;
      const userDoc = users?.find(u => u.id === a.userId);
      const ent = entitlements?.find(e => e.id === a.entitlementId);
      const res = resources?.find(r => r.id === ent?.resourceId);
      const userName = userDoc?.displayName || '';
      const resName = res?.name || '';
      if (!userName.toLowerCase().includes(search.toLowerCase()) && !resName.toLowerCase().includes(search.toLowerCase())) return false;
      const isCompleted = !!a.lastReviewedAt;
      if (activeFilter === 'pending') return !isCompleted && a.status !== 'removed';
      if (activeFilter === 'completed') return isCompleted;
      return true;
    });
  }, [assignments, users, entitlements, resources, search, activeFilter, activeTenantId]);

  const handleReview = async (assignmentId: string, action: 'certify' | 'revoke') => {
    const existing = assignments?.find(a => a.id === assignmentId);
    if (!existing) return;
    const reviewData = { status: action === 'certify' ? 'active' : 'removed', lastReviewedAt: new Date().toISOString(), reviewedBy: user?.uid || 'system' };
    if (dataSource === 'mysql') await saveCollectionRecord('assignments', assignmentId, { ...existing, ...reviewData });
    else updateDocumentNonBlocking(doc(db, 'assignments', assignmentId), reviewData);
    toast({ title: action === 'certify' ? "Zertifiziert" : "Widerrufen" });
    setTimeout(() => refreshAssignments(), 150);
  };

  const openQuickAdvisor = async (assignment: any) => {
    const userDoc = users?.find(u => u.id === assignment.userId);
    const ent = entitlements?.find(e => e.id === assignment.entitlementId);
    const res = resources?.find(r => r.id === ent?.resourceId);
    if (!userDoc) return;
    setSelectedReviewItem({ assignment, user: userDoc, ent, res });
    setIsAdvisorLoading(true); setIsAdvisorOpen(true); setAiAdvice(null);
    try {
      const advice = await getAccessAdvice({
        userDisplayName: userDoc.displayName,
        userEmail: userDoc.email,
        department: userDoc.department || 'IT',
        assignments: [{ resourceName: res?.name || '?', entitlementName: ent?.name || '?', riskLevel: ent?.riskLevel || 'low' }]
      });
      setAiAdvice(advice);
    } catch (e) { setIsAdvisorOpen(false); } finally { setIsAdvisorLoading(false); }
  };

  const stats = useMemo(() => {
    const base = assignments?.filter(a => activeTenantId === 'all' || a.tenantId === activeTenantId) || [];
    return {
      total: base.filter(a => a.status !== 'removed').length,
      completed: base.filter(a => !!a.lastReviewedAt).length,
      overdue: base.filter(a => !a.lastReviewedAt && a.validUntil && new Date(a.validUntil) < new Date()).length
    };
  }, [assignments, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access Reviews</h1>
          <p className="text-sm text-muted-foreground">Regelmäßige Prüfung der Zugriffsberechtigungen.</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => refreshAssignments()}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Aktualisieren</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="rounded-none border shadow-none p-4"><p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Fortschritt</p><div className="text-2xl font-bold">{stats.total > 0 ? Math.round((stats.completed/stats.total)*100) : 0}%</div><Progress value={stats.total > 0 ? (stats.completed/stats.total)*100 : 0} className="h-1 mt-2 rounded-none" /></Card>
        <Card className="rounded-none border shadow-none p-4 border-red-200"><p className="text-[9px] font-bold uppercase text-red-600 mb-1">Überfällig</p><div className="text-2xl font-bold text-red-600">{stats.overdue}</div></Card>
      </div>

      <div className="flex justify-between items-center gap-4">
        <div className="flex border rounded-none p-1 bg-muted/20">
          {['pending', 'completed', 'all'].map(id => (
            <Button key={id} variant={activeFilter === id ? 'default' : 'ghost'} size="sm" className="h-8 text-[9px] font-bold uppercase px-6" onClick={() => setActiveFilter(id as any)}>
              {id === 'pending' ? 'Ausstehend' : id === 'completed' ? 'Erledigt' : 'Alle'}
            </Button>
          ))}
        </div>
        <div className="relative w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Suchen..." className="pl-10 h-10 rounded-none bg-white" value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow><TableHead className="py-4 font-bold uppercase text-[10px]">Benutzer</TableHead><TableHead className="font-bold uppercase text-[10px]">System / Rolle</TableHead><TableHead className="font-bold uppercase text-[10px]">KI-Advisor</TableHead><TableHead className="text-right font-bold uppercase text-[10px]">Aktion</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssignments.map((a) => {
              const userDoc = users?.find(u => u.id === a.userId);
              const ent = entitlements?.find(e => e.id === a.entitlementId);
              const res = resources?.find(r => r.id === ent?.resourceId);
              return (
                <TableRow key={a.id} className="hover:bg-muted/5 border-b">
                  <TableCell className="py-4"><div className="font-bold text-sm">{userDoc?.displayName}</div><div className="text-[10px] text-muted-foreground uppercase">{a.tenantId}</div></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {ent?.isAdmin && <ShieldAlert className="w-3.5 h-3.5 text-red-600" />}
                      <div><div className="font-bold text-sm">{res?.name}</div><div className="text-xs text-muted-foreground">{ent?.name}</div></div>
                    </div>
                  </TableCell>
                  <TableCell><Button variant="ghost" size="sm" className="h-8 text-[9px] font-bold uppercase text-blue-600 gap-2" onClick={() => openQuickAdvisor(a)}><BrainCircuit className="w-3.5 h-3.5" /> KI-Check</Button></TableCell>
                  <TableCell className="text-right">
                    {a.lastReviewedAt ? <Badge className="bg-emerald-50 text-emerald-700 rounded-none text-[8px]">GEPRÜFT</Badge> : (
                      <div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="h-8 text-[9px] font-bold uppercase border-red-200 text-red-600" onClick={() => handleReview(a.id, 'revoke')}>Widerruf</Button><Button size="sm" className="h-8 text-[9px] font-bold uppercase bg-emerald-600" onClick={() => handleReview(a.id, 'certify')}>Bestätigen</Button></div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAdvisorOpen} onOpenChange={setIsAdvisorOpen}>
        <DialogContent className="max-w-2xl rounded-none">
          {isAdvisorLoading ? <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /><p className="mt-4 text-[10px] font-bold uppercase">Analysiere Risikoprofil...</p></div> : aiAdvice && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold uppercase">KI Analyse: {selectedReviewItem?.user?.displayName}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border bg-blue-50/50"><p className="text-[9px] font-bold uppercase">Risiko Score</p><p className="text-3xl font-bold">{aiAdvice.riskScore}/100</p></div>
                <div className="p-4 border bg-orange-50/50"><p className="text-[9px] font-bold uppercase">Empfehlung</p><p className="text-sm font-bold uppercase mt-1">{aiAdvice.riskScore > 50 ? 'Widerruf prüfen' : 'Behalten'}</p></div>
              </div>
              <p className="text-xs italic bg-slate-50 p-4 border leading-relaxed">"{aiAdvice.summary}"</p>
              <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">Bedenken & Hinweise</p>
                <ul className="text-xs space-y-1">{aiAdvice.concerns?.map((c: string, i: number) => <li key={i} className="flex items-center gap-2"><AlertTriangle className="w-3 h-3 text-amber-600" /> {c}</li>)}</ul>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setIsAdvisorOpen(false)} className="rounded-none">Schließen</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
