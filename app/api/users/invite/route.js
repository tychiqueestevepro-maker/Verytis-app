import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendEmail } from '../../../../lib/email';

export async function POST(req) {
    const body = await req.json();
    const { email, name, role } = body;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const targetOrgId = profile.organization_id;

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    try {
        let newUserId;
        let authAction = 'invited';

        // 1. Generate Invite Link (Admin only)
        let { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'invite',
            email: email,
            options: {
                data: { full_name: name },
                redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`
            }
        });

        if (linkError) {
            console.warn("Generate link failed:", linkError.message);
            if (linkError.message.includes("already registered") || linkError.status === 422) {
                // User already exists in Auth - find them
                const { data: listData } = await supabase.auth.admin.listUsers();
                const existing = listData.users.find(u => u.email === email);

                if (existing) {
                    newUserId = existing.id;

                    // Check if user is still pending (needs to complete onboarding)
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('status')
                        .eq('id', existing.id)
                        .single();

                    if (profile?.status === 'pending') {
                        // Generate a magic link for resending invitation
                        const { data: magicLinkData, error: magicError } = await supabase.auth.admin.generateLink({
                            type: 'magiclink',
                            email: email,
                            options: {
                                redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`
                            }
                        });

                        if (!magicError && magicLinkData?.properties?.action_link) {
                            authAction = 'resend';
                            // Store the link for email sending later
                            linkData = magicLinkData;
                        } else {
                            console.warn("Magic link generation failed:", magicError?.message);
                            authAction = 'exists';
                        }
                    } else {
                        authAction = 'exists';
                    }
                } else {
                    throw linkError;
                }
            } else {
                throw linkError;
            }
        } else {
            newUserId = linkData.user.id;
        }

        // 2. Send Custom Email via SMTP (for new invites or resends to pending users)
        if ((authAction === 'invited' || authAction === 'resend') && linkData?.properties?.action_link) {
            const inviteUrl = linkData.properties.action_link;
            const logoPath = '/Users/tychiqueesteve/Verytis-app/components/image/Gemini Generated Image (14).png';

            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                            <td align="center" style="padding: 40px 0;">
                                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">
                                    
                                    <!-- Header with Logo -->
                                    <tr>
                                        <td align="center" style="padding: 40px 0 30px 0; background-color: #ffffff; border-bottom: 1px solid #f3f4f6;">
                                            <img src="cid:logo" alt="Verytis Logo" width="100" style="display: block; border-style: none;" />
                                        </td>
                                    </tr>

                                    <!-- Content -->
                                    <tr>
                                        <td style="padding: 40px 50px;">
                                            <h1 style="color: #111827; font-size: 22px; margin: 0 0 24px 0; font-weight: 600; text-align: center;">Join the workspace "Verytis"</h1>
                                            
                                            <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 32px 0; text-align: center;">
                                                You have been invited by the administrator to collaborate on the workspace <strong>Verytis</strong>.
                                            </p>

                                            <!-- Details Box -->
                                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; border-radius: 8px; margin-bottom: 32px;">
                                                <tr>
                                                    <td style="padding: 24px;">
                                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                            <tr>
                                                                <td style="padding-bottom: 8px; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Workspace</td>
                                                            </tr>
                                                            <tr>
                                                                <td style="padding-bottom: 16px; color: #111827; font-size: 16px; font-weight: 500;">Verytis (Production)</td>
                                                            </tr>
                                                            <tr>
                                                                <td style="padding-bottom: 8px; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Role</td>
                                                            </tr>
                                                            <tr>
                                                                <td style="color: #111827; font-size: 16px; font-weight: 500;">${role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member'}</td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>

                                            <!-- Button -->
                                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                <tr>
                                                    <td align="center">
                                                        <a href="${inviteUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #2563EB; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                                                            Accept Invitation &rarr;
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                            
                                            <p style="color: #9ca3af; font-size: 14px; line-height: 20px; margin: 32px 0 0 0; text-align: center;">
                                                This link expires in 2 hours and can only be used once.
                                            </p>
                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="background-color: #f9fafb; padding: 24px 50px; text-align: center; border-top: 1px solid #e5e7eb;">
                                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                                &copy; ${new Date().getFullYear()} Verytis. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `;

            const emailResult = await sendEmail({
                to: email,
                subject: 'You have been invited to join Verytis',
                html: emailHtml,
                attachments: [{
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'logo'
                }]
            });

            if (!emailResult.success) {
                console.warn("SMTP Sending failed:", emailResult.error);
            }
        }

        // 3. Create/Update Profile Entry
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .upsert([{
                id: newUserId,
                organization_id: targetOrgId,
                email,
                full_name: name || email.split('@')[0],
                role: (role || 'member').toLowerCase(),
                status: 'pending',
                avatar_url: '',
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (profileError) throw profileError;

        // 4. If Manager and Team provided, assign to team and update scopes
        if (role === 'manager' && body.teamId) {
            const teamId = body.teamId;
            const scopes = body.scopes || [];

            // Add member as Lead
            const { error: memberError } = await supabase
                .from('team_members')
                .upsert([{
                    team_id: teamId,
                    user_id: newUserId,
                    role: 'lead'
                }], { onConflict: 'team_id,user_id' });

            if (memberError) console.error("Error adding manager to team:", memberError);

            // Update Team Scopes
            if (scopes.length > 0) {
                const { data: teamData } = await supabase
                    .from('teams')
                    .select('settings')
                    .eq('id', teamId)
                    .single();

                const currentSettings = teamData?.settings || {};
                const newSettings = { ...currentSettings, scopes: scopes };

                const { error: scopeError } = await supabase
                    .from('teams')
                    .update({ settings: newSettings })
                    .eq('id', teamId);

                if (scopeError) console.error("Error updating team scopes:", scopeError);
            }
        }

        return NextResponse.json({
            user: profile,
            message: authAction === 'exists' ? 'User already exists.' : 'Invitation email sent via Custom SMTP'
        });

    } catch (error) {
        console.error('Error inviting user:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
