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
  Box,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  FileCode,
  FilePen,
  ArrowRightCircle,
  ArrowRight,
  Terminal,
  CheckCircle,
  Link as LinkIcon,
  MousePointer2,
  Maximize2,
  Info,
  CircleDot,
  LogOut,
  ExternalLink,
  HelpCircle
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
import { toast } from '@/hooks/use-toast';
import { ProcessModel, ProcessLayout, ProcessNode, Process } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach((node, idx) => {
    const pos = positions[node.id] || { x: 50 + (idx * 220), y: 150 };
    let style = '';
    let w = 160, h = 80;
    switch (node.type) {
      case 'start': style = 'ellipse;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;'; w = 60; h = 60; break;
      case 'end': 
        const hasLink = !!node.targetProcessId;
        style = hasLink 
          ? 'ellipse;fillColor=#e1f5fe;strokeColor=#0288d1;strokeWidth=3;' 
          : 'ellipse;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=3;'; 
        w = 60; h = 60; 
        break;
      case 'decision': style = 'rhombus;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;'; w = 100; h = 100; break;
      default: style = 'whiteSpace=wrap;html=1;rounded=1;fillColor=#ffffff;strokeColor=#334155;strokeWidth=1.5;shadow=1;';
    }
    xml += `<mxCell id="${node.id}" value="${node.title}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach(edge => {
    xml += `<mxCell id="${edge.id}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=2;fontSize=10;" edge="1" parent="1" source="${edge.source}" target="${edge.target}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
  });
  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function ProcessDesignerPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource } = useSettings();
  const { user } = usePlatformAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [leftWidth, setLeftWidth] = useState(380);
  const [rightWidth, setRightWidth] = useState(380);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [localNodeEdits, setLocalNodeEdits] = useState({ 
    id: '', title: '', roleId: '', description: '', checklist: '', tips: '', errors: '', type: 'step', targetProcessId: '' 
  });

  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaOpenQuestions, setMetaOpenQuestions] = useState('');
  const [metaStatus, setMetaStatus] = useState<any>('draft');

  const [newEdgeTargetId, setNewEdgeTargetId] = useState<string>('');
  const [newEdgeLabel, setNewEdgeLabel] = useState<string>('');

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id), [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);

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
        targetProcessId: selectedNode.targetProcessId || ''
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
    isResizingLeft.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  }, [handleMouseMove, stopResizing]);

  const startResizeRight = useCallback((e: React.MouseEvent) => {
    isResizingRight.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  }, [handleMouseMove, stopResizing]);

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
        toast({ title: "Modell aktualisiert" });
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

  const saveNodeUpdate = async (field: string) => {
    if (!selectedNodeId) return;
    const value = (localNodeEdits as any)[field];
    let processedValue: any = value;
    if (field === 'checklist') processedValue = value.split('\n').filter((l: string) => l.trim() !== '');
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

  const handleMoveNode = async (nodeId: string, direction: 'up' | 'down') => {
    if (!currentVersion) return;
    const nodes = [...currentVersion.model_json.nodes];
    const index = nodes.findIndex((n: any) => n.id === nodeId);
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= nodes.length) return;
    const newNodes = [...nodes];
    const [movedNode] = newNodes.splice(index, 1);
    newNodes.splice(newIndex, 0, movedNode);
    await handleApplyOps([{ type: 'REORDER_NODES', payload: { orderedNodeIds: newNodes.map(n => n.id) } }]);
  };

  const handleAddEdge = async () => {
    if (!selectedNodeId || !newEdgeTargetId) return;
    await handleApplyOps([{ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}`, source: selectedNodeId, target: newEdgeTargetId, label: newEdgeLabel } } }]);
    setNewEdgeTargetId(''); setNewEdgeLabel('');
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

  if (!mounted) return null;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -m-8 overflow-hidden bg-slate-50 font-body select-none">
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-none"><ChevronLeft className="w-6 h-6" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-base tracking-tight text-slate-900">{currentProcess?.title}</h2>
              <Badge className="bg-blue-600 rounded-none text-[8px] font-black uppercase px-2 h-4">Rev {currentVersion?.revision}</Badge>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{currentProcess?.status} • V{currentVersion?.version}.0</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" className="rounded-none h-9 text-[10px] font-bold uppercase" onClick={syncDiagramToModel}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Sync</Button></TooltipTrigger><TooltipContent className="text-[10px] font-bold uppercase">Diagramm aktualisieren</TooltipContent></Tooltip></TooltipProvider>
          <Button size="sm" className="rounded-none h-9 text-[10px] font-bold uppercase bg-slate-900 hover:bg-black text-white px-6 gap-2" onClick={() => publishToBookStackAction(currentProcess.id, currentVersion?.version || 1, "", dataSource).then(() => toast({ title: "Export erfolgreich" }))} disabled={isPublishing}>{isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />} Export</Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside style={{ width: `${leftWidth}px` }} className="border-r flex flex-col bg-white shrink-0 overflow-hidden relative group/sidebar">
          <Tabs defaultValue="steps" className="flex-1 flex flex-col min-h-0">
            <TabsList className="h-14 bg-slate-50 border-b gap-2 p-0 w-full justify-start px-4 shrink-0 rounded-none">
              <TabsTrigger value="meta" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-3 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"><FilePen className="w-3.5 h-3.5" /> Stammblatt</TabsTrigger>
              <TabsTrigger value="steps" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-3 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"><ClipboardList className="w-3.5 h-3.5" /> Prozessschritte</TabsTrigger>
            </TabsList>
            
            <TabsContent value="meta" className="flex-1 mt-0 m-0 p-0 overflow-hidden data-[state=active]:flex flex-col outline-none">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-10 pb-20">
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 border-b pb-1">Allgemein</h3>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Name</Label><Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="rounded-none font-bold h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Status</Label><Select value={metaStatus} onValueChange={setMetaStatus}><SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="draft">Entwurf</SelectItem><SelectItem value="published">Veröffentlicht</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Beschreibung</Label><Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="rounded-none min-h-[80px] text-xs" /></div>
                    
                    <div className="space-y-1.5 pt-4">
                      <Label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2">
                        <HelpCircle className="w-3.5 h-3.5" /> Offene Fragen (KI Fokus)
                      </Label>
                      <Textarea 
                        value={metaOpenQuestions} 
                        onChange={e => setMetaOpenQuestions(e.target.value)} 
                        placeholder="Was muss noch geklärt werden? Die KI berücksichtigt dieses Feld..."
                        className="rounded-none min-h-[120px] text-xs border-indigo-100 bg-indigo-50/10 focus:border-indigo-300" 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-6 pt-10 border-t">
                    <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /><h3 className="text-[10px] font-black uppercase text-emerald-700">ISO 9001 Compliance</h3></div>
                    {[{ id: 'inputs', label: 'Inputs', icon: ArrowRight }, { id: 'outputs', label: 'Outputs', icon: Check }, { id: 'risks', label: 'Risiken', icon: AlertTriangle }, { id: 'evidence', label: 'Nachweise', icon: FileCode }].map(f => (
                      <div key={f.id} className="space-y-2"><Label className="text-[10px] font-bold uppercase flex items-center gap-2"><f.icon className="w-3.5 h-3.5 text-emerald-600" /> {f.label}</Label><Textarea defaultValue={currentVersion?.model_json?.isoFields?.[f.id] || ''} className="text-xs rounded-none min-h-[80px]" onBlur={e => handleApplyOps([{ type: 'SET_ISO_FIELD', payload: { field: f.id, value: e.target.value } }])} /></div>
                    ))}
                  </div>
                  
                  <div className="pt-10 border-t">
                    <Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full rounded-none h-11 font-black uppercase text-[10px] gap-2 tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl">
                      {isSavingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 
                      Stammdaten Speichern
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="steps" className="flex-1 mt-0 m-0 p-0 overflow-hidden data-[state=active]:flex flex-col outline-none">
              <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between shrink-0">
                <h3 className="text-[10px] font-bold uppercase text-slate-400">Ablauffolge</h3>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-[8px] font-bold uppercase rounded-none" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[8px] font-bold uppercase rounded-none" onClick={() => handleQuickAdd('decision')}>+ Entsch.</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[8px] font-bold uppercase rounded-none" onClick={() => handleQuickAdd('end')}>+ Ende</Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-1.5 pb-20">
                  {(currentVersion?.model_json?.nodes || []).map((node: any, idx: number) => {
                    const isEndLinked = node.type === 'end' && !!node.targetProcessId;
                    const linkedProc = isEndLinked ? processes?.find(p => p.id === node.targetProcessId) : null;
                    
                    return (
                      <div key={`${node.id}-${idx}`} className={cn("group flex items-center gap-3 p-2.5 border transition-all cursor-pointer bg-white", selectedNodeId === node.id ? "border-primary ring-1 ring-primary/10" : "border-slate-100 hover:border-slate-300")} onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}>
                        <div className={cn(
                          "w-7 h-7 rounded-none flex items-center justify-center shrink-0 border", 
                          node.type === 'decision' ? "bg-orange-50 text-orange-600" : 
                          node.type === 'start' ? "bg-emerald-50 text-emerald-700" : 
                          node.type === 'end' ? (isEndLinked ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600") :
                          "bg-slate-50 text-slate-600"
                        )}>
                          {node.type === 'decision' ? <GitBranch className="w-3.5 h-3.5" /> : 
                           node.type === 'end' ? (isEndLinked ? <LinkIcon className="w-3.5 h-3.5" /> : <CircleDot className="w-3.5 h-3.5" />) :
                           <Activity className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{node.title}</p>
                          {isEndLinked && <p className="text-[8px] text-blue-600 uppercase font-black flex items-center gap-1 mt-0.5"><ExternalLink className="w-2.5 h-2.5" /> Link: {linkedProc?.title}</p>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={e => { e.stopPropagation(); handleMoveNode(node.id, 'up'); }}><ChevronUp className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === currentVersion.model_json.nodes.length - 1} onClick={e => { e.stopPropagation(); handleMoveNode(node.id, 'down'); }}><ChevronDown className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
          <div onMouseDown={startResizeLeft} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 z-30 transition-all opacity-0 group-hover/sidebar:opacity-100" />
        </aside>

        <main className="flex-1 relative bg-slate-100 flex flex-col p-6 overflow-hidden">
          <div className="absolute top-10 right-10 z-10 bg-white/95 backdrop-blur shadow-2xl border p-1.5 flex flex-col gap-1.5">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={syncDiagramToModel} className="h-9 w-9"><RefreshCw className="w-4 h-4 text-slate-600" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-bold uppercase">Sync</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*')} className="h-9 w-9"><Maximize2 className="w-4 h-4 text-slate-600" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-bold uppercase">Zentrieren</TooltipContent></Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 bg-white shadow-inner border-2 relative overflow-hidden"><iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" /></div>
        </main>

        <aside style={{ width: `${rightWidth}px` }} className="border-l flex flex-col bg-white shrink-0 overflow-hidden relative group/right">
          <div onMouseDown={startResizeRight} className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/30 z-30 transition-all opacity-0 group-hover/right:opacity-100" />
          <div className="p-5 border-b bg-slate-900 text-white flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-primary flex items-center justify-center shadow-lg"><Zap className="w-5 h-5 text-white fill-current" /></div><div className="flex flex-col"><span className="text-[10px] font-black uppercase text-blue-400">KI Advisor</span><span className="text-[8px] font-bold text-slate-400 uppercase">Active Assistant</span></div></div></div>
          <ScrollArea className="flex-1 p-5 bg-slate-50/50 select-auto">
            <div className="space-y-6">
              {chatHistory.length === 0 && <div className="text-center py-20 opacity-40"><MessageSquare className="w-8 h-8 mx-auto mb-4" /><p className="text-[10px] font-bold uppercase">Bereit für Ihre Anweisung</p></div>}
              {chatHistory.map((msg, i) => (
                <div key={i} className={cn("flex flex-col gap-2", msg.role === 'user' ? "items-end" : "items-start")}>
                  <div className={cn("p-4 text-[11px] leading-relaxed max-w-[90%] shadow-sm", msg.role === 'user' ? "bg-slate-900 text-white" : "bg-white text-slate-700 border-l-4 border-l-primary")}>{msg.text}</div>
                  {msg.role === 'ai' && msg.questions && msg.questions.length > 0 && (
                    <div className="space-y-2 w-full">
                      {msg.questions.map((q: string, qIdx: number) => (
                        <div key={qIdx} className="p-4 bg-indigo-50 border-2 border-indigo-100 text-[11px] font-bold text-indigo-900 italic shadow-sm relative group">
                          <HelpCircle className="w-3.5 h-3.5 absolute top-2 right-2 opacity-20" />
                          {q}
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.role === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-3 w-full bg-white border-2 border-primary p-5 space-y-4 shadow-xl"><div className="flex items-center gap-2 text-primary"><Sparkles className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Vorschlag anwenden</span></div>
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                        {msg.suggestions.map((op: any, opIdx: number) => (
                          <div key={opIdx} className="text-[9px] p-2 bg-slate-50 border border-slate-100 flex items-center gap-3">
                            <span className="font-bold text-slate-400 uppercase text-[7px]">{op.type}</span>
                            <span className="truncate font-bold text-slate-700">{op.payload?.node?.title || op.payload?.field || (op.type === 'UPDATE_PROCESS_META' ? 'Metadaten (Fragen)' : 'Update')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2"><Button onClick={() => { handleApplyOps(msg.suggestions); msg.suggestions = []; }} disabled={isApplying} className="flex-1 h-11 bg-primary text-white text-[10px] font-bold uppercase">Übernehmen</Button><Button variant="outline" onClick={() => msg.suggestions = []} className="flex-1 h-11 text-[10px] font-bold uppercase">Ablehnen</Button></div>
                    </div>
                  )}
                </div>
              ))}
              {isAiLoading && <div className="flex justify-start"><div className="bg-white border p-4 flex items-center gap-4 shadow-sm"><Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="text-[10px] font-bold text-slate-400 uppercase animate-pulse">Analysiere...</span></div></div>}
            </div>
          </ScrollArea>
          <div className="p-5 border-t bg-white select-auto"><div className="relative"><Input placeholder="Prozess beschreiben..." value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiChat()} className="h-14 rounded-none border-2 bg-slate-50/50 pr-14" disabled={isAiLoading} /><Button size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-slate-900 text-white" onClick={handleAiChat} disabled={isAiLoading || !chatMessage}>{isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</Button></div></div>
        </aside>
      </div>

      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-3xl rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-2xl bg-white">
          <DialogHeader className={cn("p-6 text-white shrink-0", localNodeEdits.type === 'end' ? "bg-red-900" : "bg-slate-900")}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-none flex items-center justify-center shrink-0 border border-white/20">
                {localNodeEdits.type === 'decision' ? <GitBranch className="w-5 h-5" /> : 
                 localNodeEdits.type === 'end' ? <CircleDot className="w-5 h-5" /> :
                 <Activity className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold uppercase tracking-wide truncate">{localNodeEdits.title || 'Schritt bearbeiten'}</DialogTitle>
                <DialogDescription className="text-[9px] text-white/50 uppercase font-black tracking-widest mt-0.5">ID: {selectedNodeId} | Typ: {localNodeEdits.type}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[75vh] p-0">
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Schrittbezeichnung</Label>
                  <Input value={localNodeEdits.title} onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})} onBlur={() => saveNodeUpdate('title')} className="h-11 text-sm font-bold rounded-none border-2 focus:border-primary" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Verantwortliche Rolle</Label>
                  <Input value={localNodeEdits.roleId} onChange={e => setLocalNodeEdits({...localNodeEdits, roleId: e.target.value})} onBlur={() => saveNodeUpdate('roleId')} className="h-11 text-sm rounded-none border-2" placeholder="z.B. IT-Admin, HR, Einkauf" />
                </div>
              </div>

              {localNodeEdits.type === 'end' && (
                <div className="p-5 bg-blue-50 border-2 border-blue-100 rounded-none space-y-4 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <LinkIcon className="w-4 h-4" />
                    <Label className="text-[10px] font-black uppercase tracking-widest">Prozess-Verknüpfung (Handover)</Label>
                  </div>
                  <Select value={localNodeEdits.targetProcessId} onValueChange={(val) => { setLocalNodeEdits({...localNodeEdits, targetProcessId: val}); saveNodeUpdate('targetProcessId'); }}>
                    <SelectTrigger className="h-11 rounded-none bg-white border-blue-200 border-2 font-bold text-xs">
                      <SelectValue placeholder="Folgeprozess wählen..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">Keine Verknüpfung</SelectItem>
                      {processes?.filter(p => p.id !== id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-blue-600/70 leading-relaxed italic">
                    Modellieren Sie Prozessketten: Bei Auswahl eines Folgeprozesses kann der Anwender am Ende dieses Ablaufs direkt zum nächsten Prozess springen.
                  </p>
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Detaillierte Anweisung</Label>
                  <Textarea value={localNodeEdits.description} onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})} onBlur={() => saveNodeUpdate('description')} className="text-sm min-h-[120px] rounded-none border-2 resize-none" placeholder="Beschreiben Sie hier präzise, was in diesem Schritt zu tun ist..." />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Operative Checkliste
                  </Label>
                  <Textarea value={localNodeEdits.checklist} onChange={e => setLocalNodeEdits({...localNodeEdits, checklist: e.target.value})} onBlur={() => saveNodeUpdate('checklist')} className="text-xs min-h-[100px] bg-slate-50/50 rounded-none border-2 font-mono" placeholder="Ein Prüfpunkt pro Zeile..." />
                </div>
              </div>
              
              <div className="pt-8 border-t space-y-6">
                <div className="flex items-center gap-2 text-primary">
                  <GitBranch className="w-4 h-4" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Ablauf-Logik & Verzweigungen</h4>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase text-slate-400">Existierende Ausgänge</Label>
                    <div className="space-y-2">
                      {(currentVersion?.model_json?.edges || []).filter((e: any) => e.source === selectedNodeId).map((edge: any, eidx: number) => {
                        const targetNode = currentVersion?.model_json?.nodes?.find((n: any) => n.id === edge.target);
                        return (
                          <div key={`${edge.id}-${eidx}`} className="flex items-center justify-between p-3 border-2 bg-slate-50 hover:bg-white transition-colors text-[11px] shadow-sm group">
                            <div className="flex items-center gap-3 truncate">
                              <ArrowRightCircle className="w-4 h-4 text-primary" />
                              <div className="truncate">
                                <span className="font-black text-primary uppercase text-[8px] block">{edge.label || 'Direkt'}</span>
                                <span className="font-bold text-slate-700 truncate">{targetNode?.title || edge.target}</span>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleApplyOps([{ type: 'REMOVE_EDGE', payload: { edgeId: edge.id } }])}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                      {(currentVersion?.model_json?.edges || []).filter((e: any) => e.source === selectedNodeId).length === 0 && (
                        <div className="p-4 border-2 border-dashed text-center text-[10px] font-bold text-slate-400 uppercase">
                          Keine Ausgänge definiert
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 bg-slate-100 border-2 border-slate-200 rounded-none space-y-4">
                    <p className="text-[9px] font-black uppercase text-slate-500 border-b border-slate-200 pb-2">Neuen Pfad erstellen</p>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[8px] uppercase font-black text-slate-600">Zielschritt</Label>
                        <Select value={newEdgeTargetId} onValueChange={setNewEdgeTargetId}>
                          <SelectTrigger className="h-10 rounded-none bg-white border-2 shadow-none font-bold text-xs">
                            <SelectValue placeholder="Wählen..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-none">
                            {(currentVersion?.model_json?.nodes || []).filter((n: any) => n.id !== selectedNodeId).map((n: any) => <SelectItem key={n.id} value={n.id} className="text-xs">{n.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[8px] uppercase font-black text-slate-600">Bedingung (Label)</Label>
                        <Input value={newEdgeLabel} onChange={e => setNewEdgeLabel(e.target.value)} className="h-10 rounded-none bg-white border-2 shadow-none text-xs" placeholder="z.B. OK, Ja, Nein, Fehler" />
                      </div>
                      <Button onClick={handleAddEdge} disabled={!newEdgeTargetId} className="w-full h-10 text-[10px] font-black bg-slate-900 hover:bg-black text-white rounded-none uppercase shadow-lg gap-2">
                        <Plus className="w-3.5 h-3.5" /> Pfad verknüpfen
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0 flex items-center justify-between">
            <Button variant="ghost" className="text-red-600 rounded-none h-11 px-6 hover:bg-red-50 font-bold uppercase text-[10px] gap-2" onClick={() => { if(confirm("Knoten permanent löschen?")) { handleApplyOps([{ type: 'REMOVE_NODE', payload: { nodeId: selectedNodeId } }]); setIsStepDialogOpen(false); } }}>
              <Trash2 className="w-4 h-4" /> Schritt löschen
            </Button>
            <Button onClick={() => setIsStepDialogOpen(false)} className="rounded-none h-11 px-12 font-black uppercase text-[10px] bg-slate-900 hover:bg-black text-white shadow-xl tracking-widest">
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
