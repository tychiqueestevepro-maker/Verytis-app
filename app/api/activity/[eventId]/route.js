import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(req, { params }) {
    const { eventId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Resolve profile for organization_id
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        // Hard delete the activity log entry
        // The BEFORE DELETE trigger will automatically move it to archive_items
        const { error } = await supabase
            .from('activity_logs')
            .delete()
            .eq('id', eventId)
            .eq('organization_id', profile.organization_id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Error deleting activity log:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
