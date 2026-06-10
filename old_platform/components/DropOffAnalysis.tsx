import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, AlertCircle, DollarSign, Clock, MessageSquare, HelpCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DropOffReason {
  reason: string;
  count: number;
  percentage: number;
}

interface DropOffAnalysisProps {
  reasons: DropOffReason[];
  totalDropOffs: number;
}

const REASON_ICONS: Record<string, React.ReactNode> = {
  'Price Too High': <DollarSign className="h-4 w-4" />,
  'Not interested': <MessageSquare className="h-4 w-4" />,
  'Specific Requirements Needed': <HelpCircle className="h-4 w-4" />,
  'Payment Terms Issue': <DollarSign className="h-4 w-4" />,
  'No Response': <Clock className="h-4 w-4" />,
  'Unknown': <AlertCircle className="h-4 w-4" />,
};

const REASON_COLORS: Record<string, string> = {
  'Price Too High': 'hsl(0, 70%, 55%)',
  'Not interested': 'hsl(30, 80%, 50%)',
  'Specific Requirements Needed': 'hsl(45, 85%, 50%)',
  'Payment Terms Issue': 'hsl(200, 70%, 50%)',
  'No Response': 'hsl(220, 60%, 55%)',
  'Unknown': 'hsl(0, 0%, 50%)',
};

const DropOffAnalysis = ({ reasons, totalDropOffs }: DropOffAnalysisProps) => {
  const chartData = reasons.slice(0, 6).map(r => ({
    ...r,
    fill: REASON_COLORS[r.reason] || 'hsl(var(--primary))'
  }));

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-red-500" />
          Drop-off Analysis
        </CardTitle>
        <CardDescription>
          Understanding why leads don't convert — {totalDropOffs} total drop-offs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reasons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No drop-off data available for the selected period</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart */}
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" horizontal={false} />
                  <XAxis 
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="reason"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    width={130}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => [`${value} leads`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Reason Cards */}
            <div className="space-y-3">
              {reasons.slice(0, 5).map((reason, index) => (
                <div 
                  key={reason.reason}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-red-100 text-red-600">
                      {REASON_ICONS[reason.reason] || <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{reason.reason}</p>
                      <p className="text-xs text-muted-foreground">{reason.count} leads lost</p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`
                      ${reason.percentage >= 30 ? 'bg-red-50 text-red-700 border-red-200' : 
                        reason.percentage >= 15 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                        'bg-muted text-muted-foreground'}
                    `}
                  >
                    {reason.percentage.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DropOffAnalysis;
