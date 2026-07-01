import { Layout } from '@/components/layout/Layout';
import { GoogleOAuthAlert } from '@/components/dashboard/GoogleOAuthAlert';
import { ActionCenterPanel } from '@/components/dashboard/ActionCenterPanel';

export default function Dashboard() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-2">
        <GoogleOAuthAlert />
        <ActionCenterPanel />
      </div>
    </Layout>
  );
}
