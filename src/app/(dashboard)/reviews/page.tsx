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
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowRight,
  Filter,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
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
import { ScrollArea } from '@/components/ui/scroll-area';

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

  const stats = useMemo(() => {
    if (!assignments) return { total: 0, completed: 0, percent: 0 };
    const base = assignments.filter((a: any) => activeTenantId === 'all' || a.tenantId === activeTenantId);
    const totalCount = base.filter((a: any) => a.status === 'active').length;
    const completedCount = base.filter((a: any) => !!a.lastReviewedAt && a.status === 'active').length;
    
    const rawPercent = totalCount > 0 ? (completedCount * 100) / totalCount : 0;
    return {
      total: totalCount,
      completed: completedCount,
      percent: Math.round(rawPercent)
    };
  }, [assignments, activeTenantId]);

  const filteredAssignments = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter(a => {
      if (activeTenantId !== 'all' && a.tenantId !== activeTenantId) return false;
      
      const userDoc = users?.find((u: any) => u.id === a.userId);
      const ent = entitlements?.find((e: any) => e.id === a.entitlementId);
      const res = resources?.find((r: any) => r.id === ent?.resourceId);
      
      const userName = userDoc?.displayName || '';
      const resName = res?.name || '';
      const lowerSearch = search.toLowerCase();
      
      if (search && !userName.toLowerCase().includes(lowerSearch) && !resName.toLowerCase().includes(lowerSearch)) {
        return false;
      }
      
      const isCompleted = !!a.lastReviewedAt;
      if (activeFilter === 'pending') return !isCompleted && a.status === 'active';
      if (activeFilter === 'completed') return isCompleted;
      return true;
    });
  }, [assignments, users, entitlements, resources, search, activeFilter, activeTenantId]);

  const handleReview = async (assignmentId: string, action: 'certify' | 'revoke') => {
    const existing = assignments?.find((a: any) => a.id === assignmentId);
    if (!existing) return;
    
    const timestamp = new Date().toISOString();
    const reviewData = { 
      status: action === 'certify' ? 'active' : 'removed', 
      lastReviewedAt: timestamp, 
      reviewedBy: user?.email || 'system' 
    };

    try {
      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', assignmentId, { ...existing, ...reviewData });
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', assignmentId), reviewData);
      }
      toast({ title: action === 'certify' ? "Bestätigt" : "Widerrufen" });
      setTimeout(() => refreshAssignments(), 150);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  const openQuickAdvisor = async (assignment: any) => {
    const userDoc = users?.find((u: any) => u.id === assignment.userId);
    const ent = entitlements?.find((e: any) => e.id === assignment.entitlementId);
    const res = resources?.find((r: any) => r.id === ent?.resourceId);
    if (!userDoc) return;

    setSelectedReviewItem({ assignment, user: userDoc, ent, res });
    setIsAdvisorLoading(true);
    setIsAdvisorOpen(true);
    setAiAdvice(null);

    try {
      const advice = await getAccessAdvice({
        userDisplayName: userDoc.displayName,
        userEmail: userDoc.email,
        department: userDoc.department || 'Allgemein',
        assignments: [{ 
          resourceName: res?.name || 'Unbekannt', 
          entitlementName: ent?.name || 'Unbekannt', 
          riskLevel: ent?.riskLevel || 'low' 
        }],
        tenantId: activeTenantId,
        dataSource
      });
      setAiAdvice(advice);
    } catch (e) {
      toast({ variant: "destructive", title: "KI-Fehler", description: "Fehler beim Laden der Beratung." });
      setIsAdvisorOpen(false);
    } finally {
      setIsAdvisorLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">Compliance Review</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Access Reviews</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zertifizierung von Identitäts-Berechtigungen.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200 active:scale-95" onClick={() => refreshAssignments()}>
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Aktualisieren
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm rounded-xl overflow-hidden bg-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Fortschritt</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold text-slate-800">{stats.percent}%</h3>
              <span className="text-[10px] font-bold text-slate-500">{stats.completed} / {stats.total}</span>
            </div>
            <Progress value={stats.percent} className="h-1.5 mt-3 rounded-full bg-slate-100" />
          </CardContent>
        </Card>
      </div>

      {/* Compact Filtering Row */}
      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Mitarbeiter oder System suchen..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          <button 
            className={cn("px-6 h-full text-[10px] font-bold rounded-sm transition-all whitespace-nowrap", activeFilter === 'pending' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
            onClick={() => setActiveFilter('pending')}
          >
            Ausstehend
          </button>
          <button 
            className={cn("px-6 h-full text-[10px] font-bold rounded-sm transition-all whitespace-nowrap", activeFilter === 'completed' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
            onClick={() => setActiveFilter('completed')}
          >
            Geprüft
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary opacity-20" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="py-4 px-6 font-bold text-xs text-slate-400">Identität</TableHead>
                  <TableHead className="font-bold text-xs text-slate-400">System / Rolle</TableHead>
                  <TableHead className="font-bold text-xs text-slate-400 text-center">KI-Advisor</TableHead>
                  <TableHead className="text-right px-6 font-bold text-xs text-slate-400">Entscheidung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((a) => {
                  const userDoc = users?.find((u: any) => u.id === a.userId);
                  const ent = entitlements?.find((e: any) => e.id === a.entitlementId);
                  const res = resources?.find((r: any) => r.id === ent?.resourceId);
                  return (
                    <TableRow key={a.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-primary font-bold text-xs">
                            {userDoc?.displayName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-800">{userDoc?.displayName || a.userId}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{userDoc?.department}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-800 truncate">{res?.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold truncate">{ent?.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 rounded-md text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 gap-2 border border-transparent hover:border-indigo-100 transition-all"
                          onClick={() => openQuickAdvisor(a)}
                        >
                          <BrainCircuit className="w-3.5 h-3.5" /> Advisor
                        </Button>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        {a.lastReviewedAt ? (
                          <Badge className={cn(
                            "rounded-full px-3 h-6 text-[9px] font-bold border-none",
                            a.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          )}>{a.status === 'active' ? 'Bestätigt' : 'Widerrufen'}</Badge>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-8 rounded-md text-[10px] font-bold border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleReview(a.id, 'revoke')}><XCircle className="w-3 h-3 mr-1.5" /> Widerrufen</Button>
                            <Button size="sm" className="h-8 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleReview(a.id, 'certify')}><CheckCircle2 className="w-3 h-3 mr-1.5" /> Bestätigen</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={isAdvisorOpen} onOpenChange={setIsAdvisorOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white h-[85vh]">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary shadow-xl border border-white/10">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-headline font-bold">KI Access Advisor</DialogTitle>
                <DialogDescription className="text-[10px] text-white/50 font-bold mt-0.5">Analyse: {selectedReviewItem?.user?.displayName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            {isAdvisorLoading ? (
              <div className="py-20 text-center space-y-6">
                <div className="relative w-16 h-16 mx-auto">
                  <Loader2 className="w-16 h-16 animate-spin text-primary opacity-20" />
                  <BrainCircuit className="absolute inset-0 m-auto w-7 h-7 text-primary animate-pulse" />
                </div>
                <p className="text-sm font-bold text-slate-800">KI evaluiert Zugriffsprofil...</p>
              </div>
            ) : aiAdvice && (
              <div className="p-8 space-y-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-inner space-y-1">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Risiko Score</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-4xl font-black text-indigo-900">{aiAdvice.riskScore}</h3>
                      <span className="text-sm font-bold text-indigo-400">/ 100</span>
                    </div>
                  </div>
                  <div className={cn(
                    "p-6 rounded-2xl border shadow-inner flex flex-col justify-center",
                    aiAdvice.riskScore > 50 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"
                  )}>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Empfehlung</p>
                    <div className="flex items-center gap-2 mt-1">
                      {aiAdvice.riskScore > 50 ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <ShieldCheck className="w-5 h-5 text-emerald-600" />}
                      <h4 className={cn("text-lg font-black", aiAdvice.riskScore > 50 ? "text-red-700" : "text-emerald-700")}>
                        {aiAdvice.riskScore > 50 ? 'Widerruf' : 'Konform'}
                      </h4>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                  <p className="text-sm font-medium italic text-slate-700 leading-relaxed pl-2">
                    "{aiAdvice.summary}"
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 ml-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Bedenken
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {aiAdvice.concerns?.map((c: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl text-xs font-medium text-slate-600 shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 ml-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Handlungsschritte
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {aiAdvice.recommendations?.map((r: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-emerald-50/30 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-900">
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsAdvisorOpen(false)} className="rounded-md font-bold text-xs px-8">Schließen</Button>
            {aiAdvice && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" className="flex-1 sm:flex-none h-10 px-6 rounded-md font-bold text-[10px] border-red-200 text-red-600 hover:bg-red-50" onClick={() => { handleReview(selectedReviewItem?.assignment?.id, 'revoke'); setIsAdvisorOpen(false); }}>KI-Widerruf</Button>
                <Button className="flex-1 sm:flex-none h-10 px-8 rounded-md font-bold text-[10px] bg-primary text-white shadow-lg" onClick={() => { handleReview(selectedReviewItem?.assignment?.id, 'certify'); setIsAdvisorOpen(false); }}>Zertifizieren</Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
