import { BillingSection } from '@/features/app/sections/billing-section';
import { WorkspaceScreen } from '@/features/app/screens/workspace-screen';

export default function BillingRoute() {
  return (
    <WorkspaceScreen section="billing">
      <BillingSection />
    </WorkspaceScreen>
  );
}
