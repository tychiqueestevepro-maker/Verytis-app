'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    Panel,
    useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSWRConfig } from 'swr';

import {
    Play,
    Save,
    Sparkles,
    Loader2,
    Send,
    Eye,
    Code,
    Copy,
    Terminal,
    Shield
} from 'lucide-react';

import { useToast } from '@/components/ui/Toast';

// Custom Nodes and Layouts
import TriggerNode from '@/components/flow/nodes/TriggerNode';
import LLMNodeV3 from '@/components/flow/nodes/LLMNodeV3';
import GuardrailNode from '@/components/flow/nodes/GuardrailNode';
import PlaceholderNode from '@/components/flow/nodes/PlaceholderNode';
import Sidebar from '@/components/flow/layout/Sidebar';
import ConfigPanel from '@/components/flow/layout/ConfigPanel';
import ToolNode from '@/components/flow/nodes/ToolNode';
import KnowledgeNode from '@/components/flow/nodes/KnowledgeNode';

import { Button } from '@/components/ui';
import AgentPlaygroundSection from '@/components/pages/AgentPlaygroundSection';

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

export default function AgentBuilder() {
    const router = useRouter();
    const reactFlowWrapper = useRef(null);
    const { showToast } = useToast();
    const { mutate } = useSWRConfig();

    // UI State
    const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'code' | 'playground'
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [agentName, setAgentName] = useState('New AI Agent');

    // Builder State
    const [agentId, setAgentId] = useState(null);
    const [magicPrompt, setMagicPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showMagicBar, setShowMagicBar] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [connectedProviders, setConnectedProviders] = useState([]);
    const [orgId, setOrgId] = useState(null);
    const [orgSettings, setOrgSettings] = useState(null);

    // Dynamic Code Generation
    const generateCodeSnippet = () => {
        const manifest = {
            agent: {
                name: agentName,
                id: agentId || 'temp_draft',
                lastModified: new Date().toISOString()
            },
            configuration: {
                system_prompt: nodes.find(n => n.type === 'llmNode' || n.type === 'placeholderNode')?.data?.system_prompt || "No system prompt defined",
                architecture: {
                    nodes: nodes.map(n => ({ id: n.id, type: n.type, label: n.data.label })),
                    edges: edges
                },
                governance: nodes.find(n => n.type === 'guardrailNode')?.data?.policies || {}
            },
            sdk_integration: {
                api_endpoint: typeof window !== 'undefined' ? `${window.location.origin}/api/run/${agentId || 'AGENT_ID'}` : '/api/run/AGENT_ID',
                auth: "Bearer VRT_LIVE_YOUR_API_KEY"
            }
        };
        return JSON.stringify(manifest, null, 2);
    };

    // 1. Loading Logic for Existing Agents & Global Settings
    useEffect(() => {
        const urlParams = new URL(window.location.href).searchParams;
        const idFromUrl = urlParams.get('id');

        const fetchAgent = async (id) => {
            try {
                const res = await fetch(`/api/agents/${id}`);
                const data = await res.json();
                if (res.ok && data.agent) {
                    setAgentId(data.agent.id);
                    setAgentName(data.agent.name);
                    setOrgId(data.agent.organization_id);
                    if (data.agent.visual_config) {
                        setNodes(hydrateNodes(data.agent.visual_config.nodes || []));
                        setEdges(data.agent.visual_config.edges || []);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch agent", err);
            }
        };

        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();
                if (res.ok && data.providers) {
                    setConnectedProviders(data.providers);
                    if (data.settings) setOrgSettings(data.settings);
                    if (data.user?.organization_id) setOrgId(data.user.organization_id);
                    // Propagate to nodes for real-time visual update
                    setNodes(nds => nds.map(node => ({
                        ...node,
                        data: { ...node.data, connectedProviders: data.providers }
                    })));
                }
            } catch (err) {
                console.error("Failed to fetch settings", err);
            }
        };

        if (idFromUrl) fetchAgent(idFromUrl);
        fetchSettings();

        // 1.1 Real-time Connection Listener
        const handleRefresh = (event) => {
            if (event.origin !== window.location.origin) return;
            if (['SLACK_CONNECTED', 'GITHUB_CONNECTED', 'TRELLO_CONNECTED', 'STRIPE_CONNECTED', 'GOOGLE_CONNECTED', 'GOOGLE_WORKSPACE_CONNECTED', 'SHOPIFY_CONNECTED', 'TRELLO_LINKED', 'GITHUB_LINKED', 'YOUTUBE_CONNECTED', 'STREAMLABS_CONNECTED', 'TIKTOK_CONNECTED'].includes(event.data?.type)) {
                console.log("[BUILDER] Connection detected, refreshing settings...", event.data.type);
                fetchSettings();
            }
        };

        window.addEventListener('message', handleRefresh);
        return () => window.removeEventListener('message', handleRefresh);
    }, [setNodes, setEdges]);

    // 2. Persistence Logic (Save & Auto-save)
    const saveAgent = async (isManual = false) => {
        if (nodes.length === 0) return;
        if (isManual) setIsSaving(true);

        try {
            const agentNode = nodes.find(n => n.type === 'llmNode' || n.type === 'placeholderNode');
            const guardrailNode = nodes.find(n => n.type === 'guardrailNode');
            const knowledgeNode = nodes.find(n => n.type === 'knowledgeNode');

            const payload = {
                id: agentId,
                name: agentName,
                description: agentNode?.data?.description || 'Agent créé via Visual Builder',
                system_prompt: agentNode?.data?.system_prompt || '',
                policies: guardrailNode?.data?.policies || {},
                knowledge_configuration: knowledgeNode?.data?.knowledge_configuration || agentNode?.data?.knowledge_configuration || {},
                visual_config: { nodes, edges },
                is_draft: true
            };

            const res = await fetch('/api/agents/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (res.ok) {
                if (!agentId) setAgentId(result.agent.id);
                if (isManual) {
                    showToast({
                        title: 'Brouillon Enregistré',
                        message: 'Toutes les modifications sont sauvegardées.',
                        type: 'success'
                    });
                }
                // Refresh sidebar history immediately
                mutate('/api/agents');
            }
        } catch (error) {
            console.error(error);
            if (isManual) showToast({ title: 'Erreur', message: 'Erreur lors de la sauvegarde.', type: 'error' });
        } finally {
            if (isManual) setIsSaving(false);
        }
    };

    // 3. handleNewAgent - ChatGPT style reset
    const handleNewAgent = useCallback(() => {
        setNodes([]);
        setEdges([]);
        setAgentName('Nouveau Agent');
        setAgentId(null);
        setSelectedNode(null);
        setMagicPrompt('');
        setShowMagicBar(false);
        // Clean URL
        if (typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [setNodes, setEdges]);

    // Auto-save debounced
    useEffect(() => {
        const timer = setTimeout(() => {
            if (nodes.length > 0) saveAgent(false);
        }, 5000); // 5 seconds of inactivity
        return () => clearTimeout(timer);
    }, [nodes, edges, agentName]);

    const calculateVerticalLayout = (nodes, edges = []) => {
        const verticalSpacing = 400; // Increased for clarity
        const horizontalSpacing = 600;
        const centerX = 400;

        // Group nodes by tier
        const triggers = nodes.filter(n => n.type === 'triggerNode');
        const shields = nodes.filter(n => n.type === 'guardrailNode');
        const agents = nodes.filter(n => n.type === 'llmNode' || n.type === 'placeholderNode');
        const tools = nodes.filter(n => n.type === 'toolNode');

        const layout = [];

        // Tier 1: Triggers (centered)
        triggers.forEach((node, i) => {
            const rowOffset = (i - (triggers.length - 1) / 2) * horizontalSpacing;
            layout.push({ ...node, position: { x: centerX + rowOffset, y: 0 } });
        });

        // Tier 2: Shield (centered)
        shields.forEach((node, i) => {
            layout.push({ ...node, position: { x: centerX, y: verticalSpacing } });
        });

        // Tier 3: Agents (centered)
        agents.forEach((node, i) => {
            const rowOffset = (i - (agents.length - 1) / 2) * horizontalSpacing;
            layout.push({ ...node, position: { x: centerX + rowOffset, y: verticalSpacing * 2 } });
        });

        // Tier 4: Tools (STAR ORCHESTRATION CENTERING)
        // All tools are at the same vertical level, fanning out horizontally from the center
        tools.forEach((tool, i) => {
            const fanOffset = (i - (tools.length - 1) / 2) * horizontalSpacing;
            layout.push({ ...tool, position: { x: centerX + fanOffset, y: verticalSpacing * 3 } });
        });

        // Merge results, keeping non-layouted nodes (if any) as they were
        const layoutedIds = new Set(layout.map(n => n.id));
        return [
            ...layout,
            ...nodes.filter(n => !layoutedIds.has(n.id))
        ];
    };

    const applyLLMConfig = (config) => {
        console.log("[MAGIC_BUILD_INPUT]", config);
        if (config.name) setAgentName(config.name);

        let newNodes = [];
        let newEdges = [];

        if (config.architecture && config.architecture.nodes) {
            // Use the AI-generated architecture and ensure data is properly merged
            const rawNodes = config.architecture.nodes.map(node => {
                const nodeData = node.data || {};
                const baseNode = {
                    ...node,
                    data: {
                        ...nodeData,
                        connectedProviders, // Inject global connectivity list
                        onChange: (key, val) => updateNodeData(node.id, { [key]: val })
                    }
                };

                if (node.type === 'llmNode' || node.type === 'placeholderNode') {
                    return {
                        ...baseNode,
                        data: {
                            ...baseNode.data,
                            label: nodeData.label || 'LLM DROPZONE', // Respect AI label if exists
                            system_prompt: nodeData.system_prompt || config.system_prompt || '',
                            description: nodeData.description || config.description || 'Agent géré par Verytis',
                            model: nodeData.model || 'gpt-4o'
                        }
                    };
                }

                if (node.type === 'knowledgeNode') {
                    return {
                        ...baseNode,
                        data: {
                            ...baseNode.data,
                            label: 'Base de Connaissance'
                        }
                    };
                }

                return baseNode;
            });

            // Ensure at least one LLM/Agent node exists (Mandatory as per latest feedback)
            const hasAgent = rawNodes.some(n => n.type === 'llmNode' || n.type === 'placeholderNode');
            if (!hasAgent) {
                console.log("No agent found. Inserting default LLM DROPZONE...");
                rawNodes.push({
                    id: 'agent-auto',
                    type: 'placeholderNode',
                    data: {
                        label: 'LLM DROPZONE'
                    }
                });
            }

            // POST-LAYOUT REFINEMENT: Enforce Logic and Connectivity
            rawNodes.forEach(node => {
                if (node.type === 'llmNode' || node.type === 'placeholderNode') {
                    // Populate system prompt from global if node-level is missing
                    if (!node.data.system_prompt && config.system_prompt) {
                        node.data.system_prompt = config.system_prompt;
                    }
                    // If no specific AI model is requested, force it to be a Placeholder Dropzone
                    if (!node.data.model || ['gpt-4o', 'gpt-4o-mini'].includes(node.data.model)) {
                        node.type = 'placeholderNode';
                    }
                }
            });

            newNodes = calculateVerticalLayout(rawNodes, config.architecture.edges || []);

            // LOGICAL CONNECTION AUDIT: Eliminate floating and ghost edges
            const nodeIds = new Set(newNodes.map(n => n.id));
            const existingEdges = (config.architecture.edges || [])
                .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
                .map(({ sourceHandle, targetHandle, ...rest }) => rest);

            // 2. DOMAIN-SPECIFIC ORCHESTRATION (Triggers -> Shield -> Agents -> Tools)
            const triggers = newNodes.filter(n => n.type === 'triggerNode');
            const shields = newNodes.filter(n => n.type === 'guardrailNode');
            const agents = newNodes.filter(n => n.type === 'llmNode' || n.type === 'placeholderNode');
            const tools = newNodes.filter(n => n.type === 'toolNode');

            // Initialize edges with AI-provided ones (if valid)
            newEdges = [...existingEdges];
            console.log("[MAGIC_BUILD_EDGES_BEFORE_AUDIT]", newEdges);

            // Tier 1 -> Tier 2 (Triggers to Shield)
            if (shields.length > 0) {
                const targetShieldId = shields[0].id;
                triggers.forEach(trigger => {
                    if (!newEdges.some(e => e.source === trigger.id)) {
                        newEdges.push({
                            id: `vrt-trigger-shield-${trigger.id}`,
                            source: trigger.id,
                            target: targetShieldId,
                            animated: true,
                            style: { stroke: '#10B981', strokeWidth: 2 }
                        });
                    }
                });
            }

            // Tier 2 -> Tier 3 (Shield to Agents)
            if (shields.length > 0 && agents.length > 0) {
                const sourceShieldId = shields[0].id;
                agents.forEach(agent => {
                    if (!newEdges.some(e => e.target === agent.id)) {
                        newEdges.push({
                            id: `vrt-shield-agent-${agent.id}`,
                            source: sourceShieldId,
                            target: agent.id,
                            animated: true,
                            style: { stroke: '#F43F5E', strokeWidth: 2 }
                        });
                    }
                });
            }

            // Tier 3 -> Tier 4 (Agents to Tools: STRICT STAR ORCHESTRATION)
            if (tools.length > 0) {
                const primaryAgentId = agents.length > 0 ? agents[0].id : null;

                if (primaryAgentId) {
                    // Forcefully remove any existing tool-related edges (incoming or outgoing) 
                    // to ensure no sequential chains survive.
                    newEdges = newEdges.filter(e => {
                        const isTargetTool = tools.some(t => t.id === e.target);
                        const isSourceTool = tools.some(t => t.id === e.source);
                        // Keep edges ONLY if they are NOT targeting or sourcing a tool 
                        // (we will rebuild the agent->tool connections manually)
                        return !isTargetTool && !isSourceTool;
                    });

                    // Rebuild strictly from primary agent to all tools
                    tools.forEach(tool => {
                        newEdges.push({
                            id: `vrt-star-hub-${tool.id}`,
                            source: primaryAgentId,
                            target: tool.id,
                            animated: true,
                            style: { stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '5,5' }
                        });
                    });
                }
            }

            // Final safety check: Ensure all targets exist in the current node list
            newEdges = newEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
        } else {
            // Fallback for older or metadata-only responses
            const fallbackNodes = [
                {
                    id: 'trigger-1',
                    type: 'triggerNode',
                    data: { label: 'Trigger', description: 'Verytis entry point' },
                    position: { x: 250, y: 0 }
                },
                {
                    id: 'shield-1',
                    type: 'guardrailNode',
                    data: {
                        label: 'Verytis Governance',
                        policies: { budget_daily_max: 25.0 }
                    },
                    position: { x: 250, y: 250 }
                },
                {
                    id: 'placeholder-llm',
                    type: 'placeholderNode',
                    data: {
                        label: 'LLM DROPZONE',
                        system_prompt: config.system_prompt || ''
                    },
                    position: { x: 250, y: 500 }
                }
            ];

            newNodes = calculateVerticalLayout(fallbackNodes, []);

            newEdges = [
                { id: 'e1-2', source: 'trigger-1', target: 'shield-1', animated: true },
                { id: 'e2-p', source: 'shield-1', target: 'placeholder-llm', animated: true },
            ];
        }

        // Add onChange to all new nodes
        newNodes = newNodes.map(n => ({
            ...n,
            data: { ...n.data, onChange: (key, val) => updateNodeData(n.id, { [key]: val }) }
        }));

        const sanitizedEdges = newEdges.map(({ sourceHandle, targetHandle, label, ...rest }) => rest);
        const finalNodes = newNodes.map(n => ({
            ...n,
            data: { ...n.data, connectedProviders } // Ensure all nodes have the latest list
        }));
        setNodes(finalNodes);
        setEdges(sanitizedEdges);
        console.log("[MAGIC_BUILD_FINAL_STATE]", { nodes: newNodes, edges: sanitizedEdges });

        // Professional Auto-Zoom
        setTimeout(() => {
            if (reactFlowInstance) {
                reactFlowInstance.fitView({ padding: 0.3, duration: 800 });
            }
        }, 300);

        // First auto-save to create the draft in DB
        setTimeout(() => saveAgent(false), 2500);
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
                applyLLMConfig(config);
                showToast({
                    title: 'Agent Généré !',
                    message: 'Le canvas a été mis à jour par l\'IA.',
                    type: 'success'
                });
                setShowMagicBar(false);
                setMagicPrompt('');
            } else {
                showToast({
                    title: 'Erreur',
                    message: config.error || 'Check console for errors',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error(error);
            showToast({ title: 'Erreur', message: 'Internal error', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        try {
            const agentNode = nodes.find(n => n.type === 'llmNode' || n.type === 'placeholderNode');
            const guardrailNode = nodes.find(n => n.type === 'guardrailNode');
            const knowledgeNode = nodes.find(n => n.type === 'knowledgeNode');

            // ─── MANDATORY GOVERNANCE VALIDATION ───
            if (orgSettings) {
                const agentPolicies = guardrailNode?.data?.policies || {};
                const missingKeywords = (orgSettings.banned_keywords || []).filter(k =>
                    !(agentPolicies.forbidden_keywords || []).includes(k)
                );
                const missingActions = (orgSettings.blocked_actions || []).filter(a =>
                    !(agentPolicies.blocked_actions || []).includes(a)
                );

                if (missingKeywords.length > 0 || missingActions.length > 0) {
                    showToast({
                        title: 'Conformité Requise',
                        message: "L'agent ne peut pas être déployé car il ne respecte pas les réglages de gouvernance obligatoires de l'organisation. Veuillez vérifier les mots-clés interdits et les actions bloquées dans le Shield.",
                        type: 'error'
                    });
                    setIsDeploying(false);
                    return;
                }
            }

            const payload = {
                id: agentId,
                name: agentName,
                description: agentNode?.data?.description || 'Agent créé via Visual Builder',
                system_prompt: agentNode?.data?.system_prompt || '',
                policies: guardrailNode?.data?.policies || {},
                knowledge_configuration: knowledgeNode?.data?.knowledge_configuration || agentNode?.data?.knowledge_configuration || {},
                visual_config: { nodes, edges },
                is_draft: false,  // ← Marque comme déployé
                status: 'active'  // ← Met le statut à 'active' en BDD
            };

            const res = await fetch('/api/agents/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (res.ok) {
                mutate('/api/agents');
                showToast({
                    title: '🚀 Agent Déployé !',
                    message: `${agentName} est maintenant actif dans votre dashboard.`,
                    type: 'success'
                });
                // ─── ROUTING: Redirect to active agents dashboard ───
                router.push('/agents');
            } else {
                showToast({ title: 'Erreur', message: result.error, type: 'error' });
            }
        } catch (error) {
            console.error(error);
            showToast({ title: 'Erreur', message: 'Deployment failed', type: 'error' });
        } finally {
            setIsDeploying(false);
        }
    };

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2 } }, eds)),
        [setEdges],
    );

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

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

    // Re-attach onChange callbacks to nodes loaded from the DB.
    // Without this, provider/model changes in the dropdown silently fail.
    const hydrateNodes = useCallback((rawNodes) => {
        return rawNodes.map((n) => ({
            ...n,
            data: {
                ...n.data,
                connectedProviders,
                onChange: (key, val) => updateNodeData(n.id, { [key]: val }),
            }
        }));
    }, [updateNodeData, connectedProviders]);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow/type');
            const label = event.dataTransfer.getData('application/reactflow/label');
            const description = event.dataTransfer.getData('application/reactflow/description');
            const model = event.dataTransfer.getData('application/reactflow/model');
            if (!type) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // LOGIC: Replace Placeholder if dropped nearby
            const findNearestPlaceholder = (pos) => {
                let nearest = null;
                let minDist = 150; // Threshold
                nodes.forEach(n => {
                    if (n.type === 'placeholderNode') {
                        const d = Math.sqrt(Math.pow(pos.x - n.position.x, 2) + Math.pow(pos.y - n.position.y, 2));
                        if (d < minDist) {
                            minDist = d;
                            nearest = n;
                        }
                    }
                });
                return nearest;
            };

            const placeholder = findNearestPlaceholder(position);

            if (placeholder) {
                const nodeId = getId();
                const newNode = {
                    id: nodeId,
                    type,
                    position: placeholder.position,
                    data: {
                        label: label || `${type} node`,
                        description,
                        model: model || undefined,
                        provider: model?.toLowerCase().includes('claude') ? 'anthropic' :
                            model?.toLowerCase().includes('gemini') ? 'google' :
                                model?.toLowerCase().includes('gpt') ? 'openai' : null,
                        onChange: (key, val) => updateNodeData(nodeId, { [key]: val })
                    },
                };

                setNodes((nds) => {
                    const filtered = nds.filter(n => n.id !== placeholder.id);
                    return filtered.concat(newNode);
                });

                // Re-route edges from/to placeholder
                setEdges((eds) => eds.map(edge => {
                    if (edge.source === placeholder.id) return { ...edge, source: newNode.id };
                    if (edge.target === placeholder.id) return { ...edge, target: newNode.id };
                    return edge;
                }));

                showToast({ title: 'Agent Activé', message: 'Le Placeholder a été remplacé.', type: 'success' });
            } else {
                const nodeId = getId();
                const newNode = {
                    id: nodeId,
                    type,
                    position,
                    data: {
                        label: label || `${type} node`,
                        description,
                        model: model || (type === 'llmNode' ? 'gpt-4o' : undefined),
                        onChange: (key, val) => updateNodeData(nodeId, { [key]: val })
                    },
                };
                setNodes((nds) => nds.concat(newNode));
            }
        },
        [reactFlowInstance, setNodes, nodes, setEdges, updateNodeData],
    );

    return (
        <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden">

            {/* Top Navigation Bar - 3-column layout to prevent overlap */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 shrink-0 z-20 shadow-sm relative">
                
                {/* LEFT: Agent Title – max 30% pour ne pas empiéter sur les onglets */}
                <div className="flex items-center gap-4 min-w-0 max-w-[30%] flex-shrink">
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-slate-900 truncate min-w-0" title={agentName}>
                                {agentName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded leading-none uppercase shrink-0">
                                Draft
                            </span>
                        </div>
                    </div>
                </div>

                {/* CENTER: View Toggle – parfaitement centré grâce au positionnement absolu */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                        onClick={() => setViewMode('visual')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'visual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Visuel
                    </button>
                    <button
                        onClick={() => setViewMode('code')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'code' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Code className="w-3.5 h-3.5" />
                        Code
                    </button>
                    <button
                        onClick={() => setViewMode('playground')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'playground' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Chat
                    </button>
                </div>

                {/* RIGHT: Actions – poussé à droite avec ml-auto */}
                <div className="flex items-center gap-3 ml-auto">
                    <button
                        onClick={() => saveAgent(true)}
                        disabled={isSaving || nodes.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Sauvegarder
                    </button>
                    <button
                        onClick={handleDeploy}
                        disabled={isDeploying || nodes.length === 0}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isDeploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        Déployer l'Agent
                    </button>
                </div>
            </header>

            {/* Main Builder Area */}
            <main className="flex-1 flex overflow-hidden relative">
                {viewMode === 'visual' ? (
                    <ReactFlowProvider>
                        <Sidebar
                            onSelectDraft={(draft) => {
                                if (draft.visual_config) {
                                    setNodes(hydrateNodes(draft.visual_config.nodes || []));
                                    setEdges(draft.visual_config.edges || []);
                                    setAgentName(draft.name);
                                    setAgentId(draft.id);
                                    setSelectedNode(null);
                                    setTimeout(() => {
                                        if (reactFlowInstance) reactFlowInstance.fitView({ padding: 0.3, duration: 800 });
                                    }, 100);
                                    // Update URL without reload
                                    window.history.pushState({}, '', `?id=${draft.id}`);
                                }
                            }}
                            onNewAgent={handleNewAgent}
                            activeAgentId={agentId}
                        />

                        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
                            {/* Empty State Overlay */}
                            {nodes.length === 0 && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-[1px]">
                                    <div className="max-w-3xl w-full text-center space-y-8 px-6 animate-in fade-in zoom-in-95 duration-500">
                                        <div className="relative inline-block">
                                            <div className="absolute inset-x-0 bottom-0 h-3 bg-blue-100/50 -rotate-2"></div>
                                            <h2 className="text-3xl font-black text-slate-900 relative">Design your AI.</h2>
                                        </div>
                                        <p className="text-slate-500 text-sm leading-relaxed">
                                            Décrivez l'agent idéal pour votre équipe. Verytis s'occupe de câbler l'intelligence et la sécurité.
                                        </p>

                                        <form onSubmit={handleMagicBuild} className="relative group">
                                            <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-500 rounded-3xl blur opacity-25 group-focus-within:opacity-40 transition duration-500"></div>
                                            <div className="relative flex flex-col bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl p-2">
                                                <textarea
                                                    placeholder="Décrivez l'agent idéal... (ex: Un recruteur Tech Lead IA qui analyse les PR GitHub et poste sur Slack)"
                                                    value={magicPrompt}
                                                    onChange={(e) => setMagicPrompt(e.target.value)}
                                                    onInput={(e) => {
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px';
                                                    }}
                                                    rows={3}
                                                    className="w-full bg-transparent py-4 px-6 text-base outline-none focus:outline-none border-none focus:ring-0 resize-none overflow-y-auto leading-relaxed placeholder:text-slate-400"
                                                    autoFocus
                                                />
                                                <div className="flex items-center justify-between px-4 pb-2 pt-1 border-t border-slate-50">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                                            <Sparkles className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by Verytis AI</span>
                                                    </div>
                                                    <button
                                                        type="submit"
                                                        disabled={isGenerating || !magicPrompt.trim()}
                                                        className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:bg-slate-200"
                                                    >
                                                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </form>

                                        <div className="flex flex-wrap justify-center gap-2 pt-4">
                                            {["Support Client Automatisé", "Analyse de Pull Requests", "Gouvernance de Budget API"].map((tpl) => (
                                                <button
                                                    key={tpl}
                                                    onClick={() => setMagicPrompt(tpl)}
                                                    className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm"
                                                >
                                                    {tpl}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isGenerating && (
                                <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-500">
                                    <div className="bg-white p-8 rounded-3xl shadow-2xl border border-blue-100 flex flex-col items-center gap-5 text-center max-w-xs scale-110">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-25"></div>
                                            <div className="relative p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                                <Sparkles className="w-10 h-10 text-blue-600 animate-pulse" />
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 text-base">
                                                {nodes.length > 0 ? 'Mise à jour de l\'agent...' : 'Architecte en action...'}
                                            </h3>
                                            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-medium">
                                                {nodes.length > 0 ? 'Intégration des modifications IA' : 'Conception du flow, des prompts et des barrières de sécurité.'}
                                            </p>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-blue-600 h-full w-1/3 rounded-full animate-[progress_2s_ease-in-out_infinite]"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onInit={setReactFlowInstance}
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                onNodeClick={(e, n) => setSelectedNode(n)}
                                onPaneClick={() => setSelectedNode(null)}
                                nodeTypes={nodeTypes}
                                defaultEdgeOptions={{
                                    type: 'smoothstep',
                                    animated: true,
                                    style: { strokeWidth: 2, stroke: '#94a3b8' }
                                }}
                                fitView
                                className="bg-slate-50/50"
                            >
                                <Controls className="bg-white border-slate-200 shadow-xl rounded-xl overflow-hidden" showInteractive={false} />
                                <Background variant="dots" gap={20} size={1} color="#e2e8f0" />

                                {nodes.length > 0 && !isGenerating && (
                                    <Panel position="top-right" className="m-4">
                                        <button
                                            onClick={() => setShowMagicBar(!showMagicBar)}
                                            className={`p-2 rounded-xl border transition-all shadow-lg ${showMagicBar ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                                        >
                                            <Sparkles className="w-5 h-5" />
                                        </button>
                                    </Panel>
                                )}

                                {showMagicBar && nodes.length > 0 && (
                                    <Panel position="top-center" className="w-[800px] mt-4 max-w-[90vw]">
                                        <form onSubmit={handleMagicBuild} className="relative group animate-in slide-in-from-top-4">
                                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-blue-400 rounded-3xl blur opacity-20"></div>
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
                            </ReactFlow>
                        </div>

                        <ConfigPanel
                            selectedNode={selectedNode}
                            orgSettings={orgSettings}
                            agentId={agentId}
                            orgId={orgId}
                            onUpdateNode={updateNodeData}
                            onClose={() => setSelectedNode(null)}
                        />
                    </ReactFlowProvider>
                ) : viewMode === 'code' ? (
                    <div className="flex-1 bg-slate-900 overflow-hidden flex flex-col animate-in fade-in duration-300">
                        <div className="h-10 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between px-6">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verytis Integration Code</span>
                            </div>
                            <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 py-1 px-2 rounded hover:bg-slate-700/50">
                                <Copy className="w-3.5 h-3.5" /> Copy Code
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-8 font-mono text-[13px] leading-relaxed selection:bg-blue-500/30">
                            <pre className="text-blue-300">
                                {generateCodeSnippet()}
                            </pre>
                        </div>
                        <div className="p-6 bg-slate-800/30 border-t border-slate-800">
                            <h4 className="text-xs font-bold text-white mb-2">Prêt pour la production ?</h4>
                            <p className="text-[11px] text-slate-400 max-w-lg mb-4">
                                Ce snippet utilise votre identité d'agent sécurisée. Assurez-vous d'avoir configuré vos clés d'API (OpenAI, Slack...) dans l'onglet Visuel avant d'exécuter.
                            </p>
                            <div className="flex gap-3">
                                <button className="px-4 py-2 bg-slate-700 text-white font-bold text-[10px] rounded-lg hover:bg-slate-600 transition-colors uppercase tracking-wider">
                                    Documentation SDK
                                </button>
                                <button className="px-4 py-2 bg-blue-600 text-white font-bold text-[10px] rounded-lg hover:bg-blue-500 transition-colors uppercase tracking-wider">
                                    Déployer maintenant
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <AgentPlaygroundSection agentId={agentId} agentName={agentName} />
                )}
            </main>

            {/* Deployment Modal removed – redirection automatique vers /agents après déploiement */}

        </div>
    );
}
