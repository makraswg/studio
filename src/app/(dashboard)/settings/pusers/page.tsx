"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Users, ShieldCheck, Mail, Building2, ChevronRight, UserCircle } from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { PlatformUser } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function PlatformUsersPage() {
  const { dataSource } = useSettings();
  const { data: pUsers, refresh } = usePluggableCollection<PlatformUser>('platformUsers');

  const handleDelete = async (id: string) => {
    if(!confirm("Admin-Zugang permanent entfernen?")) return;
    try {
      const res = await deleteCollectionRecord('platformUsers', id, dataSource);
      if (res.success) {
        toast({ title: "Administrator entfernt" });
        refresh();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  return (
    <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="p-10 bg-slate-900 text-white shrink-0">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-xl">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-headline font-bold uppercase tracking-tight">Plattform Administratoren</CardTitle>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Berechtigte Nutzer für die Governance-Konsole</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
            <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
              <TableHead className="py-6 px-10 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Administrator</TableHead>
              <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Rolle</TableHead>
              <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Zuständigkeit</TableHead>
              <TableHead className="text-right px-10 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pUsers?.map(u => (
              <TableRow key={u.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-colors">
                <TableCell className="py-5 px-10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-black">
                      {u.displayName?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{u.displayName}</div>
                      <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3" /> {u.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase px-3 h-6 border-slate-200 dark:border-slate-800 text-slate-500">
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                    <Building2 className="w-3.5 h-3.5 text-slate-300" /> {u.tenantId || 'GLOBAL'}
                  </div>
                </TableCell>
                <TableCell className="text-right px-10">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all" 
                    onClick={() => handleDelete(u.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(!pUsers || pUsers.length === 0) && (
          <div className="py-20 text-center space-y-4">
            <UserCircle className="w-12 h-12 text-slate-200 mx-auto" />
            <p className="text-sm font-black uppercase text-slate-400 tracking-widest">Keine Administratoren gefunden</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
