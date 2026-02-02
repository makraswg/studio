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
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  ExternalLink,
  Shield,
  Layers,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ResourcesPage() {
  const { tenantId } = useParams();
  const db = useFirestore();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('SaaS');
  const [newOwner, setNewOwner] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCriticality, setNewCriticality] = useState('medium');
  const [newNotes, setNewNotes] = useState('');

  const resourcesQuery = useMemoFirebase(() => {
    return collection(db, 'tenants', tenantId as string, 'resources');
  }, [db, tenantId]);

  const { data: resources, isLoading } = useCollection(resourcesQuery);

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newOwner) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please fill in all required fields.",
      });
      return;
    }

    setIsSubmitting(true);
    const resourceId = `res-${Math.random().toString(36).substring(2, 9)}`;
    const resourceRef = doc(db, 'tenants', tenantId as string, 'resources', resourceId);

    const resourceData = {
      id: resourceId,
      tenantId: tenantId as string,
      name: newName,
      type: newType,
      owner: newOwner,
      url: newUrl,
      criticality: newCriticality,
      notes: newNotes,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(resourceRef, resourceData);
      toast({
        title: "Resource Created",
        description: `${newName} has been added to the catalog.`,
      });
      setIsCreateOpen(false);
      // Reset form
      setNewName('');
      setNewOwner('');
      setNewUrl('');
      setNewNotes('');
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "Failed to create resource.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredResources = resources?.filter(res => 
    res.name.toLowerCase().includes(search.toLowerCase()) ||
    res.owner.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Resource Catalog</h1>
          <p className="text-muted-foreground mt-1">Documentation of systems, applications and internal tools.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary gap-2 h-11 px-6 shadow-lg shadow-primary/20">
              <Plus className="w-5 h-5" /> Add Resource
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleCreateResource}>
              <DialogHeader>
                <DialogTitle>Add New Resource</DialogTitle>
                <DialogDescription>
                  Register a new system or application in the tenant inventory.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name *</Label>
                  <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} className="col-span-3" placeholder="e.g. AWS Production" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">Type</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SaaS">SaaS</SelectItem>
                      <SelectItem value="OnPrem">On-Premises</SelectItem>
                      <SelectItem value="Shop">Shop</SelectItem>
                      <SelectItem value="Tool">Internal Tool</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="owner" className="text-right">Owner *</Label>
                  <Input id="owner" value={newOwner} onChange={e => setNewOwner(e.target.value)} className="col-span-3" placeholder="Resource manager email" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="url" className="text-right">URL</Label>
                  <Input id="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="col-span-3" placeholder="https://..." />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="criticality" className="text-right">Criticality</Label>
                  <Select value={newCriticality} onValueChange={setNewCriticality}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="notes" className="text-right">Notes</Label>
                  <Textarea id="notes" value={newNotes} onChange={e => setNewNotes(e.target.value)} className="col-span-3" placeholder="Purpose of this resource..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Resource"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, owner or URL..." 
            className="pl-10 h-11 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 gap-2">
            <Filter className="w-4 h-4" /> Filter
          </Button>
          <Button variant="outline" className="h-11">
            Sort: Newest
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Loading catalog...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-accent/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px] py-4">Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Criticality</TableHead>
                <TableHead>Entitlements</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.map((resource) => (
                <TableRow key={resource.id} className="group transition-colors hover:bg-accent/10">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          {resource.name}
                          {resource.url && (
                            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{resource.notes}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-medium bg-secondary text-secondary-foreground">{resource.type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{resource.owner}</TableCell>
                  <TableCell>
                    <Badge 
                      className={cn(
                        "font-bold",
                        resource.criticality === 'high' ? "bg-red-500/10 text-red-500" :
                        resource.criticality === 'medium' ? "bg-orange-500/10 text-orange-500" :
                        "bg-blue-500/10 text-blue-500"
                      )}
                      variant="outline"
                    >
                      {resource.criticality?.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex -space-x-2">
                       <div className="w-7 h-7 rounded-full border-2 border-card bg-accent flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        0
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem className="font-medium">View Details</DropdownMenuItem>
                        <DropdownMenuItem className="font-medium">Edit Resource</DropdownMenuItem>
                        <DropdownMenuItem className="font-medium">Manage Entitlements</DropdownMenuItem>
                        <div className="h-px bg-border my-1" />
                        <DropdownMenuItem className="font-medium text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isLoading && filteredResources?.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-bold text-xl">No resources found</p>
              <p className="text-muted-foreground">Start by documenting your first IT resource or system.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
