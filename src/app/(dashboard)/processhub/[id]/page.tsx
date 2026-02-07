
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
  ClipboardCheck,
  Building2,
  CheckSquare,
  Square
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
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessComment, ProcessNode, ProcessOperation, ProcessEdge, ProcessVersion, Department, RegulatoryOption } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const [chatMessage, setChatMessage] = useState('');
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

  // Metadata Form
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaOpenQuestions, setMetaOpenQuestions] = useState('');
  const [metaDeptId, setMetaDeptId] = useState('');
  const [metaRegulatory, setMetaRegulatory] = useState<string[]>([]);
  const [metaStatus, setMetaStatus] = useState<any>('draft');

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: regulatoryOptions } = usePluggableCollection<RegulatoryOption>('regulatory_options');
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
      setMetaDeptId(currentProcess.responsibleDepartmentId || '');
      setMetaStatus(currentProcess.status || 'draft');
      try {
        const reg = currentProcess.regulatoryFramework ? JSON.parse(currentProcess.regulatoryFramework) : [];
        setMetaRegulatory(Array.isArray(reg) ? reg : []);
      } catch (e) {
        setMetaRegulatory([]);
      }
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
        toast({ title: "Version gespeichert" });
        refreshAudit();
        refreshVersion();
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user || !currentProcess) return;
    setIsCommenting(true);
    try {
      const id = `comm-${Math.random().toString(36).substring(2, 9)}`;
      const data = {
        id,
        process_id: currentProcess.id,
        user_id: user.id,
        user_name: user.displayName || user.email,
        text: commentText,
        created_at: new Date().toISOString()
      };
      await saveCollectionRecord('process_comments', id, data, dataSource);
      setCommentText('');
      refreshComments();
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNodeId || !currentVersion || !user) return;
    if (!confirm('Modul permanent löschen? Alle Verknüpfungen werden ebenfalls entfernt.')) return;
    setIsDeleting(true);
    try {
      const ops = [{ type: 'REMOVE_NODE', payload: { nodeId: selectedNodeId } }];
      const res = await applyProcessOpsAction(currentVersion.process_id, currentVersion.version, ops, currentVersion.revision, user.id, dataSource);
      if (res.success) {
        toast({ title: "Modul entfernt" });
        setIsStepDialogOpen(false);
        setSelectedNodeId(null);
        refreshVersion();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveEdge = async (edgeId: string) => {
    await handleApplyOps([{ type: 'REMOVE_EDGE', payload: { edgeId } }]);
  };

  const handleAddEdge = async (targetId: string, direction: 'forward' | 'backward') => {
    if (!selectedNodeId) return;
    const edge = {
      id: `edge-${Date.now()}`,
      source: direction === 'forward' ? selectedNodeId : targetId,
      target: direction === 'forward' ? targetId : selectedNodeId,
      label: ''
    };
    await handleApplyOps([{ type: 'ADD_EDGE', payload: { edge } }]);
  };

  const handleSaveMetadata = async () => {
    if (!currentProcess) return;
    setIsSavingMeta(true);
    try {
      const res = await updateProcessMetadataAction(currentProcess.id, { 
        title: metaTitle, 
        description: metaDesc, 
        openQuestions: metaOpenQuestions,
        responsibleDepartmentId: metaDeptId,
        regulatoryFramework: JSON.stringify(metaRegulatory),
        status: metaStatus 
      }, dataSource);
      if (res.success) {
        toast({ title: "Stammdaten gespeichert" });
        refreshProc();
      }
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
    const success = await handleApplyOps([{ type: 'UPDATE_NODE', payload: { nodeId: selectedNodeId, patch } }]);
    if (success) setIsStepDialogOpen(false);
  };

  const handleQuickAdd = (type: 'step' | 'decision' | 'end' | 'subprocess') => {
    if (!currentVersion) return;
    const newId = `${type}-${Date.now()}`;
    const titles = { step: 'Neuer Schritt', decision: 'Entscheidung?', end: 'Endpunkt', subprocess: 'Prozess-Referenz' };
    const nodes = currentVersion.model_json.nodes || [];
    const predecessor = selectedNodeId ? nodes.find((n: any) => n.id === selectedNodeId) : nodes[nodes.length - 1];
    
    const ops: ProcessOperation[] = [{ type: 'ADD_NODE', payload: { node: { id: newId, type, title: titles[type] } } }];
    if (predecessor) {
      ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}`, source: predecessor.id, target: newId } } });
    }
    handleApplyOps(ops).then(s => { if(s) { setSelectedNodeId(newId); setIsStepDialogOpen(true); } });
  };

  const toggleRegulatory = (id: string) => {
    setMetaRegulatory(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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
          <Button size="sm" className="rounded-md h-8 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-6 shadow-sm transition-all gap-2" onClick={handleCommitVersion} disabled={isCommitting}>
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
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Verantwortliche Abteilung</Label>
                      <Select value={metaDeptId} onValueChange={setMetaDeptId}>
                        <SelectTrigger className="rounded-xl h-10 border-slate-200 text-xs bg-white"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Regulatorik (Checklist)</Label>
                      <div className="grid grid-cols-1 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        {regulatoryOptions?.filter(o => o.enabled).map(opt => (
                          <div key={opt.id} className="flex items-center gap-2 cursor-pointer" onClick={() => toggleRegulatory(opt.id)}>
                            {metaRegulatory.includes(opt.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-slate-300" />}
                            <span className="text-[11px] font-bold text-slate-700">{opt.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 ml-1">Zusammenfassung</Label>
                      <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="rounded-xl min-h-[80px] text-xs border-slate-200 leading-relaxed bg-white" />
                    </div>
                  </div>

                  <div className="space-y-6 pt-8 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-primary" />
                      <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Prozess-Vernetzung</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase">Input von</Label>
                        {incomingProcessLinks.length > 0 ? (
                          <div className="space-y-1.5">{incomingProcessLinks.map(p => (<div key={p.id} className="p-2 bg-slate-50 border rounded-lg flex items-center justify-between group"><span className="text-[10px] font-bold text-slate-700 truncate flex-1 mr-2">{p.title}</span><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => router.push(`/processhub/view/${p.id}`)}><ExternalLink className="w-3 h-3" /></Button></div>))}</div>
                        ) : <p className="text-[9px] text-slate-300 italic px-1">Keine</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase">Output nach</Label>
                        {outgoingProcessLinks.length > 0 ? (
                          <div className="space-y-1.5">{outgoingProcessLinks.map(p => (<div key={p.id} className="p-2 bg-primary/5 border border-primary/10 rounded-lg flex items-center justify-between group"><span className="text-[10px] font-bold text-primary truncate flex-1 mr-2">{p.title}</span><Button variant="ghost" size="icon" className="h-6 w-6 text-primary shrink-0" onClick={() => router.push(`/processhub/view/${p.id}`)}><ExternalLink className="w-3 h-3" /></Button></div>))}</div>
                        ) : <p className="text-[9px] text-slate-300 italic px-1">Keine</p>}
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
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('decision')}>+ Weiche</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('subprocess')}>+ Prozess</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('end')}>+ Ende</Button>
                </div>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {(currentVersion?.model_json?.nodes || []).map((node: any) => {
                    const nodeCommentCount = comments?.filter(c => c.node_id === node.id).length || 0;
                    const roleName = jobTitles?.find(j => j.id === node.roleId)?.name;
                    return (
                      <div key={node.id} className={cn("group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer bg-white shadow-sm", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/5" : "border-slate-100")} onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border relative", node.type === 'decision' ? "bg-amber-50 text-amber-600" : node.type === 'start' ? "bg-emerald-50 text-emerald-700" : node.type === 'end' ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500")}>
                          {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : node.type === 'end' ? <CircleDot className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                          {nodeCommentCount > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white">{nodeCommentCount}</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{node.title}</p>
                          {roleName && <p className="text-[9px] text-primary font-bold mt-0.5"><Briefcase className="w-2.5 h-2.5 inline mr-1" /> {roleName}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="log" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <ScrollArea className="flex-1 bg-white">
                <div className="p-5 space-y-5">
                  {combinedLog.length === 0 ? (
                    <div className="py-16 text-center opacity-20"><History className="w-10 h-10 mx-auto" /><p className="text-[10px] font-bold uppercase">Keine Log-Einträge</p></div>
                  ) : combinedLog.map((log) => (
                    <div key={log.id} className="space-y-1.5 animate-in slide-in-from-right-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded", log.type === 'audit' ? "bg-slate-900 text-white" : "bg-primary text-white")}>{log.type}</span><span className="text-[10px] font-bold text-slate-900">{log.user}</span></div>
                        <span className="text-[9px] font-bold text-slate-400">{new Date(log.date).toLocaleDateString()}</span>
                      </div>
                      <div className={cn("p-3 rounded-xl border text-[11px] leading-relaxed shadow-sm", log.type === 'audit' ? "bg-slate-50 text-slate-500 italic" : "bg-white text-slate-700")}>{log.text}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t bg-slate-50/50 shrink-0">
                <div className="space-y-2.5">
                  <Textarea placeholder="Anmerkung..." value={commentText} onChange={e => setCommentText(e.target.value)} className="min-h-[70px] rounded-lg text-[11px] bg-white" />
                  <Button onClick={handleAddComment} disabled={isCommenting || !commentText.trim()} className="w-full h-9 font-bold text-[10px] bg-primary text-white shadow-md transition-all active:scale-95">{isCommenting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Senden</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        <main className="flex-1 relative bg-slate-100 flex flex-col overflow-hidden">
          {!hasNodes ? (
            <div className="h-full flex flex-col items-center justify-center bg-white p-10 text-center animate-in fade-in duration-700">
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6 border border-dashed border-primary/20"><Workflow className="w-10 h-10 text-primary opacity-20" /></div>
              <h2 className="text-xl font-headline font-bold text-slate-900">Modellierung starten</h2>
              <div className="flex gap-3 mt-8"><Button className="rounded-xl h-11 px-8 font-bold text-xs" onClick={() => handleQuickAdd('step')}><PlusCircle className="w-4 h-4 mr-2" /> Ersten Schritt anlegen</Button></div>
            </div>
          ) : (
            <div className="flex-1 bg-white relative overflow-hidden">
              <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
            </div>
          )}
        </main>
      </div>

      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-3xl w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white h-[90vh]">
          <DialogHeader className="p-6 bg-white border-b pr-10">
            <div className="flex items-center gap-5">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", localNodeEdits.type === 'decision' ? "bg-amber-50 text-amber-600" : localNodeEdits.type === 'end' ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary")}>
                {localNodeEdits.type === 'decision' ? <GitBranch className="w-6 h-6" /> : localNodeEdits.type === 'end' ? <CircleDot className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
              </div>
              <div className="min-w-0 flex-1"><DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate">{localNodeEdits.title || 'Schritt bearbeiten'}</DialogTitle><DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Modul: {localNodeEdits.type}</DialogDescription></div>
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-slate-50 border-b h-11 px-6 justify-start rounded-none"><TabsTrigger value="base" className="text-[10px] font-bold uppercase gap-2">Stammdaten</TabsTrigger><TabsTrigger value="logic" className="text-[10px] font-bold uppercase gap-2">Prozess-Logik</TabsTrigger><TabsTrigger value="details" className="text-[10px] font-bold uppercase gap-2">Ausführung</TabsTrigger></TabsList>
            <ScrollArea className="flex-1 p-8 space-y-10">
              <TabsContent value="base" className="mt-0 space-y-8"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-slate-400">Bezeichnung</Label><Input value={localNodeEdits.title} onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})} className="h-11 font-bold rounded-xl" /></div><div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-slate-400">Verantwortliche Stelle</Label><Select value={localNodeEdits.roleId} onValueChange={(val) => setLocalNodeEdits({...localNodeEdits, roleId: val})}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger><SelectContent>{jobTitles?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent></Select></div></div></TabsContent>
              <TabsContent value="logic" className="mt-0 space-y-10">
                <div className="space-y-4"><h4 className="text-[10px] font-bold uppercase text-slate-400 ml-1 flex items-center gap-2"><ArrowLeftCircle className="w-4 h-4" /> Vorgänger (Eingehend)</h4>
                  <div className="grid grid-cols-1 gap-2">{incomingEdges.map((edge: ProcessEdge) => (<div key={edge.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-dashed"><span className="text-xs text-slate-500">{currentVersion?.model_json?.nodes?.find((n: any) => String(n.id) === String(edge.source))?.title || edge.source}</span><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => handleRemoveEdge(edge.id)}><X className="w-3.5 h-3.5" /></Button></div>))}
                  <Select onValueChange={(val) => handleAddEdge(val, 'backward')}><SelectTrigger className="h-10 text-xs rounded-xl border-dashed bg-white"><SelectValue placeholder="Vorgänger hinzufügen..." /></SelectTrigger><SelectContent>{currentVersion?.model_json?.nodes?.filter((n: any) => String(n.id) !== String(selectedNodeId)).map((n: any) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="space-y-4"><h4 className="text-[10px] font-bold uppercase text-emerald-600 ml-1 flex items-center gap-2"><ArrowRightCircle className="w-4 h-4" /> Nachfolger (Ausgehend)</h4>
                  <div className="grid grid-cols-1 gap-2">{outgoingEdges.map((edge: ProcessEdge) => (<div key={edge.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-700">{currentVersion?.model_json?.nodes?.find((n: any) => String(n.id) === String(edge.target))?.title || edge.target}</span><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => handleRemoveEdge(edge.id)}><X className="w-3.5 h-3.5" /></Button></div>))}
                  <Select onValueChange={(val) => handleAddEdge(val, 'forward')}><SelectTrigger className="h-10 text-xs rounded-xl border-dashed bg-white"><SelectValue placeholder="Nachfolger hinzufügen..." /></SelectTrigger><SelectContent>{currentVersion?.model_json?.nodes?.filter((n: any) => String(n.id) !== String(selectedNodeId)).map((n: any) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}</SelectContent></Select></div>
                </div>
                {(localNodeEdits.type === 'end' || localNodeEdits.type === 'subprocess') && (
                  <div className="space-y-4"><h4 className="text-[10px] font-bold uppercase text-blue-600 ml-1">Zielprozess (Referenz)</h4><Select value={localNodeEdits.targetProcessId} onValueChange={(val) => setLocalNodeEdits({...localNodeEdits, targetProcessId: val})}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Folgeprozess wählen..." /></SelectTrigger><SelectContent><SelectItem value="none">Kein Folgeprozess</SelectItem>{processes?.filter(p => p.id !== id).map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
                )}
              </TabsContent>
              <TabsContent value="details" className="mt-0 space-y-8"><div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Tätigkeitsbeschreibung</Label><Textarea value={localNodeEdits.description} onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})} className="text-xs min-h-[120px] rounded-xl" /></div><div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Prüfschritte</Label><Textarea value={localNodeEdits.checklist} onChange={e => setLocalNodeEdits({...localNodeEdits, checklist: e.target.value})} className="text-[11px] min-h-[100px] bg-slate-50 rounded-xl" /></div></TabsContent>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-4 bg-slate-50 border-t flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleDeleteNode} disabled={isDeleting} className="rounded-xl h-10 px-6 text-red-600 border-red-100 hover:bg-red-50 gap-2">{isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Modul löschen</Button>
            <div className="flex gap-2"><Button variant="ghost" onClick={() => setIsStepDialogOpen(false)}>Abbrechen</Button><Button onClick={handleSaveNodeEdits} className="rounded-xl h-10 px-12 bg-primary text-white shadow-lg">Änderungen speichern</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
