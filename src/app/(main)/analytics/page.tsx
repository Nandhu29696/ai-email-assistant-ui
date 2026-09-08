"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import api from "@/lib/api";
import LoadingSpinner from "@/components/UI/LoadingSpinner";
import type { TrendsResponse, DashboardStats } from "@/types";

const COLORS = {
  positive: "#22c55e",
  neutral:  "#94a3b8",
  negative: "#ef4444",
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#3b82f6",
};

const CATEGORY_COLORS = [
  "#6366f1","#3b82f6","#22c55e","#f97316","#ec4899","#eab308","#14b8a6"
];

const PERIODS = [7, 14, 30, 60, 90];

function useStats()  { return useQuery<DashboardStats>({ queryKey: ["stats"], queryFn: () => api.get("/api/dashboard/stats").then(r => r.data) }); }
function useTrends(d: number) { return useQuery<TrendsResponse>({ queryKey: ["trends", d], queryFn: () => api.get(`/api/dashboard/trends?days=${d}`).then(r => r.data), staleTime: 60_000 }); }

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30);
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: trends, isLoading: trendsLoading } = useTrends(period);

  const isLoading = statsLoading || trendsLoading;

  const categoryData = stats
    ? Object.entries(stats.category).map(([key, val]) => ({ name: key, value: val }))
    : [];

  const priorityData = stats
    ? Object.entries(stats.priority).map(([key, val]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        count: val,
        fill: COLORS[key as keyof typeof COLORS] ?? "#94a3b8",
      }))
    : [];

  const sentimentData = stats
    ? [
        { name: "Positive", value: stats.sentiment.positive, fill: COLORS.positive },
        { name: "Neutral",  value: stats.sentiment.neutral,  fill: COLORS.neutral },
        { name: "Negative", value: stats.sentiment.negative, fill: COLORS.negative },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Email volume, sentiment, and category trends</p>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {PERIODS.map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === d
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={36} /></div>
      ) : (
        <>
          {/* Breakdowns row */}
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
            {/* Sentiment pie */}
            <div className="flex min-h-[300px] flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Sentiment Split</h2>
              <ResponsiveContainer width="100%" height={245}>
                <PieChart>
                  <Pie data={sentimentData} cx="50%" cy="42%" innerRadius={55} outerRadius={78} dataKey="value" paddingAngle={3}>
                    {sentimentData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={40} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>


            {/* Priority bar */}
            <div className="flex min-h-[300px] flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Priority Breakdown</h2>
              <ResponsiveContainer width="100%" height={245}>
                <BarChart data={priorityData} layout="vertical" margin={{ top: 4, left: 0, right: 12, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category pie */}
            <div className="flex min-h-[300px] flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Category Split</h2>
              <ResponsiveContainer width="100%" height={245}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="38%" outerRadius={78} dataKey="value" paddingAngle={2}>
                    {categoryData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={58} iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sentiment trend */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Sentiment Trend — Last {period} Days</h2>
            <ResponsiveContainer width="100%" height={270}>
              <LineChart data={trends?.trends ?? []} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                <Line type="monotone" dataKey="positive" stroke={COLORS.positive} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="neutral"  stroke={COLORS.neutral}  dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="negative" stroke={COLORS.negative} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Volume bar chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Daily Email Volume</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trends?.trends ?? []} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </>
      )}
    </div>
  );
}
