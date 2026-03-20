import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidGoogleToken } from '@/lib/google/tokens';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type'); // 'drive_folders' or 'calendars'

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
        const organizationId = profile?.organization_id;

        const token = await getValidGoogleToken({ organizationId });
        if (!token) {
            return NextResponse.json({ error: 'Google Workspace not connected' }, { status: 404 });
        }

        if (type === 'drive_folders') {
            // 1. Fetch folders (including those in shared drives)
            const foldersRes = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType=\'application/vnd.google-apps.folder\' and trashed = false&fields=files(id, name, driveId)&supportsAllDrives=true&includeItemsFromAllDrives=true', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const foldersData = await foldersRes.json();
            
            // 2. Fetch root Shared Drives (Team Drives)
            const drivesRes = await fetch('https://www.googleapis.com/drive/v3/drives', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const drivesData = await drivesRes.json();

            const drives = (drivesData.drives || []).map(d => ({
                label: `🏢 [DRIVE ÉQUIPE] ${d.name}`,
                value: d.id
            }));

            const folders = (foldersData.files || []).map(f => ({ 
                label: f.driveId ? `📁 [Équipe] ${f.name}` : `📁 [Perso] ${f.name}`, 
                value: f.id 
            }));

            // Merge: Drives first, then folders
            return NextResponse.json([...drives, ...folders]);
        }

        if (type === 'calendars') {
            const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            const calendars = (data.items || []).map(c => ({ label: c.summary, value: c.id }));
            return NextResponse.json(calendars);
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (err) {
        console.error('[GOOGLE METADATA] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
