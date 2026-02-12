"use client";

import { useState, useMemo, useEffect } from 'react';
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
  Loader2, 
  ClipboardList, 
  MoreVertical, 
  Trash2, 
  Pencil, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  User as UserIcon,
  MessageSquare,
  ChevronRight,
  Filter,
  Save,
  Info,
  CalendarDays,
  Target,
  Send,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { saveTaskAction, deleteTaskAction, addTaskCommentAction } from '@/app/actions/task-actions';
import { toast } from '@/hooks/use-toast';
import { Task, TaskComment, PlatformUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TasksPage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState<Task['status']>('todo');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  // Comment State
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  const { data: tasks, isLoading, refresh } = usePluggableCollection<Task>('tasks');
  const { data: pUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: comments, refresh: refreshComments } = usePluggableCollection<TaskComment>('task_comments');

  useEffect(() => { setMounted(true); }, []);

  const handleSave = async () => {
    if (!title || !assigneeId) {
      toast({ variant: "destructive", title: "Fehler", description: "Titel und Verantwortlicher sind erforderlich." });
      return;
    }
    setIsSaving(true);
    const taskData: Partial<Task> = {
      ...selectedTask,
      tenantId: activeTenantId === 'all' ? 'global' : activeTenantId,
      title,
      description: desc,
      status,
      priority,
      assigneeId,
      dueDate,
      creatorId: selectedTask?.creatorId || user?.id || 'system'
    };

    try {
      const res = await saveTaskAction(taskData, dataSource, user?.email || 'system');
      if (res.success) {
        toast({ title: "Aufgabe gespeichert" });
        setIsDialogOpen(false);
        resetForm();
        refresh();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTask) return;
    setIsCommenting(true);
    const res = await addTaskCommentAction({
      taskId: selectedTask.id,
      userId: user?.id || 'system',
      userName: user?.displayName || user?.email || 'System',
      text: commentText,
      createdAt: new Date().toISOString()
    }, dataSource);
    if (res.success) {
      setCommentText('');
      refreshComments();
    }
    setIsCommenting(false);
  };

  const resetForm = () => {
    setSelectedTask(null);
    setTitle('');
    setDesc('');
    setStatus('todo');
    setPriority('medium');
    setAssigneeId('');
    setDueDate('');
  };

  const openEdit = (task: Task) => {
    setSelectedTask(task);
    setTitle(task.title);
    setDesc(task.description || '');
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId || '');
    setDueDate(task.dueDate || '');
    setIsDialogOpen(true);
  };

  const openDetail = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => {
      const matchTenant = activeTenantId === 'all' || t.tenantId === activeTenantId || t.tenantId === 'global';
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
      return matchTenant && matchStatus && matchSearch;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, search, statusFilter, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-10 max-w-[1800px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none uppercase tracking-widest">Governance Ops</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Aufgabenverwaltung</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zentrale Steuerung und Tracking von Compliance-Tasks.</p>
          </div>
        </div>
        <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-lg active:scale-95 transition-all" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-2" /> Neue Aufgabe
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Aufgaben suchen..." 
            className="pl-9 h-9 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-none shadow-none h-full rounded-sm bg-transparent text-[10px] font-bold min-w-[120px]">
              <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Alle Status</SelectItem>
              <SelectItem value="todo" className="text-xs">Offen</SelectItem>
              <SelectItem value="in_progress" className="text-xs">In Arbeit</SelectItem>
              <SelectItem value="done" className="text-xs">Erledigt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lade Aufgaben...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Titel / Referenz</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Verantwortlich</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Priorität</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Status</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((t) => {
                const assignee = pUsers?.find(u => u.id === t.assigneeId);
                const commentCount = comments?.filter(c => c.taskId === t.id).length || 0;
                return (
                  <TableRow key={t.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer" onClick={() => openDetail(t)}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-inner",
                          t.status === 'done' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                        )}>
                          <Target className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors">{t.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200 text-slate-400 px-1.5 h-4">{t.entityType || 'Global'}</Badge>
                            {commentCount > 0 && <span className="text-[9px] text-slate-400 flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> {commentCount}</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                        <UserIcon className="w-3 h-3 text-slate-300" /> {assignee?.displayName || 'Nicht zugewiesen'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-md font-bold text-[9px] h-5 px-2 border-none shadow-sm",
                        t.priority === 'critical' ? "bg-red-600 text-white" : t.priority === 'high' ? "bg-red-50 text-red-600" : t.priority === 'medium' ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                      )}>{t.priority.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "rounded-full text-[9px] font-bold h-5 px-2 border-none shadow-sm",
                        t.status === 'done' ? "bg-emerald-100 text-emerald-700" : t.status === 'in_progress' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                      )}>{t.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-right px-6" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-1.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm" onClick={() => openEdit(t)}>
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 transition-all"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-56 p-1 shadow-2xl border">
                            <DropdownMenuItem onSelect={() => openDetail(t)} className="rounded-lg py-2 gap-2 text-xs font-bold">
                              <ChevronRight className="w-3.5 h-3.5 text-primary" /> Details ansehen
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem className="text-red-600 rounded-lg py-2 gap-2 text-xs font-bold" onSelect={() => { if(confirm("Aufgabe permanent löschen?")) deleteTaskAction(t.id, dataSource).then(() => refresh()); }}>
                              <Trash2 className="w-3.5 h-3.5" /> Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Task Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] h-[90vh] md:h-auto md:max-h-[85vh] rounded-xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-10">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/10 shadow-sm">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate">{selectedTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe erfassen'}</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Zentrale Governance-Steuerung</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-white">
            <div className="p-6 md:p-8 space-y-8">
              <div className="space-y-2">
                <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Bezeichnung / Titel</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl h-12 text-sm font-bold border-slate-200 bg-white" placeholder="Was ist zu tun?" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Zuständigkeit (Assignee)</Label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {pUsers?.map(u => <SelectItem key={u.id} value={u.id} className="text-xs font-bold">{u.displayName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Deadline</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-xl h-11 border-slate-200 bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Priorität</Label>
                  <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low" className="text-xs font-bold">Niedrig</SelectItem>
                      <SelectItem value="medium" className="text-xs font-bold">Mittel</SelectItem>
                      <SelectItem value="high" className="text-xs font-bold">Hoch</SelectItem>
                      <SelectItem value="critical" className="text-xs font-bold text-red-600">Kritisch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Status</Label>
                  <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="todo" className="text-xs font-bold">Offen</SelectItem>
                      <SelectItem value="in_progress" className="text-xs font-bold">In Arbeit</SelectItem>
                      <SelectItem value="done" className="text-xs font-bold text-emerald-600">Erledigt</SelectItem>
                      <SelectItem value="archived" className="text-xs font-bold text-slate-400">Archiviert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Detailbeschreibung</Label>
                <Textarea value={desc} onChange={e => setDesc(e.target.value)} className="rounded-2xl min-h-[120px] text-xs font-medium border-slate-200 bg-slate-50/30 p-4 leading-relaxed" placeholder="Anweisungen für den Verantwortlichen..." />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold text-[10px] px-8 h-11 text-slate-400 hover:bg-white uppercase tracking-widest">Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSaving || !title || !assigneeId} className="rounded-xl font-bold text-[10px] tracking-widest px-12 h-11 bg-primary hover:bg-primary/90 text-white shadow-lg gap-2 uppercase">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          {selectedTask && (
            <>
              <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border border-white/10",
                      selectedTask.priority === 'critical' ? "bg-red-600" : "bg-primary"
                    )}>
                      <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-headline font-bold uppercase tracking-tight">{selectedTask.title}</DialogTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-white/10 text-white border-none rounded-full text-[8px] font-black uppercase px-2 h-4">{selectedTask.status}</Badge>
                        <span className="text-[9px] text-white/50 font-bold uppercase tracking-widest">ID: {selectedTask.id}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-white/50 hover:text-white" onClick={() => setIsDetailOpen(false)}><X className="w-5 h-5" /></Button>
                </div>
              </DialogHeader>

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden md:flex-row">
                {/* Left: Info */}
                <ScrollArea className="flex-1 border-r border-slate-100">
                  <div className="p-6 md:p-8 space-y-10">
                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2">Aufgabendetails</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Verantwortlich</p>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                            <UserIcon className="w-3.5 h-3.5 text-primary" /> {pUsers?.find(u => u.id === selectedTask.assigneeId)?.displayName || 'Unbekannt'}
                          </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Fälligkeit</p>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                            <CalendarDays className="w-3.5 h-3.5 text-orange-600" /> {selectedTask.dueDate || 'Keine Frist'}
                          </div>
                        </div>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-3 tracking-widest">Beschreibung</p>
                        <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap italic">"{selectedTask.description || 'Keine weitere Beschreibung hinterlegt.'}"</p>
                      </div>
                    </section>

                    {selectedTask.entityId && (
                      <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 border-b pb-2 flex items-center gap-2">
                          <Target className="w-3.5 h-3.5" /> Referenziertes Objekt
                        </h3>
                        <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100 flex items-center justify-between group hover:bg-indigo-50 transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/${selectedTask.entityType === 'feature' ? 'features' : selectedTask.entityType === 'process' ? 'processhub' : selectedTask.entityType}s?search=${selectedTask.entityId}`)}>
                          <div>
                            <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{selectedTask.entityType}</p>
                            <p className="text-[9px] text-indigo-400 font-bold mt-0.5">ID: {selectedTask.entityId}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600">
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </section>
                    )}
                  </div>
                </ScrollArea>

                {/* Right: Comments */}
                <aside className="w-full md:w-80 bg-slate-50 flex flex-col overflow-hidden">
                  <div className="p-4 border-b bg-white flex items-center justify-between shrink-0">
                    <h4 className="text-[10px] font-black uppercase text-slate-900 flex items-center gap-2 tracking-widest"><MessageSquare className="w-3.5 h-3.5 text-primary" /> Journal</h4>
                    <Badge variant="outline" className="text-[8px] font-black rounded-full h-4 px-1.5 border-none bg-primary/10 text-primary">{comments?.filter(c => c.taskId === selectedTask.id).length || 0}</Badge>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {comments?.filter(c => c.taskId === selectedTask.id).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(c => (
                        <div key={c.id} className="space-y-1 animate-in slide-in-from-bottom-1">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black text-slate-900 truncate max-w-[120px] uppercase">{c.userName}</span>
                            <span className="text-[8px] font-bold text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm text-[11px] leading-relaxed text-slate-700 font-medium">{c.text}</div>
                        </div>
                      ))}
                      {(!comments || comments.filter(c => c.taskId === selectedTask.id).length === 0) && (
                        <div className="py-10 text-center opacity-30">
                          <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-[9px] font-black uppercase tracking-widest">Keine Einträge</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="p-4 bg-white border-t space-y-3 shrink-0 shadow-inner">
                    <Textarea 
                      placeholder="Journal-Eintrag..." 
                      value={commentText} 
                      onChange={e => setCommentText(e.target.value)}
                      className="min-h-[80px] rounded-xl text-xs bg-slate-50 border-none shadow-inner p-3"
                    />
                    <Button className="w-full h-9 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 bg-slate-900 hover:bg-black text-white transition-all active:scale-95" onClick={handleAddComment} disabled={isCommenting || !commentText.trim()}>
                      {isCommenting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Journalisieren
                    </Button>
                  </div>
                </aside>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
