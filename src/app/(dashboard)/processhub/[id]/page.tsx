"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  Send, 
  Check, 
  X, 
  BrainCircuit, 
  BookOpen,
  ShieldCheck,
  Save, 
  Trash2, 
  Activity, 
  RefreshCw, 
  GitBranch, 
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  FileCode,
  FilePen,
  ArrowRight,
  CheckCircle,
  Link as LinkIcon,
  Maximize2,
  CircleDot,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Info,
  Sparkles,
  Briefcase,
  Minus,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { applyProcessOpsAction, updateProcessMetadataAction } from '@/app/actions/process-actions';
import { getProcessSuggestions } from '@/ai/flows/process-designer-flow';
import { publishToBookStackAction } from '@/app/actions/bookstack-actions';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessComment, ProcessNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Erzeugt MX-XML für draw.io Integration.
 * Korrektur: Linien (Edges) werden nun explizit mit Kontrastfarben gezeichnet.
 */
function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach((node, idx) => {
    let nodeSafeId = String(node.id || `node-${idx}`);
    const pos = positions[nodeSafeId] || { x: 50 + (idx * 220), y: 150 };
    let style = '';
    let w = 160, h = 80;
    
    switch (node.type) {
      case 'start': 
        style = 'ellipse;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;shadow=1;'; 
        w = 60; h = 60; 
        break;
      case 'end': 
        const hasLink = !!node.targetProcessId && node.targetProcessId !== 'none';
        style = hasLink 
          ? 'ellipse;fillColor=#e1f5fe;strokeColor=#0288d1;strokeWidth=3;shadow=1;' 
          : 'ellipse;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=3;shadow=1;'; 
        w = 60; h = 60; 
        break;
      case 'decision': 
        style = 'rhombus;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;shadow=1;'; 
        w = 100; h = 100; 
        break;
      case 'subprocess':
        style = 'whiteSpace=wrap;html=1;rounded=1;fillColor=#eff6ff;strokeColor=#3b82f6;strokeWidth=2;shadow=1;fontStyle=1;';
        break;
      default: 
        style = 'whiteSpace=wrap;html=1;rounded=1;fillColor=#ffffff;strokeColor=#334155;strokeWidth=2;shadow=1;';
    }
    xml += `<mxCell id="${nodeSafeId}" value="${node.title}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    let edgeSafeId = String(edge.id || `edge-${idx}`);
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    
    const sourceExists = nodes.some(n => String(n.id) === sourceId);
    const targetExists = nodes.some(n => String(n.id) === targetId);
    
    if (sourceExists && targetExists) {
      xml += `<mxCell id="${edgeSafeId}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=2;fontSize=10;fontColor=#1e293b;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
    }
  });
  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function ProcessDesignerPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource } = useSettings();
  const { user } = usePlatformAuth();
  const isMobile = useIsMobile();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [leftWidth, setLeftWidth] = useState(360);
  const isResizingLeft = useRef(false);

  // Floating AI State
  const [isAiAdvisorOpen, setIsAiAdvisorOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [localNodeEdits, setLocalNodeEdits] = useState({ 
    id: '', title: '', roleId: '', description: '', checklist: '', tips: '', errors: '', type: 'step', targetProcessId: '', customFields: {} as Record<string, string>
  });

  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaOpenQuestions, setMetaOpenQuestions] = useState('');
  const [metaStatus, setMetaStatus] = useState<any>('draft');

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: comments, refresh: refreshComments } = usePluggableCollection<ProcessComment>('process_comments');
  const { data: auditEvents } = usePluggableCollection<any>('auditEvents');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);
  const processComments = useMemo(() => comments?.filter(c => c.process_id === id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [], [comments, id]);

  const selectedNode = useMemo(() => 
    currentVersion?.model_json?.nodes?.find((n: any) => n.id === selectedNodeId), 
    [currentVersion, selectedNodeId]
  );

  useEffect(() => {
    if (currentProcess) {
      setMetaTitle(currentProcess.title || '');
      setMetaDesc(currentProcess.description || '');
      setMetaOpenQuestions(currentProcess.openQuestions || '');
      setMetaStatus(currentProcess.status || 'draft');
    }
  }, [currentProcess?.id]);

  useEffect(() => {
    if (selectedNode) {
      setLocalNodeEdits({
        id: selectedNode.id,
        title: selectedNode.title || '',
        roleId: selectedNode.roleId || '',
        description: selectedNode.description || '',
        checklist: (selectedNode.checklist || []).join('\n'),
        tips: selectedNode.tips || '',
        errors: selectedNode.errors || '',
        type: selectedNode.type || 'step',
        targetProcessId: selectedNode.targetProcessId || '',
        customFields: selectedNode.customFields || {}
      });
    }
  }, [selectedNode?.id]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingLeft.current) setLeftWidth(Math.max(300, Math.min(600, e.clientX)));
  }, []);

  const stopResizing = useCallback(() => {
    isResizingLeft.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  }, [handleMouseMove]);

  const startResizeLeft = useCallback(() => {
    if (isMobile) return;
    isResizingLeft.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  }, [handleMouseMove, stopResizing, isMobile]);

  useEffect(() => { setMounted(true); }, []);

  const syncDiagramToModel = useCallback(() => {
    if (!iframeRef.current || !currentVersion) return;
    const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 1 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 300);
  }, [currentVersion]);

  useEffect(() => {
    if (!mounted || !iframeRef.current) return;
    
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') {
          syncDiagramToModel();
        }
      } catch (e) {}
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, currentVersion?.id, syncDiagramToModel]);

  const handleApplyOps = async (ops: any[]) => {
    if (!currentVersion || !user || !ops.length) return;
    setIsApplying(true);
    try {
      const res = await applyProcessOpsAction(currentVersion.process_id, currentVersion.version, ops, currentVersion.revision, user.id, dataSource);
      if (res.success) {
        refreshVersion();
        refreshProc();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update fehlgeschlagen", description: e.message });
    } finally {
      setIsApplying(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!currentProcess) return;
    setIsSavingMeta(true);
    try {
      const res = await updateProcessMetadataAction(currentProcess.id, { 
        title: metaTitle, 
        description: metaDesc, 
        openQuestions: metaOpenQuestions,
        status: metaStatus 
      }, dataSource);
      if (res.success) {
        toast({ title: "Stammdaten gespeichert" });
        refreshProc();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Speichern", description: e.message });
    } finally { setIsSavingMeta(false); }
  };

  const saveNodeUpdate = async (field: string, value?: any) => {
    if (!selectedNodeId) return;
    const val = value !== undefined ? value : (localNodeEdits as any)[field];
    let processedValue: any = val;
    if (field === 'checklist' && typeof val === 'string') processedValue = val.split('\n').filter((l: string) => l.trim() !== '');
    const ops = [{ type: 'UPDATE_NODE', payload: { nodeId: selectedNodeId, patch: { [field]: processedValue } } }];
    await handleApplyOps(ops);
  };

  const handleQuickAdd = (type: 'step' | 'decision' | 'end' | 'subprocess') => {
    const newId = `${type}-${Date.now()}`;
    const titles = {
      step: 'Neuer Schritt',
      decision: 'Entscheidung?',
      end: 'Endpunkt',
      subprocess: 'Prozess-Link'
    };
    const ops = [{ type: 'ADD_NODE', payload: { node: { id: newId, type, title: titles[type] } } }];
    handleApplyOps(ops).then(() => {
      setSelectedNodeId(newId);
      setIsStepDialogOpen(true);
    });
  };

  const handleMoveNode = (nodeId: string, direction: 'up' | 'down') => {
    const nodes = currentVersion?.model_json?.nodes || [];
    const idx = nodes.findIndex((n: any) => n.id === nodeId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= nodes.length) return;
    const newNodes = [...nodes];
    const [moved] = newNodes.splice(idx, 1);
    newNodes.splice(newIdx, 0, moved);
    handleApplyOps([{ type: 'REORDER_NODES', payload: { orderedNodeIds: newNodes.map((n: any) => n.id) } }]);
  };

  const handleAiChat = async () => {
    if (!chatMessage.trim() || !currentVersion) return;
    const msg = chatMessage;
    setChatMessage('');
    setIsAiLoading(true);
    const newHistory = [...chatHistory, { role: 'user', text: msg }];
    setChatHistory(newHistory);
    try {
      const suggestions = await getProcessSuggestions({ 
        userMessage: msg, 
        currentModel: currentVersion.model_json, 
        openQuestions: currentProcess?.openQuestions || "",
        chatHistory: newHistory, 
        dataSource 
      });
      setChatHistory([...newHistory, { role: 'ai', text: suggestions.explanation, questions: suggestions.openQuestions, suggestions: suggestions.proposedOps }]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "KI-Fehler", description: e.message });
    } finally { setIsAiLoading(false); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user || !id) return;
    setIsCommenting(true);
    const commentId = `comm-${Math.random().toString(36).substring(2, 9)}`;
    const commentData: ProcessComment = {
      id: commentId,
      process_id: id as string,
      node_id: selectedNodeId || undefined,
      user_id: user.id,
      user_name: user.displayName || 'Unbekannt',
      text: commentText,
      created_at: new Date().toISOString()
    };

    try {
      const res = await saveCollectionRecord('process_comments', commentId, commentData, dataSource);
      if (res.success) {
        setCommentText('');
        refreshComments();
      }
    } finally {
      setIsCommenting(false);
    }
  };

  const onGoBack = useCallback(() => { router.push('/processhub'); }, [router]);

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body relative">
      {/* Designer Header */}
      <header className="glass-header h-14 flex items-center justify-between px-6 shrink-0 z-20 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onGoBack} className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-md transition-all"><ChevronLeft className="w-5 h-5" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-sm md:text-base tracking-tight text-slate-900 truncate max-w-[200px] md:max-w-md">{currentProcess?.title}</h2>
              <Badge className="bg-primary/10 text-primary border-none rounded-full text-[9px] font-bold px-2 h-4 hidden md:flex">Rev. {currentVersion?.revision}</Badge>
            </div>
            <p className="text-[9px] text-slate-400 font-bold">Status: {currentProcess?.status} • V{currentVersion?.version}.0</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-md h-8 text-[10px] font-bold border-slate-200 px-4 gap-2 hidden md:flex hover:bg-indigo-50 transition-all" onClick={() => publishToBookStackAction(currentProcess?.id || '', currentVersion?.version || 1, "", dataSource).then(() => toast({ title: "Export erfolgreich" }))} disabled={isPublishing}>
            <BookOpen className="w-3.5 h-3.5" /> Export
          </Button>
          <Button size="sm" className="rounded-md h-8 text-[10px] font-bold bg-primary hover:bg-primary/90 text-white px-6 shadow-sm transition-all active:scale-[0.95]" onClick={() => syncDiagramToModel()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Aktualisieren
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        {/* Sidebar (Links) */}
        <aside style={{ width: isMobile ? '100%' : `${leftWidth}px` }} className={cn("border-r flex flex-col bg-white shrink-0 overflow-hidden relative group/sidebar h-full shadow-sm", isMobile && "hidden")}>
          <Tabs defaultValue="steps" className="h-full flex flex-col overflow-hidden">
            <TabsList className="h-11 bg-slate-50 border-b gap-0 p-0 w-full justify-start shrink-0 rounded-none overflow-x-auto no-scrollbar">
              <TabsTrigger value="meta" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><FilePen className="w-3.5 h-3.5" /> Stammdaten</TabsTrigger>
              <TabsTrigger value="steps" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><ClipboardList className="w-3.5 h-3.5" /> Ablauf</TabsTrigger>
              <TabsTrigger value="diskurs" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><MessageCircle className="w-3.5 h-3.5" /> Diskurs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="meta" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-8 pb-32">
                  <div className="space-y-5">
                    <h3 className="text-[10px] font-bold text-slate-400 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Grunddaten</h3>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Bezeichnung</Label>
                      <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="rounded-xl font-bold h-10 border-slate-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Status</Label>
                      <Select value={metaStatus} onValueChange={setMetaStatus}>
                        <SelectTrigger className="rounded-xl h-10 border-slate-200 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="draft" className="text-xs">Entwurf</SelectItem>
                          <SelectItem value="published" className="text-xs">Veröffentlicht</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Zusammenfassung</Label>
                      <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="rounded-xl min-h-[80px] text-xs border-slate-200 leading-relaxed" />
                    </div>
                    
                    <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2.5 shadow-inner">
                      <Label className="text-[10px] font-bold text-indigo-600 flex items-center gap-2">
                        <HelpCircle className="w-3.5 h-3.5" /> Offene Fragen für KI
                      </Label>
                      <Textarea value={metaOpenQuestions} onChange={e => setMetaOpenQuestions(e.target.value)} placeholder="Unklarheiten dokumentieren..." className="rounded-lg min-h-[100px] text-[11px] border-indigo-200 bg-white focus:border-indigo-400" />
                    </div>
                  </div>
                  
                  <div className="space-y-6 pt-8 border-t border-slate-100">
                    <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /><h3 className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">ISO 9001 Compliance</h3></div>
                    {[{ id: 'inputs', label: 'Eingaben' }, { id: 'outputs', label: 'Ausgaben' }, { id: 'risks', label: 'Risiken & Chancen' }, { id: 'evidence', label: 'Nachweise' }].map(f => (
                      <div key={f.id} className="space-y-2">
                        <Label className="text-[10px] font-bold flex items-center gap-2 text-slate-600">{f.label}</Label>
                        <Textarea defaultValue={currentVersion?.model_json?.isoFields?.[f.id] || ''} className="text-[11px] rounded-lg min-h-[80px] border-slate-200 bg-slate-50/50 focus:bg-white transition-all" onBlur={e => handleApplyOps([{ type: 'SET_ISO_FIELD', payload: { field: f.id, value: e.target.value } }])} />
                      </div>
                    ))}
                  </div>

                  <div className="pt-8 border-t border-slate-100">
                    <Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full rounded-xl h-11 font-bold text-xs gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 transition-all active:scale-95">
                      {isSavingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                      Änderungen speichern
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="steps" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="px-6 py-3 border-b bg-white flex items-center justify-between shrink-0">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ablauffolge</h3>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md border-slate-200 hover:bg-primary/5 hover:text-primary" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md border-slate-200 hover:bg-accent/5 hover:text-accent" onClick={() => handleQuickAdd('decision')}>+ Weiche</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md border-slate-200 hover:bg-blue-50 hover:text-blue-600" onClick={() => handleQuickAdd('subprocess')}>+ Link</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md border-slate-200 hover:bg-red-50 hover:text-red-600" onClick={() => handleQuickAdd('end')}>+ Ende</Button>
                </div>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {(currentVersion?.model_json?.nodes || []).map((node: any, idx: number) => {
                    const isEndLinked = node.type === 'end' && !!node.targetProcessId && node.targetProcessId !== 'none';
                    const nodeCommentCount = comments?.filter(c => c.node_id === node.id).length || 0;
                    const roleName = jobTitles?.find(j => j.id === node.roleId)?.name;
                    const descPreview = node.description ? node.description.split(' ').slice(0, 8).join(' ') + (node.description.split(' ').length > 8 ? '...' : '') : '';

                    return (
                      <div key={String(node.id || idx)} className={cn("group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer bg-white shadow-sm hover:border-primary/30", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/5" : "border-slate-100")} onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border relative", node.type === 'decision' ? "bg-amber-50 text-amber-600 border-amber-100" : node.type === 'start' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : node.type === 'end' ? (isEndLinked ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-600 border-red-100") : node.type === 'subprocess' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-500 border-slate-100 shadow-inner")}>
                          {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : node.type === 'end' ? (isEndLinked ? <LinkIcon className="w-4 h-4" /> : <CircleDot className="w-4 h-4" />) : node.type === 'subprocess' ? <LinkIcon className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                          {nodeCommentCount > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white">{nodeCommentCount}</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{node.title}</p>
                          {roleName && (
                            <p className="text-[9px] text-primary font-bold mt-0.5 flex items-center gap-1">
                              <Briefcase className="w-2.5 h-2.5" /> {roleName}
                            </p>
                          )}
                          {descPreview && (
                            <p className="text-[9px] text-slate-400 italic mt-0.5 truncate leading-tight">
                              {descPreview}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-0.5 hover:text-primary transition-colors disabled:opacity-20" disabled={idx === 0} onClick={e => { e.stopPropagation(); handleMoveNode(node.id, 'up'); }}><ChevronUp className="w-3.5 h-3.5" /></button>
                          <button className="p-0.5 hover:text-primary transition-colors disabled:opacity-20" disabled={idx === (currentVersion?.model_json?.nodes?.length || 0) - 1} onClick={e => { e.stopPropagation(); handleMoveNode(node.id, 'down'); }}><ChevronDown className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="diskurs" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="p-4 bg-slate-50/50 border-b shrink-0">
                <h3 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Diskurs & Feedback</h3>
                <div className="flex items-center gap-1.5">
                  {auditEvents?.filter(e => e.entityId === id).slice(0, 3).map((e: any, i: number) => (
                    <Avatar key={i} className="h-7 w-7 border-2 border-white shadow-sm">
                      <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">{String(e.actorUid).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1 bg-white">
                <div className="p-5 space-y-5">
                  {processComments.length === 0 ? (
                    <div className="py-16 text-center space-y-3 opacity-20">
                      <MessageCircle className="w-10 h-10 mx-auto" />
                      <p className="text-[10px] font-bold">Keine Anmerkungen dokumentiert</p>
                    </div>
                  ) : processComments.map((comm) => (
                    <div key={comm.id} className="space-y-1.5 animate-in slide-in-from-right-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-900">{comm.user_name}</span>
                        <span className="text-[9px] font-bold text-slate-400">{new Date(comm.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] leading-relaxed text-slate-600 shadow-sm">
                        {comm.text}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-slate-50/50 shrink-0">
                <div className="space-y-2.5">
                  <Textarea placeholder="Kommentar..." value={commentText} onChange={e => setCommentText(e.target.value)} className="min-h-[70px] rounded-lg border-slate-200 focus:border-primary text-[11px] shadow-inner bg-white" />
                  <Button onClick={handleAddComment} disabled={isCommenting || !commentText.trim()} className="w-full rounded-lg h-9 font-bold text-[10px] gap-2 bg-primary text-white shadow-md transition-all active:scale-95">
                    {isCommenting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Senden
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          {!isMobile && <div onMouseDown={startResizeLeft} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 z-30 transition-all opacity-0 group-hover/sidebar:opacity-100" />}
        </aside>

        {/* Main Canvas Area */}
        <main className={cn("flex-1 relative bg-slate-100 flex flex-col overflow-hidden")}>
          <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-md shadow-lg rounded-xl border border-slate-200 p-1.5 flex flex-col gap-1.5">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={syncDiagramToModel} className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"><RefreshCw className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[9px] font-bold">Sync</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*')} className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"><Maximize2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[9px] font-bold">Zentrieren</TooltipContent></Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 bg-white relative overflow-hidden">
            <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
          </div>
        </main>
      </div>

      {/* Floating AI Advisor (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-none">
        {isAiAdvisorOpen && (
          <Card className="w-[calc(100vw-2rem)] sm:w-[400px] h-[600px] rounded-3xl shadow-2xl border-none flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 bg-white pointer-events-auto">
            <header className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-white/10 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary shadow-lg border border-white/10">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">KI Advisor</h3>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Prozess-Optimierung aktiv</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 rounded-full" onClick={() => setIsAiAdvisorOpen(false)}>
                <Minus className="w-4 h-4" />
              </Button>
            </header>

            <ScrollArea className="flex-1 bg-slate-50/50">
              <div className="p-5 space-y-6 pb-10">
                {chatHistory.length === 0 && (
                  <div className="text-center py-20 opacity-30 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center shadow-inner"><BrainCircuit className="w-8 h-8" /></div>
                    <p className="text-[10px] font-bold max-w-[200px] leading-relaxed uppercase tracking-tight italic">Beschreiben Sie Ihren Prozess für einen KI-Entwurf</p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1", msg.role === 'user' ? "items-end" : "items-start")}>
                    <div className={cn("p-4 text-[11px] leading-relaxed max-w-[90%] shadow-md border transition-all", 
                      msg.role === 'user' 
                        ? "bg-slate-800 text-white border-slate-700 rounded-2xl rounded-tr-none" 
                        : "bg-white text-slate-600 border-slate-100 rounded-2xl rounded-tl-none")}>
                      {msg.text}
                    </div>
                    {msg.role === 'ai' && msg.questions && msg.questions.length > 0 && (
                      <div className="space-y-2 w-full pl-2">
                        {msg.questions.map((q: string, qIdx: number) => (
                          <div key={qIdx} className="p-3 bg-indigo-50/50 border border-indigo-100 text-[11px] font-bold text-indigo-900 italic rounded-xl shadow-sm flex items-start gap-2 animate-in slide-in-from-left-2">
                            <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            {q}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.role === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-3 w-full bg-blue-50 border-2 border-blue-100 p-4 rounded-2xl space-y-4 shadow-sm animate-in zoom-in-95">
                        <div className="flex items-center gap-2 text-blue-700">
                          <BrainCircuit className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">KI Vorschlag anwenden</span>
                        </div>
                        <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                          {msg.suggestions.map((op: any, opIdx: number) => (
                            <div key={opIdx} className="text-[9px] p-2 bg-white/80 border border-blue-100 rounded-lg flex items-center gap-3">
                              <Badge variant="outline" className="text-[8px] font-bold bg-white border-blue-200 text-blue-600 h-4 px-1">NEU</Badge>
                              <span className="truncate font-bold text-slate-700">{op.payload?.node?.title || op.payload?.field || 'Modell-Update'}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button onClick={() => { handleApplyOps(msg.suggestions); msg.suggestions = []; }} disabled={isApplying} className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg shadow-md transition-all active:scale-95">Bestätigen</Button>
                          <Button variant="ghost" onClick={() => msg.suggestions = []} className="flex-1 h-9 text-[10px] font-bold border border-blue-200 rounded-lg bg-white">Ignorieren</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-indigo-100 p-3 rounded-2xl flex items-center gap-3 shadow-sm">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span className="text-[10px] font-bold text-slate-400 animate-pulse uppercase tracking-widest">Analyse läuft...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t bg-white shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.02)]">
              <div className="relative group">
                <Input placeholder="Anweisung oder Frage..." value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiChat()} className="h-11 rounded-xl border border-slate-200 bg-slate-50/50 pr-12 focus:bg-white transition-all text-xs font-medium shadow-inner" disabled={isAiLoading} />
                <Button size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 bg-slate-900 hover:bg-black text-white rounded-lg shadow-md active:scale-95 transition-transform" onClick={handleAiChat} disabled={isAiLoading || !chatMessage}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {!isAiAdvisorOpen && (
          <Button 
            onClick={() => setIsAiAdvisorOpen(true)}
            className="w-14 h-14 rounded-full shadow-2xl bg-slate-900 hover:bg-black text-white flex items-center justify-center p-0 transition-all active:scale-90 pointer-events-auto border-4 border-white dark:border-slate-800 animate-in zoom-in duration-300 group"
          >
            <BrainCircuit className="w-7 h-7 text-primary transition-transform group-hover:scale-110" />
          </Button>
        )}
      </div>

      {/* Node Edit Dialog */}
      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white h-[85vh]">
          <DialogHeader className="p-6 bg-white border-b shrink-0 pr-10">
            <div className="flex items-center gap-5">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                localNodeEdits.type === 'decision' ? "bg-amber-50 text-amber-600 border-amber-100" : 
                localNodeEdits.type === 'end' ? "bg-red-50 text-red-600 border-red-100" : 
                localNodeEdits.type === 'subprocess' ? "bg-blue-50 text-blue-600 border-blue-100" :
                "bg-primary/10 text-primary border-primary/10"
              )}>
                {localNodeEdits.type === 'decision' ? <GitBranch className="w-6 h-6" /> : localNodeEdits.type === 'end' ? <CircleDot className="w-6 h-6" /> : localNodeEdits.type === 'subprocess' ? <LinkIcon className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate">
                  {localNodeEdits.title || 'Modul bearbeiten'}
                </DialogTitle>
                <DialogDescription className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-wider uppercase">
                  Modul: {localNodeEdits.type} • ID: {selectedNodeId}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-0">
            <div className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 ml-1 tracking-widest uppercase">Bezeichnung</Label>
                  <Input value={localNodeEdits.title} onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})} onBlur={() => saveNodeUpdate('title')} className="h-11 text-sm font-bold rounded-xl border-slate-200 bg-white shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 ml-1 tracking-widest uppercase">Verantwortliche Stelle</Label>
                  <Select value={localNodeEdits.roleId} onValueChange={(val) => { setLocalNodeEdits({...localNodeEdits, roleId: val}); saveNodeUpdate('roleId', val); }}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-xs">
                      <SelectValue placeholder="Rolle wählen..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="text-xs">Keine spezifische Rolle</SelectItem>
                      {jobTitles?.filter(j => j.tenantId === currentProcess?.tenantId || j.tenantId === 'global').map(j => (
                        <SelectItem key={j.id} value={j.id} className="text-xs">{j.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(localNodeEdits.type === 'end' || localNodeEdits.type === 'subprocess') && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-[10px] font-bold text-slate-400 ml-1 tracking-widest uppercase">Zielprozess (Handover/Link)</Label>
                  <Select value={localNodeEdits.targetProcessId} onValueChange={(val) => { setLocalNodeEdits({...localNodeEdits, targetProcessId: val}); saveNodeUpdate('targetProcessId', val); }}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-xs">
                      <SelectValue placeholder="Prozess wählen..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="text-xs">Kein Folgeprozess</SelectItem>
                      {processes?.filter(p => p.id !== id).map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 ml-1 tracking-widest uppercase">Tätigkeitsbeschreibung</Label>
                  <div className="p-1 rounded-2xl border border-slate-100 bg-slate-50/30">
                    <Textarea value={localNodeEdits.description} onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})} onBlur={() => saveNodeUpdate('description')} className="text-xs min-h-[120px] rounded-xl border-none bg-transparent leading-relaxed p-4 shadow-none focus:ring-0" placeholder="Beschreiben Sie hier die auszuführende Aktion..." />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 ml-1 flex items-center gap-2 tracking-widest uppercase">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Prüfschritte / Checkliste
                  </Label>
                  <Textarea value={localNodeEdits.checklist} onChange={e => setLocalNodeEdits({...localNodeEdits, checklist: e.target.value})} onBlur={() => saveNodeUpdate('checklist')} className="text-[11px] min-h-[100px] bg-slate-900 text-slate-100 rounded-xl font-mono p-4 leading-relaxed shadow-lg border-none" placeholder="Einen Punkt pro Zeile eingeben..." />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex items-start gap-3 shadow-inner">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-bold text-slate-800">Versionskontrolle</p>
                  <p className="text-[10px] text-slate-500 italic leading-relaxed">
                    Jede Änderung an diesem Schritt wird automatisch als neue Revision im Audit-Log erfasst.
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <Button variant="ghost" className="text-red-600 rounded-xl h-10 px-6 hover:bg-red-50 font-bold text-[10px] gap-2 transition-colors w-full sm:w-auto" onClick={() => { if(confirm("Diesen Modul unwiderruflich entfernen?")) { handleApplyOps([{ type: 'REMOVE_NODE', payload: { nodeId: selectedNodeId } }]); setIsStepDialogOpen(false); } }}>
              <Trash2 className="w-3.5 h-3.5" /> Modul löschen
            </Button>
            <Button onClick={() => setIsStepDialogOpen(false)} className="rounded-xl h-10 px-12 font-bold text-xs bg-slate-900 hover:bg-black text-white shadow-lg transition-all active:scale-[0.95] w-full sm:w-auto">
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
