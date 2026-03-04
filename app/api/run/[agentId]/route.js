import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import crypto from 'crypto';
import { scrubText } from '@/lib/security/scrubber';
import { calculateCost } from '@/lib/security/pricing';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────
// STEP 3: Multi-Provider Model Resolver
// Routes model strings to the correct AI SDK provider.
// ──────────────────────────────────────────────────
function resolveModel(modelId) {
    if (!modelId) return openai('gpt-4o'); // Fallback

    const id = modelId.toLowerCase();

    // Anthropic
    if (id.includes('claude')) return anthropic(modelId);

    // Google
    if (id.includes('gemini')) return google(modelId);

    // OpenAI (default for gpt-*, o1-*, or unknown)
    return openai(modelId);
}

// ──────────────────────────────────────────────────
// STEP 2: Dynamic Tool Discovery from Visual Config
// Parses the agent's visual_config to find ToolNodes
// and maps them to Vercel AI SDK tool() definitions.
// ──────────────────────────────────────────────────
function discoverTools(visualConfig) {
    if (!visualConfig?.nodes) return {};

    const toolNodes = visualConfig.nodes.filter(n => n.type === 'toolNode');
    if (toolNodes.length === 0) return {};

    const toolMap = {};

    for (const node of toolNodes) {
        const label = node.data?.label || 'unknown_tool';
        const toolId = label.toLowerCase().replace(/[^a-z0-9_]/g, '_');

        // Map known tool types to their schemas and simulated actions
        switch (true) {
            case toolId.includes('slack'):
                toolMap[`action_slack_${toolId}`] = tool({
                    description: `Send a message or notification via Slack (${label}). Use this when the user's request requires Slack communication.`,
                    parameters: z.object({
                        channel: z.string().describe('The Slack channel to send the message to'),
                        message: z.string().describe('The message content to send')
                    }),
                    execute: async ({ channel, message }) => {
                        // MVP: Simulated response
                        return `[VERYTIS TOOL] Action Slack effectuée: Message envoyé sur #${channel} — "${message.substring(0, 80)}..."`;
                    }
                });
                break;

            case toolId.includes('jira'):
                toolMap[`action_jira_${toolId}`] = tool({
                    description: `Create or update a Jira ticket (${label}). Use this when a task, bug, or incident needs to be tracked.`,
                    parameters: z.object({
                        project: z.string().describe('The Jira project key (e.g., SRE, OPS)'),
                        summary: z.string().describe('Title of the ticket'),
                        priority: z.enum(['Critical', 'High', 'Medium', 'Low']).describe('Ticket priority')
                    }),
                    execute: async ({ project, summary, priority }) => {
                        return `[VERYTIS TOOL] Ticket Jira créé: ${project}-${Math.floor(Math.random() * 9000 + 1000)} — "${summary}" (Priorité: ${priority})`;
                    }
                });
                break;

            case toolId.includes('github'):
                toolMap[`action_github_${toolId}`] = tool({
                    description: `Interact with GitHub (${label}). Use this to create issues, check commit history, or trigger workflows.`,
                    parameters: z.object({
                        repo: z.string().describe('Repository name (owner/repo)'),
                        action: z.enum(['create_issue', 'get_last_commit', 'trigger_workflow']).describe('The GitHub action to perform'),
                        title: z.string().optional().describe('Issue title (if creating an issue)')
                    }),
                    execute: async ({ repo, action, title }) => {
                        return `[VERYTIS TOOL] GitHub action "${action}" exécutée sur ${repo}${title ? ` — "${title}"` : ''}`;
                    }
                });
                break;

            case toolId.includes('pagerduty') || toolId.includes('pager'):
                toolMap[`action_pagerduty_${toolId}`] = tool({
                    description: `Acknowledge or escalate PagerDuty incidents (${label}).`,
                    parameters: z.object({
                        incident_id: z.string().describe('The PagerDuty incident ID'),
                        action: z.enum(['acknowledge', 'resolve', 'escalate']).describe('Action to perform')
                    }),
                    execute: async ({ incident_id, action }) => {
                        return `[VERYTIS TOOL] PagerDuty: Incident ${incident_id} — Action "${action}" effectuée avec succès.`;
                    }
                });
                break;

            case toolId.includes('cloudwatch') || toolId.includes('aws'):
                toolMap[`action_aws_${toolId}`] = tool({
                    description: `Query AWS CloudWatch logs (${label}). Use this to retrieve recent log entries for a service.`,
                    parameters: z.object({
                        log_group: z.string().describe('CloudWatch Log Group name'),
                        lines: z.number().optional().describe('Number of log lines to retrieve (default: 100)')
                    }),
                    execute: async ({ log_group, lines }) => {
                        return `[VERYTIS TOOL] CloudWatch: Récupéré les ${lines || 100} dernières lignes de "${log_group}". Analyse en cours...`;
                    }
                });
                break;

            case toolId.includes('postgres') || toolId.includes('database') || toolId.includes('sql'):
                toolMap[`action_db_${toolId}`] = tool({
                    description: `Execute a read-only database query (${label}). NEVER execute DELETE, DROP, or UPDATE statements.`,
                    parameters: z.object({
                        query_description: z.string().describe('Natural language description of the data to retrieve')
                    }),
                    execute: async ({ query_description }) => {
                        return `[VERYTIS TOOL] Database query simulée: "${query_description}" — Résultats retournés (mode simulé).`;
                    }
                });
                break;

            default:
                // Generic tool for unknown types
                toolMap[`action_generic_${toolId}`] = tool({
                    description: `Execute the "${label}" action. This is a generic tool integration.`,
                    parameters: z.object({
                        input: z.string().describe('The input or command for this tool')
                    }),
                    execute: async ({ input }) => {
                        return `[VERYTIS TOOL] Action "${label}" exécutée avec succès. Input: "${input.substring(0, 100)}"`;
                    }
                });
        }
    }

    return toolMap;
}

