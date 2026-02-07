
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  MessageSquare, 
  ChevronLeft, 
  Loader2, 
  Send, 
  Check, 
  X, 
  Zap, 
  Plus, 
  BookOpen,
  ShieldCheck,
  Save, 
  Trash2, 
  Activity, 
  RefreshCw, 
  Sparkles, 
  GitBranch, 
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  FileCode,
  FilePen,
  ArrowRightCircle,
  ArrowRight,
  CheckCircle,
  Link as LinkIcon,
  Maximize2,
  CircleDot,
  ExternalLink,
  HelpCircle,
  Tags,
  PlusCircle,
  Layout,
  LayoutGrid,
  UserCircle,
  History,
  MessageCircle
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
import { ProcessModel, ProcessLayout, ProcessNode, Process, JobTitle, ProcessComment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

/**
 * Erzeugt das XML für mxGraph mit robustem Fallback für IDs.
 */
function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach((node, idx) => {
    let nodeSafeId = String(node.id || `node-gen-${idx}`);
    if (nodeSafeId === 'undefined' || nodeSafeId === 'null' || nodeSafeId === '' || nodeSafeId === '[object Object]') {
      nodeSafeId = `node-fix-${idx}-${Math.random().toString(36).substring(2, 7)}`;
    }
    
    const pos = positions[nodeSafeId] || { x: 50 + (idx * 220), y: 150 };
    let style = '';
    let w = 160, h = 80;
    switch (node.type) {
      case 'start': style = 'ellipse;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;'; w = 60; h = 60; break;
      case 'end': 
        const hasLink = !!node.targetProcessId && node.targetProcessId !== 'none';
        style = hasLink 
          ? 'ellipse;fillColor=#e1f5fe;strokeColor=#0288d1;strokeWidth=3;' 
          : 'ellipse;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=3;'; 
        w = 60; h = 60; 
        break;
      case 'decision': style = 'rhombus;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;'; w = 100; h = 100; break;
      default: style = 'whiteSpace=wrap;html=1;rounded=1;fillColor=#ffffff;strokeColor=#334155;strokeWidth=1.5;shadow=1;';
    }
    xml += `<mxCell id="${nodeSafeId}" value="${node.title}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    let edgeSafeId = String(edge.id || `edge-gen-${idx}`);
    const sourceExists = nodes.some(n => n.id === edge.source);
    const targetExists = nodes.some(n => n.id === edge.target);
    if (sourceExists && targetExists) {
      xml += `<mxCell id="${edgeSafeId}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=2;fontSize=10;" edge="1" parent="1" source="${edge.source}" target="${edge.target}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
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
  const [leftWidth, setLeftWidth] = useState(380);
  const [rightWidth, setRightWidth] = useState(380);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  const [mobileView, setMobileView] = useState<'steps' | 'diagram' | 'ai'>('steps');
  const [rightActiveTab, setRightActiveTab] = useState<'ai' | 'collab'>('ai');

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

  const [commentText, setChatMessageCollab] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaOpenQuestions, setMetaOpenQuestions] = useState('');
  const [metaStatus, setMetaStatus] = useState<any>('draft');

  const [newEdgeTargetId, setNewEdgeTargetId] = useState<string>('');
  const [newEdgeLabel, setNewEdgeLabel] = useState<string>('');

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: comments, refresh: refreshComments } = usePluggableCollection<ProcessComment>('process_comments');
  const { data: auditEvents } = usePluggableCollection<any>('auditEvents');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id), [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);
  const processComments = useMemo(() => comments?.filter(c => c.process_id === id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [], [comments, id]);

  const lastEditors = useMemo(() => {
    if (!auditEvents) return [];
    const related = auditEvents.filter(e => e.entityId === id || e.entityId?.startsWith(`ver-${id}`));
    const unique = new Map();
    related.forEach(e => unique.set(e.actorUid, e));
    return Array.from(unique.values()).slice(0, 3);
  }, [auditEvents, id]);

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
    if (isResizingLeft.current) setLeftWidth(Math.max(250, Math.min(600, e.clientX)));
    if (isResizingRight.current) setRightWidth(Math.max(300, Math.min(600, window.innerWidth - e.clientX)));
  }, []);

  const stopResizing = useCallback(() => {
    isResizingLeft.current = false;
    isResizingRight.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  }, [handleMouseMove]);

  const startResizeLeft = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    isResizingLeft.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  }, [handleMouseMove, stopResizing, isMobile]);

  const startResizeRight = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    isResizingRight.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  }, [handleMouseMove, stopResizing, isMobile]);

  useEffect(() => { setMounted(true); }, []);

  const syncDiagramToModel = useCallback(() => {
    if (!iframeRef.current || !currentVersion) return;
    const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 1 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 500);
  }, [currentVersion]);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !currentVersion) return;
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

  const handleQuickAdd = (type: 'step' | 'decision' | 'end') => {
    const newId = `${type}-${Date.now()}`;
    const ops = [{ type: 'ADD_NODE', payload: { node: { id: newId, type, title: type === 'decision' ? 'Entscheidung?' : type === 'end' ? 'Ende' : 'Neuer Schritt' } } }];
    handleApplyOps(ops).then(() => {
      setSelectedNodeId(newId);
      setIsStepDialogOpen(true);
    });
  };

  const handleAddEdge = () => {
    if (!selectedNodeId || !newEdgeTargetId) return;
    const ops = [{ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}`, source: selectedNodeId, target: newEdgeTargetId, label: newEdgeLabel } } }];
    handleApplyOps(ops);
    setNewEdgeTargetId('');
    setNewEdgeLabel('');
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
        setChatMessageCollab('');
        refreshComments();
      }
    } finally {
      setIsCommenting(false);
    }
  };

  if (!mounted) return null;

  const SidebarLeft = (
    <aside 
      style={{ width: isMobile ? '100%' : `${leftWidth}px` }} 
      className={cn(
        "border-r flex flex-col bg-white shrink-0 overflow-hidden relative group/sidebar h-full", 
        isMobile && mobileView !== 'steps' && "hidden"
      )}
    >
      <Tabs defaultValue="steps" className="h-full flex flex-col overflow-hidden">
        <TabsList className="h-12 bg-slate-50 border-b gap-4 p-0 w-full justify-start px-6 shrink-0 rounded-none">
          <TabsTrigger value="meta" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><FilePen className="w-4 h-4" /> Stammblatt</TabsTrigger>
          <TabsTrigger value="steps" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Schritte</TabsTrigger>
        </TabsList>
        
        <TabsContent value="meta" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10 pb-32">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 pb-2 tracking-[0.2em]">Grunddaten</h3>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Prozessbezeichnung</Label>
                  <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="rounded-xl font-bold h-12 border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Status</Label>
                  <Select value={metaStatus} onValueChange={setMetaStatus}>
                    <SelectTrigger className="rounded-xl h-12 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="draft">Entwurf</SelectItem>
                      <SelectItem value="published">Veröffentlicht</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Zusammenfassung</Label>
                  <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="rounded-xl min-h-[100px] text-xs border-slate-200 leading-relaxed" />
                </div>
                
                <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-3">
                  <Label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2 tracking-widest">
                    <HelpCircle className="w-4 h-4" /> Offene Fragen für KI
                  </Label>
                  <Textarea 
                    value={metaOpenQuestions} 
                    onChange={e => setMetaOpenQuestions(e.target.value)} 
                    placeholder="Dokumentieren Sie hier Unklarheiten..."
                    className="rounded-xl min-h-[120px] text-xs border-indigo-200 bg-white focus:border-indigo-400" 
                  />
                </div>
              </div>
              
              <div className="space-y-8 pt-10 border-t border-slate-100">
                <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /><h3 className="text-[10px] font-black uppercase text-emerald-700 tracking-[0.2em]">ISO 9001 Compliance</h3></div>
                {[{ id: 'inputs', label: 'Inputs (Eingabegrößen)', icon: ArrowRight }, { id: 'outputs', label: 'Outputs (Ergebnisse)', icon: Check }, { id: 'risks', label: 'Risiken & Chancen', icon: AlertTriangle }, { id: 'evidence', label: 'Nachweise & Aufzeichnungen', icon: FileCode }].map(f => (
                  <div key={f.id} className="space-y-3">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-600"><f.icon className="w-3.5 h-3.5 text-emerald-600" /> {f.label}</Label>
                    <Textarea 
                      defaultValue={currentVersion?.model_json?.isoFields?.[f.id] || ''} 
                      className="text-xs rounded-xl min-h-[100px] border-slate-200 bg-slate-50 focus:bg-white transition-all" 
                      onBlur={e => handleApplyOps([{ type: 'SET_ISO_FIELD', payload: { field: f.id, value: e.target.value } }])} 
                    />
                  </div>
                ))}
              </div>

              <div className="pt-10 border-t border-slate-100">
                <Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full rounded-2xl h-14 font-black uppercase text-xs gap-3 tracking-[0.2em] bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20">
                  {isSavingMeta ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
                  Stammdaten Speichern
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="steps" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
          <div className="px-6 py-3 border-b bg-white flex items-center justify-between shrink-0">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ablauffolge</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase rounded-lg border-slate-200 hover:bg-primary/5 hover:text-primary transition-all" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
              <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase rounded-lg border-slate-200 hover:bg-accent/5 hover:text-accent transition-all" onClick={() => handleQuickAdd('decision')}>+ Entscheidung</Button>
            </div>
          </div>
          <ScrollArea className="flex-1 bg-slate-50/30">
            <div className="p-6 space-y-3 pb-32">
              {(currentVersion?.model_json?.nodes || []).map((node: any, idx: number) => {
                const isEndLinked = node.type === 'end' && !!node.targetProcessId && node.targetProcessId !== 'none';
                const linkedProc = isEndLinked ? processes?.find(p => p.id === node.targetProcessId) : null;
                const nodeCommentCount = comments?.filter(c => c.node_id === node.id).length || 0;
                
                return (
                  <div 
                    key={`${node.id || idx}`} 
                    className={cn(
                      "group flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer bg-white shadow-sm hover:shadow-md", 
                      selectedNodeId === node.id ? "border-primary ring-4 ring-primary/5" : "border-slate-100 hover:border-slate-300"
                    )} 
                    onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner relative", 
                      node.type === 'decision' ? "bg-accent/10 text-accent border-accent/20" : 
                      node.type === 'start' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                      node.type === 'end' ? (isEndLinked ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-600 border-red-100") :
                      "bg-slate-50 text-slate-600 border-slate-100"
                    )}>
                      {node.type === 'decision' ? <GitBranch className="w-5 h-5" /> : 
                       node.type === 'end' ? (isEndLinked ? <LinkIcon className="w-5 h-5" /> : <CircleDot className="w-5 h-5" />) :
                       <Activity className="w-5 h-5" />}
                      {nodeCommentCount > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[8px] font-black border-2 border-white">{nodeCommentCount}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate leading-tight">{node.title}</p>
                      {isEndLinked ? (
                        <p className="text-[9px] text-blue-600 uppercase font-black flex items-center gap-1.5 mt-1.5"><ExternalLink className="w-3 h-3" /> Verknüpft: {linkedProc?.title}</p>
                      ) : (
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{node.type}</p>
                      )}
                    </div>
                    {!isMobile && (
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 hover:text-primary transition-colors disabled:opacity-20" disabled={idx === 0} onClick={e => { e.stopPropagation(); handleMoveNode(node.id, 'up'); }}><ChevronUp className="w-4 h-4" /></button>
                        <button className="p-1 hover:text-primary transition-colors disabled:opacity-20" disabled={idx === (currentVersion?.model_json?.nodes?.length || 0) - 1} onClick={e => { e.stopPropagation(); handleMoveNode(node.id, 'down'); }}><ChevronDown className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      {!isMobile && <div onMouseDown={startResizeLeft} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 z-30 transition-all opacity-0 group-hover/sidebar:opacity-100" />}
    </aside>
  );

  const DiagramArea = (
    <main className={cn("flex-1 relative bg-slate-100 flex flex-col overflow-hidden", isMobile && mobileView !== 'diagram' && "hidden")}>
      <div className="absolute top-6 right-6 md:top-10 md:right-10 z-10 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-slate-200 p-2 flex flex-col gap-2">
        <TooltipProvider>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={syncDiagramToModel} className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary"><RefreshCw className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-black uppercase">Refresh</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*')} className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary"><Maximize2 className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-black uppercase">Fit to Screen</TooltipContent></Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex-1 bg-white relative overflow-hidden">
        <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
      </div>
    </main>
  );

  const SidebarRight = (
    <aside 
      style={{ width: isMobile ? '100%' : `${rightWidth}px` }} 
      className={cn(
        "border-l flex flex-col bg-white shrink-0 overflow-hidden relative group/right h-full", 
        isMobile && mobileView !== 'ai' && "hidden"
      )}
    >
      {!isMobile && <div onMouseDown={startResizeRight} className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/30 z-30 transition-all opacity-0 group-hover/right:opacity-100" />}
      
      <Tabs value={rightActiveTab} onValueChange={(v: any) => setRightActiveTab(v)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="h-12 bg-slate-900 border-b border-white/10 gap-0 p-0 w-full justify-start rounded-none shrink-0">
          <TabsTrigger value="ai" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 h-full text-[10px] font-black uppercase tracking-widest text-white/50 data-[state=active]:text-primary flex items-center gap-2 transition-all"><Zap className="w-4 h-4 fill-current" /> AI Advisor</TabsTrigger>
          <TabsTrigger value="collab" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 h-full text-[10px] font-black uppercase tracking-widest text-white/50 data-[state=active]:text-primary flex items-center gap-2 transition-all"><MessageCircle className="w-4 h-4" /> Diskussion</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
          <ScrollArea className="flex-1 bg-slate-50/50">
            <div className="p-6 space-y-8 pb-32">
              {chatHistory.length === 0 && (
                <div className="text-center py-20 opacity-30 flex flex-col items-center gap-4">
                  <MessageSquare className="w-12 h-12" />
                  <p className="text-[10px] font-black uppercase tracking-widest max-w-[180px]">Beschreiben Sie Ihren Prozess für einen Entwurf</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={cn("flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2", msg.role === 'user' ? "items-end" : "items-start")}>
                  <div className={cn(
                    "p-5 text-xs leading-relaxed max-w-[92%] shadow-sm rounded-2xl", 
                    msg.role === 'user' ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-100"
                  )}>
                    {msg.text}
                  </div>
                  {msg.role === 'ai' && msg.questions && msg.questions.length > 0 && (
                    <div className="space-y-3 w-full pl-2">
                      {msg.questions.map((q: string, qIdx: number) => (
                        <div key={qIdx} className="p-4 bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-900 italic rounded-xl shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                          <HelpCircle className="w-4 h-4 absolute top-2 right-2 opacity-10" />
                          {q}
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.role === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-4 w-full bg-white border-2 border-primary p-6 rounded-3xl space-y-5 shadow-2xl animate-in zoom-in-95">
                      <div className="flex items-center gap-2 text-primary">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Visueller Vorschlag</span>
                      </div>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                        {msg.suggestions.map((op: any, opIdx: number) => (
                          <div key={opIdx} className="text-[10px] p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
                            <Badge variant="outline" className="text-[8px] font-black bg-white shrink-0 border-slate-200">{op.type.split('_')[0]}</Badge>
                            <span className="truncate font-bold text-slate-700">{op.payload?.node?.title || op.payload?.field || 'Update'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button onClick={() => { handleApplyOps(msg.suggestions); msg.suggestions = []; }} disabled={isApplying} className="flex-1 h-12 bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 rounded-xl">Übernehmen</Button>
                        <Button variant="ghost" onClick={() => msg.suggestions = []} className="flex-1 h-12 text-[10px] font-black uppercase border border-slate-200 rounded-xl">Ablehnen</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">KI modelliert...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-6 border-t bg-white shrink-0">
            <div className="relative group">
              <Input 
                placeholder="Prozess beschreiben..." 
                value={chatMessage} 
                onChange={e => setChatMessage(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAiChat()} 
                className="h-16 rounded-2xl border-2 border-slate-100 bg-slate-50 pr-16 focus:bg-white focus:border-primary transition-all text-sm font-medium" 
                disabled={isAiLoading} 
              />
              <Button size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 bg-slate-900 hover:bg-black text-white rounded-xl shadow-xl active:scale-95 transition-transform" onClick={handleAiChat} disabled={isAiLoading || !chatMessage}>
                {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="collab" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
          <div className="p-6 bg-slate-50 border-b shrink-0">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Letzte Editoren</h3>
            <div className="flex items-center gap-2">
              {lastEditors.length > 0 ? lastEditors.map((e, i) => (
                <TooltipProvider key={i}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-8 w-8 border-2 border-white ring-2 ring-primary/5">
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-black">{e.actorUid.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent className="text-[9px] font-bold uppercase">{e.actorUid}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )) : <p className="text-[9px] text-slate-400 font-bold uppercase italic">Keine Daten verfügbar</p>}
            </div>
          </div>

          <ScrollArea className="flex-1 bg-white">
            <div className="p-6 space-y-6">
              {processComments.length === 0 ? (
                <div className="py-20 text-center space-y-4 opacity-20">
                  <MessageCircle className="w-12 h-12 mx-auto" />
                  <p className="text-[10px] font-black uppercase">Noch keine Anmerkungen</p>
                </div>
              ) : processComments.map((comm) => (
                <div key={comm.id} className="space-y-2 group animate-in slide-in-from-right-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-slate-900">{comm.user_name}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(comm.created_at).toLocaleDateString()}</span>
                    </div>
                    {comm.node_id && (
                      <Badge variant="outline" className="text-[7px] h-4 rounded-none font-black uppercase border-primary/20 text-primary bg-primary/5">Node ID: {comm.node_id}</Badge>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs leading-relaxed text-slate-600">
                    {comm.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-6 border-t bg-slate-50 shrink-0">
            <div className="space-y-3">
              <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Kommentar verfassen</Label>
              {selectedNodeId && (
                <div className="flex items-center justify-between bg-primary/5 p-2 rounded-xl border border-primary/10 mb-2">
                  <span className="text-[9px] font-black text-primary uppercase flex items-center gap-2"><Activity className="w-3 h-3" /> Bezug: {selectedNode?.title}</span>
                  <button onClick={() => setSelectedNodeId(null)} className="text-primary hover:text-primary/80"><X className="w-3 h-3" /></button>
                </div>
              )}
              <Textarea 
                placeholder="Anmerkung hinterlassen..." 
                value={commentText} 
                onChange={e => setChatMessageCollab(e.target.value)}
                className="min-h-[80px] rounded-2xl border-slate-200 focus:border-primary text-xs" 
              />
              <Button onClick={handleAddComment} disabled={isCommenting || !commentText.trim()} className="w-full rounded-xl h-10 font-black uppercase text-[10px] gap-2 tracking-widest bg-primary text-white">
                {isCommenting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Kommentar senden
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 selection:bg-primary/20 selection:text-primary">
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-base md:text-lg tracking-tight text-slate-900 truncate max-w-[200px] md:max-w-md">{currentProcess?.title}</h2>
              <Badge className="bg-primary/10 text-primary border-none rounded-full text-[9px] font-black uppercase px-3 h-5 hidden md:flex">Rev {currentVersion?.revision}</Badge>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest truncate">{currentProcess?.status} • V{currentVersion?.version}.0</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 mr-4 border-r pr-6 border-slate-100">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Aktiv:</span>
            <div className="flex -space-x-2">
              <Avatar className="h-7 w-7 border-2 border-white">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-[8px] font-black">AI</AvatarFallback>
              </Avatar>
              <Avatar className="h-7 w-7 border-2 border-white">
                <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-black">{user?.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl h-10 text-[10px] font-black uppercase border-slate-200 px-6 gap-2 hidden md:flex hover:bg-indigo-50 hover:text-indigo-600 transition-all" onClick={() => publishToBookStackAction(currentProcess.id, currentVersion?.version || 1, "", dataSource).then(() => toast({ title: "Export erfolgreich" }))} disabled={isPublishing}>
            {isPublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4" />} Export
          </Button>
          <Button size="sm" className="rounded-xl h-10 text-[10px] font-black uppercase bg-primary hover:bg-primary/90 text-white px-8 shadow-lg shadow-primary/20" onClick={() => syncDiagramToModel()}>
            <RefreshCw className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        {SidebarLeft}
        {DiagramArea}
        {SidebarRight}
      </div>

      {isMobile && (
        <div className="h-20 border-t bg-white flex items-center justify-around px-4 shrink-0 z-30 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
          <button onClick={() => setMobileView('steps')} className={cn("flex flex-col items-center gap-1.5 flex-1 h-full justify-center transition-all", mobileView === 'steps' ? "text-primary scale-110" : "text-slate-400")}>
            <LayoutGrid className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Detail</span>
          </button>
          <button onClick={() => setMobileView('diagram')} className={cn("flex flex-col items-center gap-1.5 flex-1 h-full justify-center transition-all", mobileView === 'diagram' ? "text-primary scale-110" : "text-slate-400")}>
            <Layout className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Visual</span>
          </button>
          <button onClick={() => setMobileView('ai')} className={cn("flex flex-col items-center gap-1.5 flex-1 h-full justify-center transition-all", mobileView === 'ai' ? "text-primary scale-110" : "text-slate-400")}>
            <Sparkles className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Advisor</span>
          </button>
        </div>
      )}

      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-[2.5rem] p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white max-h-[90vh]">
          <DialogHeader className={cn("p-10 text-white shrink-0", localNodeEdits.type === 'end' ? "bg-red-900" : "bg-slate-900")}>
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 border border-white/20 shadow-xl">
                {localNodeEdits.type === 'decision' ? <GitBranch className="w-8 h-8" /> : 
                 localNodeEdits.type === 'end' ? <CircleDot className="w-8 h-8" /> :
                 <Activity className="w-8 h-8" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight truncate">{localNodeEdits.title || 'Schritt bearbeiten'}</DialogTitle>
                <DialogDescription className="text-[10px] text-white/50 uppercase font-black tracking-[0.2em] mt-1.5">ID: {selectedNodeId} | Typ: {localNodeEdits.type}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-0">
            <div className="p-8 md:p-12 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Schrittbezeichnung</Label>
                  <Input value={localNodeEdits.title} onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})} onBlur={() => saveNodeUpdate('title')} className="h-14 text-base font-bold rounded-2xl border-slate-200 focus:border-primary focus:ring-4 ring-primary/5" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Verantwortliche Stelle</Label>
                  <Select value={localNodeEdits.roleId} onValueChange={(val) => { setLocalNodeEdits({...localNodeEdits, roleId: val}); saveNodeUpdate('roleId', val); }}>
                    <SelectTrigger className="h-14 rounded-2xl border-slate-200 bg-slate-50/50">
                      <SelectValue placeholder="Rolle wählen..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="none">Keine spezifische Stelle</SelectItem>
                      {jobTitles?.filter(j => j.tenantId === currentProcess?.tenantId || j.tenantId === 'global').map(j => (
                        <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Detaillierte Anweisung</Label>
                  <Textarea value={localNodeEdits.description} onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})} onBlur={() => saveNodeUpdate('description')} className="text-sm min-h-[150px] rounded-2xl border-slate-200 bg-slate-50 focus:bg-white transition-all leading-relaxed p-5" placeholder="Beschreiben Sie hier präzise, was in diesem Schritt zu tun ist..." />
                </div>
                
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" /> Operative Checkliste
                  </Label>
                  <Textarea value={localNodeEdits.checklist} onChange={e => setLocalNodeEdits({...localNodeEdits, checklist: e.target.value})} onBlur={() => saveNodeUpdate('checklist')} className="text-xs min-h-[120px] bg-slate-900 text-slate-100 rounded-2xl font-mono p-5 leading-relaxed" placeholder="Ein Prüfpunkt pro Zeile..." />
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  className="rounded-xl h-12 font-black uppercase text-[10px] gap-2 flex-1"
                  onClick={() => { setRightActiveTab('collab'); setIsStepDialogOpen(false); }}
                >
                  <MessageCircle className="w-4 h-4" /> Zum Schritt diskutieren
                </Button>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-10 bg-slate-50 border-t shrink-0 flex items-center justify-between">
            <Button variant="ghost" className="text-red-600 rounded-xl h-14 px-8 hover:bg-red-50 font-black uppercase text-[10px] gap-3 transition-colors" onClick={() => { if(confirm("Schritt permanent löschen?")) { handleApplyOps([{ type: 'REMOVE_NODE', payload: { nodeId: selectedNodeId } }]); setIsStepDialogOpen(false); } }}>
              <Trash2 className="w-5 h-5" /> Schritt löschen
            </Button>
            <Button onClick={() => setIsStepDialogOpen(false)} className="rounded-2xl h-14 px-16 font-black uppercase text-xs tracking-[0.2em] bg-slate-900 hover:bg-black text-white shadow-2xl">
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
