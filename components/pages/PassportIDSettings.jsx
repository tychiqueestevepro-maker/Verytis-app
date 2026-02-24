'use client';

import { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../ui';

import { useRole } from '@/lib/providers';

const PassportIDSettings = () => {
    const { currentUser, setCurrentUser } = useRole();
    const [passportStatus, setPassportStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Manual Linking State
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [slackEmailInput, setSlackEmailInput] = useState('');
    const [linkStatus, setLinkStatus] = useState('idle'); // idle, sending, success, error

    // Sync Slack info to Context when status is loaded and connected
    useEffect(() => {
        if (passportStatus?.connections?.slack?.connected && passportStatus.connections.slack.slackId) {
            const slackId = passportStatus.connections.slack.slackId;
            const slackEmail = passportStatus.connections.slack.email;

            // Only update if not already set to avoid infinite loops
            if (currentUser.slackId !== slackId) {
                console.log("Syncing Slack ID to Context:", slackId);
                setCurrentUser({
                    ...currentUser,
                    slackId: slackId,
                    slackEmail: slackEmail
                });
            }
        }

        // Sync GitHub
        if (passportStatus?.connections?.github?.connected) {
            // For now just logging, can extend context if needed
            // console.log("GitHub Connected:", passportStatus.connections.github.username);
        }
    }, [passportStatus, currentUser, setCurrentUser]);

    // Listener for Popup Message
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data.type === 'GITHUB_LINKED') {
                console.log("GitHub Linked!", event.data.user);
                // Aggressive refresh pattern
                fetchPassportStatus();
                setTimeout(fetchPassportStatus, 1000);
                setTimeout(fetchPassportStatus, 3000);
            }
            if (event.data.type === 'TRELLO_LINKED') {
                console.log("Trello Linked!", event.data.user);
                // Aggressive refresh pattern
                fetchPassportStatus();
                setTimeout(fetchPassportStatus, 1000);
                setTimeout(fetchPassportStatus, 3000);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [currentUser]);

    useEffect(() => {
        if (currentUser?.id) {
            fetchPassportStatus();
        }
    }, [currentUser?.id]);

    const fetchPassportStatus = async () => {
        if (!currentUser?.id) return;

        setIsLoading(true);
        setError(null);
        try {
            // Pass the current DEV user ID to the API + cache buster
            const res = await fetch(`/api/user/passport-status?userId=${currentUser.id}&t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                setPassportStatus(data);
            } else {
                throw new Error('Failed to fetch passport status');
            }
        } catch (e) {
            console.error('Error fetching passport status:', e);
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const integrations = [
        {
            id: 'slack',
            name: 'Slack',
            logo: 'https://www.google.com/s2/favicons?domain=slack.com&sz=128',
            description: 'Connect your Slack workspace for real-time collaboration tracking'
        },
        {
            id: 'github',
            name: 'GitHub',
            logo: 'https://www.google.com/s2/favicons?domain=github.com&sz=128',
            description: 'Connect your GitHub account for code repository tracking'
        },
        {
            id: 'trello',
            name: 'Trello',
            logo: 'https://www.google.com/s2/favicons?domain=trello.com&sz=128',
            description: 'Connect your Trello account for project management tracking'
        }
    ];

    if (isLoading && !passportStatus) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-blue-600" />
                            Passport ID
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Checking connection status...</p>
                    </div>
                </div>
                <div className="animate-pulse space-y-4">
                    {[1, 2].map(i => <div key={i} className="h-24 bg-slate-100 rounded-lg"></div>)}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Passport ID
                </h2>
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                    Error loading passport status: {error}
                </div>
            </div>
        );
    }



    const handleSendLink = async () => {
        if (!slackEmailInput || !slackEmailInput.includes('@')) return;

        setLinkStatus('sending');
        try {
            const res = await fetch('/api/user/link-slack-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    slackEmail: slackEmailInput
                })
            });

            if (res.ok) {
                setLinkStatus('success');
                setTimeout(() => {
                    setShowLinkModal(false);
                    setLinkStatus('idle');
                    setSlackEmailInput('');
                }, 3000);
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send link');
            }
        } catch (e) {
            console.error(e);
            setLinkStatus('error');
        }
    };

    const handleDisconnect = async (provider) => {
        console.log('handleDisconnect called for:', provider);
        if (!confirm(`Are you sure you want to disconnect ${provider}?`)) {
            console.log('User cancelled disconnect');
            return;
        }

        console.log('Proceeding with disconnect...');
        setIsLoading(true);
        try {
            console.log('Calling /api/user/disconnect with:', { userId: currentUser.id, provider });
            const res = await fetch('/api/user/disconnect', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    provider: provider
                })
            });

            console.log('Disconnect response status:', res.status);
            if (res.ok) {
                console.log('Disconnect successful, refreshing status...');
                // Refresh status
                await fetchPassportStatus();
            } else {
                const err = await res.json();
                console.error('Disconnect failed:', err);
                throw new Error(err.error || 'Failed to disconnect');
            }
        } catch (e) {
            console.error('Disconnect error:', e);
            alert('Failed to disconnect: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
            {/* LINK MODAL */}
            {showLinkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 pointer-events-auto" onClick={() => setShowLinkModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-[440px] overflow-hidden ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/30">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">Link Slack Account</h3>
                                <p className="text-xs text-slate-500 mt-1">Connect your workspace identity to Verytis.</p>
                            </div>
                            <button
                                onClick={() => setShowLinkModal(false)}
                                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors -mr-2 -mt-2"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {linkStatus === 'success' ? (
                                <div className="text-center py-6 space-y-4 animate-in zoom-in-95">
                                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-900">Check your inbox!</h4>
                                        <p className="text-sm text-slate-500 mt-2 max-w-[280px] mx-auto leading-relaxed">
                                            We sent a verification link to <br />
                                            <strong className="text-slate-800">{slackEmailInput}</strong>
                                        </p>
                                    </div>
                                    <div className="pt-2">
                                        <p className="text-xs text-slate-400">Click the link in the email to complete setup.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            Enter the email address associated with your Slack account. We'll send a secure magic link to verify ownership.
                                        </p>

                                        <div className="space-y-2">
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Slack Email Address</label>
                                            <div className="relative">
                                                <input
                                                    type="email"
                                                    value={slackEmailInput}
                                                    onChange={(e) => setSlackEmailInput(e.target.value)}
                                                    placeholder="name@company.com"
                                                    autoFocus
                                                    className={`w-full p-3 pl-4 border rounded-xl text-sm outline-none transition-all shadow-sm ${linkStatus === 'error'
                                                        ? 'border-rose-300 focus:ring-2 focus:ring-rose-100 bg-rose-50/30 text-rose-900 placeholder:text-rose-300'
                                                        : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400'
                                                        }`}
                                                />
                                            </div>
                                            {linkStatus === 'error' && (
                                                <p className="text-xs text-rose-600 font-medium flex items-center gap-1 animate-in slide-in-from-top-1">
                                                    <XCircle className="w-3 h-3" />
                                                    We couldn't reach that email. Please try again.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Actions */}
                        {linkStatus !== 'success' && (
                            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowLinkModal(false)}
                                    className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendLink}
                                    disabled={!slackEmailInput || linkStatus === 'sending'}
                                    className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                                >
                                    {linkStatus === 'sending' ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Sending Link...
                                        </>
                                    ) : (
                                        'Send Verification Link'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        Passport ID
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Your connection status to external applications
                    </p>
                </div>
                <button
                    onClick={fetchPassportStatus}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Refresh status"
                >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
            </div>

            {/* Info Banner */}
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700 leading-relaxed">
                    <strong>Passport ID</strong> is your unified identity across all connected services.
                    The connections shown below are managed by your organization administrator.
                </p>
            </div>

            {/* Integration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map(integration => {
                    const status = passportStatus?.connections?.[integration.id];
                    const isConnected = status?.connected || false;

                    return (
                        <Card key={integration.id}>
                            <div className="p-5 space-y-4">
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2">
                                            <img
                                                src={integration.logo}
                                                alt={integration.name}
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-sm">{integration.name}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">{integration.description}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Badge */}
                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <span className="text-xs font-medium text-slate-600">Connection Status</span>
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isConnected
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                                        }`}>
                                        {isConnected ? (
                                            <>
                                                <CheckCircle className="w-3 h-3" />
                                                Connected
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="w-3 h-3" />
                                                Not Connected
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Connected Account Info / Manual Connect */}
                                {isConnected ? (
                                    <div className="pt-3 border-t border-slate-50">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Connected Account</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <p className="text-xs font-medium text-slate-700" title={integration.id === 'github' || integration.id === 'trello' ? status.username : status.email}>
                                                    {integration.id === 'github' || integration.id === 'trello' ? `@${status.username}` : status.email}
                                                </p>
                                                {status.lastSync && (
                                                    <span className="text-[10px] text-slate-400">
                                                        Synced: {new Date(status.lastSync).toLocaleString()}
                                                    </span>
                                                )}
                                                {/* Org Membership Status */}
                                                {status.orgName && (
                                                    <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${status.foundInOrg ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {status.foundInOrg ? (
                                                            <>
                                                                <CheckCircle className="w-3 h-3" />
                                                                <span>Found in {status.orgName}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <AlertCircle className="w-3 h-3" />
                                                                <span>Not found in {status.orgName}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                className="text-[10px] text-rose-600 hover:text-rose-700 hover:underline font-medium"
                                                onClick={() => handleDisconnect(integration.id)}
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-3 border-t border-slate-50">
                                        {status?.reason === 'email_mismatch' && (
                                            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md animate-in fade-in zoom-in-95 duration-200">
                                                <p className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                                                    ⚠️ Email Mismatch
                                                </p>
                                                <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                                                    We couldn't automatically find a match for <strong>{currentUser?.email}</strong> in {integration.name}.
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex justify-end">
                                            {integration.id === 'github' ? (
                                                <button
                                                    onClick={() => {
                                                        const width = 600;
                                                        const height = 700;
                                                        const left = (window.screen.width - width) / 2;
                                                        const top = (window.screen.height - height) / 2;
                                                        const url = `/api/auth/github/login?userId=${currentUser.id}`;
                                                        window.open(
                                                            url,
                                                            'GitHubLink',
                                                            `width=${width},height=${height},top=${top},left=${left}`
                                                        );
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition flex items-center gap-2"
                                                >
                                                    <img src="https://www.google.com/s2/favicons?domain=github.com&sz=128" className="w-3 h-3 invert" />
                                                    Connect with GitHub
                                                </button>
                                            ) : integration.id === 'trello' ? (
                                                <button
                                                    onClick={() => {
                                                        const width = 600;
                                                        const height = 700;
                                                        const left = (window.screen.width - width) / 2;
                                                        const top = (window.screen.height - height) / 2;
                                                        const url = `/api/auth/trello/login?userId=${currentUser.id}`;
                                                        window.open(
                                                            url,
                                                            'TrelloLink',
                                                            `width=${width},height=${height},top=${top},left=${left}`
                                                        );
                                                    }}
                                                    className="px-3 py-1.5 bg-[#0079BF] text-white text-xs font-bold rounded-lg hover:bg-[#026AA7] transition flex items-center gap-2"
                                                >
                                                    <img src="https://www.google.com/s2/favicons?domain=trello.com&sz=128" className="w-3 h-3" />
                                                    Connect with Trello
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        console.log("Opening Link Modal");
                                                        setShowLinkModal(true);
                                                    }}
                                                    className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                                                >
                                                    {status?.reason === 'email_mismatch' ? 'Link Account Manually' : 'Connect manually'} &rarr;
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Footer Note */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                    <strong>Note:</strong> To connect or disconnect services, please contact your organization administrator.
                    This view is read-only and reflects the current state of your Passport ID.
                </p>
            </div>

        </div>
    );
};

export default PassportIDSettings;
