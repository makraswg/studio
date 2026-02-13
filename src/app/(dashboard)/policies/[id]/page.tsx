
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  ScrollText, 
  History, 
  Save, 
  CheckCircle2, 
  Clock, 
  Activity, 
  FileText, 
  UserCircle,
  ShieldCheck,
  Plus,
  ArrowRight,
  Zap,
  Info,
  ExternalLink,
  Eye,
  FileEdit,
  Trash2,
  AlertTriangle,
  BadgeCheck,
  BrainCircuit,
  Target,
  Server,
  X,
  BookOpen,
  Share2,
  FileDown,
  Briefcase,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Table as TableIcon,
  Minus,
  CalendarDays,
  Image as LuImage,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  PlusSquare,
  Columns,
  Rows,
  Trash,
  Paperclip,
  ImageIcon,
  FileUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { Policy, PolicyVersion, JobTitle, MediaFile, Risk, RiskMeasure, Resource, RiskControl, BookStackConfig, Tenant } from '@/lib/types';
import { commitPolicyVersionAction, linkPolicyEntityAction, unlinkPolicyEntityAction } from '@/app/actions/policy-actions';
import { saveMediaAction, deleteMediaAction } from '@/app/actions/media-actions';
import { publishPolicyToBookStackAction } from '@/app/actions/bookstack-actions';
import { runPolicyValidation, PolicyValidatorOutput } from '@/ai/flows/policy-validator-flow';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { exportPolicyPdf, exportPolicyDocx } from '@/lib/export-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

// TipTap Imports
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';

