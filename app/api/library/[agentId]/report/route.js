import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';

export async function POST(req, { params }) {
    try {
        const { agentId } = await params;
        const body = await req.json();
        const { message, agentName } = body;

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Configure Nodemailer transporter using environment variables
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Email content
        const mailOptions = {
            from: process.env.SMTP_FROM || '"Verytis Team" <noreply@earlyverytis.com>',
            to: process.env.SMTP_USER, // Sending to the admin/support email itself as a notification
            replyTo: user.email,
            subject: `🚨 Signalement de Problème: Agent ${agentName || agentId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #e11d48;">Signalement de Problème d'Agent</h2>
                    <p>Un utilisateur a signalé un problème avec un agent de la Librairie.</p>
                    
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-top: 20px;">
                        <p><strong>Agent ID:</strong> ${agentId}</p>
                        <p><strong>Nom de l'Agent:</strong> ${agentName || 'Non spécifié'}</p>
                        <p><strong>Signalé par:</strong> ${user.email} (ID: ${user.id})</p>
                    </div>

                    <h3 style="margin-top: 20px; color: #334155;">Message du signalement:</h3>
                    <div style="background-color: #fff1f2; padding: 15px; border-left: 4px solid #e11d48; border-radius: 4px; color: #4c0519; white-space: pre-wrap;">
                        ${message}
                    </div>
                </div>
            `,
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true, message: 'Report email sent successfully' });

    } catch (err) {
        console.error('Error sending report email:', err);
        return NextResponse.json({ error: 'Failed to send report email' }, { status: 500 });
    }
}
