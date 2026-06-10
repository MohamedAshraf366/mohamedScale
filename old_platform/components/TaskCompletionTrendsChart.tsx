import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { format, startOfWeek, startOfMonth, subWeeks, subMonths, parseISO, isWithinInterval, endOfWeek, endOfMonth } from 'date-fns';
import { TrendingUp, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  action: string;
  follow_up_date: string;
  created_at: string;
  status_after: string | null;
  notes: string | null;
  communication_log_id: string;
  follow_up_number?: number;
  follow_up_channel?: string | null;
  isGeneralTask?: boolean;
  priority?: string | null;
  communication_log: {
    id: string;
    company_name: string;
    contact_info: string;
    person_name: string;
    assigned_to: string | null;
    related_supplier_id: string | null;
  } | null;
}

interface TaskCompletionTrendsChartProps {
  tasks: Task[];
}

type ViewMode = 'weekly' | 'monthly';

const TaskCompletionTrendsChart = ({ tasks }: TaskCompletionTrendsChartProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');

  const chartData = useMemo(() => {
    const today = new Date();
    const data: Array<{
      period: string;
      completed: number;
      created: number;
      completionRate: number;
    }> = [];

    if (viewMode === 'weekly') {
      // Last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 0 });
        const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 0 });
        
        const createdInWeek = tasks.filter(task => {
          if (!task.created_at) return false;
          const createdDate = parseISO(task.created_at);
          return isWithinInterval(createdDate, { start: weekStart, end: weekEnd });
        }).length;

        const completedInWeek = tasks.filter(task => {
          if (!task.created_at) return false;
          // Count both 'Closed' and 'Done' as completed
          if (task.status_after !== 'Closed' && task.status_after !== 'Done') return false;
          const createdDate = parseISO(task.created_at);
          return isWithinInterval(createdDate, { start: weekStart, end: weekEnd });
        }).length;

        const completionRate = createdInWeek > 0 
          ? Math.round((completedInWeek / createdInWeek) * 100) 
          : 0;

        data.push({
          period: format(weekStart, 'MMM d'),
          completed: completedInWeek,
          created: createdInWeek,
          completionRate,
        });
      }
    } else {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(today, i));
        const monthEnd = endOfMonth(subMonths(today, i));
        
        const createdInMonth = tasks.filter(task => {
          if (!task.created_at) return false;
          const createdDate = parseISO(task.created_at);
          return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
        }).length;

        const completedInMonth = tasks.filter(task => {
          if (!task.created_at) return false;
          // Count both 'Closed' and 'Done' as completed
          if (task.status_after !== 'Closed' && task.status_after !== 'Done') return false;
          const createdDate = parseISO(task.created_at);
          return isWithinInterval(createdDate, { start: monthStart, end: monthEnd });
        }).length;

        const completionRate = createdInMonth > 0 
          ? Math.round((completedInMonth / createdInMonth) * 100) 
          : 0;

        data.push({
          period: format(monthStart, 'MMM yyyy'),
          completed: completedInMonth,
          created: createdInMonth,
          completionRate,
        });
      }
    }

    return data;
  }, [tasks, viewMode]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const totalCreated = chartData.reduce((sum, d) => sum + d.created, 0);
    const totalCompleted = chartData.reduce((sum, d) => sum + d.completed, 0);
    const avgCompletionRate = totalCreated > 0 
      ? Math.round((totalCompleted / totalCreated) * 100) 
      : 0;
    
    // Trend: compare last period to previous
    const lastPeriod = chartData[chartData.length - 1];
    const prevPeriod = chartData[chartData.length - 2];
    const trend = lastPeriod && prevPeriod 
      ? lastPeriod.completionRate - prevPeriod.completionRate 
      : 0;

    return { totalCreated, totalCompleted, avgCompletionRate, trend };
  }, [chartData]);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Task Completion Trends</CardTitle>
          </div>
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('weekly')}
              className="h-7 text-xs"
            >
              Weekly
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('monthly')}
              className="h-7 text-xs"
            >
              Monthly
            </Button>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="flex items-center gap-6 mt-3 text-sm">
          <div>
            <span className="text-muted-foreground">Total Created:</span>
            <span className="ml-1 font-semibold">{overallStats.totalCreated}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Completed:</span>
            <span className="ml-1 font-semibold text-green-600">{overallStats.totalCompleted}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Avg Rate:</span>
            <span className={cn(
              "ml-1 font-semibold",
              overallStats.avgCompletionRate >= 70 ? "text-green-600" : 
              overallStats.avgCompletionRate >= 40 ? "text-yellow-600" : "text-red-600"
            )}>
              {overallStats.avgCompletionRate}%
            </span>
          </div>
          {overallStats.trend !== 0 && (
            <div className={cn(
              "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
              overallStats.trend > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}>
              {overallStats.trend > 0 ? '↑' : '↓'} {Math.abs(overallStats.trend)}% vs prev
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value: number, name: string) => [
                  value,
                  name === 'created' ? 'Created' : name === 'completed' ? 'Completed' : 'Rate'
                ]}
              />
              <Legend 
                verticalAlign="top" 
                height={24}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground capitalize">{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="created"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCreated)"
                name="created"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCompleted)"
                name="completed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskCompletionTrendsChart;