export default function PolicyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = usePlatformAuth();
  const { dataSource, activeTenantId } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [changelog, setChangelog] = useState('');

  // AI State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAuditResult, setAiAuditResult] = useState<PolicyValidatorOutput | null>(null);

  const { data: policies, isLoading: isPolLoading, refresh: refreshPolicies } = usePluggableCollection<Policy>('policies');
  const { data: versions, refresh: refreshVersions } = usePluggableCollection<any>('policy_versions');
  const { data: mediaFiles, refresh: refreshMedia } = usePluggableCollection<MediaFile>('media');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: policyLinks, refresh: refreshLinks } = usePluggableCollection<any>('policy_links');
  const { data: bsConfigs } = usePluggableCollection<BookStackConfig>('bookstackConfigs');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  const policy = useMemo(() => policies?.find(p => p.id === id), [policies, id]);
  const policyVersions = useMemo(() => 
    (versions || [])
      .filter((v: any) => v.policyId === id)
      .sort((a: any, b: any) => b.version - a.version || b.revision - a.revision) || [], 
    [versions, id]
  );
  const activeVersion = policyVersions[0];
  const policyAttachments = mediaFiles?.filter(m => m.entityId === id && m.module === 'PolicyHub') || [];
  const hasBookStack = bsConfigs?.some(c => c.enabled);
  const tenant = useMemo(() => tenants?.find(t => t.id === policy?.tenantId), [tenants, policy]);

  const linkedRisks = useMemo(() => {
    const ids = policyLinks?.filter((l: any) => l.policyId === id && l.targetType === 'risk').map((l: any) => l.targetId);
    return risks?.filter(r => ids?.includes(r.id)) || [];
  }, [policyLinks, risks, id]);

  const linkedMeasures = useMemo(() => {
    const ids = policyLinks?.filter((l: any) => l.policyId === id && l.targetType === 'measure').map((l: any) => l.targetId);
    return measures?.filter(m => ids?.includes(m.id)) || [];
  }, [policyLinks, measures, id]);

  // TipTap Editor Configuration
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight,
      Typography,
      Placeholder.configure({
        placeholder: 'Beginnen Sie hier mit der Erstellung Ihrer Richtlinie...',
      }),
    ],
    content: '',
    editable: false,
  });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (editor && activeVersion && !editMode) {
      editor.commands.setContent(activeVersion.content);
      editor.setEditable(false);
    }
  }, [activeVersion, editor, editMode]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editMode);
    }
  }, [editMode, editor]);

  const handleSaveVersion = async (isMajor: boolean = false) => {
    if (!id || !editor) return;
    const content = editor.getHTML();
    if (!content || content === '<p></p>') {
      toast({ variant: "destructive", title: "Inhalt leer", description: "Bitte geben Sie einen Text ein." });
      return;
    }
    setIsSaving(true);
    try {
      const res = await commitPolicyVersionAction(
        id as string, 
        activeVersion?.version || 1, 
        content, 
        changelog || (isMajor ? "Neue Hauptversion / Freigabe" : "Revision"), 
        user?.email || 'system', 
        dataSource, 
        isMajor
      );
      if (res.success) {
        toast({ title: isMajor ? "Version veröffentlicht" : "Revision gespeichert" });
        setEditMode(false);
        setChangelog('');
        refreshVersions();
        refreshPolicies();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleBookStackExport = async () => {
    if (!activeVersion || !id) return;
    setIsExporting(true);
    try {
      const res = await publishPolicyToBookStackAction(id as string, activeVersion.id, dataSource);
      if (res.success) {
        toast({ title: "Export erfolgreich", description: "Dokument wurde in BookStack aktualisiert." });
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export fehlgeschlagen", description: e.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = () => {
    if (!policy || !activeVersion) return;
    exportPolicyPdf(policy, activeVersion, tenant?.name || 'Global');
    toast({ title: "PDF generiert" });
  };

  const handleExportDocx = () => {
    if (!policy || !activeVersion) return;
    exportPolicyDocx(policy, activeVersion);
    toast({ title: "Word-Dokument generiert" });
  };

  const handleLinkEntity = async (type: 'risk' | 'measure' | 'resource', targetId: string) => {
    const res = await linkPolicyEntityAction(id as string, type, targetId, dataSource);
    if (res.success) {
      toast({ title: "Verknüpfung erstellt" });
      refreshLinks();
    }
  };

  const handleUnlink = async (targetId: string) => {
    const link = policyLinks?.find((l: any) => l.policyId === id && l.targetId === targetId);
    if (link) {
      await unlinkPolicyEntityAction(link.id, dataSource);
      refreshLinks();
      toast({ title: "Verknüpfung entfernt" });
    }
  };

  const handleAiAudit = async () => {
    if (!activeVersion) return;
    setIsAiLoading(true);
    try {
      const res = await runPolicyValidation({
        title: policy?.title || '',
        content: activeVersion.content,
        linkedRisks: linkedRisks.map(r => ({ title: r.title, description: r.description || '' })),
        linkedMeasures: linkedMeasures.map(m => ({ title: m.title, description: m.description || '' })),
        tenantId: policy?.tenantId,
        dataSource
      });
      setAiAuditResult(res);
      toast({ title: "KI-Audit abgeschlossen" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const mediaId = `med-pol-${Math.random().toString(36).substring(2, 9)}`;
      const mediaData: MediaFile = {
        id: mediaId,
        tenantId: policy?.tenantId || activeTenantId || 'global',
        module: 'PolicyHub',
        entityId: id as string,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: base64,
        createdAt: new Date().toISOString(),
        createdBy: user?.email || 'system'
      };
      try {
        const res = await saveMediaAction(mediaData, dataSource);
        if (res.success) {
          toast({ title: "Anhang hinzugefügt" });
          refreshMedia();
        }
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!mounted) return null;
  if (isPolLoading) return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-emerald-600 opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade Dokumenten-Container...</p></div>;
  if (!policy) return null;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700 max-w-[1600px] mx-auto p-4 md:p-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/policies')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{policy.title}</h1>
              <Badge className={cn(
                "rounded-full px-3 h-6 text-[10px] font-black uppercase border-none shadow-sm",
                policy.status === 'published' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
              )}>{policy.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <ScrollText className="w-3 h-3" /> Wiki-Style Modul • V{policy.currentVersion}.0 • Rev. {activeVersion?.revision || 0}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-xs px-6 border-slate-200 hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-2xl border bg-white">
              <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400 px-3 py-2 tracking-widest">Format wählen</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleExportPdf} className="rounded-lg py-2.5 gap-3 text-xs font-bold cursor-pointer">
                <FileDown className="w-4 h-4 text-red-500" /> PDF Dokument
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportDocx} className="rounded-lg py-2.5 gap-3 text-xs font-bold cursor-pointer">
                <FileText className="w-4 h-4 text-blue-600" /> Word (DOCX)
              </DropdownMenuItem>
              {hasBookStack && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleBookStackExport} disabled={isExporting} className="rounded-lg py-2.5 gap-3 text-xs font-bold cursor-pointer">
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4 text-indigo-600" />}
                    BookStack Sync
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-xs px-6 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm" onClick={handleAiAudit} disabled={isAiLoading}>
            {isAiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />} KI Audit
          </Button>
          {!editMode ? (
            <Button size="sm" className="h-10 rounded-xl font-bold text-xs px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:scale-95 transition-all" onClick={() => setEditMode(true)}>
              <FileEdit className="w-4 h-4 mr-2" /> Editor öffnen
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-10 rounded-xl font-bold text-xs px-6" onClick={() => setEditMode(false)}>Verwerfen</Button>
              <Button size="sm" className="h-10 rounded-xl font-bold text-xs px-8 bg-emerald-600 text-white shadow-lg" onClick={() => handleSaveVersion(false)} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Revision sichern
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-4 px-6">
              <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-400">Dokumenten-Info</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Ownership (Rolle)</p>
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl shadow-inner">
                    <Briefcase className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{jobTitles?.find(j => j.id === policy.ownerRoleId)?.name || 'Nicht zugewiesen'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Nächster Review</p>
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl shadow-inner">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">In {policy.reviewInterval} Tagen</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-4 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Paperclip className="w-3.5 h-3.5" /> Anhänge ({policyAttachments.length})
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => fileInputRef.current?.click()}>
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {policyAttachments.map(file => (
                  <div key={file.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-primary/20 transition-all">
                    <div className="min-w-0 flex items-center gap-2">
                      {file.fileType.includes('image') ? <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> : <FileText className="w-3.5 h-3.5 text-slate-400" />}
                      <span className="text-[10px] font-bold truncate max-w-[120px]">{file.fileName}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100 transition-all" onClick={() => deleteMediaAction(file.id, file.tenantId, user?.email || 'admin', dataSource).then(() => refreshMedia())}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="content" className="space-y-6">
            <TabsList className="bg-slate-100 p-1.5 h-14 rounded-2xl border w-full justify-start gap-2 shadow-inner">
              <TabsTrigger value="content" className="rounded-xl px-6 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
                <BookOpen className="w-4 h-4" /> Inhalt
              </TabsTrigger>
              <TabsTrigger value="links" className="rounded-xl px-6 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
                <Target className="w-4 h-4" /> GRC-Bezug
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl px-6 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-lg">
                <History className="w-4 h-4" /> Historie
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="animate-in fade-in duration-500">
              {editMode && editor ? (
                <div className="space-y-6">
                  <Card className="rounded-2xl border shadow-xl overflow-hidden flex flex-col">
                    <CardHeader className="bg-slate-50 border-b p-0 flex flex-col sticky top-0 z-30">
                      <div className="p-4 px-6 flex flex-row items-center justify-between border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <FileEdit className="w-5 h-5 text-primary" />
                          <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-900">WYSIWYG Dokumenten-Editor</CardTitle>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 border-none rounded-full text-[8px] font-black uppercase px-2 h-4">Word-Modus Aktiv</Badge>
                      </div>
                      
                      <div className="bg-white p-2 px-6 flex flex-wrap items-center gap-1">
                        <TooltipProvider>
                          {/* Text Styles */}
                          <div className="flex items-center gap-0.5 pr-2 border-r">
                            <Tooltip><TooltipTrigger asChild><Button variant={editor.isActive('bold') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Fett</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant={editor.isActive('italic') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Kursiv</TooltipContent></Tooltip>
                          </div>
                          
                          {/* Headers */}
                          <div className="flex items-center gap-0.5 px-2 border-r">
                            <Tooltip><TooltipTrigger asChild><Button variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Überschrift 1</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Überschrift 2</TooltipContent></Tooltip>
                          </div>

                          {/* Alignment */}
                          <div className="flex items-center gap-0.5 px-2 border-r">
                            <Tooltip><TooltipTrigger asChild><Button variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Linksbündig</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Zentriert</TooltipContent></Tooltip>
                          </div>

                          {/* Lists */}
                          <div className="flex items-center gap-0.5 px-2 border-r">
                            <Tooltip><TooltipTrigger asChild><Button variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Aufzählung</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Nummerierung</TooltipContent></Tooltip>
                          </div>

                          {/* Tables - Modern Dropdown */}
                          <div className="flex items-center gap-0.5 px-2 border-r">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><TableIcon className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-48 rounded-xl p-1">
                                <DropdownMenuItem className="text-xs font-bold gap-2" onSelect={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                                  <PlusSquare className="w-3.5 h-3.5" /> Tabelle einfügen (3x3)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-xs font-bold gap-2" onSelect={() => editor.chain().focus().addColumnAfter().run()}>
                                  <Columns className="w-3.5 h-3.5" /> Spalte hinzufügen
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-xs font-bold gap-2" onSelect={() => editor.chain().focus().addRowAfter().run()}>
                                  <Rows className="w-3.5 h-3.5" /> Zeile hinzufügen
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-xs font-bold gap-2 text-red-600" onSelect={() => editor.chain().focus().deleteTable().run()}>
                                  <Trash className="w-3.5 h-3.5" /> Tabelle löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Media & Others */}
                          <div className="flex items-center gap-0.5 pl-2">
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const url = window.prompt('Bild URL eingeben (oder Anhang nutzen)'); if (url) editor.chain().focus().setImage({ src: url }).run(); }}><LuImage className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Bild einfügen</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold">Trennlinie</TooltipContent></Tooltip>
                          </div>
                        </TooltipProvider>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 bg-slate-100 flex justify-center overflow-auto min-h-[800px]">
                      <div className="w-full max-w-4xl min-h-[1000px] bg-white shadow-2xl my-12 mx-4 p-20 rounded-sm relative prose prose-slate max-w-none">
                        <EditorContent editor={editor} className="outline-none min-h-[800px]" />
                      </div>
                    </CardContent>
                    <div className="p-8 border-t bg-slate-50 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Änderungsgrund (revisionssicher)</Label>
                        <Input value={changelog} onChange={e => setChangelog(e.target.value)} placeholder="z.B. Integration der neuen Home-Office Richtlinie..." className="rounded-xl h-12 bg-white border-slate-200 font-bold" />
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button variant="outline" className="rounded-xl h-12 px-8 font-black text-[10px] uppercase border-slate-200" onClick={() => handleSaveVersion(true)} disabled={isSaving}>Offizielle Freigabe (Major)</Button>
                        <Button className="rounded-xl h-12 px-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase shadow-lg transition-all active:scale-95 gap-2" onClick={() => handleSaveVersion(false)} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Revision Sichern
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <Card className="rounded-2xl border shadow-xl bg-white p-16 min-h-[700px] relative overflow-hidden">
                  <div className="max-w-4xl mx-auto">
                    {activeVersion ? (
                      <div className="space-y-10">
                        <header className="space-y-4">
                          <h1 className="font-headline font-black text-4xl text-slate-900 leading-tight">{policy.title}</h1>
                          <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 p-3 rounded-xl border border-slate-100 w-fit">
                            <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 opacity-50" /> {new Date(activeVersion.createdAt).toLocaleDateString()}</span>
                            <span className="flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-emerald-500" /> Version {activeVersion.version}.{activeVersion.revision}</span>
                            <span className="flex items-center gap-2"><UserCircle className="w-4 h-4 opacity-50" /> {activeVersion.createdBy}</span>
                          </div>
                        </header>
                        <Separator />
                        <div className="text-lg leading-relaxed text-slate-700 font-medium font-body prose prose-slate max-w-none break-words" dangerouslySetInnerHTML={{ __html: activeVersion.content }} />
                      </div>
                    ) : (
                      <div className="py-32 text-center space-y-8 opacity-30">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-dashed border-slate-300">
                          <ScrollText className="w-12 h-12 text-slate-300" />
                        </div>
                        <div className="space-y-3">
                          <p className="text-lg font-bold uppercase tracking-widest text-slate-900">Kein Dokumenten-Inhalt</p>
                          <p className="text-sm text-slate-500 italic max-w-sm mx-auto leading-relaxed">Dieses Dokument wurde noch nicht befüllt. Nutzen Sie den Editor, um den Text zu erstellen.</p>
                        </div>
                        <Button className="rounded-xl h-12 px-12 bg-primary text-white font-bold text-xs uppercase tracking-widest shadow-lg" onClick={() => setEditMode(true)}>Editor öffnen</Button>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="links" className="space-y-6 animate-in fade-in">
              <div className="p-8 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] flex items-center gap-8 shadow-sm">
                <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shrink-0">
                  <Target className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black uppercase text-indigo-900">GRC-Context Mapping</h4>
                  <p className="text-xs text-indigo-700 font-medium leading-relaxed italic">
                    Verknüpfen Sie dieses Dokument mit operativen Risiken und technischen Maßnahmen.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b p-4 px-8">
                    <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-widest">Risikobezug</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {linkedRisks.map(r => (
                        <div key={r.id} className="p-4 px-8 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            <div>
                              <p className="text-xs font-bold text-slate-800">{r.title}</p>
                              <p className="text-[9px] text-slate-400 font-black uppercase">{r.category}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => handleUnlink(r.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ))}
                      {linkedRisks.length === 0 && <p className="py-16 text-center text-[10px] text-slate-300 italic uppercase">Keine Risiken verknüpft</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b p-4 px-8">
                    <CardTitle className="text-xs font-black uppercase text-emerald-600 tracking-widest">Maßnahmen (TOM)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {linkedMeasures.map(m => (
                        <div key={m.id} className="p-4 px-8 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            <div>
                              <p className="text-xs font-bold text-slate-800">{m.title}</p>
                              <p className="text-[9px] text-slate-400 font-black uppercase">{m.tomCategory || 'TOM'}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => handleUnlink(m.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ))}
                      {linkedMeasures.length === 0 && <p className="py-16 text-center text-[10px] text-slate-300 italic uppercase">Keine Maßnahmen verknüpft</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="p-8 bg-slate-50 border border-dashed rounded-[2.5rem] flex flex-col items-center gap-6 shadow-inner">
                <div className="text-center space-y-1">
                  <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Schnell-Verknüpfung hinzufügen</h4>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  <Select onValueChange={(val) => handleLinkEntity('risk', val)}>
                    <SelectTrigger className="w-64 h-11 rounded-xl bg-white border-slate-200 font-bold text-xs"><SelectValue placeholder="Risiko verknüpfen" /></SelectTrigger>
                    <SelectContent className="rounded-xl">{risks?.filter(r => !linkedRisks.some(lr => lr.id === r.id)).map(r => <SelectItem key={r.id} value={r.id} className="text-xs">{r.title}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select onValueChange={(val) => handleLinkEntity('measure', val)}>
                    <SelectTrigger className="w-64 h-11 rounded-xl bg-white border-slate-200 font-bold text-xs"><SelectValue placeholder="Maßnahme verknüpfen" /></SelectTrigger>
                    <SelectContent className="rounded-xl">{measures?.filter(m => !linkedMeasures.some(lm => lm.id === m.id)).map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-6 px-8">
                  <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-slate-500" />
                    <CardTitle className="text-sm font-headline font-bold uppercase tracking-tight">Audit Trail & Revisionen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {policyVersions.map(v => (
                      <div key={v.id} className="p-8 hover:bg-slate-50 transition-all flex items-start justify-between group">
                        <div className="flex items-start gap-6">
                          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-105", v.revision === 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>
                            {v.revision === 0 ? <BadgeCheck className="w-7 h-7" /> : <History className="w-7 h-7" />}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h4 className="font-black text-slate-900 text-base">Version {v.version}.{v.revision}</h4>
                              {v.revision === 0 && <Badge className="bg-emerald-500 text-white border-none rounded-full text-[8px] font-black uppercase px-2 h-4">Major Release</Badge>}
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 italic max-w-xl">
                              "{v.changelog || 'Keine Revisionsnotiz hinterlegt.'}"
                            </p>
                            <div className="flex items-center gap-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-1">
                              <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 opacity-50" /> {new Date(v.createdAt).toLocaleString()}</span>
                              <span className="flex items-center gap-2"><UserCircle className="w-3.5 h-3.5 opacity-50" /> Erstellt von: {v.createdBy}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 uppercase text-[9px] font-black h-9 px-6 rounded-xl hover:bg-white shadow-sm" onClick={() => { if(editor) editor.commands.setContent(v.content); setEditMode(true); window.scrollTo({top: 0, behavior: 'smooth'}); }}>Snapshot laden</Button>
                      </div>
                    ))}
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
