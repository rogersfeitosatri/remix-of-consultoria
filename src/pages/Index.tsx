import { Layout } from '@/components/layout/Layout';
import { GoogleOAuthAlert } from '@/components/dashboard/GoogleOAuthAlert';
import { ActionCenterPanel } from '@/components/dashboard/ActionCenterPanel';
import { BiweeklyContactPanel } from '@/components/dashboard/BiweeklyContactPanel';

export default function Dashboard() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-2">
        <GoogleOAuthAlert />
        <ActionCenterPanel />
        <BiweeklyContactPanel />
      </div>
    </Layout>
  );
}
