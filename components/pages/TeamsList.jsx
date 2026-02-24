'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Plus, MoreHorizontal, Shield, FileText, Download, Pencil, Users, Archive, Trash2, X, ChevronDown, Check } from 'lucide-react';
import { Card, Button, Modal, SkeletonTeamItem, EmptyState } from '../ui';
import { SCOPES_CONFIG } from '@/lib/constants';

const TeamsList = ({ userRole, currentUser }) => {
    const fetcher = (...args) => fetch(...args).then(res => res.json());

    // SWR Hooks for data management
    const { data: teamsData, isLoading: isTeamsLoading, mutate: mutateTeams } = useSWR(
        currentUser?.id || userRole === 'Admin' ? `/api/teams${currentUser?.id ? `?userId=${currentUser.id}` : ''}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 10000 }
    );

    const { data: usersData, isLoading: isUsersLoading } = useSWR('/api/users', fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
    const { data: channelsData, isLoading: isChannelsLoading } = useSWR('/api/resources/list', fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });

    // Derived states
    const teams = teamsData?.teams || [];
    const availableUsers = usersData?.users || [];
    const availableChannels = (channelsData?.resources || []).filter(r => r.type === 'channel');
    const isLoading = isTeamsLoading && teams.length === 0; // Show loader only on first clear fetch

    const [dropdownState, setDropdownState] = useState({ type: false, addUser: false, memberRole: null });
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [modalConfig, setModalConfig] = useState({ type: null, team: null });
    const [showAddMember, setShowAddMember] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [teamFormData, setTeamFormData] = useState({
        name: '', description: '', type: 'operational', members: [], scopes: [], channels: []
    });

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeDropdown && !event.target.closest('.action-menu')) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [activeDropdown]);

    const handleAction = (type, team) => {
        setActiveDropdown(null);
        if (type === 'archive') {
            mutateTeams({ ...teamsData, teams: teams.map(t => t.id === team.id ? { ...t, status: 'Archived' } : t) }, false);
        } else if (type === 'delete') {
            setModalConfig({ type: 'delete', team });
        } else {
            setModalConfig({ type, team });
        }
    };

    const confirmDelete = () => {
        mutateTeams({ ...teamsData, teams: teams.filter(t => t.id !== modalConfig.team.id) }, false);
        setModalConfig({ type: null, team: null });
        // TODO: Call API to delete
    };

    // Filter teams based on backend response (which handles roles)
    const displayedTeams = teams;

    if (isLoading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <header className="flex justify-between items-end">
                    <div className="space-y-2">
                        <div className="h-7 w-32 bg-slate-200 animate-pulse rounded-lg" />
                        <div className="h-4 w-64 bg-slate-100 animate-pulse rounded-md" />
                    </div>
                    {userRole === 'Admin' && <div className="h-9 w-28 bg-slate-200 animate-pulse rounded-lg" />}
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <SkeletonTeamItem key={i} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Teams</h1>
                    <p className="text-slate-500 mt-1 text-xs font-medium">
                        {userRole === 'Member'
                            ? 'Overview of teams where you have active membership.'
                            : userRole === 'Manager'
                                ? 'Manage your assigned teams and memberships.'
                                : 'Structure your organization to strictly control audit visibility.'}
                    </p>
                </div>
                {userRole === 'Admin' && (
                    <Button variant="primary" icon={Plus} onClick={() => {
                        setModalConfig({ type: 'create', team: {} });
                        setCurrentStep(1);
                        setTeamFormData({ name: '', description: '', type: 'operational', members: [], scopes: [], channels: [] });
                    }}>Create Team</Button>
                )}
            </header>
            <Card className="overflow-hidden shadow-sm min-h-[400px]">
                <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 uppercase tracking-wide">Team Name</th>
                            <th className="px-6 py-3 uppercase tracking-wide">Type</th>
                            <th className="px-6 py-3 uppercase tracking-wide">Channels</th>
                            <th className="px-6 py-3 uppercase tracking-wide">Members</th>
                            {userRole !== 'Admin' && <th className="px-6 py-3 uppercase tracking-wide">Role</th>}
                            {/* Audit Scope Column Removed */}
                            <th className="px-6 py-3 uppercase tracking-wide">Created</th>
                            {userRole !== 'Member' && <th className="px-6 py-3 text-right uppercase tracking-wide">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayedTeams.length > 0 ? displayedTeams.map(team => {
                            // Use role from API response (normalized)
                            let roleRaw = team.currentUserRole || 'Member';
                            let role = 'Member';
                            if (roleRaw.toLowerCase() === 'lead' || roleRaw.toLowerCase() === 'manager') role = 'Manager';
                            else if (roleRaw.toLowerCase() === 'admin') role = 'Admin';

                            return (
                                <tr key={team.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <Link
                                            href={`/teams/${team.id}`}
                                            className="block cursor-pointer"
                                        >
                                            <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">{team.name}</span>
                                            <p className="text-slate-500 mt-0.5 truncate max-w-xs">{team.description}</p>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${team.status === 'Archived' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {team.status === 'Archived' ? 'Archived' : team.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600">{team.channels}</td>
                                    <td className="px-6 py-4 font-mono text-slate-600">{team.members}</td>

                                    {/* Role Column */}
                                    {userRole !== 'Admin' && (
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${role === 'Manager'
                                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                }`}>
                                                {role || 'Member'}
                                            </span>
                                        </td>
                                    )}

                                    {/* Audit Scope Cell Removed */}
                                    <td className="px-6 py-4 text-slate-500" suppressHydrationWarning>{new Date(team.created_at || team.created || Date.now()).toLocaleDateString()}</td>

                                    {userRole !== 'Member' && (
                                        <td className="px-6 py-4 text-right relative action-menu">
                                            {(role === 'Manager' || role === 'Admin') && (
                                                <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveDropdown(activeDropdown === team.id ? null : team.id);
                                                        }}
                                                        className={`text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-100 rounded ${activeDropdown === team.id ? 'bg-slate-100 text-slate-900' : ''}`}
                                                    >
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </button>
                                                    {activeDropdown === team.id && (
                                                        <div className="absolute right-8 top-8 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right text-left">
                                                            <div className="py-1">
                                                                <button onClick={() => handleAction('edit', team)} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                    <Pencil className="w-3.5 h-3.5 text-slate-400" /> Edit Team
                                                                </button>
                                                                <button onClick={() => handleAction('members', team)} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                    <Users className="w-3.5 h-3.5 text-slate-400" /> Manage Members
                                                                </button>
                                                                <button onClick={() => handleAction('archive', team)} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                    <Archive className="w-3.5 h-3.5 text-slate-400" /> {team.status === 'Archived' ? 'Unarchive' : 'Archive Team'}
                                                                </button>
                                                                {userRole === 'Admin' && (
                                                                    <>
                                                                        <div className="h-px bg-slate-100 my-1"></div>
                                                                        <button onClick={() => handleAction('delete', team)} className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                                                                            <Trash2 className="w-3.5 h-3.5" /> Delete Team
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={userRole === 'Admin' ? "7" : "6"} className="px-6 py-12">
                                    <EmptyState
                                        title="No teams configured"
                                        description="Teams allow you to group members and scope their audit visibility. Decisions made in linked channels will be automatically tracked."
                                        icon={Users}
                                        actionText={userRole === 'Admin' ? "Create New Team" : undefined}
                                        onAction={userRole === 'Admin' ? () => {
                                            setModalConfig({ type: 'create', team: {} });
                                            setCurrentStep(1);
                                            setTeamFormData({ name: '', description: '', type: 'operational', members: [], scopes: [], channels: [] });
                                        } : undefined}
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {/* Edit / Create Modal */}
            <Modal
                isOpen={modalConfig.type === 'edit' || modalConfig.type === 'create'}
                onClose={() => setModalConfig({ type: null, team: null })}
                title={modalConfig.type === 'create' ? `Create New Team (Step ${currentStep}/3)` : `Edit ${modalConfig.team?.name}`}
                maxWidth={modalConfig.type === 'create' ? "max-w-2xl" : "max-w-lg"}
            >
                {modalConfig.type === 'create' ? (
                    <div className="space-y-6">
                        {/* Step Indicator */}
                        <div className="flex items-center justify-between px-2 mb-4">
                            <div className={`h-1 flex-1 rounded-full ${currentStep >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                            <div className="w-2"></div>
                            <div className={`h-1 flex-1 rounded-full ${currentStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                            <div className="w-2"></div>
                            <div className={`h-1 flex-1 rounded-full ${currentStep >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                        </div>

                        {/* Step 1: Basic Info */}
                        {currentStep === 1 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name</label>
                                    <input
                                        type="text"
                                        value={teamFormData.name}
                                        onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                                        placeholder="e.g. Finance & Legal"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Team Type</label>
                                    <div className="relative">
                                        {dropdownState.type && <div className="fixed inset-0 z-10" onClick={() => setDropdownState({ ...dropdownState, type: false })} />}
                                        <button
                                            type="button"
                                            onClick={() => setDropdownState({ ...dropdownState, type: !dropdownState.type })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        >
                                            <span className="capitalize">{teamFormData.type}</span>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownState.type ? 'rotate-180' : ''}`} />
                                        </button>

                                        {dropdownState.type && (
                                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-200">
                                                {['operational', 'governance'].map((type) => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => {
                                                            setTeamFormData({ ...teamFormData, type });
                                                            setDropdownState({ ...dropdownState, type: false });
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between capitalize transition-colors ${teamFormData.type === type ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                                                    >
                                                        {type}
                                                        {teamFormData.type === type && <Check className="w-4 h-4" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                                    <textarea
                                        value={teamFormData.description}
                                        onChange={(e) => setTeamFormData({ ...teamFormData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-24"
                                        placeholder="Briefly describe the team's purpose..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Members & Scopes */}
                        {currentStep === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-semibold text-slate-700">Add Members</label>
                                        <span className="text-[10px] text-slate-400">{teamFormData.members.length} selected</span>
                                    </div>
                                    <div className="relative">
                                        {dropdownState.addUser && <div className="fixed inset-0 z-10" onClick={() => setDropdownState({ ...dropdownState, addUser: false })} />}
                                        <button
                                            type="button"
                                            onClick={() => setDropdownState({ ...dropdownState, addUser: !dropdownState.addUser })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white hover:bg-slate-50 transition-colors"
                                        >
                                            <span className="text-slate-500">Select a user to add...</span>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownState.addUser ? 'rotate-180' : ''}`} />
                                        </button>

                                        {dropdownState.addUser && (
                                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto">
                                                {availableUsers.filter(u => !teamFormData.members.find(m => m.id === u.id)).length === 0 ? (
                                                    <div className="px-3 py-2 text-xs text-slate-400 text-center">No more users to add</div>
                                                ) : (
                                                    availableUsers
                                                        .filter(u => !teamFormData.members.find(m => m.id === u.id))
                                                        .map(u => (
                                                            <button
                                                                key={u.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setTeamFormData({
                                                                        ...teamFormData,
                                                                        members: [...teamFormData.members, { ...u, role: 'Member' }]
                                                                    });
                                                                    setDropdownState({ ...dropdownState, addUser: false });
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between text-slate-700 transition-colors"
                                                            >
                                                                <span>{u.name} <span className="text-slate-400 text-xs">({u.email})</span></span>
                                                                <Plus className="w-3.5 h-3.5 text-slate-400" />
                                                            </button>
                                                        ))
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border border-slate-200 rounded-md max-h-32 overflow-y-auto bg-slate-50 min-h-[80px] p-2 space-y-1">
                                        {teamFormData.members.length === 0 ? (
                                            <p className="text-[11px] text-slate-400 text-center py-4">No members added yet.</p>
                                        ) : teamFormData.members.map(member => (
                                            <div key={member.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-1">
                                                <span>{member.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        {dropdownState.memberRole === member.id && <div className="fixed inset-0 z-30" onClick={() => setDropdownState({ ...dropdownState, memberRole: null })} />}
                                                        <button
                                                            type="button"
                                                            onClick={() => setDropdownState({ ...dropdownState, memberRole: dropdownState.memberRole === member.id ? null : member.id })}
                                                            className="text-[10px] py-0.5 px-2 border border-slate-200 rounded flex items-center gap-1 hover:bg-slate-50 bg-white transition-colors"
                                                        >
                                                            {member.role}
                                                            <ChevronDown className="w-3 h-3 text-slate-400" />
                                                        </button>
                                                        {dropdownState.memberRole === member.id && (
                                                            <div className="absolute right-0 top-full mt-1 w-24 bg-white border border-slate-200 rounded shadow-lg z-40 py-1 animate-in fade-in zoom-in-95 duration-200">
                                                                {['Member', 'Manager'].map(role => (
                                                                    <button
                                                                        key={role}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setTeamFormData({
                                                                                ...teamFormData,
                                                                                members: teamFormData.members.map(m => m.id === member.id ? { ...m, role } : m)
                                                                            });
                                                                            setDropdownState({ ...dropdownState, memberRole: null });
                                                                        }}
                                                                        className={`w-full text-left px-2 py-1 text-[10px] hover:bg-slate-50 flex justify-between items-center transition-colors ${member.role === role ? 'text-blue-600 bg-blue-50' : 'text-slate-700'}`}
                                                                    >
                                                                        {role}
                                                                        {member.role === role && <Check className="w-3 h-3" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => setTeamFormData({ ...teamFormData, members: teamFormData.members.filter(m => m.id !== member.id) })}
                                                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-xs font-semibold text-slate-700">Manager Scope</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {SCOPES_CONFIG.map((scope, idx) => (
                                            <label key={idx} className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${teamFormData.scopes.includes(scope.title) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    checked={teamFormData.scopes.includes(scope.title)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setTeamFormData({ ...teamFormData, scopes: [...teamFormData.scopes, scope.title] });
                                                        else setTeamFormData({ ...teamFormData, scopes: teamFormData.scopes.filter(s => s !== scope.title) });
                                                    }}
                                                />
                                                <div>
                                                    <div className="text-[11px] font-bold text-slate-900">{scope.title}</div>
                                                    <div className="text-[9px] text-slate-500 leading-tight">{scope.desc}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Link Channels */}
                        {currentStep === 3 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <p className="text-xs text-slate-500">Select channels to link to this team. Decisions made in these channels will be audited.</p>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto border border-slate-200 rounded-md">
                                    {availableChannels.length === 0 ? (
                                        <p className="text-xs text-center text-slate-400 py-4">No available public channels found.</p>
                                    ) : availableChannels.map(channel => (
                                        <label key={channel.id} className={`flex items-center justify-between p-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 ${teamFormData.channels.includes(channel.id) ? 'bg-blue-50/50' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    checked={teamFormData.channels.includes(channel.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setTeamFormData({ ...teamFormData, channels: [...teamFormData.channels, channel.id] });
                                                        else setTeamFormData({ ...teamFormData, channels: teamFormData.channels.filter(id => id !== channel.id) });
                                                    }}
                                                />
                                                <div>
                                                    <div className="text-xs font-bold text-slate-900">{channel.name}</div>
                                                    <div className="text-[10px] text-slate-500 capitalize">{channel.platform} • Public Channel</div>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between pt-4 border-t border-slate-100">
                            <div className="flex gap-2">
                                {currentStep > 1 ? (
                                    <Button variant="ghost" onClick={() => setCurrentStep(curr => curr - 1)}>Back</Button>
                                ) : (
                                    <Button variant="ghost" onClick={() => setModalConfig({ type: null, team: null })}>Cancel</Button>
                                )}
                            </div>

                            <div className="flex gap-2">
                                {currentStep < 3 ? (
                                    <Button variant="primary" onClick={() => setCurrentStep(curr => curr + 1)} disabled={currentStep === 1 && !teamFormData.name}>Next Step</Button>
                                ) : (
                                    <Button variant="primary" onClick={async () => {
                                        try {
                                            const res = await fetch('/api/teams', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    name: teamFormData.name,
                                                    description: teamFormData.description,
                                                    type: teamFormData.type,
                                                    members: teamFormData.members,
                                                    channels: teamFormData.channels,
                                                    scopes: teamFormData.scopes
                                                })
                                            });

                                            if (res.ok) {
                                                const { team: newTeam } = await res.json();
                                                const viewTeam = {
                                                    ...newTeam,
                                                    members: 0,
                                                    channels: 0,
                                                    scopes: teamFormData.scopes, // scopes not saved to DB yet
                                                    status: 'Active',
                                                    created_at: newTeam.created_at
                                                };
                                                mutateTeams({ ...teamsData, teams: [viewTeam, ...teams] }, false);
                                                setModalConfig({ type: null, team: null });
                                            }
                                        } catch (e) {
                                            console.error("Failed to create team", e);
                                            alert("Error creating team");
                                        }
                                    }}>Create Team</Button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name</label>
                            <input type="text" defaultValue={modalConfig.team?.name} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="e.g. Finance & Legal" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                            <textarea defaultValue={modalConfig.team?.description} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm h-24" placeholder="Briefly describe the team's purpose..." />
                        </div>
                        <div className="flex justify-end pt-4 gap-2">
                            <Button variant="ghost" onClick={() => setModalConfig({ type: null, team: null })}>Cancel</Button>
                            <Button variant="primary" onClick={() => setModalConfig({ type: null, team: null })}>
                                Save Changes
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Manage Members Modal */}
            <Modal
                isOpen={modalConfig.type === 'members'}
                onClose={() => setModalConfig({ type: null, team: null })}
                title={`Members: ${modalConfig.team?.name}`}
            >
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">Manage Members</h3>
                    <p className="text-xs text-slate-500 mb-6">
                        Detailed member management, including role assignments and removals, is available in the Team Details page.
                    </p>
                    <div className="flex justify-center gap-3">
                        <Button variant="ghost" onClick={() => setModalConfig({ type: null, team: null })}>Cancel</Button>
                        <Link href={`/teams/${modalConfig.team?.id}`}>
                            <Button variant="primary">Go to Team Details</Button>
                        </Link>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={modalConfig.type === 'delete'}
                onClose={() => setModalConfig({ type: null, team: null })}
                title="Delete Team"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <div className="bg-rose-50 text-rose-800 p-3 rounded-lg text-sm border border-rose-100">
                        Warning: This action cannot be undone. All channels and data associated with this team will be permanently deleted.
                    </div>
                    <p className="text-sm text-slate-600">
                        Are you sure you want to delete <strong>{modalConfig.team?.name}</strong>?
                    </p>
                    <div className="flex justify-end pt-4 gap-2">
                        <Button variant="secondary" onClick={() => setModalConfig({ type: null, team: null })}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDelete}>Delete Team</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default TeamsList;
