import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { email, password, fullName, orgName } = await req.json();

        if (!email || !password || !fullName || !orgName) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // 1. Create the Organization
        const slug = orgName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
                name: orgName,
                slug: slug,
                domain: email.split('@')[1]
            })
            .select()
            .single();

        if (orgError) {
            console.error('Organization creation error:', orgError);
            return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
        }

        // 2. Create user with auto-confirm enabled
        const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        });

        if (error) {
            console.error('Signup error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // 3. Create the profile record as ADMIN
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: user.id,
                organization_id: org.id,
                email: email,
                full_name: fullName,
                role: 'admin', // First member is admin
                status: 'active'
            });

        if (profileError) {
            console.error('Profile creation error:', profileError);
        }

        return NextResponse.json({ success: true, user });
    } catch (error) {
        console.error('Signup API Catch:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
