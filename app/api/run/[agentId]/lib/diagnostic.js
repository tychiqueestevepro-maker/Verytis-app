import fs from 'fs';
import path from 'path';

/**
 * Diagnostic tool to capture AI steps for auditing.
 */
export function logDiagnostic(traceId, data) {
    try {
        const logDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        
        const logPath = path.join(logDir, `hitl_trace_${traceId}.json`);
        fs.writeFileSync(logPath, JSON.stringify(data, null, 2));
        console.log(`[DIAGNOSTIC] Trace saved to ${logPath}`);
    } catch (e) {
        console.error('[DIAGNOSTIC] Failed to save log:', e);
    }
}
