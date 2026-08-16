import { Layout } from '@/components/layout/Layout';
import { GoogleOAuthAlert } from '@/components/dashboard/GoogleOAuthAlert';
import { OperationalPanel } from '@/components/dashboard/OperationalPanel';
import { BiweeklyContactPanel } from '@/components/dashboard/BiweeklyContactPanel';
import { AthleteRadarPanel } from '@/components/dashboard/AthleteRadarPanel';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export default function Dashboard() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-2">
        <div className="flex justify-end mb-3">
          <ThemeToggle />
        </div>
        <GoogleOAuthAlert />
        <OperationalPanel />
        <AthleteRadarPanel />
        <BiweeklyContactPanel />
      </div>
    </Layout>
  );
}
