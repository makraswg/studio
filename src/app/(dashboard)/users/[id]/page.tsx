"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  UserCircle, 
  Mail, 
  Building2, 
  Briefcase, 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Clock, 
  Layers, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink,
  History,
  Info,
  KeyRound,
  Fingerprint,
  RotateCcw,
  Plus,
  Trash2,
  Lock,
  CalendarDays,
  Target
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { User, Assignment, Entitlement, Resource, Tenant, JobTitle, Department } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function UserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);

  const { data: users, isLoading: isUsersLoading } = usePluggableCollection<User>('users');
  const { data: assignments } = usePluggableCollection<Assignment>('assignments');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: jobs } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: auditLogs } = usePluggableCollection<any>('auditEvents');

  useEffect(() => { setMounted(true); }, []);

  const user = useMemo(() => users?.find(u => u.id === id), [users, id]);
  
  const userAssignments = useMemo(() => 
    assignments?.filter(a => a.userId === id) || [], 
    [assignments, id]
  );

  const userAuditLogs = useMemo(() => 
    auditLogs?.filter((log: any) => log.entityId === id || (log.after && log.after.id === id))
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) || [],
    [auditLogs, id]
  );

  const driftInfo = useMemo(() => {
    if (!user || !entitlements || !assignments) return { hasDrift: false, missing: [], extra: [], integrity: 100 };

    const activeAssignedIds = userAssignments.filter(a => a.status === 'active').map(a => a.entitlementId);
    const job = jobs?.find(j => j.name === user.title && j.tenantId === user.tenantId);
    const blueprintIds = job?.entitlementIds || [];
    
    const targetIds = Array.from(new Set([...activeAssignedIds, ...blueprintIds]));
    const targetGroups = targetIds
      .map(eid => entitlements.find(e => e.id === eid)?.externalMapping)
      .filter(Boolean) as string[];

    const actualGroups = user.adGroups || [];
    const missing = targetGroups.filter(g => !actualGroups.includes(g));
    const extra = actualGroups.filter(g => {
      const isManaged = entitlements.some(e => e.externalMapping === g);
      return isManaged && !targetGroups.includes(g);
    });

    const integrity = Math.max(0, 100 - (missing.length * 10) - (extra.length * 20));
    return { hasDrift: missing.length > 0 || extra.length > 0, missing, extra, integrity };
  }, [user, userAssignments, entitlements, jobs, assignments]);

  if (!mounted) return null;

  if (isUsersLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade Identitätsprofil...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-20 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-headline font-bold text-slate-900">Benutzer nicht gefunden</h2>
        <Button onClick={() => router.push('/users')}>Zurück zur Übersicht</Button>
      </div>
    );
  }

  const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/users')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{user.displayName}</h1>
              <Badge className={cn(
                "rounded-full px-2 h-5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}>{isEnabled ? 'Aktiv' : 'Inaktiv'}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{user.email} • ID: {user.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-6 border-slate-200" onClick={() => router.push(`/reviews?search=${user.displayName}`)}>
            <RotateCcw className="w-3.5 h-3.5 mr-2" /> Access Review starten
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-lg active:scale-95 transition-all">
            <Pencil className="w-3.5 h-3.5 mr-2" /> Profil bearbeiten
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Profile Summary */}
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identitäts-Kontext</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Abteilung</p>
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                    <Building2 className="w-4 h-4 text-primary" /> {user.department || '---'}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Rollenprofil (Stelle)</p>
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                    <Briefcase className="w-4 h-4 text-indigo-600" /> {user.title || '---'}
                  </div>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Mandant (Standort)</p>
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                    <Globe className="w-4 h-4 text-slate-400" /> {tenants?.find(t => t.id === user.tenantId)?.name || user.tenantId}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">AD-Integrität</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black">
                    <span className={cn(driftInfo.integrity === 100 ? "text-emerald-600" : "text-amber-600")}>{driftInfo.integrity}% Match</span>
                    <span className="text-slate-400 uppercase">LDAP Sync</span>
                  </div>
                  <Progress value={driftInfo.integrity} className="h-1.5 rounded-full bg-slate-100" />
                </div>
                {driftInfo.hasDrift && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-amber-700 font-bold leading-relaxed italic">Synchronisations-Abweichung zum Active Directory erkannt.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary">Security Stats</CardTitle>
              <Zap className="w-3.5 h-3.5 text-primary fill-current" />
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Aktive Rechte</span>
                <span className="text-sm font-black text-slate-800">{userAssignments.filter(a => a.status === 'active').length}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Admin-Status</span>
                <Badge variant={userAssignments.some(a => entitlements?.find(e => e.id === a.entitlementId)?.isAdmin) ? "destructive" : "outline"} className="text-[8px] font-black h-4 px-1.5 uppercase">
                  {userAssignments.some(a => entitlements?.find(e => e.id === a.entitlementId)?.isAdmin) ? 'Privilegiert' : 'Standard'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Review Status</span>
                <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full h-4 px-1.5 text-[8px] font-black uppercase">Konform</Badge>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="assignments" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1 shadow-inner">
              <TabsTrigger value="assignments" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Berechtigungen
              </TabsTrigger>
              <TabsTrigger value="drift" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Activity className="w-3.5 h-3.5 text-indigo-600" /> Compliance & Drift
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <History className="w-3.5 h-3.5 text-slate-500" /> Journal & Audit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assignments" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-sm font-bold">Aktive Zugriffsberechtigungen</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Übersicht aller Einzelzuweisungen und Gruppenrechte</CardDescription>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-[10px] font-black uppercase gap-2 border-primary/20 text-primary hover:bg-primary/5" onClick={() => router.push('/assignments')}>
                    <Plus className="w-3.5 h-3.5" /> Recht hinzufügen
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow>
                        <TableHead className="py-3 px-6 font-bold text-[10px] uppercase text-slate-400">System (Asset)</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400">Rolle / Recht</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400">Herkunft</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400">Gültigkeit</TableHead>
                        <TableHead className="text-right px-6 font-bold text-[10px] uppercase text-slate-400">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userAssignments.filter(a => a.status === 'active').map(a => {
                        const ent = entitlements?.find(e => e.id === a.entitlementId);
                        const res = resources?.find(r => r.id === ent?.resourceId);
                        const isBlueprint = a.syncSource === 'blueprint' || a.syncSource === 'group';
                        
                        return (
                          <TableRow key={a.id} className="group hover:bg-slate-50 border-b last:border-0">
                            <TableCell className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner">
                                  <Server className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-slate-800">{res?.name || 'Unbekannt'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-700">{ent?.name}</span>
                                {ent?.isAdmin && <Badge className="bg-red-50 text-red-600 border-none rounded-full h-3.5 px-1.5 text-[7px] font-black uppercase">Admin</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "text-[8px] font-black h-4 px-1.5 border-none uppercase shadow-none",
                                isBlueprint ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                              )}>{isBlueprint ? 'Blueprint' : 'Direkt'}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                <CalendarDays className="w-3 h-3 opacity-30" />
                                {a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Unbefristet'}
                              </div>
                            </TableCell>
                            <TableCell className="text-right px-6">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all" onClick={() => router.push(`/assignments`)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {userAssignments.filter(a => a.status === 'active').length === 0 && (
                        <TableRow><TableCell colSpan={5} className="py-12 text-center opacity-30 italic text-xs uppercase tracking-widest">Keine Berechtigungen zugewiesen</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="drift" className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-amber-50/50 border-b p-6">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">Fehlende Rollen (LDAP Drift)</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase">Im Hub definiert, aber im AD nicht vorhanden</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    {driftInfo.missing.map((g, i) => (
                      <div key={i} className="p-3 bg-red-50/50 border border-red-100 rounded-xl flex items-center justify-between group">
                        <span className="text-[11px] font-bold text-red-700 font-mono">{g}</span>
                        <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 group-hover:scale-110 transition-transform"><RotateCcw className="w-3 h-3" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">In AD provisionieren</TooltipContent></Tooltip></TooltipProvider>
                      </div>
                    ))}
                    {driftInfo.missing.length === 0 && (
                      <div className="py-10 text-center space-y-2 opacity-30">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                        <p className="text-[9px] font-black uppercase">Vollständig synchron</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-indigo-50/50 border-b p-6">
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-indigo-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">Nicht autorisierte Rollen</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase">Im AD vorhanden, aber im Hub nicht autorisiert</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    {driftInfo.extra.map((g, i) => (
                      <div key={i} className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl flex items-center justify-between group">
                        <span className="text-[11px] font-bold text-amber-700 font-mono">{g}</span>
                        <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-amber-400 group-hover:scale-110 transition-transform"><Trash2 className="w-3 h-3" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Aus AD entfernen</TooltipContent></Tooltip></TooltipProvider>
                      </div>
                    ))}
                    {driftInfo.extra.length === 0 && (
                      <div className="py-10 text-center space-y-2 opacity-30">
                        <ShieldCheck className="w-8 h-8 mx-auto text-primary" />
                        <p className="text-[9px] font-black uppercase">Keine Drift-Rechte</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-slate-500" />
                    <div>
                      <CardTitle className="text-sm font-bold">Individuelles Journal</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Alle Audit-Ereignisse bezogen auf diese Identität</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {userAuditLogs.map((log: any) => (
                      <div key={log.id} className="p-4 px-8 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 mt-1 shadow-inner shrink-0">
                            <Activity className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-relaxed">{log.action}</p>
                            <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(log.timestamp).toLocaleString()}</span>
                              <span className="flex items-center gap-1"><UserCircle className="w-2.5 h-2.5" /> Akteur: {log.actorUid}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => router.push(`/audit?search=${log.id}`)}><ExternalLink className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                    {userAuditLogs.length === 0 && (
                      <div className="py-20 text-center opacity-30 italic text-xs uppercase tracking-widest">Keine Historie vorhanden</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
