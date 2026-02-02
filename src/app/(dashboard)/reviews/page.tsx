
"use client";

import { useState, useEffect } from 'react';
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
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search, 
  ShieldAlert,
  Layers,
  Calendar,
  Loader2,
  RefreshCw,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AccessReviewsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [search, setSearch] = useState('');

  const assignmentsQuery = useMemoFirebase(() => collection(db, 'assignments'), [db]);
  const usersQuery = useMemoFirebase(() => collection(db, 'users'), [db]);
  const entitlementsQuery = useMemoFirebase(() => collection(db, 'entitlements'), [db]);
  const resourcesQuery = useMemoFirebase(() => collection(db, 'resources'), [db]);

  const { data: assignments, isLoading } = useCollection(assignmentsQuery);
  const { data: users } = useCollection(usersQuery);
  const { data: entitlements } = useCollection(entitlementsQuery);
  const { data: resources } = useCollection(resourcesQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleReview = (assignmentId: string, action: 'certify' | 'revoke') => {
    const docRef = doc(db, 'assignments', assignmentId);
    
    updateDocumentNonBlocking(docRef, {
      status: action === 'certify' ? 'active' : 'removed',
      lastReviewedAt: new Date().toISOString(),
      reviewedBy: user?.uid || 'system'
    });

    addDocumentNonBlocking(collection(db, 'auditEvents'), {
      actorUid: user?.uid || 'system',
      action: action === 'certify' ? 'Zertifizierung' : 'Widerruf (Review)',
      entityType: 'assignment',
      entityId: assignmentId,
      timestamp: new Date().toISOString(),
      tenantId: 't1'
    });

    toast({
      title: action === 'certify' ? "Zuweisung zertifiziert" : "Zuweisung widerrufen",
      description: "Die Compliance-Anforderung wurde erfüllt.",
    });
  };

  const filteredAssignments = assignments?.filter(assignment => {
    const userDoc = users?.find(u => u.id === assignment.userId);
    const ent = entitlements?.find(e => e.id === assignment.entitlementId);
    const res = resources?.find(r => r.id === ent?.resourceId);
    
    const matchesSearch = 
      userDoc?.displayName.toLowerCase().includes(search.toLowerCase()) || 
      res?.name.toLowerCase().includes(search.toLowerCase());
    
    const isCompleted = !!assignment.lastReviewedAt;
    if (activeFilter === 'pending') return matchesSearch && !isCompleted && assignment.status !== 'removed';
    if (activeFilter === 'completed') return matchesSearch && isCompleted;
    return matchesSearch;
  });

  const stats = {
    total: assignments?.filter(a => a.status !== 'removed').length || 0,
    completed: assignments?.filter(a => !!a.lastReviewedAt).length || 0,
    overdue: assignments?.filter(a => {
      if (!a.grantedAt) return false;
      const days = (new Date().getTime() - new Date(a.grantedAt).getTime()) / (1000 * 3600 * 24);
      return days > 90 && !a.lastReviewedAt && a.status !== 'removed';
    }).length || 0
  };

  const progressPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access Reviews</h1>
          <p className="text-sm text-muted-foreground">Vierteljährliche Überprüfung kritischer Berechtigungen.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-semibold">
            <RefreshCw className="w-4 h-4 mr-2" /> Neue Kampagne
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-none rounded-none border">
          <CardHeader className="py-3 bg-muted/20 border-b">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Fortschritt</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold">{progressPercent}%</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Q3 Kampagne</span>
            </div>
            <Progress value={progressPercent} className="h-1 rounded-none" />
            <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase">
              {stats.completed} von {stats.total} abgeschlossen
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none rounded-none border border-red-200">
          <CardHeader className="py-3 bg-red-50/50 border-b border-red-200">
            <CardTitle className="text-xs font-bold uppercase text-red-700">Kritisch / Überfällig</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex items-center justify-between">
            <span className="text-3xl font-bold text-red-600">{stats.overdue}</span>
            <AlertCircle className="w-8 h-8 text-red-200" />
          </CardContent>
        </Card>

        <Alert className="rounded-none border shadow-none bg-blue-50/30">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-xs font-bold uppercase text-blue-800">Review Guide</AlertTitle>
          <AlertDescription className="text-xs text-blue-700">
            Prüfen Sie insbesondere "High Risk" Rollen. Widerrufen Sie Zugriff, der länger als 90 Tage nicht genutzt wurde.
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex border rounded-none p-1 bg-muted/20 w-full md:w-auto">
          {['pending', 'completed', 'all'].map(id => (
            <Button 
              key={id}
              variant={activeFilter === id ? 'default' : 'ghost'} 
              size="sm" 
              className="flex-1 md:flex-none text-[10px] font-bold uppercase rounded-none h-8"
              onClick={() => setActiveFilter(id as any)}
            >
              {id === 'pending' ? 'Ausstehend' : id === 'completed' ? 'Erledigt' : 'Alle'}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Suchen..." 
            className="pl-10 h-10 rounded-none bg-white" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-card overflow-hidden rounded-none shadow-none">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Benutzer</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Ressource / Rolle</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Risiko</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
                <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Review Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments?.map((assignment) => {
                const userDoc = users?.find(u => u.id === assignment.userId);
                const ent = entitlements?.find(e => e.id === assignment.entitlementId);
                const res = resources?.find(r => r.id === ent?.resourceId);
                
                return (
                  <TableRow key={assignment.id} className="group hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-slate-100 flex items-center justify-center text-[10px] font-bold">
                          {userDoc?.displayName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="font-bold text-sm">{userDoc?.displayName || assignment.userId}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{userDoc?.department}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{res?.name}</span>
                        <span className="text-xs text-muted-foreground">{ent?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "rounded-none font-bold uppercase text-[9px]",
                        ent?.riskLevel === 'high' ? "border-red-200 text-red-600 bg-red-50" : "border-blue-200 text-blue-600 bg-blue-50"
                      )}>
                        {ent?.riskLevel || 'MEDIUM'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase border-none bg-muted/50">
                        {assignment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {assignment.lastReviewedAt ? (
                        <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold text-[10px] uppercase">
                          <CheckCircle className="w-3.5 h-3.5" /> Zertifiziert
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-[10px] font-bold uppercase rounded-none border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => handleReview(assignment.id, 'revoke')}
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Widerruf
                          </Button>
                          <Button 
                            size="sm" 
                            className="h-8 text-[10px] font-bold uppercase rounded-none bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleReview(assignment.id, 'certify')}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Bestätigen
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
