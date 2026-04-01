'use client';

import React, { useState } from 'react';
import { 
    Globe, 
    Copy, 
    ShieldAlert, 
    CheckCircle2 
} from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

export default function DeploymentTab({ agent, mutate }) {
    const { showToast } = useToast();
    const [regeneratedKey, setRegeneratedKey] = useState(null);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const triggerNode = agent?.visual_config?.nodes?.find(n => n.type === 'triggerNode');
    const triggerProvider = triggerNode?.data?.provider;
    const triggerProviderDomain = triggerProvider ? {
        slack: 'slack.com',
        github: 'github.com',
        trello: 'trello.com',
        shopify: 'shopify.com',
        stripe: 'stripe.com',
        google_workspace: 'workspace.google.com',
        youtube: 'youtube.com',
        streamlabs: 'streamlabs.com'
    }[triggerProvider.toLowerCase()] : null;

    const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/run/${agent.id}` : `/api/run/${agent.id}`;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="p-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    {triggerProviderDomain ? (
                        <img 
                            src={`https://www.google.com/s2/favicons?domain=${triggerProviderDomain}&sz=128`} 
                            className="w-48 h-48 grayscale opacity-50 contrast-125"
                            alt="Provider Logo"
                        />
                    ) : (
                        <Globe className="w-48 h-48" />
                    )}
                </div>
                <div className="relative">
                    <h3 className="text-lg font-bold text-slate-900">Endpoint Webhook (Live)</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                        Utilisez cette URL pour appeler votre agent depuis n'importe quel service tiers. Les requêtes sont sécurisées par votre clé d'organisation globale.
                    </p>

                    <div className="mt-6 p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-inner flex justify-between items-center group">
                        <code className="text-xs font-mono text-blue-400">{webhookUrl}</code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(webhookUrl);
                                showToast({ title: 'Copié', message: 'URL du Webhook copiée', type: 'success' });
                            }}
                            className="p-2 text-slate-500 hover:text-white transition-colors"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mt-6 border-t border-slate-100 pt-6">
                        <h4 className="text-sm font-bold text-slate-900 mb-2">Authentification (Clé API)</h4>
                        <p className="text-xs text-slate-500 mb-4 max-w-xl">
                            Les appels à l'agent nécessitent un header <code>Authorization: Bearer</code> contenant la clé API de l'agent.
                        </p>

                        {regeneratedKey ? (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Nouvelle clé API générée avec succès
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-white p-2 px-3 rounded text-sm border border-emerald-100 font-mono text-emerald-700 break-all select-all">
                                        {regeneratedKey}
                                    </code>
                                    <Button
                                        variant="secondary"
                                        className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                        onClick={() => {
                                            navigator.clipboard.writeText(regeneratedKey);
                                            showToast({ title: 'Copié', message: 'Clé API copiée', type: 'success' });
                                        }}
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="secondary"
                                icon={ShieldAlert}
                                disabled={isRegenerating}
                                onClick={async () => {
                                    if (!confirm("⚠️ ATTENTION : Générer une nouvelle clé API va invalider la précédente immédiatement.")) return;
                                    setIsRegenerating(true);
                                    try {
                                        const res = await fetch(`/api/agents/${agent.id}/regenerate-key`, { method: 'POST' });
                                        const payload = await res.json();
                                        if (res.ok && payload.api_key) {
                                            setRegeneratedKey(payload.api_key);
                                            showToast({ title: 'Succès', message: 'Nouvelle clé API générée', type: 'success' });
                                        }
                                    } finally {
                                        setIsRegenerating(false);
                                    }
                                }}
                            >
                                {isRegenerating ? 'Génération...' : 'Régénérer la clé API Agent'}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CodeExample title="Node.js" code={`const res = await fetch(\n  '${webhookUrl}',\n  {\n    method: 'POST',\n    headers: {\n      'Authorization': 'Bearer YOUR_API_KEY',\n      'Content-Type': 'application/json'\n    },\n    body: JSON.stringify({ message: 'Hello!' })\n  }\n);`} />
                <CodeExample title="Python" code={`import requests\n\nurl = "${webhookUrl}"\nheaders = {\n    "Authorization": "Bearer YOUR_API_KEY",\n    "Content-Type": "application/json"\n}\npayload = { "message": "Bonjour!" }\n\nresponse = requests.post(url, json=payload, headers=headers)\nprint(response.json())`} />
            </div>
        </div>
    );
}

function CodeExample({ title, code }) {
    return (
        <Card className="p-6">
            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                Exemple de Requête ({title})
            </h4>
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-[10px] text-blue-300 overflow-x-auto">
                <pre>{code}</pre>
            </div>
        </Card>
    );
}
