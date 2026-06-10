import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AgentAction {
  intent_key: string;
  tool_name: string | null;
  title_en: string;
  title_ar: string;
  status: string;
  is_visible: boolean;
  menu_order: number;
  tables: string[];
  keywords: string[];
  example_phrases_en: string[];
  example_phrases_ar: string[];
  main_fields: unknown;
  updated_at: string;
}

const AgentActions = () => {
  const { data: actions, isLoading, error } = useQuery({
    queryKey: ['agent-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_actions')
        .select('*')
        .order('menu_order', { ascending: true });
      
      if (error) throw error;
      return data as AgentAction[];
    },
  });

  const activeCount = actions?.filter(a => a.status === 'active').length ?? 0;
  const visibleCount = actions?.filter(a => a.is_visible).length ?? 0;
  const totalCount = actions?.length ?? 0;

  return (
    <ProtectedRoute>
      <AppLayout title="Agent Actions">
        <div className="space-y-6 p-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agent Actions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              System progress overview for agent tools and actions
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{activeCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Visible in Menu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{visibleCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Actions Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Registered Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-destructive text-sm py-4">
                  Failed to load agent actions
                </div>
              ) : actions && actions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Intent</TableHead>
                        <TableHead>Tool</TableHead>
                        <TableHead>Title (EN)</TableHead>
                        <TableHead>Tables</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Visible</TableHead>
                        <TableHead>Examples</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {actions.map((action) => (
                        <TableRow key={action.intent_key}>
                          <TableCell className="text-muted-foreground text-xs">
                            {action.menu_order}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {action.intent_key}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {action.tool_name || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {action.title_en}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {action.tables.slice(0, 3).map((table) => (
                                <Badge 
                                  key={table} 
                                  variant="secondary" 
                                  className="text-xs font-mono"
                                >
                                  {table}
                                </Badge>
                              ))}
                              {action.tables.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{action.tables.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {action.status === 'active' ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">
                                <XCircle className="h-3 w-3 mr-1" />
                                {action.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {action.is_visible ? (
                              <Eye className="h-4 w-4 text-primary" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                                  <MessageSquare className="h-4 w-4" />
                                  <span className="text-xs">
                                    {action.example_phrases_en.length}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <div className="space-y-1">
                                  <div className="font-medium text-xs mb-2">Example Phrases:</div>
                                  {action.example_phrases_en.slice(0, 3).map((phrase, i) => (
                                    <div key={i} className="text-xs text-muted-foreground">
                                      "{phrase}"
                                    </div>
                                  ))}
                                  {action.example_phrases_en.length > 3 && (
                                    <div className="text-xs text-muted-foreground">
                                      +{action.example_phrases_en.length - 3} more
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm py-8 text-center">
                  No agent actions configured yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default AgentActions;
