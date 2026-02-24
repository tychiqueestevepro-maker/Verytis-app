import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Nécessaire pour créer des users sans confirmation email
);

const ORG_ID = '1abe99cd-78ae-4f6a-b839-c44e68e408d1';

const members = [
    { name: 'Brooklyn Simmons', job: 'Cloud Architect' },
    { name: 'Cameron Williamson', job: 'Security Engineer' },
    { name: 'David Miller', job: 'Frontend Dev' },
    { name: 'Jane Cooper', job: 'Compliance Officer' },
    { name: 'Sarah Jenkins', job: 'Product Manager' },
    { name: 'Alex Rivera', job: 'DevOps Specialist' },
    { name: 'Elena Rodriguez', job: 'SOC Analyst' },
    { name: 'Marcus Thorne', job: 'IAM Architect' },
    { name: 'Sophie Chen', job: 'Fullstack Dev' },
    { name: 'Oliver Wright', job: 'Backend Engineer' },
    { name: 'Mia Thompson', job: 'QA Lead' },
    { name: 'Lucas Garcia', job: 'Security Auditor' },
    { name: 'Ava Wilson', job: 'UX Engineer' },
    { name: 'Ethan Hunt', job: 'Systems Admin' },
    { name: 'Isabella Ross', job: 'Project Lead' }
];

async function seed() {
    console.log('🚀 Démarrage du peuplement des membres Verytis...');

    for (const member of members) {
        const email = `${member.name.toLowerCase().replace(/ /g, '.')}@verytis.com`;

        console.log(`Creating ${email}...`);

        // 1. Créer l'utilisateur dans Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { full_name: member.name }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log(`User ${email} already exists, skipping auth...`);
                continue;
            }
            console.error(`Error creating auth user ${email}:`, authError.message);
            continue;
        }

        const userId = authUser.user.id;

        // 2. Mettre à jour le Profil (Certains triggers le créent déjà, on fait un UPSERT sécurisé)
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: userId,
            organization_id: ORG_ID,
            email: email,
            full_name: member.name,
            job_title: member.job,
            role: 'member',
            status: 'active',
            slack_user_id: `sl_${userId.substring(0, 5)}`,
            social_profiles: {
                github: { username: member.name.toLowerCase().split(' ')[0], connected_at: new Date() },
                trello: { username: member.name.toLowerCase().split(' ')[0] + '_v', connected_at: new Date() }
            }
        });

        if (profileError) console.error(`Error updating profile ${email}:`, profileError.message);

        // 3. Ajouter à une équipe aléatoire
        const { data: team } = await supabase.from('teams').select('id').eq('organization_id', ORG_ID).limit(1).single();
        if (team) {
            await supabase.from('team_members').upsert({
                team_id: team.id,
                user_id: userId,
                role: 'member'
            });
        }

        // 4. Créer des Passport Connections
        await supabase.from('connections').upsert([
            { user_id: userId, provider: 'slack', provider_user_id: `sl_${userId.substring(0, 5)}`, status: 'connected', email: email },
            { user_id: userId, provider: 'github', provider_user_id: `gh_${userId.substring(0, 5)}`, status: 'connected', email: email }
        ]);
    }

    console.log('✅ 15 membres créés et configurés avec succès !');
}

seed();
