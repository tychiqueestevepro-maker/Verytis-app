'use client';

import React, { useState } from 'react';
import { Search, Filter, ShieldCheck, Mail, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useRole } from '@/lib/providers';

export default function PassportIdentitiesBoard() {
    const [identities, setIdentities] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        const fetchIdentities = async () => {
            try {
                const res = await fetch('/api/users');
                if (res.ok) {
                    const data = await res.json();
                    // Map API users to UI format
                    const mapped = (data.users || []).map(u => ({
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: u.role,
                        department: u.managedTeams?.length > 0 ? u.managedTeams[0].name : (u.teams?.length > 0 ? u.teams[0].name : 'General'),
                        passportStatus: u.connections?.length >= 2 ? 'Verified' : (u.connections?.length === 1 ? 'Warning' : 'Incomplete'),
                        connections: [
                            { app: 'Slack', connected: u.connections?.some(c => c.provider === 'slack') },
                            { app: 'GitHub', connected: u.connections?.some(c => c.provider === 'github') },
                            { app: 'Trello', connected: u.connections?.some(c => c.provider === 'trello') },
                        ]
                    }));
                    setIdentities(mapped);
                }
            } catch (err) {
                console.error("Failed to fetch identities", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchIdentities();
    }, []);

    const filteredIdentities = identities.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-500 font-medium">Loading Passport Board...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-12 animate-in fade-in duration-300">
            <div className="max-w-6xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 mt-8">

                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-gray-200">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                            Company Passport ID Board
                        </h1>
                        <p className="text-sm font-medium text-slate-500 mt-1">
                            Surveillez en temps réel quelles applications sont validées par le Passport de vos utilisateurs.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search user or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium shadow-sm"
                            />
                        </div>
                        <button className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors shadow-sm">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Kanban-like Grid Board */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredIdentities.map(user => (
                        <div key={user.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">

                            {/* User Identity Header */}
                            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                                <div className="flex gap-3 items-center">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 border border-blue-200">
                                        {user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">{user.name}</h3>
                                        <div className="flex items-center text-xs text-slate-500 mt-0.5 max-w-[150px] truncate">
                                            <Mail className="w-3 h-3 mr-1 shrink-0" />
                                            <span className="truncate">{user.email}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Passport Status Badge */}
                                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${user.passportStatus === 'Verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    user.passportStatus === 'Warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}>
                                    {user.passportStatus}
                                </div>
                            </div>

                            {/* Connected Apps Visualization */}
                            <div className="p-5 flex-1 flex flex-col justify-between">
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Authorized Apps</h4>
                                    <div className="space-y-3">
                                        {user.connections.map((conn, idx) => (
                                            <div key={idx} className="flex justify-between items-center group">
                                                <span className="text-sm font-medium text-slate-700">{conn.app}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold uppercase ${conn.connected ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {conn.connected ? 'Linked' : 'Missing'}
                                                    </span>
                                                    {conn.connected ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-slate-300 group-hover:text-rose-400 transition-colors" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer Action */}
                                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                        {user.department}
                                    </span>
                                    <button className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                        Manage Access
                                    </button>
                                </div>

                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
