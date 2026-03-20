import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/archive/[itemId] — Get full archived item data
export async function GET(req, { params }) {
    try {
        const { itemId } = await params;
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

        const { data: item, error } = await supabase
            .from('archive_items')
            .select('*')
            .eq('id', itemId)
            .eq('organization_id', profile.organization_id)
            .single();

        if (error || !item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

        return NextResponse.json({ item });

    } catch (error) {
        console.error('Error fetching archive item:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/archive/[itemId] — Move to trash (30-day soft delete)
export async function DELETE(req, { params }) {
    try {
        const { itemId } = await params;
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        if (profile.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

        // Fetch the item
        const { data: item, error: fetchError } = await supabase
            .from('archive_items')
            .select('*')
            .eq('id', itemId)
            .eq('organization_id', profile.organization_id)
            .single();

        if (fetchError || !item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

        // Move to trash
        const purgeAt = new Date();
        purgeAt.setDate(purgeAt.getDate() + 30);

        const { error: trashError } = await supabase.from('archive_trash').insert({
            organization_id: profile.organization_id,
            archive_item_id: item.id,
            section: item.section,
            category: item.category,
            label: item.label,
            data: item.data,
            content_hash: item.content_hash || null,
            deleted_by: user.id,
            purge_at: purgeAt.toISOString(),
        });

        if (trashError) throw trashError;

        // Delete from archive_items
        const { error: deleteError } = await supabase
            .from('archive_items')
            .delete()
            .eq('id', itemId)
            .eq('organization_id', profile.organization_id);

        if (deleteError) throw deleteError;

        // Audit log
        await supabase.from('activity_logs').insert({
            organization_id: profile.organization_id,
            actor_id: user.id,
            action_type: 'DATA_TRASHED',
            summary: `Moved "${item.label}" to trash (purge in 30 days)`,
            metadata: { archive_item_id: itemId, section: item.section, purge_at: purgeAt.toISOString() }
        });

        return NextResponse.json({ success: true, purge_at: purgeAt.toISOString() });

    } catch (error) {
        console.error('Error trashing item:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
