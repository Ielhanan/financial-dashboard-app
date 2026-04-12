import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarketPerformanceCard } from "@/components/market/MarketPerformanceCard";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="xl:col-span-4">
        <MarketPerformanceCard />
      </div>
    </DashboardLayout>
  );
}
