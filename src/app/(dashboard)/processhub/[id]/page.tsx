
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
  Link as LinkIcon 
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

function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach(node => {
    const pos = positions[node.id] || { x: 100, y: 100 };
    let style = '';
    let w = 120, h = 60;

    switch (node.type) {
      case 'start':
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;';
        w = 60; h = 60;
        break;
      case 'end':
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;fontStyle=1;strokeWidth=2;';
        w = 60; h = 60;
        break;
      case 'decision':
        style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;';
        w = 80; h = 80;
        break;
      default:
        style = 'whiteSpace=wrap;html=1;rounded=1;fillColor=#f5f5f5;strokeColor=#666666;';
    }
    
    xml += `<mxCell id="${node.id}" value="${node.title}" style="${style}" vertex="1" parent="1">
      <mxGeometry x="${pos.x}" y="${pos.y}" width="${w}" height="${h}" as="geometry"/>
    </mxCell>`;
  });

  edges.forEach(edge => {
    xml += `<mxCell id="${edge.id}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#333333;strokeWidth=1.5;" edge="1" parent="1" source="${edge.source}" target="${edge.target}">
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

  useEffect(() => { setMounted(true); }, []);

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

  const updateNodeField = async (nodeId: string, field: string, value: any) => {
    const ops = [{
      type: 'UPDATE_NODE',
      payload: { nodeId, patch: { [field]: value } }
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
        toast({ title: "Veröffentlicht!", description: `In BookStack verfügbar unter ID ${res.pageId}` });
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lade Prozess-Modell...</p>
      </div>
    );
  }

  if (!currentProcess || !currentVersion) {
    return (
      <div className="p-8">
        <Alert variant="destructive" className="rounded-none border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-bold uppercase">Prozess nicht gefunden</AlertTitle>
          <AlertDescription className="text-xs">Der angeforderte Prozess existiert nicht.</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/processhub')} className="mt-4 rounded-none uppercase text-[10px] font-bold">Zurück</Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -m-8 overflow-hidden bg-background">
      {/* HEADER */}
      <div className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-8 w-8">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h2 className="font-bold text-sm uppercase tracking-wider">{currentProcess.title}</h2>
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground uppercase font-black">
              <Badge variant="outline" className="rounded-none text-[8px] h-4 bg-muted/30">V{currentVersion.version}</Badge>
              <span>Revision {currentVersion.revision}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-none h-8 text-[9px] font-bold uppercase" onClick={syncDiagramToModel}>
            <RefreshCw className="w-3 h-3 mr-2" /> Sync UI
          </Button>
          <Button size="sm" className="rounded-none h-8 text-[9px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <BookOpen className="w-3 h-3 mr-2" />}
            Publish
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: Steps & Connections */}
        <aside className="w-[380px] border-r flex flex-col bg-slate-50/50 overflow-hidden">
          <Tabs defaultValue="nodes" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 border-b bg-white shrink-0">
              <TabsList className="h-12 bg-transparent gap-4 p-0">
                <TabsTrigger value="nodes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-2 text-[10px] font-black uppercase">Schritte</TabsTrigger>
                <TabsTrigger value="edges" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-2 text-[10px] font-black uppercase">Verbindungen</TabsTrigger>
                <TabsTrigger value="compliance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-2 text-[10px] font-black uppercase">ISO 9001</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <TabsContent value="nodes" className="m-0 p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Button variant="outline" size="sm" className="flex-1 text-[8px] font-bold uppercase h-7 rounded-none" onClick={() => handleApplyOps([{ type: 'ADD_NODE', payload: { node: { id: `step-${Date.now()}`, type: 'step', title: 'Neuer Schritt' } } }])}>+ Schritt</Button>
                    <Button variant="outline" size="sm" className="flex-1 text-[8px] font-bold uppercase h-7 rounded-none" onClick={() => handleApplyOps([{ type: 'ADD_NODE', payload: { node: { id: `dec-${Date.now()}`, type: 'decision', title: 'Entscheidung?' } } }])}>+ Verzweigung</Button>
                  </div>

                  <div className="space-y-2">
                    {(currentVersion.model_json.nodes || []).map((node: ProcessNode) => (
                      <div 
                        key={node.id} 
                        className={cn(
                          "p-3 bg-white border transition-all cursor-pointer group relative",
                          selectedNodeId === node.id ? "border-primary ring-1 ring-primary/20" : "border-slate-200 hover:border-slate-300"
                        )}
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-[7px] font-black h-3.5 rounded-none uppercase">{node.type}</Badge>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-red-500" onClick={(e) => { e.stopPropagation(); handleApplyOps([{ type: 'REMOVE_NODE', payload: { nodeId: node.id } }]); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="font-bold text-xs">{node.title}</div>
                      </div>
                    ))}
                  </div>

                  {selectedNode && (
                    <div className="mt-6 pt-6 border-t space-y-4 animate-in slide-in-from-left-2">
                      <h3 className="text-[10px] font-black uppercase text-primary">Schritt Details</h3>
                      <div className="space-y-2">
                        <Label className="text-[9px] font-bold uppercase">Bezeichnung</Label>
                        <Input value={selectedNode.title} onChange={e => updateNodeField(selectedNode.id, 'title', e.target.value)} className="h-8 text-xs rounded-none" />
                        <Label className="text-[9px] font-bold uppercase">Rolle</Label>
                        <Input value={selectedNode.roleId || ''} onChange={e => updateNodeField(selectedNode.id, 'roleId', e.target.value)} placeholder="Verantwortlich..." className="h-8 text-xs rounded-none" />
                        <Label className="text-[9px] font-bold uppercase">Beschreibung</Label>
                        <Textarea value={selectedNode.description || ''} onChange={e => updateNodeField(selectedNode.id, 'description', e.target.value)} className="text-xs rounded-none min-h-[80px]" />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="edges" className="m-0 p-4 space-y-6">
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-none space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-blue-700">Neue Verbindung</h4>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold uppercase">Von: {selectedNode?.title || 'Bitte Schritt wählen'}</Label>
                      <Select value={newEdgeTargetId} onValueChange={setNewEdgeTargetId}>
                        <SelectTrigger className="h-8 text-[10px] rounded-none"><SelectValue placeholder="Ziel wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-none">
                          {currentVersion.model_json.nodes.filter(n => n.id !== selectedNodeId).map(n => (
                            <SelectItem key={n.id} value={n.id} className="text-xs">{n.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Label (z.B. Ja / Nein)" value={newEdgeLabel} onChange={e => setNewEdgeLabel(e.target.value)} className="h-8 text-xs rounded-none" />
                      <Button onClick={handleAddEdge} disabled={!selectedNodeId || !newEdgeTargetId} className="w-full h-8 text-[9px] font-bold uppercase rounded-none">Verknüpfen</Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase text-slate-400">Aktive Verbindungen</h4>
                    {(currentVersion.model_json.edges || []).map((edge: ProcessEdge) => {
                      const source = currentVersion.model_json.nodes.find(n => n.id === edge.source);
                      const target = currentVersion.model_json.nodes.find(n => n.id === edge.target);
                      return (
                        <div key={edge.id} className="p-2 border bg-white flex items-center justify-between group">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold truncate">{source?.title} → {target?.title}</p>
                            {edge.label && <Badge variant="outline" className="text-[7px] h-3.5 rounded-none">{edge.label}</Badge>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveEdge(edge.id)}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="compliance" className="m-0 p-4 space-y-6">
                  <div className="p-4 bg-slate-100 border rounded-none space-y-2">
                    <h4 className="text-[10px] font-black uppercase text-slate-700">ISO 9001:2015 Konformität</h4>
                    <p className="text-[9px] leading-relaxed text-slate-500">Definieren Sie Inputs, Outputs und Risiken für den Gesamtprozess.</p>
                  </div>
                  {['inputs', 'outputs', 'risks', 'evidence'].map(field => (
                    <div key={field} className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">{field}</Label>
                      <Textarea 
                        defaultValue={currentVersion.model_json.isoFields?.[field] || ''}
                        placeholder={`Ermittelte ${field}...`}
                        className="text-xs rounded-none min-h-[100px] bg-white"
                        onBlur={e => handleApplyOps([{ type: 'SET_ISO_FIELD', payload: { field, value: e.target.value } }])}
                      />
                    </div>
                  ))}
                  <div className="h-8 shrink-0" /> {/* Spacer for scroll bottom */}
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
        </aside>

        {/* MIDDLE PANE: Diagram */}
        <main className="flex-1 relative bg-white flex flex-col">
          <iframe 
            ref={iframeRef}
            src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json"
            className="absolute inset-0 w-full h-full border-none"
          />
        </main>

        {/* RIGHT PANE: AI Chat */}
        <aside className="w-[350px] border-l flex flex-col bg-white overflow-hidden">
          <div className="p-4 border-b bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-primary fill-current" />
              <span className="text-[10px] font-black uppercase tracking-widest block">AI Co-Pilot</span>
            </div>
            <Badge className="bg-blue-600 rounded-none text-[8px] font-black h-4">VIBECODING</Badge>
          </div>

          <div className="flex-1 min-h-0 bg-slate-50/30">
            <ScrollArea className="h-full p-4">
              <div className="space-y-6">
                {aiSuggestions ? (
                  <div className="animate-in slide-in-from-bottom-2">
                    <div className="p-4 bg-white border-2 border-blue-600 rounded-none shadow-xl space-y-4">
                      <p className="text-[11px] italic text-slate-700 leading-relaxed">"{aiSuggestions.explanation}"</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {aiSuggestions.proposedOps.map((op, i) => (
                          <div key={i} className="text-[9px] p-1 bg-slate-50 border flex items-center gap-2">
                            <ArrowRight className="w-2.5 h-2.5 text-blue-500" />
                            <span className="font-bold text-slate-600">{op.type}:</span>
                            <span className="truncate">{op.payload.node?.title || op.payload.edge?.label || op.payload.nodeId || 'Layout Update'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleApplyOps(aiSuggestions.proposedOps)} disabled={isApplying} className="flex-1 h-9 rounded-none bg-blue-600 hover:bg-blue-700 text-[10px] font-black uppercase">Übernehmen</Button>
                        <Button variant="outline" onClick={() => setAiSuggestions(null)} className="h-9 w-9 p-0 rounded-none"><X className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 opacity-20">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest px-8">Beschreiben Sie Prozess-Änderungen oder Verzweigungen...</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="p-4 border-t bg-white shrink-0">
            <div className="flex gap-2">
              <Input 
                placeholder="Anweisung..." 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiChat()}
                className="h-11 rounded-none border-2 text-xs focus:border-slate-900 transition-all"
                disabled={isAiLoading}
              />
              <Button size="icon" className="h-11 w-11 shrink-0 rounded-none bg-slate-900" onClick={handleAiChat} disabled={isAiLoading || !chatMessage}>
                {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
