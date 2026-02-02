"use client";

import { useState } from 'react';
import { useParams } from 'next/navigation';
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
  Filter, 
  Plus, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Calendar,
  User as UserIcon,
  Layers,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export default function AssignmentsPage() {
  const { tenantId } = useParams();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'requested' | 'removed'>('all');
  const [search, setSearch] = useState('');

  const assignmentsQuery = useMemoFirebase(() => {
    return collection(db, 'tenants', tenantId as string, 'assignments');
  }, [db, tenantId]);

  const { data: assignments, isLoading } = useCollection(assignmentsQuery);

  const filteredAssignments = assignments?.filter(assignment => {
    const matchesSearch = assignment.id.toLowerCase().includes(search.toLowerCase()) || 
                         assignment.ticketRef?.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || assignment.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const stats = {
    all: assignments?.length || 0,
    active: assignments?.filter(a => a.status === 'active').length || 0,
    requested: assignments?.filter(a => a.status === 'requested').length || 0,
    removed: assignments?.filter(a => a.status === 'removed').length || 0,
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Assignments</h1>
          <p className="text-muted-foreground mt-1">Management of user entitlements and permissions.</p>
        </div>
        <Button className="bg-primary gap-2 h-11 px-6 shadow-lg shadow-primary/20">
          <Plus className="w-5 h-5" /> New Assignment
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'all', label: 'All Assignments', count: stats.all, icon: ShieldCheck },
            { id: 'active', label: 'Active', count: stats.active, icon: CheckCircle2 },
            { id: 'requested', label: 'Requested', count: stats.requested, icon: Clock },
            { id: 'removed', label: 'Expired/Removed', count: stats.removed, icon: XCircle },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'outline'}
              className={cn(
                "h-12 px-6 gap-3 rounded-full shrink-0 border-none transition-all",
                activeTab === tab.id ? "bg-primary shadow-lg shadow-primary/30" : "bg-card hover:bg-accent/50 text-muted-foreground"
              )}
              onClick={() => setActiveTab(tab.id as any)}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-bold">{tab.label}</span>
              <Badge variant="secondary" className={cn("ml-1 font-bold", activeTab === tab.id ? "bg-white/20 text-white" : "bg-accent text-muted-foreground")}>
                {tab.count}
              </Badge>
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by ticket ID or assignment ID..." 
              className="pl-10 h-11 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 gap-2 border-dashed">
            <Filter className="w-4 h-4" /> Advanced Filter
          </Button>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground font-medium">Loading assignments...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-accent/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px] py-4">Assignment Details</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Ticket Reference</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments?.map((assignment) => (
                  <TableRow key={assignment.id} className="group transition-colors hover:bg-accent/10">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-blue-100 text-blue-600">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">Entitlement: {assignment.entitlementId}</div>
                          <div className="text-[10px] text-muted-foreground font-medium">ID: {assignment.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{assignment.userId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "border-none font-bold text-[10px]",
                        assignment.status === 'active' ? "bg-green-500/10 text-green-600" :
                        assignment.status === 'requested' ? "bg-orange-500/10 text-orange-600" :
                        "bg-red-500/10 text-red-600"
                      )}>
                        {assignment.status?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{assignment.validUntil ? new Date(assignment.validUntil).toLocaleDateString() : 'Permanent'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-medium bg-accent/30 border-none">
                        {assignment.ticketRef || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="font-bold text-primary hover:text-primary hover:bg-primary/5">
                        Modify
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredAssignments?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No assignments found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
