
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
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ProcessModel, ProcessLayout, ProcessNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

/**
 * Generiert MXGraph XML aus dem semantischen Modell.
 */
function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach((node, idx) => {
    const defaultX = 50 + (idx * 220);
    const defaultY = 150;
    const pos = positions[node.id] || { x: defaultX, y: defaultY };
    
    let style = '';
    let w = 160, h = 80;

    switch (node.type) {
      case 'start':
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;strokeWidth=2;';
        w = 60; h = 60;
        break;
      case 'end':
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;fontStyle=1;strokeWidth=3;';
        w = 60; h = 60;
        break;
      case 'decision':
        style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;';
        w = 100; h = 100;
        break;
      default:
        style = 'whiteSpace=wrap;html=1;rounded=1;fillColor=#ffffff;strokeColor=#334155;strokeWidth=1.5;shadow=1;';
    }
    
    xml += `<mxCell id="${node.id}" value="${node.title}" style="${style}" vertex="1" parent="1">
      <mxGeometry x="${pos.x}" y="${pos.y}" width="${w}" height="${h}" as="geometry"/>
    </mxCell>`;
  });

  edges.forEach(edge => {
    xml += `<mxCell id="${edge.id}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=2;fontSize=10;fontColor=#475569;" edge="1" parent="1" source="${edge.source}" target="${edge.target}">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>`;
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
  
  // Resizable state
  const [leftWidth, setLeftWidth] = useState(400);
  const [rightWidth, setRightWidth] = useState(380);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string, questions?: string[], suggestions?: any, timestamp: number}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [localNodeEdits, setLocalNodeEdits] = useState({ id: '', title: '', roleId: '', description: '', checklist: '', tips: '', errors: '' });

  // Metadata Form State
  const [metaTitle, setMetaMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaStatus, setMetaStatus] = useState<any>('draft');

  const [newEdgeTargetId, setNewEdgeTargetId] = useState<string>('');
  const [newEdgeLabel, setNewEdgeLabel] = useState<string>('');

  const { data: processes, refresh: refreshProc } = usePluggableCollection<any>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id), [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);

  const selectedNode = useMemo(() => 
    currentVersion?.model_json?.nodes?.find((n: any) => n.id === selectedNodeId), 
    [currentVersion, selectedNodeId]
  );

  useEffect(() => {
    if (currentProcess) {
      setMetaMetaTitle(currentProcess.title || '');
      setMetaDesc(currentProcess.description || '');
      setMetaStatus(currentProcess.status || 'draft');
    }
  }, [currentProcess?.id]);

  useEffect(() => {
    if (selectedNode && localNodeEdits.id !== selectedNode.id) {
      setLocalNodeEdits({
        id: selectedNode.id,
        title: selectedNode.title || '',
        roleId: selectedNode.roleId || '',
        description: selectedNode.description || '',
        checklist: (selectedNode.checklist || []).join('\n'),
        tips: selectedNode.tips || '',
        errors: selectedNode.errors || ''
      });
    }
  }, [selectedNode?.id, localNodeEdits.id]);

  useEffect(() => { setMounted(true); }, []);

  // Resize Handlers
  const startResizeLeft = useCallback((e: React.MouseEvent) => {
    isResizingLeft.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  }, []);

  const startResizeRight = useCallback((e: React.MouseEvent) => {
    isResizingRight.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  }, []);

  const stopResizing = useCallback(() => {
    isResizingLeft.current = false;
    isResizingRight.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingLeft.current) {
      const newWidth = Math.max(250, Math.min(600, e.clientX));
      setLeftWidth(newWidth);
    }
    if (isResizingRight.current) {
      const newWidth = Math.max(300, Math.min(600, window.innerWidth - e.clientX));
      setRightWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !currentVersion) return;
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string' || evt.data.length === 0) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') syncDiagramToModel();
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, currentVersion?.id]);

  const syncDiagramToModel = () => {
    if (!iframeRef.current || !currentVersion) return;
    const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({
      action: 'load',
      xml: xml,
      autosave: 1
    }), '*');
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({action: 'zoom', type: 'fit'}), '*');
    }, 500);
  };

  const handleApplyOps = async (ops: any[]) => {
    if (!currentVersion || !user || !ops.length) return;
    setIsApplying(true);
    try {
      const res = await applyProcessOpsAction(
        currentVersion.process_id,
        currentVersion.version,
        ops,
        currentVersion.revision,
        user.id,
        dataSource
      );
      if (res.success) {
        toast({ title: "Modell aktualisiert" });
        refreshVersion();
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
        status: metaStatus
      }, dataSource);
      if (res.success) {
        toast({ title: "Stammdaten gespeichert" });
        refreshProc();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSavingMeta(false);
    }
  };

  const saveNodeUpdate = async (field: string) => {
    if (!selectedNodeId) return;
    const value = (localNodeEdits as any)[field];
    
    let processedValue: any = value;
    if (field === 'checklist') processedValue = value.split('\n').filter((l: string) => l.trim() !== '');

    const ops = [{
      type: 'UPDATE_NODE',
      payload: { nodeId: selectedNodeId, patch: { [field]: processedValue } }
    }];
    await handleApplyOps(ops);
  };

  const handleQuickAdd = (type: 'step' | 'decision') => {
    const newId = `${type}-${Date.now()}`;
    const ops = [
      {
        type: 'ADD_NODE',
        payload: { 
          node: { 
            id: newId, 
            type, 
            title: type === 'decision' ? 'Entscheidung?' : 'Neuer Schritt',
            description: '',
            checklist: [],
            tips: '',
            errors: ''
          } 
        }
      }
    ];
    handleApplyOps(ops);
    setSelectedNodeId(newId);
    setIsStepDialogOpen(true);
  };

  const handleMoveNode = async (nodeId: string, direction: 'up' | 'down') => {
    if (!currentVersion) return;
    const nodes = [...currentVersion.model_json.nodes];
    const index = nodes.findIndex((n: any) => n.id === nodeId);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= nodes.length) return;
    const newNodes = [...nodes];
    const [movedNode] = newNodes.splice(index, 1);
    newNodes.splice(newIndex, 0, movedNode);
    const ops = [{
      type: 'REORDER_NODES',
      payload: { orderedNodeIds: newNodes.map(n => n.id) }
    }];
    await handleApplyOps(ops);
  };

  const handleAddEdge = async () => {
    if (!selectedNodeId || !newEdgeTargetId) return;
    const ops = [{
      type: 'ADD_EDGE',
      payload: {
        edge: {
          id: `edge-${Date.now()}`,
          source: selectedNodeId,
          target: newEdgeTargetId,
          label: newEdgeLabel
        }
      }
    }];
    await handleApplyOps(ops);
    setNewEdgeTargetId('');
    setNewEdgeLabel('');
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
    
    const newHistory = [...chatHistory, { role: 'user', text: msg, timestamp: Date.now() } as const];
    setChatHistory(newHistory);

    try {
      const suggestions = await getProcessSuggestions({
        userMessage: msg,
        currentModel: currentVersion.model_json,
        chatHistory: newHistory,
        dataSource
      });
      setChatHistory([...newHistory, { 
        role: 'ai', 
        text: suggestions.explanation, 
        questions: suggestions.openQuestions,
        suggestions: suggestions.proposedOps,
        timestamp: Date.now()
      } as const]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "KI-Fehler", description: e.message });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!currentVersion || !currentProcess) return;
    setIsPublishing(true);
    try {
      const res = await publishToBookStackAction(currentProcess.id, currentVersion.version, "", dataSource);
      if (res.success) toast({ title: "Veröffentlicht!", description: `In BookStack verfügbar.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export Fehler", description: e.message });
    } finally {
      setIsPublishing(false);
    }
  };

  const getOpTitle = (op: any) => {
    const type = op.type;
    const p = op.payload;
    if (type === 'ADD_NODE' && p.node) return `Schritt: ${p.node.title || 'Neu'}`;
    if (type === 'UPDATE_NODE' && p.nodeId) {
      const node = currentVersion?.model_json?.nodes?.find((n: any) => n.id === p.nodeId);
      return `Update: ${node?.title || p.nodeId}`;
    }
    if (type === 'SET_ISO_FIELD') return `ISO: ${p.field}`;
    if (type === 'ADD_EDGE') return `Logik: ${p.edge?.label || 'Verbindung'}`;
    return String(type);
  };

  if (!mounted) return null;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -m-8 overflow-hidden bg-slate-50 font-body select-none">
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-none">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-base tracking-tight text-slate-900">{currentProcess?.title}</h2>
              <Badge className="bg-blue-600 rounded-none text-[8px] font-black uppercase px-2 h-4">Revision {currentVersion?.revision}</Badge>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase mt-0.5">
              <Activity className="w-2.5 h-2.5" />
              <span>{currentProcess?.status}</span>
              <span className="mx-1">•</span>
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Version {currentVersion?.version}.0</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-none h-9 text-[10px] font-bold uppercase border-slate-200 text-slate-600 hover:bg-slate-50" onClick={syncDiagramToModel}>
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Diagramm Sync
                </Button>
              </TooltipTrigger>
              <TooltipContent className="rounded-none text-[10px] font-bold uppercase">Grafik aktualisieren</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-6 bg-slate-200 mx-1" />
          <Button size="sm" className="rounded-none h-9 text-[10px] font-bold uppercase bg-slate-900 hover:bg-black text-white px-6 gap-2" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
            Exportieren
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Structure */}
        <aside 
          style={{ width: `${leftWidth}px` }}
          className="border-r flex flex-col bg-white shrink-0 overflow-hidden shadow-sm relative group/sidebar"
        >
          <Tabs defaultValue="steps" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 border-b bg-slate-50 shrink-0">
              <TabsList className="h-14 bg-transparent gap-2 p-0 w-full justify-start">
                <TabsTrigger value="meta" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <FilePen className="w-3.5 h-3.5" /> Stammblatt
                </TabsTrigger>
                <TabsTrigger value="steps" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5" /> Prozessschritte
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 flex flex-col select-auto">
              <ScrollArea className="flex-1">
                <TabsContent value="meta" className="m-0 p-6 space-y-8">
                  {/* General Metadata */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1">Allgemeine Informationen</h3>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Prozessbezeichnung</Label>
                      <Input value={metaTitle} onChange={e => setMetaMetaTitle(e.target.value)} className="rounded-none font-bold h-10 border-slate-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Aktueller Status</Label>
                      <Select value={metaStatus} onValueChange={setMetaStatus}>
                        <SelectTrigger className="rounded-none h-10 border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="draft">Entwurf</SelectItem>
                          <SelectItem value="published">Veröffentlicht</SelectItem>
                          <SelectItem value="archived">Archiviert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Allgemeine Beschreibung</Label>
                      <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="rounded-none min-h-[100px] text-sm border-slate-200" placeholder="Ziel und Zweck des Prozesses..." />
                    </div>
                    <Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full rounded-none h-10 font-bold uppercase text-[10px] gap-2">
                      {isSavingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Stammdaten speichern
                    </Button>
                  </div>

                  {/* ISO 9001 Compliance */}
                  <div className="space-y-6 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-700">ISO 9001 Compliance</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      {[
                        { id: 'inputs', label: 'Prozess-Eingaben (Inputs)', icon: ArrowRight },
                        { id: 'outputs', label: 'Prozess-Ergebnisse (Outputs)', icon: Check },
                        { id: 'risks', label: 'Risiken & Chancen', icon: AlertTriangle },
                        { id: 'evidence', label: 'Nachweise / Aufzeichnungen', icon: FileCode }
                      ].map(field => (
                        <div key={field.id} className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase text-slate-700 flex items-center gap-2">
                            <field.icon className="w-3.5 h-3.5 text-emerald-600" /> {field.label}
                          </Label>
                          <Textarea 
                            defaultValue={currentVersion?.model_json?.isoFields?.[field.id] || ''}
                            className="text-xs rounded-none min-h-[80px] bg-white border-slate-200 focus:border-emerald-500 leading-relaxed"
                            placeholder="Vorgaben gemäß Norm..."
                            onBlur={e => handleApplyOps([{ type: 'SET_ISO_FIELD', payload: { field: field.id, value: e.target.value } }])}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="steps" className="m-0 p-0">
                  <div className="p-5 border-b bg-slate-50/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Arbeitsfolge</h3>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-[8px] font-bold uppercase rounded-none border-slate-200 bg-white" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                        <Button variant="outline" size="sm" className="h-7 text-[8px] font-bold uppercase rounded-none border-slate-200 bg-white" onClick={() => handleQuickAdd('decision')}>+ Entscheidung</Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {(currentVersion?.model_json?.nodes || []).map((node: any, idx: number) => (
                        <div 
                          key={`${node.id}-${idx}`}
                          className={cn(
                            "group flex items-center gap-3 p-2.5 border transition-all cursor-pointer",
                            selectedNodeId === node.id ? "border-primary bg-primary/5 ring-1 ring-primary/10" : "border-slate-100 hover:border-slate-300 bg-white"
                          )}
                          onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-none flex items-center justify-center shrink-0 border shadow-sm",
                            node.type === 'decision' ? "bg-orange-50 text-orange-600 border-orange-100" : 
                            node.type === 'start' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            node.type === 'end' ? "bg-red-50 text-red-600 border-red-100" :
                            "bg-blue-50 text-blue-600 border-blue-100"
                          )}>
                            {node.type === 'decision' ? <GitBranch className="w-3.5 h-3.5" /> : 
                             node.type === 'start' ? <Zap className="w-3.5 h-3.5" /> :
                             node.type === 'end' ? <X className="w-3.5 h-3.5" /> :
                             <Activity className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-slate-800 truncate">{node.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[7px] font-bold uppercase text-slate-400">{node.type}</span>
                              {node.roleId && <Badge variant="outline" className="text-[6px] h-3 px-1 rounded-none border-slate-200">{node.roleId}</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); handleMoveNode(node.id, 'up'); }}>
                              <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" disabled={idx === (currentVersion?.model_json?.nodes || []).length - 1} onClick={(e) => { e.stopPropagation(); handleMoveNode(node.id, 'down'); }}>
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
          {/* Resize Handle Left */}
          <div 
            onMouseDown={startResizeLeft}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-30 flex items-center justify-center group-hover/sidebar:opacity-100 opacity-0"
          >
            <div className="w-px h-8 bg-slate-200" />
          </div>
        </aside>

        {/* CENTER: Canvas */}
        <main className="flex-1 relative bg-slate-100 flex flex-col p-6 overflow-hidden">
          <div className="absolute top-10 right-10 z-10 flex flex-col gap-2">
             <div className="bg-white/95 backdrop-blur shadow-2xl border border-slate-200 p-1.5 rounded-none flex flex-col gap-1.5">
                {[
                  { icon: RefreshCw, label: 'Neu zeichnen', action: syncDiagramToModel },
                  { icon: Box, label: 'Zentrieren', action: () => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({action: 'zoom', type: 'fit'}), '*') }
                ].map((btn, i) => (
                  <TooltipProvider key={i}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200" onClick={btn.action}>
                          <btn.icon className="w-4 h-4 text-slate-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-[10px] font-bold uppercase rounded-none">{btn.label}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
             </div>
          </div>
          <div className="flex-1 bg-white shadow-inner border-2 border-slate-200 relative group overflow-hidden">
            <iframe 
              ref={iframeRef}
              src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json"
              className="absolute inset-0 w-full h-full border-none"
            />
          </div>
        </main>

        {/* RIGHT SIDEBAR: AI Advisor */}
        <aside 
          style={{ width: `${rightWidth}px` }}
          className="border-l flex flex-col bg-white shrink-0 overflow-hidden shadow-2xl z-30 relative group/right"
        >
          {/* Resize Handle Right */}
          <div 
            onMouseDown={startResizeRight}
            className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-30 flex items-center justify-center group-hover/right:opacity-100 opacity-0"
          >
            <div className="w-px h-8 bg-slate-200" />
          </div>

          <div className="p-5 border-b bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-none flex items-center justify-center shadow-lg">
                <Zap className="w-5 h-5 text-white fill-current" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest block text-blue-400">KI Advisor</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Active Assistant</span>
              </div>
            </div>
            <Badge className="bg-slate-800 text-slate-400 border-slate-700 rounded-none text-[8px] font-bold h-5 uppercase px-2">Online</Badge>
          </div>

          <div className="flex-1 min-h-0 flex flex-col bg-slate-50/50 select-auto">
            <ScrollArea className="flex-1 p-5">
              <div className="space-y-6">
                {chatHistory.length === 0 && (
                  <div className="text-center py-20 space-y-4 opacity-40">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                      <MessageSquare className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Bereit für Ihre Anweisung</p>
                    <p className="text-[9px] text-slate-500 italic px-8 leading-relaxed">
                      Beschreiben Sie den gewünschten Ablauf oder stellen Sie Fragen zur ISO-9001 Optimierung.
                    </p>
                  </div>
                )}

                {chatHistory.map((msg, i) => (
                  <div key={`${msg.timestamp}-${i}`} className={cn(
                    "flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "p-4 text-[11px] leading-relaxed max-w-[90%] shadow-sm",
                      msg.role === 'user' ? "bg-slate-900 text-white rounded-none" : "bg-white text-slate-700 border-l-4 border-l-primary rounded-none"
                    )}>
                      {msg.text}
                    </div>
                    
                    {msg.role === 'ai' && msg.questions && msg.questions.length > 0 && (
                      <div className="w-full mt-2 space-y-2">
                        {msg.questions.map((q, qIdx) => (
                          <div key={`${i}-${qIdx}`} className="p-4 bg-indigo-50 border-2 border-indigo-100 text-[11px] font-bold text-indigo-900 italic shadow-sm">
                            <span className="text-[8px] uppercase block text-indigo-400 font-bold mb-1.5 tracking-widest">Beratung</span>
                            {q}
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.role === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-3 w-full animate-in zoom-in-95 duration-500">
                        <div className="bg-white border-2 border-primary p-5 space-y-4 shadow-xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full -mr-8 -mt-8" />
                          <div className="flex items-center gap-2 text-primary">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Optimierungs-Vorschlag</span>
                          </div>
                          
                          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                            {msg.suggestions.map((op: any, opIdx: number) => (
                              <div key={`${opIdx}-${i}-${msg.timestamp}`} className="text-[9px] p-2 bg-slate-50 border border-slate-100 flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span className="font-bold text-slate-400 uppercase shrink-0 text-[7px]">{String(op.type).replace('_', ' ')}</span>
                                <span className="truncate font-bold text-slate-700">
                                  {getOpTitle(op)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button 
                              onClick={() => handleApplyOps(msg.suggestions)} 
                              disabled={isApplying} 
                              className="flex-1 h-11 rounded-none bg-primary hover:bg-blue-700 text-white text-[10px] font-bold uppercase shadow-lg gap-2"
                            >
                              {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              Anwenden
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                const newHistory = [...chatHistory];
                                newHistory[i].suggestions = [];
                                setChatHistory(newHistory);
                              }} 
                              className="flex-1 h-11 rounded-none border-slate-200 bg-white text-slate-500 text-[10px] font-bold uppercase hover:bg-slate-50"
                            >
                              Ablehnen
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border p-4 rounded-none flex items-center gap-4 shadow-sm border-blue-100">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Analysiere Modell...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="p-5 border-t bg-white shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] select-auto">
            <div className="relative group">
              <Input 
                placeholder="Wie soll der Prozess aussehen?" 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiChat()}
                className="h-14 rounded-none border-2 border-slate-100 text-sm focus:border-primary focus:ring-0 transition-all pl-5 pr-14 shadow-sm bg-slate-50/50"
                disabled={isAiLoading}
              />
              <Button 
                size="icon" 
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-none bg-slate-900 hover:bg-black text-white shadow-md active:scale-95 transition-all" 
                onClick={handleAiChat} 
                disabled={isAiLoading || !chatMessage}
              >
                {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
            <div className="flex justify-between mt-3 px-1">
               <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Governance Engine v2</span>
               <span className="text-[8px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5"><Terminal className="w-3 h-3" /> System Context Active</span>
            </div>
          </div>
        </aside>
      </div>

      {/* STEP EDITOR DIALOG (Popup) */}
      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-2xl rounded-none p-0 overflow-hidden flex flex-col border-2 shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-none flex items-center justify-center shrink-0 border border-white/10",
                selectedNode?.type === 'decision' ? "bg-orange-500" : "bg-blue-600"
              )}>
                {selectedNode?.type === 'decision' ? <GitBranch className="w-5 h-5 text-white" /> : <Activity className="w-5 h-5 text-white" />}
              </div>
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">{localNodeEdits.title || 'Schritt bearbeiten'}</DialogTitle>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">ID: {selectedNodeId}</p>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh]">
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Bezeichnung</Label>
                  <Input 
                    value={localNodeEdits.title} 
                    onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})}
                    onBlur={() => saveNodeUpdate('title')}
                    className="h-10 text-sm rounded-none border-slate-200 font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Zuständigkeit (Rolle)</Label>
                  <Input 
                    value={localNodeEdits.roleId} 
                    onChange={e => setLocalNodeEdits({...localNodeEdits, roleId: e.target.value})} 
                    onBlur={() => saveNodeUpdate('roleId')} 
                    className="h-10 text-sm rounded-none border-slate-200" 
                    placeholder="z.B. IT-Admin, HR..." 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Detaillierte Anweisung</Label>
                <Textarea 
                  value={localNodeEdits.description} 
                  onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})} 
                  onBlur={() => saveNodeUpdate('description')} 
                  className="text-sm rounded-none min-h-[100px] border-slate-200 leading-relaxed" 
                  placeholder="Beschreiben Sie hier genau, was in diesem Schritt zu tun ist..." 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" /> Checkliste für den Mitarbeiter
                </Label>
                <Textarea 
                  value={localNodeEdits.checklist} 
                  onChange={e => setLocalNodeEdits({...localNodeEdits, checklist: e.target.value})} 
                  onBlur={() => saveNodeUpdate('checklist')} 
                  className="text-xs rounded-none min-h-[100px] border-slate-200 bg-slate-50/50" 
                  placeholder="Ein Punkt pro Zeile..." 
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <GitBranch className="w-4 h-4" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Ablauf-Logik (Verknüpfungen)</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-[9px] font-bold uppercase text-slate-400">Bestehende Wege</Label>
                    <div className="space-y-2">
                      {(currentVersion?.model_json?.edges || []).filter((e: any) => e.source === selectedNodeId).map((edge: any, idx: number) => {
                        const targetNode = currentVersion?.model_json?.nodes?.find((n: any) => n.id === edge.target);
                        return (
                          <div key={`${edge.id}-${idx}`} className="flex items-center justify-between p-3 bg-white border border-slate-100 text-[11px] rounded-none shadow-sm">
                            <div className="flex items-center gap-3 truncate">
                              <ArrowRightCircle className="w-4 h-4 text-slate-300" />
                              <span className="font-bold text-slate-700 truncate">{targetNode?.title || edge.target}</span>
                              {edge.label && <Badge className="h-4 rounded-none text-[8px] bg-blue-50 text-blue-600 border-none px-2 uppercase font-black">{edge.label}</Badge>}
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50 rounded-none" onClick={() => handleRemoveEdge(edge.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                      {(currentVersion?.model_json?.edges || []).filter((e: any) => e.source === selectedNodeId).length === 0 && (
                        <p className="text-[10px] text-slate-400 italic">Keine ausgehenden Verbindungen definiert.</p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-none space-y-4">
                    <Label className="text-[9px] font-bold uppercase text-slate-600">Neuen Weg hinzufügen</Label>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[8px] font-black uppercase text-slate-400">Zielknoten</Label>
                        <Select value={newEdgeTargetId} onValueChange={setNewEdgeTargetId}>
                          <SelectTrigger className="h-9 text-xs rounded-none bg-white border-slate-200"><SelectValue placeholder="Ziel wählen..." /></SelectTrigger>
                          <SelectContent className="rounded-none">
                            {(currentVersion?.model_json?.nodes || []).filter((n: any) => n.id !== selectedNodeId).map((n: any) => <SelectItem key={n.id} value={n.id} className="text-xs font-bold">{n.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[8px] font-black uppercase text-slate-400">Bedingung (z.B. "Ja", "OK")</Label>
                        <Input placeholder="Label..." value={newEdgeLabel} onChange={e => setNewEdgeLabel(e.target.value)} className="h-9 text-xs rounded-none border-slate-200 bg-white" />
                      </div>
                      <Button onClick={handleAddEdge} disabled={!newEdgeTargetId} className="w-full h-9 text-[10px] font-black uppercase rounded-none bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md">
                        <Plus className="w-3.5 h-3.5" /> Verknüpfen
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
            <Button variant="ghost" className="rounded-none h-10 px-8 text-red-600 hover:bg-red-50" onClick={() => { if(confirm("Diesen Schritt unwiderruflich löschen?")) { handleApplyOps([{ type: 'REMOVE_NODE', payload: { nodeId: selectedNodeId } }]); setIsStepDialogOpen(false); } }}>
              <Trash2 className="w-4 h-4 mr-2" /> Löschen
            </Button>
            <Button onClick={() => setIsStepDialogOpen(false)} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] tracking-widest bg-slate-900 hover:bg-black text-white">
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
