import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarketPerformanceCard } from "@/components/market/MarketPerformanceCard";
import { EPSRevenueChart } from "@/components/financials/EPSRevenueChart";
import { CashChart } from "@/components/financials/CashChart";
import { OrderBacklogChart } from "@/components/financials/OrderBacklogChart";
import { RatiosModule } from "@/components/ratios/RatiosModule";
import { OwnershipModule } from "@/components/ownership/OwnershipModule";
import { NewsFeed } from "@/components/news/NewsFeed";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      {/* Row 1: Live market data + EPS/Revenue chart */}
      <div className="xl:col-span-4">
        <MarketPerformanceCard />
      </div>
      <div className="xl:col-span-8">
        <EPSRevenueChart />
      </div>

      {/* Row 2: Cash trend + Order backlog */}
      <div className="xl:col-span-6">
        <CashChart />
      </div>
      <div className="xl:col-span-6">
        <OrderBacklogChart />
      </div>

      {/* Row 3: Ratios */}
      <div className="xl:col-span-12">
        <RatiosModule />
      </div>

      {/* Row 4: Ownership + News */}
      <div className="xl:col-span-8">
        <OwnershipModule />
      </div>
      <div className="xl:col-span-4">
        <NewsFeed />
      </div>
    </DashboardLayout>
  );
}
