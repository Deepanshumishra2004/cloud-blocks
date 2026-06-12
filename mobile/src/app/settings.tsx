import { SettingsSection } from '@/features/app/sections/settings-section';
import { WorkspaceScreen } from '@/features/app/screens/workspace-screen';

export default function SettingsRoute() {
  return (
    <WorkspaceScreen section="settings">
      <SettingsSection />
    </WorkspaceScreen>
  );
}
