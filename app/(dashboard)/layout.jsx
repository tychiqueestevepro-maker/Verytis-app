'use client';

import { Providers, useRole, useModal, useSidebar } from '@/lib/providers';
import FloatingSidebar from '@/components/layout/FloatingSidebar';
import { Modal } from '@/components/ui';
import IntegrationsSettings from '@/components/pages/IntegrationsSettings';
import AdminSecuritySettings from '@/components/pages/AdminSecuritySettings';
import PassportIDSettings from '@/components/pages/PassportIDSettings';
import { createClient } from '@/lib/supabase/client';
import { useEffect } from 'react';

import { useParams, useRouter } from 'next/navigation';

function DashboardContent({ children }) {
    const params = useParams();
    const router = useRouter();
    const { currentRole, setCurrentRole, currentUser, setCurrentUser } = useRole();
    const { activeModal, setActiveModal } = useModal();
    const { isSidebarCollapsed, setIsSidebarCollapsed } = useSidebar();
    const supabase = createClient();

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    setCurrentUser({
                        id: profile.id,
                        name: profile.full_name || user.email.split('@')[0],
                        email: user.email,
                        initials: (profile.full_name?.substring(0, 2) || user.email.substring(0, 2)).toUpperCase(),
                        role: profile.role.charAt(0).toUpperCase() + profile.role.slice(1),
                        color: 'from-blue-500 to-indigo-600'
                    });
                }
            }
        };
        fetchUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <>
            <FloatingSidebar
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={setIsSidebarCollapsed}
                onModalOpen={setActiveModal}
                currentRole={currentRole}
                user={currentUser}
                onLogout={handleLogout}
            />

            <main className={`${isSidebarCollapsed ? 'ml-24' : 'ml-56'} p-8 min-h-screen transition-all duration-300 ease-out`}>
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>

            <Modal
                isOpen={activeModal === 'integrations'}
                onClose={() => setActiveModal(null)}
                title="Company Passport ID"
            >
                <IntegrationsSettings teamId={params?.teamId} />
            </Modal>

            <Modal
                isOpen={activeModal === 'account'}
                onClose={() => setActiveModal(null)}
                title="Admin Security & Logs"
            >
                <AdminSecuritySettings />
            </Modal>

            <Modal
                isOpen={activeModal === 'passport'}
                onClose={() => setActiveModal(null)}
                title="My Passport ID"
            >
                <PassportIDSettings />
            </Modal>
        </>
    );
}

export default function DashboardLayout({ children }) {
    return (
        <Providers>
            <DashboardContent>{children}</DashboardContent>
        </Providers>
    );
}
