
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
  ShieldCheck,
  Save, 
  Activity, 
  RefreshCw, 
  GitBranch, 
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ClipboardList,
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
  Plus,
  ArrowRightCircle,
  ArrowLeftCircle,
  Link2,
  Share2,
  ArrowRight as ArrowRightIcon,
  Trash2,
  Network,
  Lock,
  Unlock,
  PlusCircle,
  Zap,
  Shield,
  History,
  ClipboardCheck
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
import { applyProcessOpsAction, updateProcessMetadataAction, commitProcessVersionAction } from '@/app/actions/process-actions';
import { getProcessSuggestions } from '@/ai/flows/process-designer-flow';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessComment, ProcessNode, ProcessOperation, ProcessEdge, ProcessVersion } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

/**
 * Erzeugt BPMN 2.0 MX-XML für draw.io Integration.
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
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;shadow=1;'; 
        w = 50; h = 50; 
        break;
      case 'end': 
        const hasLink = !!node.targetProcessId && node.targetProcessId !== 'none';
        style = hasLink 
          ? 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#e1f5fe;strokeColor=#0288d1;strokeWidth=3;shadow=1;' 
          : 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=4;shadow=1;'; 
        w = 50; h = 50; 
        break;
      case 'decision': 
        style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;shadow=1;'; 
        w = 80; h = 80; 
        break;
      case 'subprocess':
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#e1f5fe;strokeColor=#0288d1;strokeWidth=2;dashed=1;';
        w = 160; h = 80;
        break;
      default: 
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#334155;strokeWidth=2;shadow=1;';
        w = 160; h = 80;
    }
    xml += `<mxCell id="${nodeSafeId}" value="${node.title}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    let edgeSafeId = String(edge.id || `edge-${idx}`);
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    
    if (nodes.some(n => String(n.id) === sourceId) && nodes.some(n => String(n.id) === targetId)) {
      xml += `<mxCell id="${edgeSafeId}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=2;fontSize=10;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
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

  // UI States
  const [isDiagramLocked, setIsDiagramLocked] = useState(false);
  const [isAiAdvisorOpen, setIsAiAdvisorOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
  const [metaRegulatory, setMetaRegulatory] = useState('');
  const [metaStatus, setMetaStatus] = useState<any>('draft');

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion, isLoading: isVerLoading } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: comments, refresh: refreshComments } = usePluggableCollection<ProcessComment>('process_comments');
  const { data: auditEvents, refresh: refreshAudit } = usePluggableCollection<any>('auditEvents');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);
  
  const combinedLog = useMemo(() => {
    const procComments = comments?.filter(c => c.process_id === id) || [];
    const procAudit = auditEvents?.filter(e => e.entityId === id && e.entityType === 'process') || [];
    
    const logs = [
      ...procComments.map(c => ({ id: c.id, type: 'comment', user: c.user_name, text: c.text, date: c.created_at })),
      ...procAudit.map(e => ({ id: e.id, type: 'audit', user: e.actorUid, text: e.action, date: e.timestamp }))
    ];
    
    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [comments, auditEvents, id]);

  const selectedNode = useMemo(() => 
    currentVersion?.model_json?.nodes?.find((n: any) => n.id === selectedNodeId), 
    [currentVersion, selectedNodeId]
  );

  const incomingEdges = useMemo(() => 
    currentVersion?.model_json?.edges?.filter((e: ProcessEdge) => String(e.target) === String(selectedNodeId)) || [],
    [currentVersion, selectedNodeId]
  );

  const outgoingEdges = useMemo(() => 
    currentVersion?.model_json?.edges?.filter((e: ProcessEdge) => String(e.source) === String(selectedNodeId)) || [],
    [currentVersion, selectedNodeId]
  );

  const incomingProcessLinks = useMemo(() => {
    if (!processes || !versions || !id) return [];
    const links: any[] = [];
    versions.forEach((v: ProcessVersion) => {
      if (v.process_id === id) return;
      const hasLink = v.model_json?.nodes?.some((n: ProcessNode) => n.targetProcessId === id);
      if (hasLink) {
        const p = processes.find(proc => proc.id === v.process_id);
        if (p) links.push({ id: p.id, title: p.title });
      }
    });
    return links;
  }, [processes, versions, id]);

  const outgoingProcessLinks = useMemo(() => {
    if (!currentVersion || !processes) return [];
    const targetIds = (currentVersion.model_json?.nodes || [])
      .filter((n: ProcessNode) => n.targetProcessId && n.targetProcessId !== 'none')
      .map((n: ProcessNode) => n.targetProcessId);
    return processes.filter(p => targetIds.includes(p.id));
  }, [currentVersion, processes]);

  useEffect(() => {
    if (currentProcess) {
      setMetaTitle(currentProcess.title || '');
      setMetaDesc(currentProcess.description || '');
      setMetaOpenQuestions(currentProcess.openQuestions || '');
      setMetaRegulatory(currentProcess.regulatoryFramework || '');
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
    if (!iframeRef.current || !currentVersion || isDiagramLocked) return;
    const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 1 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 300);
  }, [currentVersion, isDiagramLocked]);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !currentVersion?.model_json?.nodes?.length) return;
    
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') syncDiagramToModel();
      } catch (e) {}
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, currentVersion?.id, syncDiagramToModel]);

  const handleApplyOps = async (ops: any[]) => {
    if (!currentVersion || !user || !ops.length) return false;
    setIsApplying(true);
    try {
      const res = await applyProcessOpsAction(currentVersion.process_id, currentVersion.version, ops, currentVersion.revision, user.id, dataSource);
      if (res.success) {
        refreshVersion();
        refreshProc();
        return true;
      }
      return false;
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update fehlgeschlagen", description: e.message });
      return false;
    } finally {
      setIsApplying(false);
    }
  };

  const handleCommitVersion = async () => {
    if (!currentVersion || !user) return;
    setIsCommitting(true);
    try {
      const res = await commitProcessVersionAction(currentVersion.process_id, currentVersion.version, user.email || user.id, dataSource);
      if (res.success) {
        toast({ title: "Version gespeichert", description: "Änderungen wurden im Log protokolliert." });
        refreshAudit();
        refreshVersion();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Speichern fehlgeschlagen", description: e.message });
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNodeId || !currentVersion || !user) return;
    
    const confirmed = window.confirm('Möchten Sie diesen Prozessschritt wirklich unwiderruflich löschen? Alle Verknüpfungen werden ebenfalls entfernt.');
    if (!confirmed) return;
    
    setIsDeleting(true);
    try {
      const ops = [{ type: 'REMOVE_NODE', payload: { nodeId: selectedNodeId } }];
      const res = await applyProcessOpsAction(
        currentVersion.process_id, 
        currentVersion.version, 
        ops, 
        currentVersion.revision, 
        user.id, 
        dataSource
      );
      
      if (res.success) {
        toast({ title: "Schritt entfernt" });
        setIsStepDialogOpen(false);
        setSelectedNodeId(null);
        refreshVersion();
        refreshProc();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Löschen", description: e.message });
    } finally {
      setIsDeleting(false);
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
        regulatoryFramework: metaRegulatory,
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

  const handleSaveNodeEdits = async () => {
    if (!selectedNodeId) return;
    const patch = {
      title: localNodeEdits.title,
      roleId: localNodeEdits.roleId,
      description: localNodeEdits.description,
      checklist: localNodeEdits.checklist.split('\n').filter((l: string) => l.trim() !== ''),
      tips: localNodeEdits.tips,
      errors: localNodeEdits.errors,
      targetProcessId: localNodeEdits.targetProcessId
    };
    const ops = [{ type: 'UPDATE_NODE', payload: { nodeId: selectedNodeId, patch } }];
    const success = await handleApplyOps(ops);
    if (success) {
      toast({ title: "Schritt gespeichert" });
      setIsStepDialogOpen(false);
    }
  };

  const handleQuickAdd = (type: 'step' | 'decision' | 'end' | 'subprocess') => {
    if (!currentVersion) return;
    const newId = `${type}-${Date.now()}`;
    const titles = { step: 'Neuer Schritt', decision: 'Entscheidung?', end: 'Endpunkt', subprocess: 'Prozess-Referenz' };
    
    const nodes = currentVersion.model_json.nodes || [];
    const predecessor = selectedNodeId ? nodes.find((n: any) => n.id === selectedNodeId) : nodes[nodes.length - 1];
    
    const ops: ProcessOperation[] = [
      { type: 'ADD_NODE', payload: { node: { id: newId, type, title: titles[type] } } }
    ];

    if (predecessor && predecessor.id !== newId) {
      ops.push({
        type: 'ADD_EDGE',
        payload: { edge: { id: `edge-${Date.now()}`, source: predecessor.id, target: newId } }
      });
    }

    handleApplyOps(ops).then((success) => {
      if (success) {
        setSelectedNodeId(newId);
        setIsStepDialogOpen(true);
      }
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

  const handleAddEdge = async (targetId: string, direction: 'forward' | 'backward' = 'forward') => {
    if (!selectedNodeId || !targetId || targetId === 'none') return;
    const edgeId = `edge-${Date.now()}`;
    const source = direction === 'forward' ? selectedNodeId : targetId;
    const target = direction === 'forward' ? targetId : selectedNodeId;
    const ops = [{ type: 'ADD_EDGE', payload: { edge: { id: edgeId, source, target } } }];
    await handleApplyOps(ops);
  };

  const handleRemoveEdge = async (edgeId: string) => {
    const ops = [{ type: 'REMOVE_EDGE', payload: { edgeId } }];
    await handleApplyOps(ops);
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
    } finally { setIsCommenting(false); }
  };

  if (!mounted) return null;
  const hasNodes = (currentVersion?.model_json?.nodes?.length || 0) > 0;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body relative">
      <header className="glass-header h-14 flex items-center justify-between px-6 shrink-0 z-20 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-md transition-all"><ChevronLeft className="w-5 h-5" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-sm md:text-base tracking-tight text-slate-900 truncate max-w-[200px] md:max-w-md">{currentProcess?.title}</h2>
              <Badge className="bg-primary/10 text-primary border-none rounded-full text-[9px] font-bold px-2 h-4 hidden md:flex">Designer</Badge>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">V{currentVersion?.version}.0 • Rev. {currentVersion?.revision}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className={cn("h-8 rounded-md text-[10px] font-bold border-slate-200 gap-2 transition-all", isDiagramLocked ? "bg-slate-100 text-slate-400" : "hover:bg-amber-50 text-amber-600")}
            onClick={() => setIsDiagramLocked(!isDiagramLocked)}
          >
            {isDiagramLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isDiagramLocked ? 'Layout gesperrt' : 'Layout frei'}
          </Button>
          <Button variant="outline" size="sm" className="rounded-md h-8 text-[10px] font-bold border-slate-200 px-4 transition-all" onClick={() => syncDiagramToModel()} disabled={isDiagramLocked}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isVerLoading && "animate-spin")} /> Diagramm-Sync
          </Button>
          <Button size="sm" className="rounded-md h-8 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-6 shadow-sm transition-all active:scale-[0.95] gap-2" onClick={handleCommitVersion} disabled={isCommitting}>
            {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />} 
            Änderungen speichern
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <aside style={{ width: isMobile ? '100%' : `${leftWidth}px` }} className={cn("border-r flex flex-col bg-white shrink-0 overflow-hidden relative group/sidebar h-full shadow-sm", isMobile && "hidden")}>
          <Tabs defaultValue="steps" className="h-full flex flex-col overflow-hidden">
            <TabsList className="h-11 bg-slate-50 border-b gap-0 p-0 w-full justify-start shrink-0 rounded-none overflow-x-auto no-scrollbar">
              <TabsTrigger value="meta" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><FilePen className="w-3.5 h-3.5" /> Stammdaten</TabsTrigger>
              <TabsTrigger value="steps" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><ClipboardList className="w-3.5 h-3.5" /> Ablauf</TabsTrigger>
              <TabsTrigger value="log" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><History className="w-3.5 h-3.5" /> Log</TabsTrigger>
            </TabsList>
            
            <TabsContent value="meta" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-8 pb-32">
                  <div className="space-y-5">
                    <h3 className="text-[10px] font-bold text-slate-400 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Grunddaten</h3>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Bezeichnung</Label>
                      <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="rounded-xl font-bold h-10 border-slate-200 bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Regulatorik (ISO / BSI / DSGVO)</Label>
                      <Input value={metaRegulatory} onChange={e => setMetaRegulatory(e.target.value)} placeholder="z.B. ISO 9001:2015, BSI NET.2.2..." className="rounded-xl h-10 border-slate-200 bg-white font-bold text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Status</Label>
                      <Select value={metaStatus} onValueChange={setMetaStatus}>
                        <SelectTrigger className="rounded-xl h-10 border-slate-200 text-xs bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="draft" className="text-xs">Entwurf</SelectItem>
                          <SelectItem value="published" className="text-xs">Veröffentlicht</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Zusammenfassung</Label>
                      <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="rounded-xl min-h-[80px] text-xs border-slate-200 leading-relaxed bg-white" />
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2.5 shadow-inner">
                      <Label className="text-[10px] font-bold text-emerald-600 flex items-center gap-2"><HelpCircle className="w-3.5 h-3.5" /> Offene Fragen für KI</Label>
                      <Textarea value={metaOpenQuestions} onChange={e => setMetaOpenQuestions(e.target.value)} placeholder="Unklarheiten dokumentieren..." className="rounded-lg min-h-[100px] text-[11px] border-emerald-200 bg-white focus:border-emerald-400" />
                    </div>
                  </div>

                  <div className="space-y-6 pt-8 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-primary" />
                      <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Prozess-Vernetzung</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase">Input von (Vorgänger-Prozesse)</Label>
                        {incomingProcessLinks.length > 0 ? (
                          <div className="space-y-1.5">
                            {incomingProcessLinks.map(p => (
                              <div key={p.id} className="p-2 bg-slate-50 border rounded-lg flex items-center justify-between group">
                                <span className="text-[10px] font-bold text-slate-700 truncate flex-1 mr-2">{p.title}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => router.push(`/processhub/view/${p.id}`)}><ExternalLink className="w-3 h-3" /></Button>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-[9px] text-slate-300 italic px-1">Keine eingehenden Verknüpfungen</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase">Output nach (Ziel-Prozesse)</Label>
                        {outgoingProcessLinks.length > 0 ? (
                          <div className="space-y-1.5">
                            {outgoingProcessLinks.map(p => (
                              <div key={p.id} className="p-2 bg-primary/5 border border-primary/10 rounded-lg flex items-center justify-between group">
                                <span className="text-[10px] font-bold text-primary truncate flex-1 mr-2">{p.title}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary shrink-0" onClick={() => router.push(`/processhub/view/${p.id}`)}><ExternalLink className="w-3 h-3" /></Button>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-[9px] text-slate-300 italic px-1">Keine ausgehenden Verknüpfungen</p>}
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100">
                    <Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full rounded-xl h-11 font-bold text-xs gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 transition-all active:scale-95">
                      {isSavingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Stammdaten speichern
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="steps" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="px-6 py-3 border-b bg-white flex items-center justify-start shrink-0">
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md border-slate-200 hover:bg-primary/5 hover:text-primary" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md border-slate-200 hover:bg-amber-50 hover:text-amber-600" onClick={() => handleQuickAdd('decision')}>+ Weiche</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md border-slate-200 hover:bg-emerald-50 hover:text-emerald-600" onClick={() => handleQuickAdd('subprocess')}>+ Prozess</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md border-slate-200 hover:bg-red-50 hover:text-red-600" onClick={() => handleQuickAdd('end')}>+ Ende</Button>
                </div>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {(currentVersion?.model_json?.nodes || []).map((node: any, idx: number) => {
                    const isEndLinked = node.type === 'end' && !!node.targetProcessId && node.targetProcessId !== 'none';
                    const nodeCommentCount = comments?.filter(c => c.node_id === node.id).length || 0;
                    const roleName = jobTitles?.find(j => j.id === node.roleId)?.name;
                    return (
                      <div key={String(node.id || idx)} className={cn("group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer bg-white shadow-sm hover:border-primary/30", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/5" : "border-slate-100")} onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border relative", node.type === 'decision' ? "bg-amber-50 text-amber-600 border-amber-100" : node.type === 'start' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : node.type === 'end' ? (isEndLinked ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-600 border-red-100") : node.type === 'subprocess' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100 shadow-inner")}>
                          {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : node.type === 'end' ? (isEndLinked ? <LinkIcon className="w-4 h-4" /> : <CircleDot className="w-4 h-4" />) : node.type === 'subprocess' ? <LinkIcon className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                          {nodeCommentCount > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white">{nodeCommentCount}</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{node.title}</p>
                          {roleName && <p className="text-[9px] text-primary font-bold mt-0.5 flex items-center gap-1"><Briefcase className="w-2.5 h-2.5" /> {roleName}</p>}
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

            <TabsContent value="log" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="p-4 bg-slate-50/50 border-b shrink-0">
                <h3 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Audit Log & Diskurs</h3>
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
                  {combinedLog.length === 0 ? (
                    <div className="py-16 text-center space-y-3 opacity-20">
                      <History className="w-10 h-10 mx-auto" />
                      <p className="text-[10px] font-bold uppercase">Keine Log-Einträge vorhanden</p>
                    </div>
                  ) : combinedLog.map((log) => (
                    <div key={log.id} className="space-y-1.5 animate-in slide-in-from-right-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                            log.type === 'audit' ? "bg-slate-900 text-white" : "bg-primary text-white"
                          )}>{log.type}</span>
                          <span className="text-[10px] font-bold text-slate-900">{log.user}</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">{new Date(log.date).toLocaleDateString()}</span>
                      </div>
                      <div className={cn(
                        "p-3 rounded-xl border text-[11px] leading-relaxed shadow-sm",
                        log.type === 'audit' ? "bg-slate-50 border-slate-100 text-slate-500 italic" : "bg-white border-slate-100 text-slate-700"
                      )}>{log.text}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t bg-slate-50/50 shrink-0">
                <div className="space-y-2.5">
                  <Textarea placeholder="Kommentar oder Anmerkung..." value={commentText} onChange={e => setCommentText(e.target.value)} className="min-h-[70px] rounded-lg border-slate-200 focus:border-primary text-[11px] shadow-inner bg-white" />
                  <Button onClick={handleAddComment} disabled={isCommenting || !commentText.trim()} className="w-full rounded-lg h-9 font-bold text-[10px] gap-2 bg-primary text-white shadow-md transition-all active:scale-95">{isCommenting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Kommentar senden</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          {!isMobile && <div onMouseDown={startResizeLeft} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 z-30 transition-all opacity-0 group-hover/sidebar:opacity-100" />}
        </aside>

        <main className={cn("flex-1 relative bg-slate-100 flex flex-col overflow-hidden")}>
          {!hasNodes ? (
            <div className="h-full flex flex-col items-center justify-center bg-white p-10 text-center animate-in fade-in duration-700">
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6 border border-dashed border-primary/20"><Workflow className="w-10 h-10 text-primary opacity-20" /></div>
              <h2 className="text-xl font-headline font-bold text-slate-900">Starten Sie die Modellierung</h2>
              <p className="text-sm text-slate-500 max-w-md mt-2 leading-relaxed">Fügen Sie den ersten Prozessschritt über das Menü oben links hinzu oder nutzen Sie den KI-Assistenten unten rechts für einen Entwurf.</p>
              <div className="flex gap-3 mt-8"><Button className="rounded-xl h-11 px-8 font-bold text-xs shadow-lg" onClick={() => handleQuickAdd('step')}><PlusCircle className="w-4 h-4 mr-2" /> Ersten Schritt anlegen</Button><Button variant="outline" className="rounded-xl h-11 px-8 font-bold text-xs" onClick={() => setIsAiAdvisorOpen(true)}><BrainCircuit className="w-4 h-4 mr-2" /> KI-Entwurf starten</Button></div>
            </div>
          ) : (
            <>
              <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-md shadow-lg rounded-xl border border-slate-200 p-1.5 flex flex-col gap-1.5">
                <TooltipProvider>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={syncDiagramToModel} className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"><RefreshCw className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[9px] font-bold uppercase">Diagramm Sync</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*')} className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"><Maximize2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[9px] font-bold uppercase">Zentrieren</TooltipContent></Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex-1 bg-white relative overflow-hidden">
                <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
              </div>
            </>
          )}
        </main>
      </div>

      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-auto">
        {isAiAdvisorOpen && (
          <Card className="w-[calc(100vw-2rem)] sm:w-[400px] h-[600px] rounded-3xl shadow-2xl border-none flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 bg-white">
            <header className="p-4 bg-emerald-600 text-white flex items-center justify-between shrink-0 border-b border-white/10 shadow-lg"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white shadow-lg border border-white/10"><BrainCircuit className="w-5 h-5" /></div><div><h3 className="text-[10px] font-black uppercase tracking-[0.2em]">KI Advisor</h3><p className="text-[8px] text-emerald-100 font-bold uppercase">Prozess-Modellierung</p></div></div><button onClick={() => setIsAiAdvisorOpen(false)} className="text-white/50 hover:text-white transition-colors"><X className="w-4 h-4" /></button></header>
            <ScrollArea className="flex-1 bg-slate-50/50">
              <div className="p-5 space-y-6 pb-10">
                {chatHistory.length === 0 && <div className="text-center py-16 opacity-30 flex flex-col items-center gap-4"><div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center shadow-inner"><Zap className="w-8 h-8 text-emerald-600" /></div><p className="text-[10px] font-bold max-w-[200px] leading-relaxed uppercase tracking-tight italic text-emerald-900">Beschreiben Sie Ihren Prozess für einen KI-Entwurf</p></div>}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1", msg.role === 'user' ? "items-end" : "items-start")}>
                    <div className={cn("p-4 text-[11px] font-medium leading-relaxed max-w-[90%] shadow-md border transition-all", msg.role === 'user' ? "bg-emerald-950 text-white border-emerald-900 rounded-2xl rounded-tr-none" : "bg-white text-slate-600 border-slate-100 rounded-2xl rounded-tl-none")}>{msg.text}</div>
                    {msg.role === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-3 w-full bg-blue-50 border-2 border-blue-100 p-4 rounded-2xl space-y-4 shadow-sm animate-in zoom-in-95">
                        <div className="flex items-center gap-2 text-primary"><BrainCircuit className="w-3.5 h-3.5 text-emerald-600" /><span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">KI Vorschlag anwenden</span></div>
                        <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">{msg.suggestions.map((op: any, opIdx: number) => <div key={opIdx} className="text-[9px] p-2 bg-white/80 border border-blue-100 rounded-lg flex items-center gap-3"><Badge variant="outline" className="text-[8px] font-bold bg-white border-blue-200 text-primary h-4 px-1">NEU</Badge><span className="truncate font-bold text-slate-700">{op.payload?.node?.title || 'Strukturelles Update'}</span></div>)}</div>
                        <div className="flex gap-2 pt-1"><Button onClick={() => handleApplyOps(msg.suggestions)} disabled={isApplying} className="flex-1 h-9 bg-primary hover:bg-primary/90 text-white text-[10px] font-bold rounded-lg shadow-md transition-all active:scale-95">Bestätigen</Button><Button variant="ghost" onClick={() => msg.suggestions = []} className="flex-1 h-9 text-[10px] font-bold border border-slate-200 rounded-lg bg-white">Ignorieren</Button></div>
                      </div>
                    )}
                  </div>
                ))}
                {isAiLoading && <div className="flex justify-start"><div className="bg-white border border-emerald-100 p-3 rounded-2xl flex items-center gap-3 shadow-sm border-emerald-200"><Loader2 className="w-4 h-4 animate-spin text-emerald-600" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">KI analysiert Kontext...</span></div></div>}
              </div>
            </ScrollArea>
            <div className="p-4 border-t bg-white shrink-0"><div className="relative"><Input placeholder="Prozess beschreiben..." value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiChat()} className="h-11 rounded-xl border border-slate-200 bg-slate-50/50 pr-12 text-xs font-medium" disabled={isAiLoading} /><Button size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md active:scale-95" onClick={handleAiChat} disabled={isAiLoading || !chatMessage}><Send className="w-3.5 h-3.5" /></Button></div></div>
          </Card>
        )}
        {!isAiAdvisorOpen && <Button onClick={() => setIsAiAdvisorOpen(true)} className="w-14 h-14 rounded-full shadow-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center p-0 transition-all active:scale-90 border-4 border-white"><BrainCircuit className="w-7 h-7" /></Button>}
      </div>

      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-3xl w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white h-[90vh]">
          <DialogHeader className="p-6 bg-white border-b shrink-0 pr-10">
            <div className="flex items-center gap-5">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border transition-colors", localNodeEdits.type === 'decision' ? "bg-amber-50 text-amber-600 border-amber-100" : localNodeEdits.type === 'end' ? "bg-red-50 text-red-600 border-red-100" : localNodeEdits.type === 'subprocess' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-primary/10 text-primary border-primary/10")}>{localNodeEdits.type === 'decision' ? <GitBranch className="w-6 h-6" /> : localNodeEdits.type === 'end' ? <CircleDot className="w-6 h-6" /> : localNodeEdits.type === 'subprocess' ? <LinkIcon className="w-6 h-6" /> : <Activity className="w-6 h-6" />}</div>
              <div className="min-w-0 flex-1"><DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate">{localNodeEdits.title || 'Schritt bearbeiten'}</DialogTitle><DialogDescription className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-wider uppercase">Modul: {localNodeEdits.type} • ID: {selectedNodeId}</DialogDescription></div>
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-slate-50 border-b h-11 px-6 justify-start rounded-none"><TabsTrigger value="base" className="text-[10px] font-bold uppercase gap-2"><FilePen className="w-3.5 h-3.5" /> Stammdaten</TabsTrigger><TabsTrigger value="logic" className="text-[10px] font-bold uppercase gap-2"><Share2 className="w-3.5 h-3.5" /> Prozess-Logik</TabsTrigger><TabsTrigger value="details" className="text-[10px] font-bold uppercase gap-2"><ClipboardList className="w-3.5 h-3.5" /> Ausführung</TabsTrigger></TabsList>
            <ScrollArea className="flex-1 p-0">
              <div className="p-8 space-y-10">
                <TabsContent value="base" className="mt-0 space-y-8"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-1.5"><Label className="text-[10px] font-bold text-slate-400 ml-1 tracking-widest uppercase">Bezeichnung</Label><Input value={localNodeEdits.title} onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})} className="h-11 text-sm font-bold rounded-xl border-slate-200 bg-white" /></div><div className="space-y-1.5"><Label className="text-[10px] font-bold text-slate-400 ml-1 tracking-widest uppercase">Verantwortliche Stelle</Label><Select value={localNodeEdits.roleId} onValueChange={(val) => setLocalNodeEdits({...localNodeEdits, roleId: val})}><SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-xs"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none" className="text-xs">Keine spezifische Rolle</SelectItem>{jobTitles?.filter(j => j.tenantId === currentProcess?.tenantId || j.tenantId === 'global').map(j => <SelectItem key={j.id} value={j.id} className="text-xs">{j.name}</SelectItem>)}</SelectContent></Select></div></div></TabsContent>
                <TabsContent value="logic" className="mt-0 space-y-10">
                  <div className="space-y-10">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-2 ml-1"><ArrowLeftCircle className="w-4 h-4" /> Vorgänger (Eingehend)</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {incomingEdges.map((edge: ProcessEdge) => {
                          const src = currentVersion?.model_json?.nodes?.find((n: any) => String(n.id) === String(edge.source));
                          return <div key={edge.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100 border-dashed"><div className="flex items-center gap-3"><Link2 className="w-3.5 h-3.5 text-slate-300" /><span className="text-xs font-medium text-slate-500">{src?.title || edge.source}</span></div><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleRemoveEdge(edge.id)}><X className="w-3.5 h-3.5" /></Button></div>;
                        })}
                        <div className="pt-2"><Select onValueChange={(val) => handleAddEdge(val, 'backward')}><SelectTrigger className="h-10 text-xs rounded-xl border-dashed bg-white"><SelectValue placeholder="Vorgänger hinzufügen..." /></SelectTrigger><SelectContent className="rounded-xl">{currentVersion?.model_json?.nodes?.filter((n: any) => String(n.id) !== String(selectedNodeId)).map((n: any) => <SelectItem key={n.id} value={n.id} className="text-xs">{n.title}</SelectItem>)}</SelectContent></Select></div>
                      </div>
                    </div>
                    <Separator className="bg-slate-100" />
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold uppercase text-emerald-600 flex items-center gap-2 ml-1"><ArrowRightCircle className="w-4 h-4" /> Nachfolger (Ausgehend)</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {outgoingEdges.map((edge: ProcessEdge) => {
                          const trg = currentVersion?.model_json?.nodes?.find((n: any) => String(n.id) === String(edge.target));
                          return <div key={edge.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="flex items-center gap-3"><Link2 className="w-3.5 h-3.5 text-slate-400" /><span className="text-xs font-bold text-slate-700">{trg?.title || edge.target}</span></div><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleRemoveEdge(edge.id)}><X className="w-3.5 h-3.5" /></Button></div>;
                        })}
                        <div className="pt-2"><Select onValueChange={(val) => handleAddEdge(val, 'forward')}><SelectTrigger className="h-10 text-xs rounded-xl border-dashed bg-white"><SelectValue placeholder="Nachfolger hinzufügen..." /></SelectTrigger><SelectContent className="rounded-xl">{currentVersion?.model_json?.nodes?.filter((n: any) => String(n.id) !== String(selectedNodeId)).map((n: any) => <SelectItem key={n.id} value={n.id} className="text-xs">{n.title}</SelectItem>)}</SelectContent></Select></div>
                      </div>
                    </div>
                    {(localNodeEdits.type === 'end' || localNodeEdits.type === 'subprocess') && (
                      <>
                        <Separator className="bg-slate-100" />
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold uppercase text-blue-600 flex items-center gap-2 ml-1"><ExternalLink className="w-4 h-4" /> Zielprozess</h4>
                          <div className="p-4 rounded-xl bg-blue-50/30 border border-blue-100"><Select value={localNodeEdits.targetProcessId} onValueChange={(val) => setLocalNodeEdits({...localNodeEdits, targetProcessId: val})}><SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-xs shadow-sm"><SelectValue placeholder="Folgeprozess wählen..." /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none" className="text-xs">Kein Folgeprozess</SelectItem>{processes?.filter(p => p.id !== id).map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.title}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="details" className="mt-0 space-y-8"><div className="space-y-8"><div className="space-y-2"><Label className="text-[10px] font-bold text-slate-400 ml-1 tracking-widest uppercase">Tätigkeitsbeschreibung</Label><Textarea value={localNodeEdits.description} onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})} className="text-xs min-h-[120px] rounded-xl border-slate-200 p-4 leading-relaxed" placeholder="Was genau wird hier getan?" /></div><div className="space-y-2"><Label className="text-[10px] font-bold text-slate-400 ml-1 flex items-center gap-2 tracking-widest uppercase"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Prüfschritte / Checkliste</Label><Textarea value={localNodeEdits.checklist} onChange={e => setLocalNodeEdits({...localNodeEdits, checklist: e.target.value})} className="text-[11px] min-h-[100px] bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-4 leading-relaxed shadow-inner" placeholder="Ein Punkt pro Zeile..." /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><Label className="text-[10px] font-bold text-blue-600 ml-1 tracking-widest uppercase">Insider-Tipps</Label><Textarea value={localNodeEdits.tips} onChange={e => setLocalNodeEdits({...localNodeEdits, tips: e.target.value})} className="text-[10px] min-h-[80px] rounded-xl border-slate-200 bg-blue-50/20" placeholder="Best Practices..." /></div><div className="space-y-2"><Label className="text-[10px] font-bold text-red-600 ml-1 tracking-widest uppercase">Fehlerquellen</Label><Textarea value={localNodeEdits.errors} onChange={e => setLocalNodeEdits({...localNodeEdits, errors: e.target.value})} className="text-[10px] min-h-[80px] rounded-xl border-slate-200 bg-red-50/20" placeholder="Was oft schief geht..." /></div></div></div></TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDeleteNode} 
              disabled={isDeleting} 
              className="rounded-xl h-10 px-6 font-bold text-xs text-red-600 border-red-100 hover:bg-red-50 transition-all gap-2"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Modul löschen
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setIsStepDialogOpen(false)} className="rounded-xl h-10 px-6 font-bold text-xs" disabled={isApplying || isDeleting}>Abbrechen</Button>
              <Button onClick={handleSaveNodeEdits} className="rounded-xl h-10 px-12 font-bold text-xs bg-primary text-white shadow-lg transition-all active:scale-[0.95]" disabled={isApplying || isDeleting}>
                {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />} Änderungen speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
