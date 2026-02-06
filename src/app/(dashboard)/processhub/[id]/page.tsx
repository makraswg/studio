
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
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
  AlertCircle,
  ShieldCheck,
  History,
  Save, 
  Trash2, 
  Edit3, 
  Layers, 
  ArrowRight, 
  RefreshCw, 
  Sparkles, 
  GitBranch, 
  Link as LinkIcon,
  Search,
  Settings2,
  Terminal,
  Activity,
  FileCode,
  Box,
  AlertTriangle,
  ChevronRight,
  Info,
  ChevronUp,
  ChevronDown
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
import { applyProcessOpsAction } from '@/app/actions/process-actions';
import { getProcessSuggestions, ProcessDesignerOutput } from '@/ai/flows/process-designer-flow';
import { publishToBookStackAction } from '@/app/actions/bookstack-actions';
import { toast } from '@/hooks/use-toast';
import { Process, ProcessVersion, ProcessNode, ProcessEdge, ProcessModel, ProcessLayout } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Generiert MXGraph XML aus dem semantischen Modell.
 */
function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach(node => {
    const pos = positions[node.id] || { x: 100, y: 100 };
    let style = '';
    let w = 140, h = 70;

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
  const [chatMessage, setChatMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ProcessDesignerOutput | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [localNodeEdits, setLocalNodeEdits] = useState<{title: string, roleId: string, description: string}>({ title: '', roleId: '', description: '' });
  const [newEdgeTargetId, setNewEdgeTargetId] = useState<string>('');
  const [newEdgeLabel, setNewEdgeLabel] = useState<string>('');

  const { data: processes, isLoading: isProcLoading } = usePluggableCollection<Process>('processes');
  const { data: versions, isLoading: isVerLoading, refresh: refreshVersion } = usePluggableCollection<ProcessVersion>('process_versions');
  
  const currentProcess = useMemo(() => processes?.find(p => p.id === id), [processes, id]);
  const currentVersion = useMemo(() => versions?.find(v => v.process_id === id), [versions, id]);

  const selectedNode = useMemo(() => 
    currentVersion?.model_json.nodes.find(n => n.id === selectedNodeId), 
    [currentVersion, selectedNodeId]
  );

  useEffect(() => {
    if (selectedNode) {
      setLocalNodeEdits({
        title: selectedNode.title || '',
        roleId: selectedNode.roleId || '',
        description: selectedNode.description || ''
      });
    }
  }, [selectedNodeId, selectedNode]);

  useEffect(() => { setMounted(true); }, []);

  // diagrams.net Bridge Init
  useEffect(() => {
    if (!mounted || !iframeRef.current || !currentVersion) return;

    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string' || evt.data.length === 0) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') {
          syncDiagramToModel();
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, currentVersion]);

  const syncDiagramToModel = () => {
    if (!iframeRef.current || !currentVersion) return;
    const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({
      action: 'load',
      xml: xml,
      autosave: 1
    }), '*');
  };

  const handleApplyOps = async (ops: any[]) => {
    if (!currentVersion || !user) return;
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
        setAiSuggestions(null);
        refreshVersion();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update fehlgeschlagen", description: e.message });
    } finally {
      setIsApplying(false);
    }
  };

  const saveNodeUpdate = async (field: string) => {
    if (!selectedNodeId) return;
    const value = localNodeEdits[field as keyof typeof localNodeEdits];
    if (selectedNode && selectedNode[field as keyof ProcessNode] === value) return;

    const ops = [{
      type: 'UPDATE_NODE',
      payload: { nodeId: selectedNodeId, patch: { [field]: value } }
    }];
    await handleApplyOps(ops);
  };

  const handleQuickAdd = (type: 'step' | 'decision') => {
    const newId = `${type}-${Date.now()}`;
    const ops = [{
      type: 'ADD_NODE',
      payload: { 
        node: { 
          id: newId, 
          type, 
          title: type === 'decision' ? 'Entscheidung?' : 'Neuer Schritt' 
        } 
      }
    }];
    handleApplyOps(ops);
    setSelectedNodeId(newId);
  };

  const handleMoveNode = async (nodeId: string, direction: 'up' | 'down') => {
    if (!currentVersion) return;
    const nodes = [...currentVersion.model_json.nodes];
    const index = nodes.findIndex(n => n.id === nodeId);
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
    setIsAiLoading(true);
    setAiSuggestions(null);
    try {
      const suggestions = await getProcessSuggestions({
        userMessage: chatMessage,
        currentModel: currentVersion.model_json,
        dataSource
      });
      setAiSuggestions(suggestions);
      setChatMessage('');
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
      if (res.success) {
        toast({ title: "Veröffentlicht!", description: `In BookStack verfügbar.` });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export Fehler", description: e.message });
    } finally {
      setIsPublishing(false);
    }
  };

  if (!mounted) return null;

  if ((isProcLoading || isVerLoading) && (!currentProcess || !currentVersion)) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Initialisiere Modellier-Umgebung...</p>
      </div>
    );
  }

  if (!currentProcess || !currentVersion) {
    return (
      <div className="p-8">
        <Alert variant="destructive" className="rounded-none border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-bold uppercase">Prozess nicht gefunden</AlertTitle>
          <AlertDescription className="text-xs">Das Modell konnte nicht geladen werden.</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/processhub')} className="mt-4 rounded-none uppercase text-[10px] font-bold">Zurück zur Übersicht</Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -m-8 overflow-hidden bg-slate-100">
      {/* PROFESSIONAL HEADER */}
      <header className="h-16 border-b bg-slate-900 text-white flex items-center justify-between px-6 shrink-0 z-20 shadow-lg">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/10 rounded-none">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-base tracking-tight">{currentProcess.title}</h2>
              <Badge className="bg-blue-600 rounded-none text-[8px] font-black uppercase tracking-widest px-2 h-4">Revision {currentVersion.revision}</Badge>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase mt-0.5">
              <Activity className="w-2.5 h-2.5" />
              <span>Status: {currentProcess.status}</span>
              <span className="mx-1">•</span>
              <RefreshCw className="w-2.5 h-2.5" />
              <span>V{currentVersion.version}.0</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-none h-9 text-[10px] font-bold uppercase border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800" onClick={syncDiagramToModel}>
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Diagramm Sync
                </Button>
              </TooltipTrigger>
              <TooltipContent className="rounded-none text-[10px] font-bold uppercase">Aktualisiert den grafischen Editor aus dem Modell</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-6 bg-slate-700 mx-1" />
          <Button size="sm" className="rounded-none h-9 text-[10px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white px-6 gap-2" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
            Publish to BookStack
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: Steps & Properties */}
        <aside className="w-[450px] border-r flex flex-col bg-white shadow-xl z-10 overflow-hidden">
          <Tabs defaultValue="structure" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 border-b bg-slate-50 shrink-0">
              <TabsList className="h-14 bg-transparent gap-6 p-0 w-full justify-start">
                <TabsTrigger value="structure" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Struktur</TabsTrigger>
                <TabsTrigger value="compliance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent h-full px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">ISO 9001</TabsTrigger>
                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">History</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1">
                <TabsContent value="structure" className="m-0 p-0">
                  <div className="p-5 border-b bg-slate-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prozess-Elemente</h3>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase rounded-none border-slate-200" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                        <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase rounded-none border-slate-200" onClick={() => handleQuickAdd('decision')}>+ Entscheidung</Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {(currentVersion.model_json.nodes || []).map((node: ProcessNode, idx: number) => (
                        <div 
                          key={node.id} 
                          className={cn(
                            "group flex items-center gap-3 p-3 border-2 transition-all cursor-pointer relative",
                            selectedNodeId === node.id ? "border-primary bg-primary/5 shadow-sm" : "border-slate-50 hover:border-slate-200 bg-white"
                          )}
                          onClick={() => setSelectedNodeId(node.id)}
                        >
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 rounded-none hover:bg-slate-100 disabled:opacity-30" 
                              disabled={idx === 0}
                              onClick={(e) => { e.stopPropagation(); handleMoveNode(node.id, 'up'); }}
                            >
                              <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 rounded-none hover:bg-slate-100 disabled:opacity-30" 
                              disabled={idx === currentVersion.model_json.nodes.length - 1}
                              onClick={(e) => { e.stopPropagation(); handleMoveNode(node.id, 'down'); }}
                            >
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          <div className={cn(
                            "w-8 h-8 rounded-none flex items-center justify-center shrink-0 border",
                            node.type === 'decision' ? "bg-orange-50 text-orange-600 border-orange-100" : "bg-blue-50 text-blue-600 border-blue-100"
                          )}>
                            {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{node.title}</p>
                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">{node.type}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 rounded-none" onClick={(e) => { e.stopPropagation(); handleApplyOps([{ type: 'REMOVE_NODE', payload: { nodeId: node.id } }]); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedNode ? (
                    <div className="p-6 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-primary" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">Eigenschaften</h3>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-mono border-slate-200 rounded-none uppercase">ID: {selectedNode.id}</Badge>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold uppercase text-slate-500">Titel / Bezeichnung</Label>
                          <Input 
                            value={localNodeEdits.title} 
                            onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})}
                            onBlur={() => saveNodeUpdate('title')}
                            className="h-10 text-sm rounded-none border-2 focus:border-primary font-bold" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold uppercase text-slate-500">Zuständige Rolle</Label>
                          <Input 
                            value={localNodeEdits.roleId} 
                            onChange={e => setLocalNodeEdits({...localNodeEdits, roleId: e.target.value})}
                            onBlur={() => saveNodeUpdate('roleId')}
                            placeholder="z.B. IT-Admin, Prozessverantwortlicher..." 
                            className="h-10 text-sm rounded-none border-2 focus:border-primary" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold uppercase text-slate-500">Detailbeschreibung (Handlungsanweisung)</Label>
                          <Textarea 
                            value={localNodeEdits.description} 
                            onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})}
                            onBlur={() => saveNodeUpdate('description')}
                            placeholder="Was genau ist in diesem Schritt zu tun?"
                            className="text-xs rounded-none min-h-[140px] border-2 focus:border-primary leading-relaxed" 
                          />
                        </div>
                      </div>

                      <div className="pt-6 border-t space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                          <GitBranch className="w-3 h-3" /> Flow-Logik
                        </h4>
                        <div className="space-y-3 p-4 bg-slate-50 border-2 border-dashed">
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold uppercase text-slate-500">Nächster Schritt</Label>
                            <Select value={newEdgeTargetId} onValueChange={setNewEdgeTargetId}>
                              <SelectTrigger className="h-9 text-[10px] rounded-none bg-white border-slate-200"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                              <SelectContent className="rounded-none">
                                {currentVersion.model_json.nodes.filter(n => n.id !== selectedNodeId).map(n => (
                                  <SelectItem key={n.id} value={n.id} className="text-xs">{n.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold uppercase text-slate-500">Bedingung (Label)</Label>
                            <Input placeholder="z.B. Ja / Nein" value={newEdgeLabel} onChange={e => setNewEdgeLabel(e.target.value)} className="h-9 text-xs rounded-none border-slate-200" />
                          </div>
                          <Button onClick={handleAddEdge} disabled={!selectedNodeId || !newEdgeTargetId} className="w-full h-10 text-[10px] font-black uppercase rounded-none bg-primary hover:bg-blue-600">
                            Verbindung erstellen
                          </Button>
                        </div>

                        <div className="space-y-1">
                          {(currentVersion.model_json.edges || []).filter(e => e.source === selectedNodeId).map(edge => {
                            const target = currentVersion.model_json.nodes.find(n => n.id === edge.target);
                            return (
                              <div key={edge.id} className="flex items-center justify-between p-2 bg-white border text-[10px] font-bold">
                                <div className="flex items-center gap-2 truncate">
                                  <ArrowRight className="w-3 h-3 text-slate-300" />
                                  <span>{target?.title}</span>
                                  {edge.label && <Badge className="h-4 rounded-none text-[7px] bg-slate-100 text-slate-600 border-none uppercase">{edge.label}</Badge>}
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleRemoveEdge(edge.id)}><X className="w-3 h-3" /></Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center space-y-4 opacity-40">
                      <Info className="w-12 h-12 mx-auto text-slate-300" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Wählen Sie ein Element aus,<br/>um die Details zu bearbeiten.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="compliance" className="m-0 p-6 space-y-8">
                  <div className="p-5 bg-emerald-50 border-2 border-emerald-100 rounded-none space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <ShieldCheck className="w-4 h-4" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest">ISO 9001 Konformität</h4>
                    </div>
                    <p className="text-[9px] leading-relaxed text-emerald-600 font-medium">Definition von Wechselwirkungen, Ressourcen und Risiken gemäß prozessorientiertem Ansatz.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    {[
                      { id: 'inputs', label: 'Eingaben (Inputs)', icon: ArrowRight, desc: 'Informationen, Artefakte oder Trigger für den Prozess' },
                      { id: 'outputs', label: 'Ergebnisse (Outputs)', icon: Check, desc: 'Produkte, Dienstleistungen oder Daten am Prozessende' },
                      { id: 'risks', label: 'Risiken & Chancen', icon: AlertTriangle, desc: 'Was kann den Prozesserfolg gefährden?' },
                      { id: 'evidence', label: 'Nachweise (Evidence)', icon: FileCode, desc: 'Dokumente zur Verifizierung der Ausführung' }
                    ].map(field => (
                      <div key={field.id} className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-700 flex items-center gap-2">
                          <field.icon className="w-3 h-3 text-emerald-600" /> {field.label}
                        </Label>
                        <Textarea 
                          defaultValue={currentVersion.model_json.isoFields?.[field.id] || ''}
                          placeholder={field.desc}
                          className="text-xs rounded-none min-h-[120px] bg-white border-2 border-slate-100 focus:border-emerald-500 leading-relaxed p-3"
                          onBlur={e => handleApplyOps([{ type: 'SET_ISO_FIELD', payload: { field: field.id, value: e.target.value } }])}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="m-0 p-6">
                   <div className="py-20 text-center opacity-30">
                      <History className="w-12 h-12 mx-auto mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Änderungsverlauf wird geladen...</p>
                   </div>
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
        </aside>

        {/* MIDDLE PANE: Diagramming Area */}
        <main className="flex-1 relative bg-slate-200 flex flex-col p-4 overflow-hidden">
          <div className="absolute top-8 right-8 z-10 flex flex-col gap-2">
             <div className="bg-white/90 backdrop-blur shadow-xl border p-1 rounded-none flex flex-col gap-1">
                <TooltipProvider>
                  {[
                    { icon: RefreshCw, label: 'Reload', action: syncDiagramToModel },
                    { icon: Box, label: 'Fit View', action: () => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({action: 'zoom', type: 'fit'}), '*') }
                  ].map((btn, i) => (
                    <Button key={i} variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-slate-100" onClick={btn.action}>
                      <btn.icon className="w-4 h-4 text-slate-600" />
                    </Button>
                  ))}
                </TooltipProvider>
             </div>
          </div>
          <div className="flex-1 bg-white shadow-2xl border-2 border-slate-300 relative group overflow-hidden">
            <iframe 
              ref={iframeRef}
              src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json"
              className="absolute inset-0 w-full h-full border-none"
            />
          </div>
        </main>

        {/* RIGHT PANE: AI Co-Pilot Chat */}
        <aside className="w-[380px] border-l flex flex-col bg-slate-50 shadow-2xl z-10 overflow-hidden">
          <div className="p-5 border-b bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-none flex items-center justify-center">
                <Zap className="w-5 h-5 text-white fill-current" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] block text-blue-400">Process Co-Pilot</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">AI-Vibecoding Active</span>
              </div>
            </div>
            <Badge className="bg-slate-800 text-slate-400 border-slate-700 rounded-none text-[8px] font-black h-5 uppercase px-2">Gemini 2.0</Badge>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 p-5">
              <div className="space-y-6">
                {aiSuggestions ? (
                  <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white border-2 border-blue-600 rounded-none shadow-2xl overflow-hidden">
                      <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Architekt-Vorschlag</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => setAiSuggestions(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="p-5 space-y-5">
                        <p className="text-[11px] font-medium text-slate-700 leading-relaxed italic border-l-2 border-blue-100 pl-3">
                          "{aiSuggestions.explanation}"
                        </p>
                        
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                          {aiSuggestions.proposedOps.map((op, i) => (
                            <div key={i} className="text-[9px] p-2 bg-slate-50 border border-slate-100 flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <span className="font-black text-slate-500 uppercase min-w-[80px]">{op.type.replace('_', ' ')}:</span>
                              <span className="truncate font-bold text-slate-700">{op.payload.node?.title || op.payload.edge?.label || op.payload.nodeId || 'Layout Update'}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button onClick={() => handleApplyOps(aiSuggestions.proposedOps)} disabled={isApplying} className="flex-1 h-11 rounded-none bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase shadow-lg group">
                            {isApplying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2 group-hover:scale-125 transition-transform" />}
                            Vorschlag anwenden
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 space-y-6 opacity-30">
                    <div className="relative inline-block">
                      <MessageSquare className="w-16 h-16 mx-auto text-slate-300" />
                      <Sparkles className="w-6 h-6 absolute -top-2 -right-2 text-blue-500" />
                    </div>
                    <div className="space-y-2 px-8">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 leading-relaxed">Beschreiben Sie Ihren Prozess</p>
                      <p className="text-[9px] font-medium text-slate-500 leading-relaxed italic">
                        "Erstelle einen Freigabeprozess für Urlaubsanträge mit Ablehnungsschleife."
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="p-5 border-t-2 border-slate-200 bg-white shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            <div className="relative group">
              <Input 
                placeholder="Anweisung an den Co-Pilot..." 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiChat()}
                className="h-14 rounded-none border-2 border-slate-200 text-sm focus:border-slate-900 focus:ring-0 transition-all pl-4 pr-14 shadow-sm"
                disabled={isAiLoading}
              />
              <Button 
                size="icon" 
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 shrink-0 rounded-none bg-slate-900 hover:bg-black text-white" 
                onClick={handleAiChat} 
                disabled={isAiLoading || !chatMessage}
              >
                {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
            <div className="flex justify-between mt-3 px-1">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Context Active</span>
               <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1"><Terminal className="w-2.5 h-2.5" /> BPMN Logic Expert</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