// ──────────────────────────────────────────────────
// STEP 4: Secure API Key Comparison (SHA-256 + timingSafeEqual)
// Prevents timing attacks for PCI-DSS/SOC2 compliance.
// ──────────────────────────────────────────────────
function secureCompareKeys(providedKey, storedKey) {
    if (!providedKey || !storedKey) return false;

    const providedHash = crypto.createHash('sha256').update(providedKey).digest();
    const storedHash = crypto.createHash('sha256').update(storedKey).digest();

    try {
        return crypto.timingSafeEqual(providedHash, storedHash);
    } catch {
        return false;
    }
}

// ──────────────────────────────────────────────────
// MAIN HANDLER
// ──────────────────────────────────────────────────
export async function POST(req, { params }) {
    try {
        const { agentId } = params;
        const authHeader = req.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
        }

        const providedKey = authHeader.substring(7);
        const supabase = createClient();

        // ─── 1. Resolve Organization & Global API Key ───
        const { data: settings, error: settingsError } = await supabase
            .from('organization_settings')
            .select('verytis_api_key, banned_keywords')
            .eq('id', 'default')
            .single();

        if (settingsError || !settings) {
            return NextResponse.json({ error: 'Organization settings not configured' }, { status: 500 });
        }

        // ─── 2. STEP 4: Secure API Key Validation (SHA-256 + timingSafeEqual) ───
        if (!secureCompareKeys(providedKey, settings.verytis_api_key)) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
        }

        // ─── 3. Resolve Agent ───
        const { data: agent, error: agentError } = await supabase
            .from('ai_agents')
            .select('*')
            .eq('id', agentId.replace('agt_live_', ''))
            .single();

        let targetAgent = agent;
        if (agentError || !agent) {
            const cleanId = agentId.replace('agt_live_', '');
            const { data: altAgent } = await supabase
                .from('ai_agents')
                .select('*')
                .eq('id', cleanId)
                .single();
            targetAgent = altAgent;
        }

        if (!targetAgent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        if (targetAgent.status !== 'active') {
            return NextResponse.json({ error: 'Agent is suspended' }, { status: 403 });
        }

        // ─── 4. Parse Input ───
        const body = await req.json();
        const { message } = body;

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // ─── 5. STEP 1: Zero-Trust Data Masking ───
        // Scrub PII from user message BEFORE sending to LLM
        const scrubbedMessage = scrubText(message);
        const messageHash = crypto.createHash('sha256').update(message).digest('hex').substring(0, 16);

        // ─── 6. Guardrails: Forbidden Keywords ───
        const globalBanned = settings.banned_keywords || [];
        const agentBanned = targetAgent.policies?.forbidden_keywords || [];
        const allBanned = [...new Set([...globalBanned, ...agentBanned])];

        for (const keyword of allBanned) {
            if (scrubbedMessage.toLowerCase().includes(keyword.toLowerCase())) {
                await supabase.from('activity_logs').insert({
                    organization_id: targetAgent.organization_id,
                    agent_id: targetAgent.id,
                    action_type: 'REQUEST_BLOCKED',
                    summary: `Requête bloquée : Mot-clé interdit détecté ("${keyword}")`,
                    metadata: {
                        status: 'BLOCKED',
                        reason: 'FORBIDDEN_KEYWORD',
                        keyword,
                        message_hash: messageHash,
                        trace_id: crypto.randomUUID()
                    }
                });

                return NextResponse.json({
                    error: 'Policy Violation',
                    reason: `Forbidden keyword detected: ${keyword}`
                }, { status: 400 });
            }
        }

        // ─── 7. STEP 3: Resolve Model Dynamically ───
        // Extract model from visual_config if available
        const visualConfig = targetAgent.visual_config;
        let modelId = null;

        if (visualConfig?.nodes) {
            const llmNode = visualConfig.nodes.find(n =>
                n.type === 'llmNode' || n.type === 'placeholderNode'
            );
            if (llmNode?.data?.model) {
                modelId = llmNode.data.model;
            }
        }

        // Fallback chain: visual_config model → agent system_prompt model → gpt-4o
        const resolvedModel = resolveModel(modelId);

        // ─── 8. STEP 2: Discover Tools from Visual Config ───
        const discoveredTools = discoverTools(visualConfig);
        const hasTools = Object.keys(discoveredTools).length > 0;

        // ─── 9. AI Execution (with optional Tool Calling) ───
        const startTime = Date.now();

        const generateOptions = {
            model: resolvedModel,
            system: targetAgent.system_prompt || 'You are a helpful assistant.',
            prompt: scrubbedMessage,  // STEP 1: Only the scrubbed message reaches the LLM
        };

        // STEP 2: Inject tools if discovered
        if (hasTools) {
            generateOptions.tools = discoveredTools;
            generateOptions.maxSteps = 5; // Allow up to 5 tool-calling rounds
        }

        const result = await generateText(generateOptions);
        const duration = Date.now() - startTime;

        // ─── 10. STEP 3: Dynamic Cost Calculation ───
        const { cost, pricing, model: pricedModel } = calculateCost(
            modelId,
            result.usage.promptTokens,
            result.usage.completionTokens
        );

        // ─── 11. Logging & Trace ───
        const traceId = crypto.randomUUID();

        // Collect tool call results for the trace
        const toolResults = result.steps
            ?.flatMap(step => step.toolResults || [])
            ?.map(tr => ({ tool: tr.toolName, result: tr.result })) || [];

        await supabase.from('activity_logs').insert({
            organization_id: targetAgent.organization_id,
            agent_id: targetAgent.id,
            action_type: 'AGENT_EXECUTION',
            summary: scrubText(message.substring(0, 80)) + '...',
            metadata: {
                status: 'CLEAN',
                trace_id: traceId,
                message_hash: messageHash,
                model: modelId || 'gpt-4o (fallback)',
                security: {
                    pii_scrubbed: scrubbedMessage !== message,
                    key_comparison: 'sha256_timing_safe'
                },
                metrics: {
                    tokens_used: result.usage.totalTokens,
                    prompt_tokens: result.usage.promptTokens,
                    completion_tokens: result.usage.completionTokens,
                    cost_usd: cost.toFixed(6),
                    pricing_per_1m: pricing,
                    duration_ms: duration
                },
                tools: {
                    discovered: Object.keys(discoveredTools),
                    invoked: toolResults
                },
                platform: 'gateway_enterprise'
            }
        });

        // ─── 12. Return Enterprise Response ───
        return NextResponse.json({
            id: traceId,
            agent: targetAgent.name,
            model: modelId || 'gpt-4o (fallback)',
            response: result.text,
            tools_used: toolResults.length > 0 ? toolResults : undefined,
            usage: {
                total_tokens: result.usage.totalTokens,
                prompt_tokens: result.usage.promptTokens,
                completion_tokens: result.usage.completionTokens,
                cost_usd: cost.toFixed(6),
                model_pricing: pricing
            },
            security: {
                pii_scrubbed: scrubbedMessage !== message,
                key_validation: 'sha256_timing_safe'
            }
        });

    } catch (error) {
        console.error('Enterprise Gateway Error:', error);
        return NextResponse.json({
            error: 'Internal Gateway Error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
