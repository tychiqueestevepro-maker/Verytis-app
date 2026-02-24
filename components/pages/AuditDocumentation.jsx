import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Shield, FileText, Slack, Users, CheckCircle, XCircle, UserCheck, Download, Table, FileSpreadsheet, X, Calendar, Search, Filter, Lock, ChevronDown, Check } from 'lucide-react';
import { Card, Button, PlatformIcon, Modal, EmptyState } from '../ui';
import AuditLogo from '../image/LOGO.PNG-ICARE.svg';
import SlackLogo from '../image/Slack Logo 2019.png';

const GET_FAVICON = (domain) => `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`;

const AuditDocumentation = ({ userRole, currentUser: propUser }) => {
    const [reportType, setReportType] = useState('Full Channel Audit');
    const [platform, setPlatform] = useState('Slack');

    // FETCHING STRATEGY: 
    // 1. Load Metadata (Resources/Teams) upfront to populate selectors
    // 2. Load Activity Logs ONLY when generating report or previewing specific resources

    const fetcher = (...args) => fetch(...args).then(res => res.json());

    // SWR Hooks
    const { data: metaData, isLoading: isMetaLoading } = useSWR('/api/audit-metadata', fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
    const { data: usersData, isLoading: isUsersLoading } = useSWR('/api/users', fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });

    // Derived Data
    const realTeams = metaData?.teams || [];
    const availableUsers = usersData?.users || [];

    // Process channels from metadata - Memorized to prevent re-renders
    const realChannels = useMemo(() => {
        const resources = (metaData?.resources || []).map(r => ({
            id: r.external_id || r.id,
            dbId: r.id,
            name: r.name || r.external_id,
            team: r.teams?.name || 'Unassigned',
            teamId: r.team_id,
            platform: r.integrations?.provider || 'Slack'
        }));

        const agents = (metaData?.agents || []).map(a => ({
            id: a.id,
            dbId: a.id,
            name: `AGENT: ${a.name}`,
            team: 'AI Governance',
            teamId: 'ai-gov',
            platform: 'AI Agent'
        }));

        return [...resources, ...agents];
    }, [metaData]);

    // Filter States
    const [selectedChannels, setSelectedChannels] = useState([]); // Array of IDs (dbId)
    const [selectedChannelId, setSelectedChannelId] = useState(''); // Single ID for Member view (deprecated or reused)
    const [selectedTeamId, setSelectedTeamId] = useState(userRole === 'Admin' ? 'all' : '');

    const [dateRange, setDateRange] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [selectedMembers, setSelectedMembers] = useState([]);

    const [exportModal, setExportModal] = useState({ type: null, isOpen: false });
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewEvents, setPreviewEvents] = useState([]); // Store fetched events for preview
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);


    // Custom Dropdown States
    const [dropdownState, setDropdownState] = useState({
        team: false,
        reportType: false,
        dateRange: false,
        csvDelimiter: false,
        xlsFormat: false
    });
    const [csvDelimiter, setCsvDelimiter] = useState('Comma (,)');
    const [xlsFormat, setXlsFormat] = useState('.xlsx (Excel 2007+)');

    // Derived User: Use passed prop
    const currentUser = propUser;

    const hasAuditScope = userRole === 'Admin' || (userRole === 'Manager' && (currentUser?.scopes?.includes('Channel Audit') || currentUser?.scopes?.includes('Documentation Audit')));

    // Reset report type when platform or role changes
    useEffect(() => {
        const isMT = platform === 'Slack';
        const suffix = platform === 'GitHub' ? 'Repo' : platform === 'Trello' ? 'Board' : platform === 'AI Agent' ? 'Agent' : 'Channel';

        // Reset selections when platform changes
        setSelectedChannels([]);
        setPreviewEvents([]);

        // Set Default Report Type based on Platform
        if (userRole === 'Member' || (userRole === 'Manager' && !hasAuditScope)) {
            // Member restricted view
            if (platform === 'GitHub') setReportType('My Activity Repo');
            else if (platform === 'Trello') setReportType('My Activity Board');
            else setReportType('My Activity Channel');
        } else {
            // Admin/Manager default view
            if (platform === 'GitHub') setReportType('Full Repo Audit');
            else if (platform === 'Trello') setReportType('Full Board Audit');
            else setReportType('Full Channel Audit');
        }
    }, [userRole, hasAuditScope, platform]);


    // Compute available teams for the current user
    const availableTeams = (() => {
        if (userRole === 'Admin') return realTeams;
        if (userRole === 'Manager' && currentUser?.teams && currentUser.teams.length > 0) {
            return currentUser.teams;
        }
        return [];
    })();

    // Filter logic for Manager and Admin (with Team selection) - Memorized
    const availableChannels = useMemo(() => {
        const getChannels = () => {
            if (reportType.includes('My Activity') || reportType.includes('Your Activity')) {
                return realChannels;
            }

            if (userRole === 'Admin') {
                if (selectedTeamId === 'all') return realChannels;
                const targetTeamId = selectedTeamId.toString();
                return realChannels.filter(c => c.teamId && c.teamId.toString() === targetTeamId);
            }

            if (userRole === 'Manager') {
                if (selectedTeamId && selectedTeamId !== 'all') {
                    return realChannels.filter(c => c.teamId && c.teamId.toString() === selectedTeamId.toString());
                }
                if (availableTeams.length > 0) {
                    const myTeamIds = new Set(availableTeams.map(t => t.id));
                    return realChannels.filter(c => c.teamId && myTeamIds.has(c.teamId));
                }
                return [];
            }

            return realChannels;
        };

        return getChannels().filter(c => (c.platform || 'Slack').toLowerCase() === platform.toLowerCase());
    }, [realChannels, reportType, userRole, selectedTeamId, availableTeams, platform]);

    // --- NEW: Fetch Events on Demand ---
    const fetchEventsForResources = async (resourceIds) => {
        if (!resourceIds || resourceIds.length === 0) return [];

        setIsPreviewLoading(true);
        let allEvents = [];

        try {
            // Fetch events for each selected resource SEQUENTIALLY or PARALLEL
            // Using Promise.all for speed.
            // API: /api/activity?channelId=<dbId>
            const promises = resourceIds.map(id =>
                fetch(`/api/activity?channelId=${id}`).then(res => res.json())
            );

            const results = await Promise.all(promises);

            results.forEach((data, index) => {
                const resourceId = resourceIds[index];
                const resource = realChannels.find(c => c.dbId === resourceId) || {};

                if (data.events) {
                    const mappedEvents = data.events.map(ev => ({
                        ...ev,
                        channelId: resource.id, // External ID or DB ID
                        channelName: resource.name || ev.resource_id,
                        teamName: resource.team || 'Unassigned',
                        platform: resource.platform // TRUST THE RESOURCE PLATFORM
                    }));
                    allEvents = [...allEvents, ...mappedEvents];
                }
            });

        } catch (error) {
            console.error("Error fetching events:", error);
            // Handle error appropriately (toast, alert)
        } finally {
            setIsPreviewLoading(false);
        }

        return allEvents;
    };

    // Trigger Fetch when selection changes (Debounced or on explicit action? 
    // For now, let's fetch when selection settles to update preview)
    // Trigger Fetch when selection changes OR Report Type changes (to support 'Full' auto-fetch)
    useEffect(() => {
        const fetchTarget = async () => {
            // Logic:
            // 1. If "Targeted", only fetch selectedChannels.
            // 2. If "Full" or "My Activity", fetch ALL availableChannels (if none selected? or merge?).
            //    User expectation: "Full" = All. "Targeted" = Selected.

            let idsToFetch = [];

            const isTargeted = reportType.includes('Targeted');
            const isFull = reportType.includes('Full');
            const isMyActivity = reportType.includes('My Activity') || reportType.includes('Your Activity');

            if (isTargeted) {
                // Strict: Only selected
                idsToFetch = selectedChannels;
            } else if (isFull || isMyActivity || reportType.includes('Decision')) {
                // Broad: If selection exists, respect it? Or default to ALL?
                // "Full Channel Audit" implies ALL channels.
                // However, to keep it performant, maybe we only fetch ALL if selection is EMPTY?
                // User said "Full Channel Audit c'est bon" (existing behavior was selection based).
                // BUT he added "Targeted".
                // So "Full" SHOULD mean ALL.
                if (selectedChannels.length > 0) {
                    idsToFetch = selectedChannels; // Allow user to subset even in Full mode?
                } else {
                    idsToFetch = availableChannels.map(c => c.dbId);
                }
            }

            if (idsToFetch.length > 0) {
                const events = await fetchEventsForResources(idsToFetch);
                setPreviewEvents(events);
            } else {
                setPreviewEvents([]);
            }
        };

        const timer = setTimeout(fetchTarget, 500);
        return () => clearTimeout(timer);
    }, [selectedChannels, platform, reportType, availableChannels]);


    // --- Filter Logic (Applied to Fetched Events) ---
    const filterEvents = (eventsToFilter) => {
        let filtered = eventsToFilter || [];

        // 1. "My Activity" filter
        if (reportType.includes('My Activity') || reportType.includes('Your Activity')) {
            const myEmail = currentUser?.email?.toLowerCase() || '';
            const myName = currentUser?.name?.toLowerCase() || '';
            filtered = filtered.filter(e => {
                const actorLower = (e.actor || '').toLowerCase();
                const emailLower = (e.email || '').toLowerCase();
                return actorLower.includes(myName) || emailLower.includes(myEmail) || actorLower === myEmail;
            });
        }

        // 2. Member Filter
        if (reportType.includes('Member') && !reportType.includes('My Activity') && selectedMembers.length > 0) {
            const targets = new Set(selectedMembers.map(m => m.toLowerCase()));
            selectedMembers.forEach(key => {
                const u = availableUsers.find(user => user.email === key || user.id === key);
                if (u && u.name) targets.add(u.name.toLowerCase());
            });

            filtered = filtered.filter(e => {
                const eEmail = (e.email || '').toLowerCase();
                const eActor = (e.actor || '').toLowerCase();
                return targets.has(eEmail) || targets.has(eActor);
            });
        }

        // 3. Decision-only filter
        if (reportType.includes('Decision')) {
            filtered = filtered.filter(e => e.type === 'decision');
        }

        // 4. Date Filter
        if (dateRange !== 'all') {
            if (dateRange === 'custom') {
                if (startDate) {
                    const start = new Date(startDate);
                    filtered = filtered.filter(e => new Date(e.timestamp) >= start);
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    filtered = filtered.filter(e => new Date(e.timestamp) <= end);
                }
            } else {
                const now = new Date();
                const days = parseInt(dateRange);
                if (!isNaN(days)) {
                    const cutoff = new Date(now.setDate(now.getDate() - days));
                    filtered = filtered.filter(e => new Date(e.timestamp) >= cutoff);
                }
            }
        }

        return filtered;
    };

    // Use filtered preview events for display
    const filteredEvents = filterEvents(previewEvents);


    const handleChannelSelect = (channelId) => {
        // channelId passed here should be the DB ID (dbId)
        if (selectedChannels.includes(channelId)) {
            setSelectedChannels(selectedChannels.filter(c => c !== channelId));
        } else {
            setSelectedChannels([...selectedChannels, channelId]);
        }
    };

    const handleMemberSelect = (memberId) => {
        if (selectedMembers.includes(memberId)) {
            setSelectedMembers(selectedMembers.filter(m => m !== memberId));
        } else {
            setSelectedMembers([...selectedMembers, memberId]);
        }
    };

    // Helper: Format Action Type
    const formatActionType = (log) => {
        let actionType = (log.type || '').toUpperCase();
        const payloadText = (log.target || log.message || '').toLowerCase();
        const actionRaw = (log.action || '').toUpperCase();
        const platform = (log.platform || '').toUpperCase();

        // 1. GitHub Specific Actions
        if (platform === 'GITHUB' || actionRaw === 'PUSH' || payloadText.includes('commit')) {
            if (actionRaw === 'PUSH' || payloadText.includes('pushed')) return '💻 COMMIT';
            if (actionRaw === 'PULL_REQUEST' || payloadText.includes('pull request')) return '🔀 PR / MERGE';
            if (actionRaw === 'ISSUE' || payloadText.includes('issue')) return '⚠️ ISSUE';
            if (actionRaw === 'FILE') return '💻 CODE CHANGE';
            return '💻 GITHUB ACTION';
        }

        // 2. Trello Specific Actions
        if (platform === 'TRELLO' || payloadText.includes('trello') || payloadText.includes('card')) {
            if (actionRaw === 'CREATECARD' || payloadText.includes('created card')) return '📋 CARD CREATE';
            if (actionRaw === 'UPDATECARD' || payloadText.includes('moved card')) return '📋 CARD MOVE';
            if (actionRaw === 'COMMENTCARD' || payloadText.includes('commented')) return '💭 COMMENT';
            if (payloadText.includes('completed') || payloadText.includes('archived') || payloadText.includes('sent to board')) return '🗃️ ARCHIVE';
            if (payloadText.includes('added') || payloadText.includes('joined')) return '👋 JOIN';
            if (payloadText.includes('removed') || payloadText.includes('left')) return '🚪 LEAVE';
            return '📋 TRELLO ACTION';
        }

        // 3. General Decision/Approval Flow 
        if (actionRaw === 'APPROVAL' || payloadText.includes('approval')) return '✅ APPROVE';
        if (actionRaw === 'REJECTION' || payloadText.includes('rejection')) return '❌ REJECT';
        if (payloadText.includes('delegat') || payloadText.includes('transfer')) return '🔁 TRANSFER';
        if (log.type === 'decision') return 'DECISION';

        // 4. Slack / Generic Fallbacks
        if (payloadText.includes('archive') || payloadText.includes('clos')) return '🗃️ ARCHIVE';
        if (payloadText.includes('update') || payloadText.includes('edit')) return '📝 UPDATE';

        if (log.type === 'file' || actionRaw === 'FILE') return '📎 UPLOAD';
        if (log.type === 'message' || actionRaw === 'MESSAGE') return '💬 MESSAGE';
        if (log.type === 'comment' || actionRaw === 'COMMENT') return '💭 COMMENT';
        if (log.type === 'join' || actionRaw === 'JOIN') return '👋 JOIN';
        if (log.type === 'leave' || actionRaw === 'LEAVE') return '🚪 LEAVE';

        return actionType;
    };

    // Helper: Strip emojis for PDF (jsPDF default font doesn't support Unicode emojis)
    const formatActionForPDF = (log) => {
        const raw = formatActionType(log);
        // Remove emojis for clean PDF text
        return raw.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}✅❌🔁🗃️📝📎💬💭👋🚪]/gu, '').trim();
    };

    // Helper: Format Channel Name
    const formatChannelName = (log) => {
        let channelName = log.channelName || log.channelId;
        // Try to find readable name from metadata if needed
        const res = realChannels.find(c => c.id === log.channelId || c.dbId === log.channelId);
        if (res) channelName = res.name;
        return channelName.length > 25 ? channelName.substring(0, 25) + '...' : channelName;
    };

    const handleGenerateReport = async (format) => {
        setIsGenerating(true);
        try {
            // Re-fetch or use current preview events? 
            // Using current filtered events is safer as it matches what user sees.
            const eventsToExport = filteredEvents;

            if (eventsToExport.length === 0) {
                alert("No events to export with current filters.");
                setIsGenerating(false);
                return;
            }

            if (format === 'pdf') {
                await generatePDF(eventsToExport);
            } else {
                await generateCSV(eventsToExport);
            }
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed");
        } finally {
            setIsGenerating(false);
            setExportModal({ ...exportModal, isOpen: false });
        }
    };

    const generateCSV = async (events) => {
        const headers = ['Timestamp', 'Actor', 'Action', 'Context', 'Target/Message', 'Metadata'];
        const rows = events.map(ev => [
            new Date(ev.timestamp).toISOString(),
            ev.actor,
            formatActionForPDF(ev), // Clean action name
            ev.channelName,
            ev.target || ev.message,
            JSON.stringify(ev.rawMetadata || {})
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `audit_export_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generatePDF = async (events) => {
        const doc = new jsPDF();

        // Helper: Load Image and Convert to PNG Data URL (for SVG handling)
        const loadLogo = () => {
            return new Promise((resolve) => {
                try {
                    const img = new Image();
                    // Handle Next.js import object or string path
                    const src = (typeof AuditLogo === 'object' && AuditLogo !== null) ? AuditLogo.src : AuditLogo;

                    if (!src) {
                        console.warn("AuditLogo source not found");
                        resolve(null);
                        return;
                    }

                    img.src = src;
                    img.crossOrigin = "Anonymous"; // Handle potential CORS

                    img.onload = () => {
                        const canvas = document.createElement("canvas");
                        // Use a reasonable size for the canvas to maintain quality
                        canvas.width = img.width || 500;
                        canvas.height = img.height || 500;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        try {
                            const dataUrl = canvas.toDataURL("image/png");
                            resolve(dataUrl);
                        } catch (e) {
                            console.warn("Canvas toDataURL failed", e);
                            resolve(null);
                        }
                    };

                    img.onerror = (err) => {
                        console.warn("Image load failed", err);
                        resolve(null);
                    };
                } catch (e) {
                    console.warn("Error in loadLogo", e);
                    resolve(null);
                }
            });
        };

        // --- 1. Header Section ---
        // --- 1. Header Section ---
        const pageWidth = doc.internal.pageSize.width;

        // Load Logo 
        const logoDataUrl = await loadLogo();
        if (logoDataUrl) {
            try {
                // Stretched logo width (approx 1.8 ratio or more as requested)
                doc.addImage(logoDataUrl, 'PNG', 10, 10, 45, 25);
            } catch (e) {
                console.warn("Add image to PDF failed", e);
            }
        }

        // Main Title: "VERYTIS" (Bold) + "GOVERNANCE AUDIT" (Light/Grey)
        // Adjusted position to reduce gap (whitespace in logo)
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42); // Darker Slate
        // Moving VERYTIS to X=42 to visually sit next to the graphic (ignoring png padding)
        doc.text("VERYTIS", 42, 25);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139); // Slate-500
        // Keeping relative distance (approx +48 from Verytis)
        doc.text("GOVERNANCE AUDIT", 90, 25);

        // Horizontal Line
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.setLineWidth(0.5);
        doc.line(10, 40, pageWidth - 10, 40); // Aligned with new left margin

        // --- 2. Metadata Grid (2 Columns) ---
        const leftColX = 10; // Aligned with header
        const rightColX = 110;
        let metaY = 50; // Start lower


        const lineHeight = 7;

        doc.setFontSize(10);
        doc.setTextColor(0); // Black

        // Helper for bold label + value
        const drawMetaRow = (label, value, x, y) => {
            doc.setFont("helvetica", "bold");
            doc.text(`${label}:`, x, y);
            const labelWidth = doc.getTextWidth(`${label}: `);
            doc.setFont("helvetica", "normal");
            doc.text(value || '-', x + labelWidth, y);
        };

        // Left Column
        drawMetaRow("Auditor", `${currentUser?.name || 'Unknown'} (${userRole})`, leftColX, metaY);
        drawMetaRow("Email", currentUser?.email || 'N/A', leftColX, metaY + lineHeight);
        drawMetaRow("Generated", new Date().toLocaleString(), leftColX, metaY + (lineHeight * 2));

        // Right Column
        // Scope logic: if admin 'All Teams', else specific team or 'Personal'
        const scopeText = userRole === 'Admin' ? 'All Organization' : (selectedTeamId !== '' ? 'Team Scope' : 'Personal Scope');

        drawMetaRow("Scope", `${scopeText}`, rightColX, metaY); // Simplified scope text
        drawMetaRow("Report Type", reportType, rightColX, metaY + lineHeight);
        drawMetaRow("Platform", platform, rightColX, metaY + (lineHeight * 2));

        // --- 3. Legal/Certification Block (Middle/Bottom) ---
        const cryptoY = metaY + (lineHeight * 4);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Certification Légale & Audit Trail :", 10, cryptoY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // Slate-500

        const legalText = "Document certifié par Verytis (Norme WORM). Son empreinte cryptographique garantit son intégrité absolue. Toute altération du fichier invalidera sa vérification sur notre plateforme.";
        const splitLegalText = doc.splitTextToSize(legalText, pageWidth - 20);
        doc.text(splitLegalText, 10, cryptoY + 6);

        // --- 4. Events Table ---
        const tableStartY = cryptoY + 20;

        autoTable(doc, {
            startY: tableStartY,
            head: [['Time', 'Actor', 'Action', 'Context', 'Summary']],
            body: events.map(ev => {
                let cleanAction = formatActionForPDF(ev);
                if (!cleanAction || cleanAction.trim() === '') cleanAction = (ev.action || 'EVENT').toUpperCase();

                return [
                    new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    ev.actor,
                    cleanAction,
                    ev.channelName || '-',
                    (ev.target || ev.message || '-').substring(0, 60) // Truncate summary
                ];
            }),
            styles: {
                fontSize: 8,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [15, 23, 42], // Slate-900
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252] // Slate-50
            },
            columnStyles: {
                0: { cellWidth: 25 }, // Time
                1: { cellWidth: 40 }, // Actor
                2: { cellWidth: 30 }, // Action
                3: { cellWidth: 40 }, // Context
                4: { cellWidth: 'auto' } // Summary
            }
        });

        // Footer Pagination
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, doc.internal.pageSize.height - 10);
            doc.text(`Verytis Digital Audit System v2.0`, 14, doc.internal.pageSize.height - 10);
        }

        // --- 5. HASH & UPLOAD AU BUCKET ---
        const pdfBlob = doc.output('blob');
        const fileName = `Audit_Report_${platform}_${new Date().toISOString().split('T')[0]}.pdf`;

        try {
            const formData = new FormData();
            formData.append('file', pdfBlob, fileName);
            formData.append('platform', platform);

            // Upload binaire vers Supabase, Hachage (WORM DB) et Récupération Url
            const response = await fetch('/api/reports/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Erreur de sécurisation du document");

            const data = await response.json();
            console.log("Archive Certificate:", data);

            // --- 6. TÉLÉCHARGEMENT LOCAL UNIQUEMENT SI LE HASH A ÉTÉ SÉCURISÉ ---
            doc.save(fileName);

            alert(`PDF Secured & Verified.\nLe fichier a été scellé dans le coffre-fort avec le Hash :\n\n${data.hash}`);
        } catch (e) {
            console.error("Failed to secure/upload report:", e);
            alert("Attention: Le PDF a été généré localement mais n'a pas pu être certifié (impossible de le stocker ou de le hacher). Vérifiez votre connexion.");
            doc.save(fileName); // Fallback offline
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {userRole === 'Member' ? 'My Audit Documentation' : 'Audit Documentation'}
                </h1>
                <p className="text-slate-500 mt-1 text-xs font-medium">
                    {userRole === 'Member'
                        ? 'Generate personal activity reports from your channels.'
                        : 'Generate complete and legally usable audit documents from authorized channels.'}
                </p>
            </header>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* LEFT: Configuration Panel */}
                <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
                    <Card className="p-5 space-y-6 sticky top-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Configuration</span>
                            <div className="h-px bg-slate-100 flex-1"></div>
                        </div>

                        {/* Platform Selector */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Platform</label>
                            <div className="grid grid-cols-4 gap-2">
                                {['Slack', 'Trello', 'GitHub', 'AI Agent'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPlatform(p)}
                                        className={`flex flex-col items-center justify-center py-3 px-1 rounded-lg border transition-all ${platform === p
                                            ? 'bg-white border-2 border-blue-600 text-blue-700 shadow-md transform scale-105 ring-2 ring-blue-50'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <PlatformIcon platform={p} className={`w-5 h-5 mb-1.5 ${platform === p ? 'text-blue-600' : ''}`} />
                                        <span className="text-[9px] font-bold">{p}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Team Selector (Only for Admin/Manager) */}
                        {(userRole === 'Admin' || (userRole === 'Manager' && availableTeams.length > 0)) && (
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Organization Team</label>
                                <div className="relative">
                                    <button
                                        onClick={() => setDropdownState({ ...dropdownState, team: !dropdownState.team })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-xs text-left flex items-center justify-between hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                                    >
                                        <span className="truncate">
                                            {selectedTeamId === 'all'
                                                ? 'All Teams'
                                                : availableTeams.find(t => t.id.toString() === selectedTeamId)?.name || 'Select Team'}
                                        </span>
                                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownState.team ? 'rotate-180' : ''}`} />
                                    </button>

                                    {dropdownState.team && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setDropdownState({ ...dropdownState, team: false })} />
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
                                                {userRole === 'Admin' && (
                                                    <button
                                                        onClick={() => { setSelectedTeamId('all'); setDropdownState({ ...dropdownState, team: false }); }}
                                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between ${selectedTeamId === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                                    >
                                                        All Teams
                                                        {selectedTeamId === 'all' && <Check className="w-3 h-3" />}
                                                    </button>
                                                )}
                                                {availableTeams.map(team => (
                                                    <button
                                                        key={team.id}
                                                        onClick={() => { setSelectedTeamId(team.id.toString()); setDropdownState({ ...dropdownState, team: false }); }}
                                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between ${selectedTeamId === team.id.toString() ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                                    >
                                                        {team.name}
                                                        {selectedTeamId === team.id.toString() && <Check className="w-3 h-3" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Report Type Selector */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Report Type</label>
                            <div className="relative">
                                <button
                                    onClick={() => setDropdownState({ ...dropdownState, reportType: !dropdownState.reportType })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-xs text-left flex items-center justify-between hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                                >
                                    <span className="truncate">{reportType}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownState.reportType ? 'rotate-180' : ''}`} />
                                </button>
                                {dropdownState.reportType && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setDropdownState({ ...dropdownState, reportType: false })} />
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 animate-in fade-in zoom-in-95 duration-200">
                                            {(() => {
                                                let options = [];
                                                if (platform === 'Slack') {
                                                    options = ['Full Channel Audit', 'My Activity Channel', 'Shipping Audit', 'Targeted Audit'];
                                                } else if (platform === 'Trello') {
                                                    options = ['Full Board Audit', 'My Activity Board'];
                                                } else if (platform === 'GitHub') {
                                                    options = ['Full Repo Audit', 'My Activity Repo'];
                                                } else if (platform === 'AI Agent') {
                                                    options = ['Full AI Audit', 'Targeted Agent Audit'];
                                                }
                                                // Member role restriction logic if needed, but assuming mostly admin/manager for full audits
                                                if (userRole === 'Member') {
                                                    // Filter for members if necessary, e.g. only 'My Activity...'
                                                    options = options.filter(o => o.includes('My Activity'));
                                                }

                                                return options.map(type => (
                                                    <button key={type} onClick={() => { setReportType(type); setDropdownState({ ...dropdownState, reportType: false }); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 block text-ellipsis overflow-hidden whitespace-nowrap">
                                                        {type}
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>


                        {/* Channel/Repo Selector */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                                Authorized {platform === 'GitHub' ? 'Repos' : platform === 'Trello' ? 'Boards' : platform === 'AI Agent' ? 'Agents' : 'Channels'}
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg pr-1 custom-scrollbar bg-slate-50 p-2 space-y-1">
                                {availableChannels.length > 0 ? (
                                    availableChannels.map(channel => (
                                        <label key={channel.dbId} className="flex items-start gap-2 p-1.5 hover:bg-white rounded cursor-pointer group transition-colors">
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                                checked={selectedChannels.includes(channel.dbId)}
                                                onChange={() => handleChannelSelect(channel.dbId)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                                                    {channel.name}
                                                </div>
                                                <div className="text-[9px] text-slate-400 truncate flex items-center gap-1">
                                                    <span>{channel.team}</span>
                                                    {/* ID Removed as requested */}
                                                </div>
                                            </div>
                                        </label>
                                    ))
                                ) : (
                                    <div className="py-2">
                                        <EmptyState
                                            title="No Resources"
                                            description={`No authorized ${platform === 'GitHub' ? 'repos' : platform === 'Trello' ? 'boards' : platform === 'AI Agent' ? 'agents' : 'channels'} available for this team.`}
                                            className="p-4"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Time Range Selector */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Time Range</label>
                            <div className="relative">
                                <button
                                    onClick={() => setDropdownState({ ...dropdownState, dateRange: !dropdownState.dateRange })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-xs text-left flex items-center justify-between hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                                >
                                    <span className="truncate">
                                        {dateRange === 'all' ? 'All Time' :
                                            dateRange === '30' ? 'Last 30 Days' :
                                                dateRange === '7' ? 'Last 7 Days' : 'Custom Range'}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownState.dateRange ? 'rotate-180' : ''}`} />
                                </button>
                                {dropdownState.dateRange && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setDropdownState({ ...dropdownState, dateRange: false })} />
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 animate-in fade-in zoom-in-95 duration-200">
                                            {[
                                                { value: 'all', label: 'All Time' },
                                                { value: '30', label: 'Last 30 Days' },
                                                { value: '7', label: 'Last 7 Days' },
                                                { value: 'custom', label: 'Custom Range' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => { setDateRange(opt.value); setDropdownState({ ...dropdownState, dateRange: false }); }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 block"
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Generate Buttons */}
                        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                            <Button
                                variant="secondary"
                                className="w-full justify-center text-xs"
                                onClick={() => setExportModal({ type: 'csv', isOpen: true })}
                                disabled={filteredEvents.length === 0}
                            >
                                Export CSV
                            </Button>
                            <Button
                                variant="primary"
                                className="w-full justify-center text-xs bg-slate-900 hover:bg-black"
                                onClick={() => handleGenerateReport('pdf')}
                                disabled={filteredEvents.length === 0 || isGenerating}
                            >
                                {isGenerating ? 'Generating...' : 'Export PDF'}
                            </Button>
                        </div>

                    </Card>
                </div>

                {/* RIGHT: Preview Area */}
                <div className="flex-1">
                    <Card className="h-full min-h-[600px] flex flex-col border-2 border-blue-600 shadow-xl overflow-hidden bg-white">
                        <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
                            <h2 className="text-sm font-bold uppercase tracking-wide text-blue-700 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Report Preview
                            </h2>
                            <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                                {isPreviewLoading ? 'Loading...' : `${filteredEvents.length} events found`}
                            </span>
                        </div>

                        {/* Preview Content */}
                        <div className="flex-1 p-8 overflow-y-auto bg-slate-50/50">
                            {/* Paper Effect */}
                            <div className="bg-white shadow-2xl border border-slate-200 min-h-[800px] max-w-[210mm] mx-auto p-12 relative text-slate-900">
                                {isPreviewLoading ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                        <div className="animate-spin w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full"></div>
                                    </div>
                                ) : filteredEvents.length === 0 ? (
                                    <EmptyState
                                        title="Ready to Preview"
                                        description="Select one or more resources from the sidebar to generate a live preview of your audit document."
                                        icon={FileText}
                                        className="h-full border-none bg-transparent"
                                    />
                                ) : (
                                    <div className="space-y-6">
                                        {/* 1. Header Section (Matched to PDF) */}
                                        <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                                            {/* Logo */}
                                            <div className="w-[45px] flex-shrink-0">
                                                <img src={(typeof AuditLogo === 'object' && AuditLogo !== null) ? AuditLogo.src : AuditLogo} alt="Logo" className="w-full" />
                                            </div>
                                            {/* Text */}
                                            <div className="flex items-baseline gap-4">
                                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">VERYTIS</h1>
                                                <span className="text-lg text-slate-500 font-normal">GOVERNANCE AUDIT</span>
                                            </div>
                                        </div>

                                        {/* 2. Metadata Grid (2 Columns) */}
                                        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[10px]">
                                            {/* Left Column */}
                                            <div className="space-y-1">
                                                <div className="flex gap-2"><span className="font-bold w-16">Auditor:</span> <span>{currentUser?.name || 'Unknown'} ({userRole})</span></div>
                                                <div className="flex gap-2"><span className="font-bold w-16">Email:</span> <span>{currentUser?.email || 'N/A'}</span></div>
                                                {/* Use client-side only date to avoid hydration error */}
                                                <div className="flex gap-2"><span className="font-bold w-16">Generated:</span> <span>{mounted ? new Date().toLocaleString() : 'Loading...'}</span></div>
                                            </div>
                                            {/* Right Column */}
                                            <div className="space-y-1">
                                                <div className="flex gap-2"><span className="font-bold w-16">Scope:</span>
                                                    <span>{userRole === 'Admin' ? 'All Organization' : (selectedTeamId !== '' ? 'Team Scope' : 'Personal Scope')}</span>
                                                </div>
                                                <div className="flex gap-2"><span className="font-bold w-16">Report Type:</span> <span>{reportType}</span></div>
                                                <div className="flex gap-2"><span className="font-bold w-16">Platform:</span> <span>{platform}</span></div>
                                            </div>
                                        </div>

                                        {/* 3. Legal & Cryptographic Signature */}
                                        <div className="pt-4 pb-0">
                                            <div className="font-bold text-[10px] mb-1 text-slate-900">Certification Légale & Audit Trail :</div>
                                            <div className="text-[9px] text-slate-500 leading-relaxed mb-2">
                                                Document certifié par Verytis (Norme WORM). Son empreinte cryptographique garantit son intégrité absolue. Toute altération du fichier invalidera sa vérification sur notre plateforme.
                                            </div>
                                        </div>

                                        {/* 4. Events Table */}
                                        <div className="w-full text-left text-[10px]">
                                            <div className="bg-slate-900 text-white font-bold p-2 grid grid-cols-[80px_1fr_100px_1fr_1.5fr] gap-2 rounded-t-sm">
                                                <div>Time</div>
                                                <div>Actor</div>
                                                <div>Action</div>
                                                <div>Context</div>
                                                <div>Summary</div>
                                            </div>
                                            <div className="border font-mono border-slate-200 divide-y divide-slate-100">
                                                {filteredEvents.slice(0, 20).map((ev, i) => (
                                                    <div key={i} className="grid grid-cols-[80px_1fr_100px_1fr_1.5fr] gap-2 p-2 hover:bg-slate-50 items-center">
                                                        <div className="text-slate-500">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                        <div className="font-medium text-slate-800 truncate">{ev.actor}</div>
                                                        <div className="text-slate-600 uppercase font-semibold">{formatActionForPDF(ev)}</div>
                                                        <div className="text-slate-500 truncate">{ev.channelName || '-'}</div>
                                                        <div className="text-slate-500 truncate" title={ev.target || ev.message}>{(ev.target || ev.message || '-')}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            {filteredEvents.length > 20 && (
                                                <div className="text-center py-4 bg-slate-50 text-slate-400 italic text-[10px] border-x border-b border-slate-200">
                                                    ... {filteredEvents.length - 20} more events will be included in the full PDF export ...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
            {/* CSV Export Modal */}
            <Modal
                isOpen={exportModal.isOpen && exportModal.type === 'csv'}
                onClose={() => setExportModal({ ...exportModal, isOpen: false })}
                title="Export Configuration"
                maxWidth="max-w-sm"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Delimiter</label>
                        <div className="space-y-2">
                            {['Comma (,)', 'Semicolon (;)', 'Tab (\\t)'].map(opt => (
                                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="csvDelimiter"
                                        checked={csvDelimiter === opt}
                                        onChange={() => setCsvDelimiter(opt)}
                                        className="text-slate-900 focus:ring-slate-900"
                                    />
                                    <span className="text-sm text-slate-700">{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 gap-2">
                        <Button variant="ghost" onClick={() => setExportModal({ ...exportModal, isOpen: false })}>Cancel</Button>
                        <Button variant="primary" onClick={() => handleGenerateReport('csv')}>Download CSV</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AuditDocumentation;
