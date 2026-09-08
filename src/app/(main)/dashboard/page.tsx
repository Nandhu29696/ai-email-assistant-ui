"use client";

import { Mail, MailOpen, AlertTriangle, TrendingUp, Clock, CheckCircle2, Layers, Activity } from "lucide-react";
import StatsCard from "@/components/Dashboard/StatsCard";
import SentimentChart from "@/components/Dashboard/SentimentChart";
import PriorityChart from "@/components/Dashboard/PriorityChart";
import CategoryChart from "@/components/Dashboard/CategoryChart";
import RecentEmails from "@/components/Dashboard/RecentEmails";
import LoadingSpinner from "@/components/UI/LoadingSpinner";
import { useDashboardStats, useDashboardTrends } from "@/hooks/useDashboard";
import { useEmails } from "@/hooks/useEmails";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ReplyTrackerSummary } from "@/types";

function useTrackerSummary() {
  return useQuery<ReplyTrackerSummary>({
    queryKey: ["reply-tracker-summary"],
    queryFn: () => api.get("/api/reply-tracker/summary?days=7").then((r) => r.data),
    staleTime: 60_000,
  });
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: trendsData, isLoading: trendsLoading } = useDashboardTrends(30);
  const { data: emailsData } = useEmails();
  const { data: trackerSummary } = useTrackerSummary();

  if (statsLoading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size={36} />
      </div>
    );
  }
  if (!stats) return null;

  const processingRate = stats.total_emails
    ? Math.round((stats.processed_emails / stats.total_emails) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of your email pipeline</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Emails"  value={stats.total_emails}                   icon={<Mail size={20} />}          colorClass="text-blue-600 bg-blue-50"   trend={null} />
        <StatsCard label="Unread"        value={stats.unread_emails}                  icon={<MailOpen size={20} />}      colorClass="text-orange-600 bg-orange-50" trend={null} />
        <StatsCard label="Critical"      value={stats.critical_emails}               icon={<AlertTriangle size={20} />} colorClass="text-red-600 bg-red-50"     trend={null} />
        <StatsCard label="Avg Sentiment" value={stats.avg_sentiment_score.toFixed(2)} icon={<TrendingUp size={20} />}   colorClass="text-green-600 bg-green-50"  sub="−1 → +1 scale" trend={null} />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Processed"     value={`${processingRate}%`}                                icon={<CheckCircle2 size={20} />}  colorClass="text-teal-600 bg-teal-50"   sub={`${stats.processed_emails} of ${stats.total_emails}`} trend={null} />
        <StatsCard label="SLA Breaches"  value={trackerSummary?.sla_breaches ?? "—"}               icon={<Clock size={20} />}         colorClass="text-rose-600 bg-rose-50"   sub="Last 7 days"    trend={null} />
        <StatsCard label="Avg Response"  value={trackerSummary ? `${Math.round(trackerSummary.avg_response_minutes)}m` : "—"} icon={<Activity size={20} />} colorClass="text-violet-600 bg-violet-50" sub="Avg reply time" trend={null} />
        <StatsCard label="Categories"    value={Object.keys(stats.category).length}                icon={<Layers size={20} />}        colorClass="text-indigo-600 bg-indigo-50" sub="Active buckets" trend={null} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!trendsLoading && trendsData && <SentimentChart trends={trendsData.trends} />}
        <PriorityChart priority={stats.priority} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryChart category={stats.category} />
        {emailsData && emailsData.items.length > 0 && (
          <RecentEmails emails={emailsData.items.slice(0, 8)} />
        )}
      </div>

      {/* Reply tracker mini summary */}
      {trackerSummary && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Reply Tracker — Last 7 Days</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(trackerSummary.status_breakdown).map(([status, count]) => (
              <div key={status} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xl font-bold text-slate-800">{count}</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">{status}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
