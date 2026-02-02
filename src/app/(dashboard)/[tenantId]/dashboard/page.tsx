"use client";

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Layers, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight,
  Activity,
  ChevronRight,
  Loader2
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

const data = [
  { name: 'Mon', active: 400 },
  { name: 'Tue', active: 300 },
  { name: 'Wed', active: 520 },
  { name: 'Thu', active: 450 },
  { name: 'Fri', active: 600 },
  { name: 'Sat', active: 200 },
  { name: 'Sun', active: 150 },
];

const riskData = [
  { name: 'Low', value: 40, color: '#10b981' },
  { name: 'Medium', value: 30, color: '#f59e0b' },
  { name: 'High', value: 15, color: '#ef4444' },
];

export default function TenantDashboard() {
  const { tenantId } = useParams();
  const db = useFirestore();

  // Fetch collections for stats
  const usersQuery = useMemoFirebase(() => collection(db, 'tenants', tenantId as string, 'users'), [db, tenantId]);
  const resourcesQuery = useMemoFirebase(() => collection(db, 'tenants', tenantId as string, 'resources'), [db, tenantId]);
  const assignmentsQuery = useMemoFirebase(() => collection(db, 'tenants', tenantId as string, 'assignments'), [db, tenantId]);
  const auditQuery = useMemoFirebase(() => collection(db, 'tenants', tenantId as string, 'auditEvents'), [db, tenantId]);

  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);
  const { data: resources, isLoading: resourcesLoading } = useCollection(resourcesQuery);
  const { data: assignments, isLoading: assignmentsLoading } = useCollection(assignmentsQuery);
  const { data: auditLogs, isLoading: auditLoading } = useCollection(auditQuery);

  const stats = [
    { title: 'Total Users', value: users?.length || 0, icon: Users, trend: 'LDAP Synced', color: 'text-blue-500', loading: usersLoading },
    { title: 'Resources', value: resources?.length || 0, icon: Layers, trend: 'Managed', color: 'text-purple-500', loading: resourcesLoading },
    { title: 'Active Assignments', value: assignments?.length || 0, icon: ShieldCheck, trend: 'Certified', color: 'text-green-500', loading: assignmentsLoading },
    { title: 'Recent Events', value: auditLogs?.length || 0, icon: Activity, trend: 'Recorded', color: 'text-orange-500', loading: auditLoading },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time statistics for {tenantId} access inventory.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Activity className="w-4 h-4" />
            Export Report
          </Button>
          <Button className="bg-primary gap-2">
            Sync LDAP
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2 rounded-lg bg-opacity-10", stat.color.replace('text', 'bg'))}>
                  <stat.icon className={cn("w-6 h-6", stat.color)} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{stat.trend}</span>
              </div>
              <div className="space-y-1">
                {stat.loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : (
                  <h3 className="text-2xl font-bold tracking-tight">{stat.value}</h3>
                )}
                <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Activity Sync History</CardTitle>
            <CardDescription>User synchronization patterns over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="active" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Entitlement Risk Levels</CardTitle>
            <CardDescription>Distribution of access risk profiles.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-4">
              {riskData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}} />
                  <span className="text-xs font-medium text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle>Recent Audit Logs</CardTitle>
              <CardDescription>Latest changes across the inventory.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary hover:bg-primary/5">
              View all <ChevronRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-4">
              {auditLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : auditLogs && auditLogs.length > 0 ? (
                auditLogs.slice(0, 5).map((log, i) => (
                  <div key={log.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-accent/30 transition-colors group">
                    <div className="mt-1 w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{log.action}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground">{log.actorUid}</span> changed {log.entityType}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">No recent activity found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm border-l-4 border-l-orange-500 bg-orange-50/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <CardTitle className="text-orange-950">System Insights</CardTitle>
            </div>
            <CardDescription className="text-orange-900/70">
              Inventory health and compliance status summary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-4 bg-card rounded-xl border border-orange-100 shadow-sm">
                <p className="text-sm font-bold">Review Campaign Due</p>
                <p className="text-xs text-muted-foreground">The quarterly access review for high-risk systems starts in 3 days.</p>
              </div>
              <Button variant="link" className="text-orange-600 font-bold p-0 mt-2 hover:no-underline hover:text-orange-700">
                Manage Review Campaigns <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
