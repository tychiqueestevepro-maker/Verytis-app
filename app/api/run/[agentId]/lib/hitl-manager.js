/**
 * Human-In-The-Loop (HITL) Manager [v4.0 - Industrial Auth-Pass & Deduplication]
 * Centralized logic for Action Payload deduction and Response Scrubbing.
 */
export function processHITL(result, originalMessage = '') {
    let scrubbedResponse = result.text.trim();
    let actionPayload = null;

    // 1. DATA AGGREGATION & DEDUPLICATION
    // Fixes the "5 tools" clutter by only keeping unique entries.
    const steps = result.steps || [];
    const toolMap = new Map();

    steps.forEach(step => {
        (step.toolCalls || []).forEach(call => {
            const toolName = (call.toolName || call.name || '').toLowerCase();
            const toolResult = step.toolResults?.find(tr => tr.toolCallId === call.toolCallId);
            
            // We favor results with options over empty ones
            if (!toolMap.has(toolName) || toolResult?.result?.options?.length > 0) {
                toolMap.set(toolName, {
                    call: { ...call, toolName: call.toolName || call.name },
                    result: toolResult?.result
                });
            }
        });
    });

    const allEntries = Array.from(toolMap.values());
    console.log(`[HITL v4.0] Audit: Scanned ${steps.length} steps, Found ${allEntries.length} unique tool entries`);
    
    // 2. DETECTOR: Find listing or UI tools
    const uiEntry = allEntries.find(e => {
        const name = (e.call.toolName || '').toLowerCase();
        return name === 'request_config_ui' || name === 'config_ui';
    });

    const listEntry = allEntries.find(e => {
        const name = (e.call.toolName || '').toLowerCase();
        return name.includes('slack_list') || 
               name.includes('trello_list') || 
               name.includes('github_list') ||
               name.includes('youtube_list') ||
               name.includes('tiktok_get') ||
               name.includes('_list_') ||
               name.includes('_get_metadata');
    });

    // 3. INTENT DETECTION (Auto-Correction)
    let forcedProvider = null;
    const aiTextLower = scrubbedResponse.toLowerCase();
    const msgLower = (originalMessage || '').toLowerCase();
    
    if (!listEntry && !uiEntry) {
        // Detect provider in AI text or original message if tools failed (Lazy AI)
        if (aiTextLower.includes('slack') || msgLower.includes('slack')) forcedProvider = 'slack';
        else if (aiTextLower.includes('youtube') || msgLower.includes('youtube')) forcedProvider = 'youtube';
        else if (aiTextLower.includes('github') || msgLower.includes('github') || msgLower.includes('git')) forcedProvider = 'github';
        else if (aiTextLower.includes('tiktok') || msgLower.includes('tiktok')) forcedProvider = 'tiktok';
        
        if (forcedProvider) {
            console.log(`[HITL] INTENT DETECTED: Forced provider: ${forcedProvider}`);
        }
    }

    if (uiEntry?.call?.args) {
        const { change_detected, target_field, options } = uiEntry.call.args;
        actionPayload = { type: 'CONFIG_UPDATE', change_detected, target_field, options, requires_approval: true };
    } else if (listEntry || forcedProvider) {
        const toolResult = listEntry?.result || {};
        const toolName = listEntry ? (listEntry.call.toolName || '') : forcedProvider;
        
        // 1. Extract Options (with default fallback)
        let extractedOptions = toolResult.options || (toolResult.user ? [toolResult.user.display_name] : ['✨ Automatique']);
        if (!Array.isArray(extractedOptions)) extractedOptions = ['✨ Automatique'];
        if (!extractedOptions.includes('✨ Automatique')) extractedOptions.unshift('✨ Automatique');

        // 2. Dynamic Metadata Extraction (NO MORE HARDCODE)
        // We take the config from the tool itself, or build it dynamically
        const hitlConfig = toolResult.hitl_config || {};
        
        // Helper to turn tool_name_listing into "Configuration Tool Name"
        const formatTitle = (name) => name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').replace('List', 'Sélection').replace('Get', 'Infos');

        const actionLabel = hitlConfig.label || formatTitle(toolName) || 'Configuration Requise';
        const targetKey = hitlConfig.field || (toolName.split('_')[0].charAt(0).toUpperCase() + toolName.split('_')[0].slice(1) + '_Target');

        actionPayload = {
            type: 'CONFIG_UPDATE',
            change_detected: actionLabel,
            target_field: targetKey,
            new_value: '✨ Automatique',
            options: extractedOptions,
            requires_approval: true
        };
        
        // [GHOSTING GUARD] Force a clean instructional response if payload is present
        scrubbedResponse = `Voici l'action de configuration nécessaire. Veuillez sélectionner l'option souhaitée ci-dessous.`;
    }

    // --- FINAL SCRUBBING ---
    // Remove technical traces, Jargon, and JSON blocks from the response text
    scrubbedResponse = scrubbedResponse
        .replace(/###\s*Outils[\s\S]*$/i, '')
        .replace(/###\s*Exécution[\s\S]*$/i, '')
        .replace(/\d+\.\s*Outils exécutés[\s\S]*$/i, '')
        .replace(/Outils exécutés[\s\S]*$/i, '')
        .replace(/Trace:\s*[a-z0-9-]+/gi, '')
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\{[\s\S]*"type"\s*:\s*"CONFIG_UPDATE"[\s\S]*\}/g, '')
        .trim();

    // Final Polish: Ensure the user sees a clear call to action if a card is present
    if (actionPayload && scrubbedResponse.length < 10) {
        scrubbedResponse = `Veuillez sélectionner l'option souhaitée ci-dessous pour finaliser la configuration.`;
    } else if (!scrubbedResponse || scrubbedResponse.length < 5) {
        scrubbedResponse = `J'ai préparé la configuration demandée. De quel compte ou canal s'agit-il ?`;
    }

    return { actionPayload, scrubbedResponse };
}
