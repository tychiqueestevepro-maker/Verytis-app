'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { Plus, Upload, MoreVertical, MoreHorizontal, Pencil, Key, Ban, Trash2, Mail, Shield, Hash, FileText, Download, Users, Search, Clock, CheckCircle, XCircle, Slack as SlackIcon, ChevronDown, Check, X, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Card, Button, StatusBadge, Modal, EmptyState } from '../ui';
import { SCOPES_CONFIG } from '@/lib/constants';

const UsersAndRoles = () => {
    const [teams, setTeams] = useState([]); // Teams for manager assignment
    const [dropdownState, setDropdownState] = useState({ editRole: false, editTeam: false, inviteRole: false, inviteTeam: false });
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [modalConfig, setModalConfig] = useState({ type: null, user: null, inviteStatus: 'idle' });
    const [inviteFormData, setInviteFormData] = useState({ name: '', email: '', role: 'member', teamId: '', scopes: [] });
    const [editFormData, setEditFormData] = useState({ id: '', name: '', role: '', teamId: '', scopes: [] });
    const [currentPage, setCurrentPage] = useState(1);

    // New State for Filtering & Tabs
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'pending'

    const itemsPerPage = 20;

    // SWR Fetcher
    const fetcher = (url) => fetch(url).then(r => r.json());

    // Fetch Users with SWR (auto-caching, revalidation)
    const { data: usersData, error: usersError, isLoading: isLoadingUsers, mutate: mutateUsers } = useSWR('/api/users', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 10000, // Cache for 10s
    });

    const users = usersData?.users || [];
    const isLoading = isLoadingUsers;

    // Fetch Teams
    useEffect(() => {
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        try {
            const res = await fetch('/api/teams');
            if (res.ok) {
                const data = await res.json();
                setTeams(data.teams || []);
            }
        } catch (error) {
            console.error('Failed to fetch teams:', error);
        }
    };

    const fetchUsers = () => {
        mutateUsers(); // Trigger SWR revalidation
    };

    // --- Search & Filter Logic ---
    const processedUsers = useMemo(() => {
        let filtered = users;

        // 1. Tab Filtering (Active vs Pending)
        if (activeTab === 'pending') {
            filtered = filtered.filter(u => u.status === 'pending' || u.status === 'invited');
        } else {
            filtered = filtered.filter(u => u.status !== 'pending' && u.status !== 'invited');
        }

        // 2. Search Filtering
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(u =>
                u.name.toLowerCase().includes(query) ||
                u.email.toLowerCase().includes(query)
            );
        }

        // 3. Sorting: Admin > Manager > Member
        const roleOrder = { 'admin': 1, 'manager': 2, 'member': 3 };
        return filtered.sort((a, b) => {
            const roleA = roleOrder[a.role?.toLowerCase()] || 4;
            const roleB = roleOrder[b.role?.toLowerCase()] || 4;
            return roleA - roleB;
        });

    }, [users, activeTab, searchQuery]);

    // Pagination logic
    const totalPages = Math.ceil(processedUsers.length / itemsPerPage);
    const paginatedUsers = processedUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

    const handleAction = (type, user) => {
        setActiveDropdown(null);
        if (type === 'edit') {
            setEditFormData({
                id: user.id || '',
                name: user.name || '',
                role: user.role?.toLowerCase() || 'member',
                teamId: user.managedTeams?.[0]?.id || '', // Pre-fill team if manager
                scopes: user.scopes || [] // Pre-fill scopes
            });
        }
        setModalConfig({ type, user });
    };

    // Handlers using API
    const handleUpdateUser = async () => {
        const { id, name, role, teamId, scopes } = editFormData;
        const originalRole = modalConfig.user?.role?.toLowerCase();

        // Validation: Upgrade to Manager requires Team
        if (originalRole === 'member' && role === 'manager' && !teamId) {
            alert('Please assign a team for the new Manager.');
            return;
        }

        try {
            const res = await fetch(`/api/users/${editFormData.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editFormData.name,
                    role: editFormData.role,
                    teamId: editFormData.role === 'manager' ? editFormData.teamId : undefined,
                    scopes: editFormData.role === 'manager' ? editFormData.scopes : [],
                    // Signal downgrade intent
                    isDowngrade: (originalRole === 'manager' && role === 'member')
                })
            });

            if (res.ok) {
                setModalConfig({ type: null, user: null });
                fetchUsers(); // Refresh list
            } else {
                alert('Failed to update user');
            }
        } catch (e) {
            console.error(e);
            alert('Error updating user');
        }
    };

    const handleDeactivate = async () => {
        const newStatus = modalConfig.user.status === 'Inactive' ? 'Active' : 'Inactive';
        try {
            const res = await fetch(`/api/users/${modalConfig.user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                fetchUsers();
                setModalConfig({ type: null, user: null });
            }
        } catch (e) { console.error(e); }
    };

    const handleDelete = async () => {
        try {
            const res = await fetch(`/api/users/${modalConfig.user.id}`, { method: 'DELETE' });
            if (res.ok) {
                mutateUsers(); // Updated from fetchUsers to match SWR pattern
                setModalConfig({ type: null, user: null });
            } else {
                alert('Failed to delete user');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting user');
        }
    };

    const handleCancelInvite = async (userId) => {
        try {
            const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                mutateUsers();
            } else {
                alert('Erreur lors de la suppression de l\'invitation');
            }
        } catch (e) {
            console.error(e);
            alert('Une erreur est survenue');
        }
    };

    const handleInviteUser = async (e) => {
        e.preventDefault();
        const { email, name, role, teamId, scopes } = inviteFormData;

        if (!email) return;

        // Validation: Managers must be assigned to a team
        if (role === 'manager' && !teamId) {
            alert('Please assign a team for the new Manager.');
            return;
        }

        setModalConfig(prev => ({ ...prev, inviteStatus: 'sending' }));

        try {
            // Artificial delay
            await new Promise(resolve => setTimeout(resolve, 800));

            const res = await fetch('/api/users/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    name,
                    role,
                    // Pass team details if manager
                    teamId: role === 'manager' ? teamId : undefined,
                    scopes: role === 'manager' ? scopes : []
                })
            });

            if (res.ok) {
                setModalConfig(prev => ({ ...prev, inviteStatus: 'success' }));
                // Reset form
                setInviteFormData({ name: '', email: '', role: 'member', teamId: '', scopes: [] });
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to invite user');
                setModalConfig(prev => ({ ...prev, inviteStatus: 'idle' }));
            }
        } catch (e) {
            console.error(e);
            alert('Error inviting user');
            setModalConfig(prev => ({ ...prev, inviteStatus: 'idle' }));
        }
    };

    const handleResend = async (user) => {
        try {
            const res = await fetch('/api/users/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    name: user.name,
                    role: user.role
                })
            });

            if (res.ok) {
                // Refresh data to update updatedAt
                mutateUsers();
                // Optional: show a small toast or just assume success if it refreshes
                alert(`Invitation renvoyée avec succès à ${user.email}`);
            } else {
                alert('Erreur lors du renvoi de l\'invitation');
            }
        } catch (e) {
            console.error(e);
            alert('Une erreur est survenue');
        }
    };

    const handleResetPassword = () => {
        // Logic to send reset email via Supabase Auth API (requires backend usually)
        // Placeholder
        alert(`Reset link sent to ${modalConfig.user.email} (simulated)`);
        setModalConfig({ type: null, user: null });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Users & Access</h1>
                    <p className="text-slate-500 mt-1 text-xs font-medium">Manage roles, channel visibility and audit scope.</p>
                </div>
                <div className="flex gap-2">
                    {/* CSV Import Placeholder - keeping simpler for now */}
                    <input
                        type="file"
                        id="csv-upload"
                        className="hidden"
                        accept=".csv"
                        onChange={() => alert("Bulk import via CSV is not yet connected to the backend API.")}
                    />
                    <Button variant="secondary" icon={Upload} onClick={() => document.getElementById('csv-upload').click()}>Import CSV</Button>
                    <Button variant="primary" icon={Plus} onClick={() => setModalConfig({ type: 'invite' })}>Invite User</Button>
                </div>
            </header>

            {/* --- Filters & Search --- */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                {/* Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-lg w-fit">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Active Members
                    </button>
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Pending Invitations
                        {/* Count pending users */}
                        {users.filter(u => u.status === 'pending' || u.status === 'invited').length > 0 && (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px]">
                                {users.filter(u => u.status === 'pending' || u.status === 'invited').length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-400"
                    />
                </div>
            </div>

            <Card className="overflow-visible">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-500">Loading users...</div>
                ) : paginatedUsers.length === 0 ? (
                    <div className="p-8">
                        <EmptyState
                            title={searchQuery ? "No members found" : "Your team is empty"}
                            description={searchQuery ? `We couldn't find any members matching "${searchQuery}". Try a different search term.` : "Start building your organization by inviting your first team member."}
                            icon={Users}
                            actionText="Invite New User"
                            onAction={() => setModalConfig({ type: 'invite' })}
                        />
                    </div>
                ) : (
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 uppercase tracking-wide">User</th>
                                <th className="px-6 py-3 uppercase tracking-wide">Role</th>
                                <th className="px-6 py-3 uppercase tracking-wide">{activeTab === 'pending' ? 'Sent At' : 'Passport ID'}</th>
                                <th className="px-6 py-3 uppercase tracking-wide">Status</th>
                                <th className="px-6 py-3 text-right uppercase tracking-wide">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedUsers.map((user, idx) => (
                                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <Link href={`/users/${user.id}`} className="block">
                                                <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm hover:border-blue-300 hover:text-blue-600 transition-colors">
                                                    {user.initials}
                                                </div>
                                            </Link>
                                            <div>
                                                <Link href={`/users/${user.id}`} className="block font-medium text-slate-900 hover:text-blue-600 transition-colors">
                                                    {user.name}
                                                </Link>
                                                <div className="text-slate-500 text-xs">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : user.role === 'manager' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        {activeTab === 'pending' ? (
                                            <div className="text-slate-500 font-medium">
                                                {user.updatedAt ? new Date(user.updatedAt).toLocaleString('fr-FR', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                }).replace(',', ' à') : '—'}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setModalConfig({ type: 'passport', user });
                                                }}
                                                className="h-8 w-12 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                                                title="View Digital Passport"
                                            >
                                                <MoreHorizontal className="w-5 h-5 text-slate-500" />
                                            </button>
                                        )}
                                    </td>

                                    <td className="px-6 py-3.5">
                                        {activeTab === 'pending' ? (
                                            (() => {
                                                const isExpired = user.updatedAt && (new Date() - new Date(user.updatedAt)) > 2 * 60 * 60 * 1000;
                                                return isExpired ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                                        <XCircle className="w-3 h-3" /> Invalid Invitation
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                        <Clock className="w-3 h-3" /> Invitation Sent
                                                    </span>
                                                );
                                            })()
                                        ) : (
                                            <StatusBadge status={user.status} />
                                        )}
                                    </td>
                                    <td className="px-6 py-3.5 text-right relative action-menu">
                                        {activeTab === 'pending' ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleResend(user);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm shadow-blue-200"
                                                >
                                                    <Mail className="w-3.5 h-3.5" /> Renvoyer
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Voulez-vous vraiment supprimer l'invitation pour ${user.email} ?`)) {
                                                            handleCancelInvite(user.id);
                                                        }
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                                    title="Supprimer l'invitation"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDropdown(activeDropdown === user.id ? null : user.id);
                                                    }}
                                                    className={`h-8 w-8 flex items-center justify-center rounded transition-colors ${activeDropdown === user.id ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {activeDropdown === user.id && (
                                                    <div className={`absolute right-8 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-200 ${idx >= paginatedUsers.length - 2 ? 'bottom-8 origin-bottom-right' : 'top-8 origin-top-right'}`}>
                                                        <div className="py-1">
                                                            <button onClick={() => setModalConfig({ type: 'passport', user })} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                <Shield className="w-3.5 h-3.5 text-slate-400" /> Check Passport
                                                            </button>
                                                            <button onClick={() => handleAction('edit', user)} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                <Pencil className="w-3.5 h-3.5 text-slate-400" /> Edit User
                                                            </button>
                                                            <button onClick={() => handleAction('reset', user)} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                <Key className="w-3.5 h-3.5 text-slate-400" /> Reset Password
                                                            </button>
                                                            <div className="h-px bg-slate-100 my-1"></div>
                                                            <button onClick={() => handleAction('deactivate', user)} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                <Ban className="w-3.5 h-3.5 text-slate-400" /> {user.status === 'Inactive' ? 'Activate User' : 'Deactivate User'}
                                                            </button>
                                                            <button onClick={() => handleAction('delete', user)} className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                                                                <Trash2 className="w-3.5 h-3.5" /> Delete User
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            {/* Edit User Modal */}
            <Modal
                isOpen={modalConfig.type === 'edit'}
                onClose={() => setModalConfig({ type: null, user: null })}
                title={`Edit User: ${modalConfig.user?.name}`}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (Read Only)</label>
                        <input type="email" value={modalConfig.user?.email} disabled className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-slate-100 text-slate-500 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                        <div className="relative">
                            {dropdownState.editRole && <div className="fixed inset-0 z-10" onClick={() => setDropdownState({ ...dropdownState, editRole: false })} />}
                            <button
                                onClick={() => setDropdownState({ ...dropdownState, editRole: !dropdownState.editRole })}
                                className="w-full bg-white border border-slate-300 text-slate-700 text-sm rounded-md px-3 py-2 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            >
                                <span className="capitalize">{editFormData.role}</span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownState.editRole ? 'rotate-180' : ''}`} />
                            </button>
                            {dropdownState.editRole && (
                                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto">
                                    {['admin', 'manager', 'member'].map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => {
                                                setEditFormData({ ...editFormData, role });
                                                setDropdownState({ ...dropdownState, editRole: false });
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between capitalize transition-colors ${editFormData.role === role ? 'text-blue-600 bg-blue-50' : 'text-slate-700'}`}
                                        >
                                            {role}
                                            {editFormData.role === role && <Check className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Edit Scopes for Existing Managers */}
                    {editFormData.role === 'manager' && modalConfig.user?.role === 'manager' && (
                        <div className="pt-4 border-t border-slate-100 mt-4">
                            <label className="block text-xs font-bold text-slate-700 mb-2">Update Audit Scopes</label>
                            <div className="grid grid-cols-1 gap-2">
                                {SCOPES_CONFIG.map((scope) => (
                                    <label key={scope.key} className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${editFormData.scopes?.includes(scope.title) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                        <input
                                            type="checkbox"
                                            checked={editFormData.scopes?.includes(scope.title) || false}
                                            onChange={(e) => {
                                                const currentScopes = editFormData.scopes || [];
                                                if (e.target.checked) setEditFormData({ ...editFormData, scopes: [...currentScopes, scope.title] });
                                                else setEditFormData({ ...editFormData, scopes: currentScopes.filter(s => s !== scope.title) });
                                            }}
                                            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <div className="text-[11px] font-bold text-slate-900">{scope.title}</div>
                                            <div className="text-[10px] text-slate-500 leading-tight">{scope.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Downgrade Warning */}
                    {modalConfig.user?.role === 'manager' && editFormData.role === 'member' && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs animate-in fade-in slide-in-from-top-1">
                            <p className="font-bold flex items-center gap-1">
                                <span className="text-lg">⚠️</span> Warning: Removing Manager Rights
                            </p>
                            <p className="mt-1 leading-relaxed">
                                This user currently manages teams. Changing their role to 'Member' will remove them as a lead from their teams.
                            </p>
                            {modalConfig.user?.managedTeams?.length > 0 && (
                                <div className="mt-2 pl-2 border-l-2 border-amber-200">
                                    <p className="font-semibold mb-1">Affected Teams:</p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        {modalConfig.user.managedTeams.map(t => (
                                            <li key={t.id}>{t.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upgrade Logic */}
                    {modalConfig.user?.role === 'member' && editFormData.role === 'manager' && (
                        <div className="pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
                            <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                <label className="block text-xs font-bold text-blue-900 mb-1.5">Assign to Team <span className="text-rose-500">*</span></label>
                                <div className="relative">
                                    {dropdownState.editTeam && <div className="fixed inset-0 z-10" onClick={() => setDropdownState({ ...dropdownState, editTeam: false })} />}
                                    <button
                                        onClick={() => setDropdownState({ ...dropdownState, editTeam: !dropdownState.editTeam })}
                                        className="w-full bg-white border border-blue-200 text-slate-700 text-sm rounded-md px-3 py-2 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                                    >
                                        <span className="truncate">{teams.find(t => t.id === editFormData.teamId)?.name || 'Select a team...'}</span>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownState.editTeam ? 'rotate-180' : ''}`} />
                                    </button>
                                    {dropdownState.editTeam && (
                                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto">
                                            {teams.map((team) => (
                                                <button
                                                    key={team.id}
                                                    onClick={() => {
                                                        setEditFormData({ ...editFormData, teamId: team.id });
                                                        setDropdownState({ ...dropdownState, editTeam: false });
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between transition-colors ${editFormData.teamId === team.id ? 'text-blue-600 bg-blue-50' : 'text-slate-700'}`}
                                                >
                                                    {team.name}
                                                    {editFormData.teamId === team.id && <Check className="w-4 h-4" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-blue-600 mt-1.5">Managers must be assigned to a team.</p>

                                <div className="mt-4 border-t border-blue-200 pt-3">
                                    <label className="block text-xs font-bold text-blue-900 mb-2">Assign Audit Scopes</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {SCOPES_CONFIG.map((scope) => (
                                            <label key={scope.key} className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${editFormData.scopes?.includes(scope.title) ? 'bg-white border-blue-300 shadow-sm' : 'bg-white/50 border-blue-200 hover:bg-white'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={editFormData.scopes?.includes(scope.title) || false}
                                                    onChange={(e) => {
                                                        const currentScopes = editFormData.scopes || [];
                                                        if (e.target.checked) setEditFormData({ ...editFormData, scopes: [...currentScopes, scope.title] });
                                                        else setEditFormData({ ...editFormData, scopes: currentScopes.filter(s => s !== scope.title) });
                                                    }}
                                                    className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div>
                                                    <div className="text-[11px] font-bold text-blue-900">{scope.title}</div>
                                                    <div className="text-[10px] text-blue-700/70 leading-tight">{scope.desc}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 gap-2">
                        <Button variant="ghost" onClick={() => setModalConfig({ type: null, user: null })}>Cancel</Button>
                        <Button variant="primary" onClick={handleUpdateUser} className={editFormData.role === 'member' && modalConfig.user?.role === 'manager' ? '!bg-amber-600 hover:!bg-amber-700' : ''}>
                            {editFormData.role === 'member' && modalConfig.user?.role === 'manager' ? 'Confirm Downgrade' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Invite User Modal */}
            <Modal
                isOpen={modalConfig.type === 'invite'}
                onClose={() => {
                    setModalConfig({ type: null, user: null });
                    // specific for invite modal to reset state
                    if (modalConfig.inviteStatus) {
                        setModalConfig(prev => ({ ...prev, inviteStatus: 'idle' }));
                    }
                }}
                title={modalConfig.inviteStatus === 'success' ? 'Invitation Sent' : 'Invite New User'}
                maxWidth="max-w-md"
            >
                {modalConfig.inviteStatus === 'success' ? (
                    <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-3xl">✨</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Success!</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
                                An invitation email has been sent to <strong>{document.getElementById('invite-email')?.value}</strong>.
                            </p>
                        </div>
                        <div className="pt-4">
                            <Button variant="primary" onClick={() => {
                                setModalConfig({ type: null, user: null });
                                fetchUsers();
                            }}>Done</Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleInviteUser} className="space-y-5">
                        <div className="flex justify-center -mt-2 mb-6">
                            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center ring-4 ring-blue-50/50">
                                <Mail className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Users className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        placeholder="John Doe"
                                        value={inviteFormData.name}
                                        onChange={(e) => setInviteFormData({ ...inviteFormData, name: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        placeholder="name@company.com"
                                        value={inviteFormData.email}
                                        onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Assign Role</label>
                                <div className="relative">
                                    {dropdownState.inviteRole && <div className="fixed inset-0 z-10" onClick={() => setDropdownState({ ...dropdownState, inviteRole: false })} />}
                                    <button
                                        type="button"
                                        onClick={() => setDropdownState({ ...dropdownState, inviteRole: !dropdownState.inviteRole })}
                                        className="w-full pl-3 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm flex items-center justify-between focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Key className="w-4 h-4 text-slate-400" />
                                            <span className="capitalize">{inviteFormData.role}</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownState.inviteRole ? 'rotate-180' : ''}`} />
                                    </button>

                                    {dropdownState.inviteRole && (
                                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                            {[
                                                { value: 'member', label: 'Member', desc: 'Standard Access' },
                                                { value: 'manager', label: 'Manager', desc: 'Can manage teams' },
                                                { value: 'admin', label: 'Admin', desc: 'Full Access' }
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setInviteFormData({ ...inviteFormData, role: option.value });
                                                        setDropdownState({ ...dropdownState, inviteRole: false });
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between transition-colors ${inviteFormData.role === option.value ? 'bg-blue-50' : ''}`}
                                                >
                                                    <div>
                                                        <div className={`font-medium ${inviteFormData.role === option.value ? 'text-blue-700' : 'text-slate-700'}`}>{option.label}</div>
                                                        <div className="text-[10px] text-slate-500">{option.desc}</div>
                                                    </div>
                                                    {inviteFormData.role === option.value && <Check className="w-4 h-4 text-blue-600" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Manager Specific Fields */}
                            {inviteFormData.role === 'manager' && (
                                <div className="space-y-4 pt-4 mt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className="w-4 h-4 text-blue-600" />
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Manager Assignment</h4>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assign to Team <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            {dropdownState.inviteTeam && <div className="fixed inset-0 z-10" onClick={() => setDropdownState({ ...dropdownState, inviteTeam: false })} />}
                                            <button
                                                type="button"
                                                onClick={() => setDropdownState({ ...dropdownState, inviteTeam: !dropdownState.inviteTeam })}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-left flex items-center justify-between focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                                            >
                                                <span className="truncate">{teams.find(t => t.id === inviteFormData.teamId)?.name || 'Select a team...'}</span>
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownState.inviteTeam ? 'rotate-180' : ''}`} />
                                            </button>

                                            {dropdownState.inviteTeam && (
                                                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto">
                                                    {teams.map((team) => (
                                                        <button
                                                            key={team.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setInviteFormData({ ...inviteFormData, teamId: team.id });
                                                                setDropdownState({ ...dropdownState, inviteTeam: false });
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between transition-colors ${inviteFormData.teamId === team.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                                                        >
                                                            {team.name}
                                                            {inviteFormData.teamId === team.id && <Check className="w-4 h-4 text-blue-600" />}
                                                        </button>
                                                    ))}
                                                    {teams.length === 0 && (
                                                        <div className="px-3 py-2 text-sm text-slate-500 italic">No teams available</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {teams.length === 0 && <p className="text-[10px] text-amber-600 mt-1">No teams available. Create a team first.</p>}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-2">Audit Scope</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {SCOPES_CONFIG.map((scope) => (
                                                <label key={scope.key} className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${inviteFormData.scopes.includes(scope.title) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={inviteFormData.scopes.includes(scope.title)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setInviteFormData({ ...inviteFormData, scopes: [...inviteFormData.scopes, scope.title] });
                                                            else setInviteFormData({ ...inviteFormData, scopes: inviteFormData.scopes.filter(s => s !== scope.title) });
                                                        }}
                                                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <div>
                                                        <div className="text-[11px] font-bold text-slate-900">{scope.title}</div>
                                                        <div className="text-[10px] text-slate-500 leading-tight">{scope.desc}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <Button
                                variant="primary"
                                type="submit" // Trigger form submit
                                className="w-full py-2.5 text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
                                onClick={() => { }} // Controlled by form
                            >
                                {modalConfig.inviteStatus === 'sending' ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending Invite...
                                    </span>
                                ) : 'Send Invitation Email'}
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Reset Password Modal */}
            <Modal
                isOpen={modalConfig.type === 'reset'}
                onClose={() => setModalConfig({ type: null, user: null })}
                title="Reset Password"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Are you sure you want to send a password reset link to <strong>{modalConfig.user?.email}</strong>?
                    </p>
                    <div className="flex justify-end pt-4 gap-2">
                        <Button variant="secondary" onClick={() => setModalConfig({ type: null, user: null })}>Cancel</Button>
                        <Button variant="primary" onClick={handleResetPassword}>Send Reset Link</Button>
                    </div>
                </div>
            </Modal>

            {/* Deactivate User Modal */}
            <Modal
                isOpen={modalConfig.type === 'deactivate'}
                onClose={() => setModalConfig({ type: null, user: null })}
                title={modalConfig.user?.status === 'Inactive' ? 'Activate User' : 'Deactivate User'}
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        {modalConfig.user?.status === 'Inactive'
                            ? <span>Are you sure you want to reactivate access for <strong>{modalConfig.user?.name}</strong>?</span>
                            : <span>Are you sure you want to deactivate <strong>{modalConfig.user?.name}</strong>? They will immediately lose access to the platform.</span>
                        }
                    </p>
                    <div className="flex justify-end pt-4 gap-2">
                        <Button variant="secondary" onClick={() => setModalConfig({ type: null, user: null })}>Cancel</Button>
                        <Button variant={modalConfig.user?.status === 'Inactive' ? 'primary' : 'danger'} onClick={handleDeactivate}>
                            {modalConfig.user?.status === 'Inactive' ? 'Activate User' : 'Deactivate User'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete User Modal */}
            <Modal
                isOpen={modalConfig.type === 'delete'}
                onClose={() => setModalConfig({ type: null, user: null })}
                title="Delete User"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <div className="bg-rose-50 text-rose-800 p-3 rounded-lg text-sm border border-rose-100">
                        Warning: This action cannot be undone. All audit history associated with this user will be anonymized.
                    </div>
                    <p className="text-sm text-slate-600">
                        Are you sure you want to permanently delete <strong>{modalConfig.user?.name}</strong>?
                    </p>
                    <div className="flex justify-end pt-4 gap-2">
                        <Button variant="secondary" onClick={() => setModalConfig({ type: null, user: null })}>Cancel</Button>
                        <Button variant="danger" onClick={handleDelete}>Delete User</Button>
                    </div>
                </div>
            </Modal>

            {/* Passport Details Modal */}
            <Modal
                isOpen={modalConfig.type === 'passport'}
                onClose={() => setModalConfig({ type: null, user: null })}
                title="Digital ID Passport"
                maxWidth="max-w-md"
            >
                <div className="space-y-6">
                    {/* User Header */}
                    <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                        <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600">
                            {modalConfig.user?.initials}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{modalConfig.user?.name}</h3>
                            <p className="text-sm text-slate-500">{modalConfig.user?.email}</p>
                            <div className="mt-1 flex items-center gap-2">
                                <StatusBadge status={modalConfig.user?.status} />
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${modalConfig.user?.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                    {modalConfig.user?.role}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* App Connections List */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Connected Applications</h4>

                        {[
                            { id: 'slack', name: 'Slack', desc: 'Messaging & Alerts', icon: 'https://www.google.com/s2/favicons?domain=slack.com&sz=128' },
                            { id: 'github', name: 'GitHub', desc: 'Version Control', icon: 'https://www.google.com/s2/favicons?domain=github.com&sz=128' },
                            { id: 'trello', name: 'Trello', desc: 'Project Management', icon: 'https://www.google.com/s2/favicons?domain=trello.com&sz=128' }
                        ].map((app) => {
                            // Enhanced connection check (Profile + Connections Table)
                            const isConnected = (app.id === 'slack' && !!modalConfig.user?.slackId) ||
                                !!modalConfig.user?.socialProfiles?.[app.id] ||
                                !!modalConfig.user?.connections?.some(c => c.provider === app.id && (c.status === 'connected' || c.status === 'active'));

                            return (
                                <div key={app.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isConnected ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center p-1">
                                            <img src={app.icon} alt={app.name} className="w-full h-full object-contain" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">{app.name}</div>
                                            <div className="text-xs text-slate-500">{app.desc}</div>
                                        </div>
                                    </div>
                                    <div>
                                        {isConnected ? (
                                            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-50 rounded border border-emerald-100">
                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                                <span className="text-[10px] font-bold text-emerald-700 uppercase">Connected</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded border border-slate-200">
                                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Not Connected</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="pt-2 text-center">
                        <Button variant="ghost" onClick={() => setModalConfig({ type: null, user: null })} className="text-xs text-slate-400 hover:text-slate-600">
                            Close Verification Details
                        </Button>
                    </div>
                </div>
            </Modal>    </div>
    );

};

export default UsersAndRoles;
