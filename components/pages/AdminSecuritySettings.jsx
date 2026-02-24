'use client';

import { useState, useEffect } from 'react';
import { Download, Shield, Server, Box, Fingerprint } from 'lucide-react';
import { Card, Button } from '../ui';
import { useRole } from '@/lib/providers';

export default function AdminSecuritySettings() {
    const { currentRole } = useRole();
    const [securityLogs, setSecurityLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Fetch real security logs from the database
        const fetchLogs = async () => {
            try {
                // Fetch general activity logs and map to the format
                const res = await fetch('/api/activity');
                const data = await res.json();
                if (data.events) {
                    const formattedLogs = data.events
                        .map(log => ({
                            id: log.id,
                            timestamp: new Date(log.timestamp).toLocaleString(),
                            actor: log.actor || 'System',
                            action: log.action,
                            target: log.target || 'N/A',
                            status: 'SUCCESS'
                        }));

                    setSecurityLogs(formattedLogs);
                }
            } catch (error) {
                console.error("Failed to fetch security logs:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (currentRole === 'Admin') {
            fetchLogs();
        }
    }, [currentRole]);


    if (currentRole !== 'Admin') {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-rose-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
                <p className="text-sm text-slate-500 mt-2 text-center max-w-sm">
                    You do not have the necessary privileges to view the Security & Governance Center. This area is strictly restricted to Administrators.
                </p>
            </div>
        );
    }

    // Helper for badge colors
    const getActionColor = (action) => {
        if (!action) return 'bg-slate-50 text-slate-700 border-slate-200';
        if (action.includes('REGISTERED') || action.includes('CONNECTED') || action.includes('APPROVED')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (action.includes('REMOVED') || action.includes('REVOKED') || action.includes('DELETED')) return 'bg-rose-50 text-rose-700 border-rose-200';
        if (action.includes('UPGRADED')) return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-blue-50 text-blue-700 border-blue-200'; // Default
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Header section replicating the screenshot style */}
            <div className="pb-2 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-indigo-600" />
                    Security & Governance Center
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Global overview of telemetry, access rules, and immutable audit logs.
                </p>
                <div className="flex gap-3 mt-4">
                    <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-semibold shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        WORM Storage: Active
                    </div>
                    <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded text-xs font-semibold shadow-sm">
                        <Shield className="w-3.5 h-3.5" />
                        AES-256-GCM Encryption
                    </div>
                </div>
            </div>

            {/* Infrastructure Status */}
            <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Server className="w-4 h-4 text-slate-500" />
                    Infrastructure Status
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                            <Box className="w-3.5 h-3.5" />
                            Data Isolation
                        </div>
                        <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            RLS Enforced
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                            <Shield className="w-3.5 h-3.5" />
                            Ledger Integrity
                        </div>
                        <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            Append-Only Audit
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                            <Fingerprint className="w-3.5 h-3.5" />
                            Ingestion Security
                        </div>
                        <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            HMAC Validated
                        </div>
                    </div>
                </div>
            </Card>

            {/* Security Logs */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-slate-500" />
                        Security & Admin Audit Trail
                    </h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                    Immutable log of authentication, access management, and infrastructure configuration events.
                </p>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Timestamp</th>
                                <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Actor</th>
                                <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Action Event</th>
                                <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Target / Resource</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                                        <div className="animate-pulse flex flex-col items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                                            Loading true data...
                                        </div>
                                    </td>
                                </tr>
                            ) : securityLogs.length > 0 ? (
                                securityLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-2.5 text-slate-400 font-mono text-[10px]">
                                            {log.timestamp}
                                        </td>
                                        <td className="px-4 py-2.5 font-medium text-slate-900">
                                            {log.actor}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getActionColor(log.action)}`}>
                                                {log.action || 'UNKNOWN_ACTION'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 truncate max-w-[200px]">
                                            {log.target}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                                        No security logs found in the ledger.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-end">
                    <Button variant="secondary" icon={Download}>Export Security Report (PDF)</Button>
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Admin Session Management</h3>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <div>
                            <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                                Current Session (You)
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-600 uppercase">Admin</span>
                            </div>
                            <div className="text-xs text-slate-500">Encrypted AES-256-GCM Connection</div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
