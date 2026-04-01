'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ChevronRight,
    ShieldCheck,
    ShieldAlert,
    CheckCircle2,
    BarChart2,
    Sparkles,
    Layers,
    ExternalLink
} from 'lucide-react';
import useSWR from 'swr';

import { Card, Button, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import AgentVisualBuilderSection from '@/components/pages/AgentVisualBuilderSection';

// Modular Components
import TelemetryTab from './components/TelemetryTab';
import ChatTab from './components/ChatTab';
import DeploymentTab from './components/DeploymentTab';

const fetcher = (url) => fetch(url).then(r => r.json());

export default function AgentGovernancePage(props) {
    return (
        <Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Initialisation du Supervisor...</div>}>
            <AgentGovernanceContent {...props} />
        </Suspense>
    );
}

function AgentGovernanceContent({ params }) {
    const { agentId } = React.use(params);
    const router = useRouter();
    const { showToast } = useToast();
    const searchParams = useSearchParams();
    
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'telemetry');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportMessage, setReportMessage] = useState('');
    const [isReporting, setIsReporting] = useState(false);

    // Sync tab with URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) setActiveTab(tab === 'playground' ? 'chat' : tab);
    }, [searchParams]);

    // Fetch Core Agent Data
    const { data, mutate, isLoading, error } = useSWR(`/api/agents/${agentId}`, fetcher);
    const agent = data?.agent;
    const logs = data?.logs || [];
    const agentName = agent?.name || "Chargement...";

    if (isLoading) return <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Chargement de l'agent...</div>;
    if (error || !agent) return <div className="p-12 text-center text-rose-500 font-medium">Erreur : Agent introuvable.</div>;

    const handleStatusToggle = async () => {
        const newStatus = agent.status === 'active' ? 'suspended' : 'active';
        if (confirm(`Voulez-vous vraiment ${newStatus === 'active' ? 'ACTIVER' : 'SUSPENDRE'} cet agent ?`)) {
            const res = await fetch(`/api/agents/${agent.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) mutate();
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 p-6 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        <Link href="/agents" className="hover:text-slate-900 transition-colors">Agents</Link>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-slate-900">{agentName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <ShieldCheck className="w-8 h-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{agentName}</h1>
                        <span className={`px-2.5 py-1 rounded text-[10px] font-black tracking-widest uppercase ml-2 ${agent.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {agent.status === 'active' ? 'En ligne' : 'Suspendu'}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Link href={`/agents/${agentId}/policies`}>
                        <Button variant="secondary" icon={ShieldCheck}>Politiques de Gouvernance</Button>
                    </Link>
                    <Button
                        variant={agent.status === 'active' ? 'danger' : 'primary'}
                        icon={agent.status === 'active' ? ShieldAlert : CheckCircle2}
                        onClick={handleStatusToggle}
                    >
                        {agent.status === 'active' ? 'Kill Switch (Suspendre)' : 'Activer Agent'}
                    </Button>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-200">
                <TabButton id="telemetry" active={activeTab} onClick={setActiveTab} label="Télémétrie & Logs" icon={BarChart2} />
                <TabButton id="chat" active={activeTab} onClick={setActiveTab} label="Agent Chat (Playground)" icon={Sparkles} />
                <TabButton id="builder" active={activeTab} onClick={setActiveTab} label="Visual Builder" icon={Layers} />
                <TabButton id="deployment" active={activeTab} onClick={setActiveTab} label="Intégration & Webhook" icon={ExternalLink} />
            </div>

            {/* Tab Content Rendering */}
            <div className="min-h-[500px]">
                {activeTab === 'telemetry' && <TelemetryTab logs={logs} agentId={agentId} />}
                {activeTab === 'chat' && <ChatTab agentId={agentId} />}
                {activeTab === 'builder' && <AgentVisualBuilderSection agent={agent} onSave={() => mutate()} />}
                {activeTab === 'deployment' && <DeploymentTab agent={agent} mutate={mutate} />}
            </div>

            {/* Footer Actions */}
            <div className="pt-8 pb-12 text-center border-t border-slate-100">
                <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors flex items-center justify-center gap-1.5 mx-auto opacity-70"
                >
                    🚩 Signaler un comportement inattendu
                </button>
            </div>

            {/* Modals */}
            <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title="Signaler un problème">
                <div className="p-4 space-y-4">
                    <p className="text-sm text-slate-500">Un log sera envoyé à l'équipe de supervision.</p>
                    <textarea
                        rows={4}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500 resize-none"
                        value={reportMessage}
                        onChange={(e) => setReportMessage(e.target.value)}
                        placeholder="Qu'est-ce qui ne fonctionne pas ?"
                    />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setIsReportModalOpen(false)}>Annuler</Button>
                        <Button
                            variant="danger"
                            disabled={isReporting}
                            onClick={() => {
                                setIsReporting(true);
                                setTimeout(() => {
                                    setIsReporting(false);
                                    setIsReportModalOpen(false);
                                    setReportMessage('');
                                    showToast({ title: 'Envoyé', message: 'Signalement transmis avec succès', type: 'success' });
                                }, 800);
                            }}
                        >
                            {isReporting ? 'Transmission...' : 'Envoyer'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function TabButton({ id, active, onClick, label, icon: Icon }) {
    const isActive = active === id;
    return (
        <button
            onClick={() => onClick(id)}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}
