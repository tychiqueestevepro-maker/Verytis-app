'use client';

import React, { useState, useEffect } from 'react';
import { 
    Sparkles, 
    UserCircle, 
    Lock, 
    Hash, 
    Database, 
    Layers, 
    Globe, 
    Folder, 
    Calendar, 
    ShoppingCart, 
    Radio, 
    Cpu, 
    Check, 
    Search, 
    MessageSquare 
} from 'lucide-react';

export default function MetadataMultiSelect({ payload, onChange }) {
    const [options, setOptions] = useState([]); // Store objects {id, name, type, ...}
    const [selected, setSelected] = useState(['\u2728 Automatique']);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const lowLabel = (payload.change_detected || '').toLowerCase();
        let endpoint = null;
        if (lowLabel.includes('slack')) endpoint = '/api/slack/channels';
        else if (lowLabel.includes('trello')) endpoint = '/api/integrations/trello/metadata';
        else if (lowLabel.includes('github') || lowLabel.includes('repo')) endpoint = '/api/integrations/github/metadata';
        else if (lowLabel.includes('youtube')) endpoint = '/api/integrations/youtube/metadata';
        else if (lowLabel.includes('tiktok')) endpoint = '/api/integrations/tiktok/metadata';
        else if (lowLabel.includes('stripe')) endpoint = '/api/integrations/stripe/metadata';
        else if (lowLabel.includes('google') || lowLabel.includes('drive') || lowLabel.includes('calendar')) {
            endpoint = `/api/integrations/google/metadata?type=${lowLabel.includes('calendar') ? 'calendars' : 'drive_folders'}`;
        }
        else if (lowLabel.includes('streamlabs')) endpoint = '/api/integrations/streamlabs/metadata';
        else if (lowLabel.includes('shopify')) endpoint = '/api/integrations/shopify/metadata';

        if (!endpoint) return;

        setLoading(true);
        fetch(endpoint)
            .then(r => r.json())
            .then(data => {
                // Unified metadata structure: items, channels, repositories, calendars, or folders
                let items = data.channels || data.items || data.repositories || data.calendars || data.folders || [];
                
                // If it's a direct array (some APIs return raw array)
                if (Array.isArray(data)) items = data;
                
                // Special handling for accounts (TikTok/Streamlabs user)
                if (lowLabel.includes('tiktok') && data.user) items = [{ name: data.user.display_name, id: 'tiktok_user' }];
                if (lowLabel.includes('streamlabs') && data.user) items = [{ name: data.user.display_name, id: 'streamlabs_user' }];
                
                const mappedItems = items.map(i => ({
                    id: i.id || i.value || i.name,
                    name: i.label || i.name || i.id,
                    is_im: i.is_im || i.is_user,
                    is_private: i.is_private,
                    is_repo: !!i.full_name,
                    owner: i.owner?.login || i.platform
                })).filter(i => i.name);

                setOptions([{ id: 'auto', name: '\u2728 Automatique', type: 'system' }, ...mappedItems]);
            })
            .catch(() => setError('Erreur de chargement'))
            .finally(() => setLoading(false));
    }, [payload.change_detected]);

    const toggle = (optName) => {
        setSelected(prev => {
            let next;
            if (optName === '\u2728 Automatique') {
                next = ['\u2728 Automatique'];
            } else {
                const without = prev.filter(v => v !== '\u2728 Automatique');
                next = without.includes(optName)
                    ? without.filter(v => v !== optName)
                    : [...without, optName];
                if (next.length === 0) next = ['\u2728 Automatique'];
            }
            onChange(next);
            return next;
        });
    };

    const filtered = options.filter(opt => 
        opt.id === 'auto' || 
        opt.name.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return (
        <div className="flex items-center gap-3 py-6 justify-center text-slate-400 text-[12px] font-bold animate-pulse">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Synchronisation des méta-données...
        </div>
    );

    if (error) return <p className="text-[10px] text-rose-500 font-bold p-4 bg-rose-50 rounded-xl border border-rose-100">{error}</p>;

    const channels = filtered.filter(o => o.type !== 'system' && !o.is_im);
    const dms = filtered.filter(o => o.type !== 'system' && o.is_im);
    const others = filtered.filter(o => o.type !== 'system' && !o.is_im); // Fallback for Trello/etc
    const auto = filtered.find(o => o.id === 'auto');

    const renderItem = (opt) => {
        const isChecked = selected.includes(opt.name);
        const lowLabel = (payload.change_detected || '').toLowerCase();
        
        return (
            <button
                key={opt.id + opt.name}
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(opt.name); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[12px] font-bold text-left transition-all group relative overflow-hidden ${
                    isChecked
                        ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/10'
                        : 'bg-white border border-slate-100 text-slate-700 hover:border-blue-200 hover:bg-slate-50'
                }`}
            >
                <div className={`p-1.5 rounded-lg flex-shrink-0 flex items-center justify-center ${
                    isChecked ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400 group-hover:text-blue-500 transition-colors'
                }`}>
                    {opt.id === 'auto' ? <Sparkles className="w-3.5 h-3.5" /> : (
                        lowLabel.includes('slack') ? (
                            opt.is_im ? <UserCircle className="w-3.5 h-3.5" /> : 
                            opt.is_private ? <Lock className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />
                        ) : lowLabel.includes('github') ? (
                            <Database className="w-3.5 h-3.5" />
                        ) : lowLabel.includes('trello') ? (
                            <Layers className="w-3.5 h-3.5" />
                        ) : lowLabel.includes('youtube') ? (
                            <Globe className="w-3.5 h-3.5" />
                        ) : lowLabel.includes('google') || lowLabel.includes('drive') ? (
                            <Folder className="w-3.5 h-3.5" />
                        ) : lowLabel.includes('calendar') ? (
                            <Calendar className="w-3.5 h-3.5" />
                        ) : lowLabel.includes('shopify') ? (
                            <ShoppingCart className="w-3.5 h-3.5" />
                        ) : lowLabel.includes('stripe') ? (
                            <img src="https://www.google.com/s2/favicons?domain=stripe.com&sz=128" className="w-3.5 h-3.5 object-contain rounded-sm" alt="Stripe" />
                        ) : lowLabel.includes('tiktok') ? (
                            <img src="https://www.google.com/s2/favicons?domain=tiktok.com&sz=128" className="w-3.5 h-3.5 object-contain rounded-sm" alt="TikTok" />
                        ) : lowLabel.includes('streamlabs') ? (
                            <Radio className="w-3.5 h-3.5" />
                        ) : <Cpu className="w-3.5 h-3.5" />
                    )}
                </div>
                <div className="flex-1 truncate min-w-0">
                    <div className="truncate">{opt.name}</div>
                    {opt.owner && <div className={`text-[9px] font-medium opacity-60 mt-0.5`}>{opt.owner}</div>}
                </div>
                {isChecked && (
                    <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-blue-600" strokeWidth={4} />
                    </div>
                )}
            </button>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Search Bar */}
            <div className="relative group/search">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within/search:text-blue-500 transition-colors" />
                <input 
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrer les options..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[12px] font-bold outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                />
            </div>

            <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {auto && renderItem(auto)}
                
                {((payload.change_detected || '').toLowerCase()).includes('slack') ? (
                    <>
                        {channels.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pl-1 mb-1">
                                    <Hash className="w-3 h-3" /> Canaux Publics
                                </div>
                                <div className="flex flex-col gap-1.5 pl-0.5">
                                    {channels.map(renderItem)}
                                </div>
                            </div>
                        )}

                        {dms.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pl-1 mb-1">
                                    <MessageSquare className="w-3 h-3" /> Messages Directs
                                </div>
                                <div className="flex flex-col gap-1.5 pl-0.5">
                                    {dms.map(renderItem)}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {others.map(renderItem)}
                    </div>
                )}
            </div>
        </div>
    );
}
