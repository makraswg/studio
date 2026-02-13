
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  ShieldCheck, 
  Fingerprint, 
  Activity, 
  ArrowRight, 
  Zap, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  UserPlus,
  UserMinus,
  Layers,
  KeyRound,
  LayoutDashboard,
  BrainCircuit,
  Ticket
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { User, Assignment, Entitlement, Resource, JobTitle } from '@/lib/types';

export default function AccessHubDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { activeTenantId } = useSettings();

  const { data: users, isLoading: uLoad } = usePluggableCollection<User>('users');
  const { data: assignments, isLoading: aLoad } = usePluggableCollection<Assignment>('assignments');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: jobs } = usePluggableCollection<JobTitle>('jobTitles');

  useEffect(() => { setMounted(true); }, []);

  const stats = useMemo(() => {
    if (!users || !assignments || !entitlements) return { totalUsers: 0, activeAss: 0, admins: 0, driftCount: 0, reviewPercent: 0 };

    const tFilter = (item: any) => activeTenantId === 'all' || item.tenantId === activeTenantId;
    const fUsers = users.filter(tFilter);
    const fAssignments = assignments.filter(tFilter);
    
    const activeAssignments = fAssignments.filter(a => a.status === 'active');
    
    // Admin Detection
    const adminRoles = new Set(entitlements.filter(e => e.isAdmin).map(e => e.id));
    const admins = new Set(activeAssignments.filter(a => adminRoles.has(a.entitlementId)).map(a => a.userId)).size;

    // Drift Detection
    let driftCount = 0;
    fUsers.forEach(u => {
      const uAss = activeAssignments.filter(a => a.userId === u.id);
      const job = jobs?.find(j => j.name === u.title && j.tenantId === u.tenantId);
      const blueprintIds = job?.entitlementIds || [];
      const assignedIds = uAss.map(a => a.entitlementId);
      
      const targetIds = Array.from(new Set([...assignedIds, ...blueprintIds]));
      const targetGroups = targetIds.map(eid => entitlements.find(e => e.id === eid)?.externalMapping).filter(Boolean);
      const actualGroups = u.adGroups || [];
      
      const hasDrift = targetGroups.some(g => !actualGroups.includes(g as string)) || 
                       actualGroups.some(g => entitlements.some(e => e.externalMapping === g) && !targetGroups.includes(g));
      if (hasDrift) driftCount++;
    });

    const reviewed = activeAssignments.filter(a => !!a.lastReviewedAt).length;
    const reviewPercent = activeAssignments.length > 0 ? Math.floor((reviewed * 100) / activeAssignments.length) : 100;

    return { totalUsers: fUsers.length, activeAss: activeAssignments.length, admins, driftCount, reviewPercent };
  }, [users, assignments, entitlements, jobs, activeTenantId]);

  const sourceData = useMemo(() => {
    if (!assignments) return [];
    const active = assignments.filter(a => a.status === 'active' && (activeTenantId === 'all' || a.tenantId === activeTenantId));
    const blueprint = active.filter(a => a.syncSource === 'blueprint' || a.syncSource === 'group').length;
    const manual = active.length - blueprint;

    return [
      { name: 'Standardzuweisung', value: blueprint, color: '#3b82f6' },
      { name: 'Einzelzuweisung', value: manual, color: '#10b981' }
    ].filter(d => d.value > 0);
  }, [assignments, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10 transition-transform hover:scale-105">
            <Fingerprint className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none uppercase tracking-wider">Access Hub Intelligence</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Identity Dashboard</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sichtbarkeit und Kontrolle über Benutzerzugriffe und Privilegien.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-6 border-slate-200" onClick={() => router.push('/users')}>
            <Users className="w-3.5 h-3.5 mr-2" /> Verzeichnis
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg active:scale-95 transition-all" onClick={() => router.push('/reviews')}>
            <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Access Review
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Security Card - Refined */}
        <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden relative group">
            <CardContent className="p-8 space-y-6 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shadow-inner border border-primary/10">
                        <ShieldCheck className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-primary border-primary/30 font-black text-[9px] uppercase tracking-widest bg-primary/5">IAM Compliance</Badge>
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-headline font-black tracking-tight text-slate-900 dark:text-white">{stats.reviewPercent}%</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rezertifizierungs-Status</p>
                </div>
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                        <span>Geprüfte Zuweisungen</span>
                        <span className="text-primary">Target: 100%</span>
                    </div>
                    <Progress value={stats.reviewPercent} className="h-2 bg-slate-100" />
                    <p className="text-[9px] text-slate-400 leading-relaxed italic mt-4">
                        Anteil der aktiven Berechtigungen, die im laufenden Review-Zyklus bereits bestätigt wurden.
                    </p>
                </div>
            </CardContent>
        </Card>

        {/* Quick Stats Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:border-primary/20 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Identitäten</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalUsers}</h3>
                        <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 font-bold uppercase mt-1">
                            <Activity className="w-3 h-3" /> Synchron
                        </div>
                    </div>
                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors shadow-inner">
                        <Users className="w-6 h-6" />
                    </div>
                </CardContent>
            </Card>
            <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:border-red-200 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Admins</p>
                        <h3 className="text-2xl font-black text-red-600">{stats.admins}</h3>
                        <p className="text-[9px] text-slate-500 font-medium italic">Kritische Rechte</p>
                    </div>
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 shadow-inner">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                </CardContent>
            </Card>
            <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:border-amber-200 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600 shadow-inner">
                            <RefreshCw className="w-6 h-6" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">AD/LDAP Integrität</p>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{stats.driftCount} Drifts</h3>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-amber-600" onClick={() => router.push('/users?status=drift')}>Ansehen <ArrowRight className="w-3.5 h-3.5 ml-2" /></Button>
                </CardContent>
            </Card>
            <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:border-blue-200 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 shadow-inner">
                            <Ticket className="w-6 h-6" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Jira Gateway</p>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Bereit</h3>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-blue-600" onClick={() => router.push('/jira-sync')}>Gateway <ArrowRight className="w-3.5 h-3.5 ml-2" /></Button>
                </CardContent>
            </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b py-4 px-6 bg-slate-50/50">
            <CardTitle className="text-xs font-headline font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" /> Zuweisungs-Struktur
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col items-center justify-center">
            <div className="h-[200px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {sourceData.map((entry, index) => <Cell key={index} fill={entry.color} cornerRadius={6} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-800 dark:text-white">{stats.activeAss}</span>
                <span className="text-[8px] font-black text-slate-400 uppercase">Rechte</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 border shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          <CardHeader className="p-6 border-b bg-slate-50/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-inner">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Empfehlungen</CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identifizierte Governance Aufgaben</p>
              </div>
            </div>
            <Badge className="bg-primary/10 text-primary border-none rounded-full text-[8px] font-black h-5 px-3 uppercase">AI Engine Active</Badge>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {stats.driftCount > 0 && (
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-2xl group hover:shadow-md transition-all cursor-pointer" onClick={() => router.push('/users?status=drift')}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-600 shadow-sm border border-amber-100"><RefreshCw className="w-5 h-5" /></div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Drift Korrektur erforderlich</h4>
                    <p className="text-[10px] text-amber-700 leading-relaxed font-medium">{stats.driftCount} Identitäten weichen ab. Starten Sie einen Sync-Run.</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
            <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl group hover:shadow-md transition-all cursor-pointer" onClick={() => router.push('/lifecycle')}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100"><UserPlus className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-bold text-indigo-900">Lifecycle Automation</h4>
                  <p className="text-[10px] text-indigo-700 font-medium">Standardzuweisungen für schnelleren Zugriff definieren.</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
