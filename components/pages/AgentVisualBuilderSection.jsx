'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Save, Loader2, Sparkles, Send, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Panel } from '@xyflow/react';

// Custom Nodes and Layouts
import TriggerNode from '@/components/flow/nodes/TriggerNode';
import LLMNodeV3 from '@/components/flow/nodes/LLMNodeV3';
import GuardrailNode from '@/components/flow/nodes/GuardrailNode';
import PlaceholderNode from '@/components/flow/nodes/PlaceholderNode';
import ToolNode from '@/components/flow/nodes/ToolNode';
import KnowledgeNode from '@/components/flow/nodes/KnowledgeNode';
import Sidebar from '@/components/flow/layout/Sidebar';
import ConfigPanel from '@/components/flow/layout/ConfigPanel';

const nodeTypes = {
    triggerNode: TriggerNode,
    llmNode: LLMNodeV3,
    guardrailNode: GuardrailNode,
    placeholderNode: PlaceholderNode,
    toolNode: ToolNode,
    knowledgeNode: KnowledgeNode,
};

let id = 0;
const getId = () => `dndnode_${id++}`;

function BuilderInternal({ agent, onSave }) {
    const reactFlowWrapper = useRef(null);
    const { showToast } = useToast();
    const { fitView } = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [connectedProviders, setConnectedProviders] = useState([]);

    // AI Magic State
    const [showMagicBar, setShowMagicBar] = useState(false);
    const [magicPrompt, setMagicPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const updateNodeData = useCallback((nodeId, newData) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, ...newData } };
                }
                return node;
            })
        );
        setSelectedNode((prev) => (prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev));
    }, [setNodes]);
    
    const hydrateEdges = useCallback((rawEdges) => {
        return rawEdges.map(e => {
            const { label, ...rest } = e;
            return {
                ...rest,
                animated: true,
                style: { strokeWidth: 2, stroke: '#3b82f6' }
            };
        });
    }, []);

    // Hydrate nodes with callbacks
    const hydrateNodes = useCallback((rawNodes, providers) => {
        return rawNodes.map((n) => ({
            ...n,
            data: {
                ...n.data,
                connectedProviders: providers,
                onChange: (key, val) => updateNodeData(n.id, { [key]: val }),
            }
        }));
    }, [updateNodeData]);

    useEffect(() => {
        const fetchSettings = async () => {
            const res = await fetch('/api/settings');
            const data = await res.json();
            const providers = data?.providers || data?.settings?.providers || [];
            if (res.ok && Array.isArray(providers)) {
                setConnectedProviders(providers);
                if (agent?.visual_config) {
                    setNodes(hydrateNodes(agent.visual_config.nodes || [], providers));
                    setEdges(hydrateEdges(agent.visual_config.edges || []));
                    setTimeout(() => fitView({ padding: 0.3, duration: 800 }), 100);
                }
            }
        };
        fetchSettings();
    }, [agent, fitView, hydrateNodes, setEdges, setNodes]);
    
    // 4b. Sync connectedProviders to all nodes when they change
    useEffect(() => {
        if (connectedProviders.length > 0) {
            setNodes(nds => nds.map(n => ({
                ...n,
                data: {
                    ...n.data,
                    connectedProviders
                }
            })));
        }
    }, [connectedProviders, setNodes]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const agentNode = nodes.find(n => n.type === 'llmNode' || n.type === 'placeholderNode');
            const guardrailNode = nodes.find(n => n.type === 'guardrailNode');

            const payload = {
                id: agent.id,
                name: agent.name,
                system_prompt: agentNode?.data?.system_prompt || '',
                policies: guardrailNode?.data?.policies || {},
                visual_config: { nodes, edges },
                is_draft: false // Keep it deployed
            };

            const res = await fetch('/api/agents/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast({ title: 'Configuration Mise à jour', message: 'Le design de l\'agent a été sauvegardé.', type: 'success' });
                if (onSave) onSave();
            } else {
                showToast({ title: 'Erreur', message: 'Impossible de sauvegarder.', type: 'error' });
            }
        } catch (error) {
            showToast({ title: 'Erreur', message: 'Erreur réseau.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleMagicBuild = async (e) => {
        if (e) e.preventDefault();
        if (!magicPrompt.trim()) return;

        setIsGenerating(true);
        try {
            const res = await fetch('/api/agents/magic-build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: magicPrompt,
                    current_architecture: nodes.length > 0 ? { nodes, edges } : null 
                })
            });
            const config = await res.json();

            if (res.ok) {
                // Apply the new configuration
                if (config.architecture && config.architecture.nodes) {
                    setNodes(hydrateNodes(config.architecture.nodes, connectedProviders));
                    setEdges(hydrateEdges(config.architecture.edges || []));
                }
                showToast({
                    title: 'Agent Modifié !',
                    message: 'L\'architecture a été mise à jour par l\'IA.',
                    type: 'success'
                });
                setShowMagicBar(false);
                setMagicPrompt('');
                setTimeout(() => fitView({ padding: 0.3, duration: 800 }), 300);
            } else {
                showToast({ title: 'Erreur', message: config.error || 'Check console', type: 'error' });
            }
        } catch (error) {
            console.error(error);
            showToast({ title: 'Erreur', message: 'Internal error', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2, stroke: '#3b82f6' } }, eds)),
        [setEdges],
    );

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow/type');
            if (!type) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const nodeId = getId();
            const newNode = {
                id: nodeId,
                type,
                position,
                data: {
                    label: event.dataTransfer.getData('application/reactflow/label') || `${type} node`,
                    onChange: (key, val) => updateNodeData(nodeId, { [key]: val }),
                    connectedProviders
                },
            };
            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes, updateNodeData, connectedProviders],
    );

    return (
        <div className="flex-1 flex overflow-hidden h-[700px] border border-slate-200 rounded-3xl bg-white relative">
            <Sidebar hideHistory hideNewAgent activeAgentId={agent.id} />
            
            <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    nodeTypes={nodeTypes}
                    onNodeClick={(_, node) => setSelectedNode(node)}
                    onPaneClick={() => setSelectedNode(null)}
                    fitView
                >
                    <Background color="#cbd5e1" variant="dots" gap={20} size={1} />
                    <Controls />

                    {/* AI Magic Toggle */}
                    {!isGenerating && (
                        <Panel position="top-right" className="m-4">
                            <button
                                onClick={() => setShowMagicBar(!showMagicBar)}
                                className={`p-2 rounded-xl border transition-all shadow-lg ${showMagicBar ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                            >
                                <Sparkles className="w-5 h-5" />
                            </button>
                        </Panel>
                    )}

                    {/* AI Magic Bar */}
                    {showMagicBar && (
                        <Panel position="top-center" className="w-[600px] mt-4 max-w-[90vw]">
                            <form onSubmit={handleMagicBuild} className="relative group animate-in slide-in-from-top-4">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl blur opacity-20"></div>
                                <div className="relative flex flex-col bg-white/95 backdrop-blur border border-blue-100 rounded-3xl shadow-2xl p-1.5 px-3">
                                    <textarea
                                        placeholder="Modifier cet agent par IA..."
                                        value={magicPrompt}
                                        onChange={(e) => setMagicPrompt(e.target.value)}
                                        onInput={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                                        }}
                                        rows={2}
                                        className="w-full bg-transparent py-3 px-3 text-sm outline-none focus:outline-none border-none focus:ring-0 resize-none overflow-y-auto max-h-48"
                                        autoFocus
                                    />
                                    <div className="flex items-center justify-between pb-1 border-t border-slate-50 pt-1 mt-1">
                                        <div className="flex items-center gap-1.5 px-2">
                                            <Sparkles className="w-3 h-3 text-blue-500" />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Magic Edit Mode</span>
                                        </div>
                                        <button type="submit" disabled={isGenerating || !magicPrompt.trim()} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:opacity-50">
                                            <Send className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </Panel>
                    )}

                    {/* Generating Overlay */}
                    {isGenerating && (
                        <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-500">
                            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-blue-100 flex flex-col items-center gap-5 text-center max-w-xs">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-25"></div>
                                    <div className="relative p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <Sparkles className="w-10 h-10 text-blue-600 animate-pulse" />
                                    </div>
                                </div>
                                <h3 className="font-black text-slate-900 text-base">
                                    {nodes.length > 0 ? 'Mise à jour IA...' : 'Architecte IA...'}
                                </h3>
                                {nodes.length > 0 && (
                                    <p className="text-[10px] text-slate-500 -mt-2 font-medium">Réorganisation du flow...</p>
                                )}
                            </div>
                        </div>
                    )}
                </ReactFlow>
            </div>

            {selectedNode && (
                <ConfigPanel
                    selectedNode={selectedNode}
                    agentId={agent?.id}
                    onUpdate={(data) => updateNodeData(selectedNode.id, data)}
                    onDelete={() => {
                        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                        setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                        setSelectedNode(null);
                    }}
                />
            )}

            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Enregistrer les modifications
                </button>
            </div>
        </div>
    );
}

export default function AgentVisualBuilderSection({ agent, onSave }) {
    return (
        <div className="animate-in fade-in duration-300">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    Agent Architecture Design
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">
                    Modifiez le flux de travail et les capacités de l'agent <strong>{agent.name}</strong> en temps réel.
                </p>
            </div>
            
            <ReactFlowProvider>
                <BuilderInternal agent={agent} onSave={onSave} />
            </ReactFlowProvider>
        </div>
    );
}
