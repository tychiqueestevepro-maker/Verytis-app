import dynamic from 'next/dynamic';

export { default as Dashboard } from './Dashboard';
export { default as Teams } from './TeamsList';
export { default as TeamDetail } from './TeamDetail';
export { default as Channels } from './ChannelsList';
export { default as ChannelDetail } from './ChannelDetail';
export { default as TimelineIntegrationList } from './TimelineIntegrationList';
export { default as TimelineResourceList } from './TimelineResourceList';
export { default as TimelineFeed } from './TimelineFeed';

export const AuditDocumentation = dynamic(() => import('./AuditDocumentation'), { ssr: false });
export { default as UsersAndRoles } from './UsersAndRoles';
export { default as UserDetail } from './UserDetail';
export { default as IntegrationsSettings } from './IntegrationsSettings';
export { default as AdminSecuritySettings } from './AdminSecuritySettings';
export { default as PassportIDSettings } from './PassportIDSettings';
