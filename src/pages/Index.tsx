import { Layout } from '@/components/layout/Layout';
import { GoogleOAuthAlert } from '@/components/dashboard/GoogleOAuthAlert';
import { OperationalPanel } from '@/components/dashboard/OperationalPanel';
import { BiweeklyContactPanel } from '@/components/dashboard/BiweeklyContactPanel';
import { AthleteRadarPanel } from '@/components/dashboard/AthleteRadarPanel';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export default function Dashboard() {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl space-y-8 pb-16">
        <div className="flex justify-end">
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
