
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
  ChevronRight,
  Plus,
  ArrowRight,
  MessageSquare,
  Zap,
  Info,
  Building2,
  Lock,
  ExternalLink,
  Eye,
  FileEdit,
  Globe,
  Tag,
  Paperclip,
  ImageIcon,
  FileUp,
  Trash2,
  AlertTriangle,
  BadgeCheck,
  Check,
  BrainCircuit,
  Target,
  Server,
  Layers,
  ShieldAlert,
  Search,
  X,
  BookOpen,
  Share2,
  FileDown,
  Download,
  Briefcase
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  const [draftContent, setDraftContent] = useState('');
  const [changelog, setChangelog] = useState('');

  // AI State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAuditResult, setAiAuditResult] = useState<PolicyValidatorOutput | null>(null);

  // Link Search State
  const [linkSearch, setLinkSearch] = useState('');

  const { data: policies, isLoading: isPolLoading, refresh: refreshPolicies } = usePluggableCollection<Policy>('policies');
  const { data: versions, refresh: refreshVersions } = usePluggableCollection<any>('policy_versions');
  const { data: mediaFiles, refresh: refreshMedia } = usePluggableCollection<MediaFile>('media');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: policyLinks, refresh: refreshLinks } = usePluggableCollection<any>('policy_links');
  const { data: controls } = usePluggableCollection<RiskControl>('riskControls');
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

  // Filtered Links
  const linkedRisks = useMemo(() => {
    const ids = policyLinks?.filter((l: any) => l.policyId === id && l.targetType === 'risk').map((l: any) => l.targetId);
    return risks?.filter(r => ids?.includes(r.id)) || [];
  }, [policyLinks, risks, id]);

  const linkedMeasures = useMemo(() => {
    const ids = policyLinks?.filter((l: any) => l.policyId === id && l.targetType === 'measure').map((l: any) => l.targetId);
    return measures?.filter(m => ids?.includes(m.id)) || [];
  }, [policyLinks, measures, id]);

  const linkedResources = useMemo(() => {
    const ids = policyLinks?.filter((l: any) => l.policyId === id && l.targetType === 'resource').map((l: any) => l.targetId);
    return resources?.filter(r => ids?.includes(r.id)) || [];
  }, [policyLinks, resources, id]);

  // Integrity Score Calculation
  const integrityScore = useMemo(() => {
    if (linkedMeasures.length === 0) return 0;
    const effectiveCount = linkedMeasures.filter(m => {
      const measureControls = controls?.filter(c => c.measureId === m.id) || [];
      return measureControls.some(c => c.isEffective);
    }).length;
    return Math.floor((effectiveCount * 100) / linkedMeasures.length);
  }, [linkedMeasures, controls]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (activeVersion && !editMode) {
      setDraftContent(activeVersion.content);
    }
  }, [activeVersion, editMode]);

  const handleSaveVersion = async (isMajor: boolean = false) => {
    if (!id || !draftContent) {
      toast({ variant: "destructive", title: "Inhalt leer", description: "Bitte geben Sie einen Text ein." });
      return;
    }
    setIsSaving(true);
    try {
      const res = await commitPolicyVersionAction(
        id as string, 
        activeVersion?.version || 1, 
        draftContent, 
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
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
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
              <ScrollText className="w-3 h-3" /> Wiki-Style Modul • V{policy.currentVersion}.{activeVersion?.revision || 0}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Export Dropdown */}
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

          <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-xs px-6 border-indigo-200 text-indigo-700 shadow-sm" onClick={handleAiAudit} disabled={isAiLoading}>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-4 px-6">
              <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-400">Dokumenten-Info</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Ownership (Rolle)</Label>
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl shadow-inner">
                    <Briefcase className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{jobTitles?.find(j => j.id === policy.ownerRoleId)?.name || 'Nicht zugewiesen'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Nächster Review</Label>
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
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => deleteMediaAction(file.id, file.tenantId, user?.email || 'admin', dataSource).then(() => refreshMedia())}>
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
              {editMode ? (
                <div className="space-y-6">
                  <Card className="rounded-2xl border shadow-xl overflow-hidden">
                    <CardHeader className="bg-slate-900 text-white p-4 px-6 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileEdit className="w-5 h-5 text-primary" />
                        <CardTitle className="text-sm font-bold uppercase tracking-widest">Inhalt bearbeiten (Markdown)</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Textarea 
                        value={draftContent} 
                        onChange={e => setDraftContent(e.target.value)} 
                        className="min-h-[500px] rounded-none border-none p-8 font-mono text-sm leading-relaxed focus:ring-0 bg-slate-50/30"
                        placeholder="# Überschrift\n\nBeschreiben Sie hier die Richtlinie..."
                      />
                    </CardContent>
                    <div className="p-6 border-t bg-slate-50 space-y-4">
                      <Input value={changelog} onChange={e => setChangelog(e.target.value)} placeholder="Änderungsgrund..." className="rounded-xl h-11 bg-white" />
                      <div className="flex justify-end gap-3">
                        <Button variant="outline" className="rounded-xl h-11 px-8 font-black text-[10px] uppercase" onClick={() => handleSaveVersion(true)} disabled={isSaving}>Freigabe erteilen</Button>
                        <Button className="rounded-xl h-11 px-12 bg-emerald-600 text-white font-black text-[10px] uppercase shadow-lg" onClick={() => handleSaveVersion(false)} disabled={isSaving}>Revision Sichern</Button>
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <Card className="rounded-2xl border shadow-xl bg-white p-10 min-h-[600px] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-300">Read-Only Mode</Badge>
                  </div>
                  <div className="max-w-3xl mx-auto prose prose-slate">
                    {activeVersion ? (
                      <div className="space-y-8">
                        <h1 className="font-headline font-black text-4xl">{policy.title}</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stand: {new Date(activeVersion.createdAt).toLocaleDateString()} • V{activeVersion.version}.{activeVersion.revision}</p>
                        <Separator />
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 font-medium">{activeVersion.content}</div>
                      </div>
                    ) : (
                      <div className="py-24 text-center space-y-4 opacity-30">
                        <ScrollText className="w-12 h-12 mx-auto" />
                        <p className="text-sm font-bold uppercase">Kein Inhalt vorhanden</p>
                        <Button variant="outline" onClick={() => setEditMode(true)}>Editor öffnen</Button>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="links" className="space-y-6 animate-in fade-in">
              <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-[2rem] flex items-center gap-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
                  <Info className="w-6 h-6" />
                </div>
                <p className="text-xs text-blue-800 font-medium leading-relaxed italic">
                  „Verknüpfungen im PolicyHub dienen der Dokumentation des regulatorischen Kontextes. Sie beeinflussen nicht den Inhalt, ermöglichen aber die automatisierte Compliance-Prüfung.“
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b p-4 px-6 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-widest">Risikobezug</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {linkedRisks.map(r => (
                        <div key={r.id} className="p-3 px-6 flex items-center justify-between group hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <span className="text-[11px] font-bold text-slate-700">{r.title}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => handleUnlink(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                      {linkedRisks.length === 0 && <p className="py-10 text-center text-[10px] text-slate-300 italic uppercase">Keine Risiken verknüpft</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b p-4 px-6 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-black uppercase text-emerald-600 tracking-widest">Maßnahmen (TOM)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {linkedMeasures.map(m => (
                        <div key={m.id} className="p-3 px-6 flex items-center justify-between group hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-[11px] font-bold text-slate-700">{m.title}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => handleUnlink(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                      {linkedMeasures.length === 0 && <p className="py-10 text-center text-[10px] text-slate-300 italic uppercase">Keine Maßnahmen verknüpft</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="p-6 bg-slate-100 border border-dashed rounded-[2rem] flex flex-col items-center gap-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Schnell-Verknüpfung</h4>
                <div className="flex flex-wrap justify-center gap-3">
                  <Select onValueChange={(val) => handleLinkEntity('risk', val)}>
                    <SelectTrigger className="w-48 h-9 rounded-xl bg-white"><SelectValue placeholder="Risiko wählen" /></SelectTrigger>
                    <SelectContent>{risks?.filter(r => !linkedRisks.some(lr => lr.id === r.id)).map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select onValueChange={(val) => handleLinkEntity('measure', val)}>
                    <SelectTrigger className="w-48 h-9 rounded-xl bg-white"><SelectValue placeholder="Maßnahme wählen" /></SelectTrigger>
                    <SelectContent>{measures?.filter(m => !linkedMeasures.some(lm => lm.id === m.id)).map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-6">
                  <CardTitle className="text-sm font-headline font-bold uppercase tracking-tight">Revision-History & Audit Trail</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {policyVersions.map(v => (
                      <div key={v.id} className="p-6 hover:bg-slate-50 transition-all flex items-start justify-between group">
                        <div className="flex items-start gap-5">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner", v.revision === 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400")}>
                            {v.revision === 0 ? <BadgeCheck className="w-6 h-6" /> : <History className="w-6 h-6" />}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 text-sm">Version {v.version}.{v.revision}</h4>
                            <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-2 rounded-lg border border-dashed italic">"{v.changelog || 'Keine Notiz'}"</p>
                            <div className="flex items-center gap-4 mt-4 text-[9px] font-bold text-slate-400 uppercase">
                              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 opacity-50" /> {new Date(v.createdAt).toLocaleString()}</span>
                              <span className="flex items-center gap-1.5"><UserCircle className="w-2.5 h-2.5 opacity-50" /> {v.createdBy}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 uppercase text-[9px] font-black" onClick={() => { setDraftContent(v.content); setEditMode(true); }}>Snapshot laden</Button>
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
