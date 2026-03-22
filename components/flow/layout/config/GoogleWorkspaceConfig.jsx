import React from 'react';
import { Sparkles, Folder, Calendar } from 'lucide-react';

const GoogleWorkspaceConfig = ({ node, theme, metadata, isLoadingMetadata, onUpdate }) => {
    const config = node.data.config || {};
    const isGmail = label.includes('gmail') || label.includes('mail') || label.includes('email');
    const isDrive = (label.includes('drive') || label.includes('fichier') || label.includes('stockage') || label.includes('dossier')) && !isGmail;
    const isCalendar = label.includes('calendar') || label.includes('agenda') || label.includes('calendrier');
    
    // Hybrid Mode logic
    const isAuto = isGmail || config.target_id === 'auto' || config.target_id === undefined;

    const items = metadata.google_items || [];

    return (
        <div className="space-y-6">
            {!isGmail && (
                <div className={`flex items-center justify-between p-3 ${theme.bg} rounded-2xl shadow-xl shadow-blue-100`}>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white uppercase tracking-wider">Mode Automatique</span>
                            <span className="text-[9px] text-blue-100 font-bold italic opacity-80">
                                {isAuto ? `L'Agent choisit ${isDrive ? 'le Drive' : (isCalendar ? "l'agenda" : "la cible")}` : `${isDrive ? 'Drive' : (isCalendar ? 'Agenda' : 'Cible')} fixe configurée`}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const nextId = isAuto ? '' : 'auto';
                            onUpdate('config', { ...config, target_id: nextId });
                        }}
                        className={`w-10 h-5 rounded-full transition-all duration-300 relative border-2 ${isAuto ? 'bg-white border-white' : 'bg-blue-700 border-blue-500'}`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform duration-300 shadow-sm ${isAuto ? 'translate-x-5 bg-blue-600' : 'translate-x-0.5 bg-blue-200'}`} />
                    </button>
                </div>
            )}

            {!isAuto && (
                <div className="space-y-4 p-4 bg-blue-50/30 rounded-2xl border border-blue-100 shadow-sm transition-all">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">
                            {isDrive ? 'DRIVE' : (isCalendar ? 'AGENDA' : 'CIBLE')}
                        </label>
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                {isDrive ? <Folder className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                            </div>
                            <select
                                value={config.target_id || ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    onUpdate('config', { ...config, target_id: val });
                                }}
                                className="w-full text-xs font-bold pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-400 shadow-sm transition-all appearance-none"
                            >
                                <option value="">Sélectionner un élément...</option>
                                {items.map(item => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-2 italic px-1">
                            {isLoadingMetadata ? 'Chargement de vos données...' : `L'agent utilisera toujours cet élément fixe.`}
                        </p>
                    </div>
                </div>
            )}


            {isGmail && (
                <div className="space-y-3">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                             <p className="text-[10px] text-blue-700 font-black uppercase tracking-[0.2em]">Gmail</p>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                            La gestion des emails est entièrement <strong>automatique</strong>. L'Agent identifiera tout seul les destinataires et le contenu en fonction du contexte de la requête.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoogleWorkspaceConfig;
