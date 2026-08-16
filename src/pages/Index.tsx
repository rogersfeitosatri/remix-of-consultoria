import { Layout } from '@/components/layout/Layout';
import { GoogleOAuthAlert } from '@/components/dashboard/GoogleOAuthAlert';
import { DashboardHome } from '@/components/dashboard/DashboardHome';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export default function Dashboard() {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-xl space-y-6 pb-16">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <GoogleOAuthAlert />
        <DashboardHome />
      </div>
    </Layout>
  );
}
