
"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Layers, 
  ShieldCheck, 
  Activity, 
  RefreshCw,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const riskData = [
  { name: 'Low Risk', value: 65, color: '#3b82f6' },
  { name: 'Med Risk', value: 25, color: '#f59e0b' },
  { name: 'High Risk', value: 10, color: '#ef4444' },
];

export default function DashboardPage() {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);

  const usersQuery = useMemoFirebase(() => collection(db, 'users'), [db]);
  const resourcesQuery = useMemoFirebase(() => collection(db, 'resources'), [db]);
  const assignmentsQuery = useMemoFirebase(() => collection(db, 'assignments'), [db]);
  const auditQuery = useMemoFirebase(() => collection(db, 'auditEvents'), [db]);

  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);
  const { data: resources, isLoading: resourcesLoading } = useCollection(resourcesQuery);
  const { data: assignments, isLoading: assignmentsLoading } = useCollection(assignmentsQuery);
  const { data: auditLogs, isLoading: auditLoading } = useCollection(auditQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const stats = [
    { title: 'Users', value: users?.length || 0, icon: Users, label: 'Identities', color: 'text-blue-600', bg: 'bg-blue-50', loading: usersLoading },
    { title: 'Systems', value: resources?.length || 0, icon: Layers, label: 'Catalog', color: 'text-indigo-600', bg: 'bg-indigo-50', loading: resourcesLoading },
    { title: 'Access', value: assignments?.filter(a => a.status === 'active').length || 0, icon: ShieldCheck, label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50', loading: assignmentsLoading },
    { title: 'Audits', value: auditLogs?.length || 0, icon: Activity, label: 'Journal', color: 'text-orange-600', bg: 'bg-orange-50', loading: auditLoading },
  ];

  const reviewProgress = assignments ? Math.round((assignments.filter(a => !!a.lastReviewedAt).length / (assignments.length || 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access Control Console</h1>
          <p className="text-sm text-muted-foreground">Operative Übersicht der Identitäts- und Zugriffsumgebung.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px]">
            <Activity className="w-3 h-3 mr-2" /> Compliance Report
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px]">
            <RefreshCw className="w-3 h-3 mr-2" /> Trigger Sync
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-none rounded-none border">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn("p-2 rounded-sm", stat.bg, stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    {stat.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <h3 className="text-2xl font-bold">{stat.value}</h3>}
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{stat.title}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-none rounded-none border overflow-hidden">
          <CardHeader className="border-b bg-muted/10 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-widest">Active Review Campaign (Q3)</CardTitle>
            <Badge className="rounded-none bg-blue-600">IN PROGRESS</Badge>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <p className="text-3xl font-bold">{reviewProgress}%</p>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-red-600 flex items-center justify-end gap-1">
                   {assignments?.filter(a => {
                     if (!a.grantedAt) return false;
                     return ((new Date().getTime() - new Date(a.grantedAt).getTime()) / 86400000) > 90 && !a.lastReviewedAt;
                   }).length || 0} Critical
                </p>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Pending Review</p>
              </div>
            </div>
            <Progress value={reviewProgress} className="h-2 rounded-none bg-slate-100" />
            <div className="mt-8 grid grid-cols-3 gap-4 border-t pt-6">
              <div className="text-center border-r">
                <p className="text-lg font-bold">{assignments?.length || 0}</p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Total Items</p>
              </div>
              <div className="text-center border-r">
                <p className="text-lg font-bold text-emerald-600">{assignments?.filter(a => !!a.lastReviewedAt).length || 0}</p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Certified</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-orange-600">{assignments?.filter(a => a.status === 'requested').length || 0}</p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none rounded-none border">
          <CardHeader className="border-b bg-muted/10 py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Risk Profiling</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                    {riskData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {riskData.map(item => (
                <div key={item.name} className="flex items-center justify-between text-[10px] font-bold uppercase">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-none" style={{backgroundColor: item.color}} />
                    <span>{item.name}</span>
                  </div>
                  <span className="text-muted-foreground">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none rounded-none border overflow-hidden">
        <CardHeader className="border-b bg-muted/10 py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-widest">Recent Activity Log</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-[9px] font-bold uppercase" asChild>
            <a href="/audit">Full Journal <ChevronRight className="ml-1 w-3 h-3" /></a>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {auditLogs?.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 hover:bg-muted/5 group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-none bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                    {log.action.includes('Zertifizierung') ? <CheckCircle2 className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{log.action}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{log.actorUid} • {log.entityType} ({log.entityId})</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase">{log.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'Now'}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
