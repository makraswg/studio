
"use client";

import { useState } from 'react';
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
  Plus, 
  Loader2, 
  Shield 
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { Role } from '@/lib/types';

export default function RolesPage() {
  const [search, setSearch] = useState('');
  const { data: roles, loading: isLoading } = usePluggableCollection<Role>('roles');

  const filteredRoles = roles?.filter(role => 
    role.name.toLowerCase().includes(search.toLowerCase()) ||
    (role.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rollenverwaltung</h1>
          <p className="text-sm text-muted-foreground">Globale Definition von Rollen und Berechtigungen.</p>
        </div>
        <Button size="sm" className="h-9 font-bold uppercase text-[10px]">
          <Plus className="w-3 h-3 mr-2" /> Neue Rolle
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Rolle suchen..." 
          className="pl-10 h-10 rounded-none shadow-none border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card overflow-hidden rounded-none shadow-none">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Rollenname</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Beschreibung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles?.map((role) => (
                  <TableRow key={role.id} className="group hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-primary" />
                        <span className="font-bold text-sm">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                        <span className="text-sm text-muted-foreground">{role.description}</span>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
