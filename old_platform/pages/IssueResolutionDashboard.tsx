import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Truck,
  Users,
  Package,
  RefreshCw,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useSupplierIssues,
  useIssueStats,
  useSuppliersWithMostIssues,
  useUpdateIssue,
  SupplierIssue,
  IssueStatus,
  IssueSeverity,
  IssueSource,
  getSeverityColor,
  getStatusColor,
  getStatusLabel,
  getIssueTypeLabel,
  getSourceLabel,
  getIssueAge,
} from '@/hooks/useSupplierIssues';
import IssueResolutionDialog from '@/components/IssueResolutionDialog';

const IssueResolutionDashboard = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<IssueSource | 'all'>('all');
  const [selectedIssue, setSelectedIssue] = useState<SupplierIssue | null>(null);
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);

  // Get status filter based on tab
  const statusFilter = activeTab === 'all' ? undefined : activeTab as IssueStatus;

  const { data: issues = [], isLoading, refetch } = useSupplierIssues({
    status: statusFilter,
    severity: severityFilter === 'all' ? undefined : severityFilter,
    source: sourceFilter === 'all' ? undefined : sourceFilter,
  });
  const { data: stats } = useIssueStats();
  const { data: topSuppliers = [] } = useSuppliersWithMostIssues(5);
  const updateIssue = useUpdateIssue();

  const filteredIssues = issues.filter(issue =>
    issue.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.order_reference?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStatusChange = async (issueId: string, newStatus: IssueStatus) => {
    if (newStatus === 'resolved') {
      const issue = issues.find(i => i.id === issueId);
      if (issue) {
        setSelectedIssue(issue);
        setResolutionDialogOpen(true);
      }
    } else {
      await updateIssue.mutateAsync({ id: issueId, status: newStatus });
    }
  };

  const handleResolveClick = (issue: SupplierIssue) => {
    setSelectedIssue(issue);
    setResolutionDialogOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Issue Resolution Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Track, investigate, and resolve supplier issues
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold text-red-600">{stats?.open || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Investigating</p>
                  <p className="text-2xl font-bold text-blue-600">{stats?.inInvestigation || 0}</p>
                </div>
                <Eye className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Escalated</p>
                  <p className="text-2xl font-bold text-purple-600">{stats?.escalated || 0}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-purple-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.resolved || 0}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-red-600">{stats?.critical || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Issues Table - 3 columns */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-base font-medium">Supplier Issues</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-[180px]"
                      />
                    </div>
                    <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
                      <SelectTrigger className="w-[120px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severity</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="minor">Minor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="auto_logistics">Auto (Logistics)</SelectItem>
                        <SelectItem value="manual_sales">Sales Team</SelectItem>
                        <SelectItem value="manual_ops">Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="px-6 pt-2">
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="open" className="relative">
                        Open
                        {(stats?.open || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                            {stats?.open}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="in_investigation">Investigating</TabsTrigger>
                      <TabsTrigger value="escalated_to_renegotiation">Escalated</TabsTrigger>
                      <TabsTrigger value="resolved">Resolved</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value={activeTab} className="mt-0">
                    {isLoading ? (
                      <div className="p-8 text-center text-muted-foreground">Loading...</div>
                    ) : filteredIssues.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500/30" />
                        <p>No issues found</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Age</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Reported</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredIssues.map((issue) => {
                            const age = getIssueAge(issue.created_at);
                            const isOld = age.days >= 7;
                            const isVeryOld = age.days >= 14;
                            
                            return (
                              <TableRow key={issue.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{issue.supplier?.name || 'Unknown'}</p>
                                    {issue.material && (
                                      <p className="text-xs text-muted-foreground">{issue.material.name}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{getIssueTypeLabel(issue.issue_type)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                                    {issue.severity}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className={`h-3.5 w-3.5 ${
                                      isVeryOld ? 'text-red-500' : 
                                      isOld ? 'text-amber-500' : 
                                      'text-muted-foreground'
                                    }`} />
                                    <span className={`text-sm font-medium ${
                                      isVeryOld ? 'text-red-600' : 
                                      isOld ? 'text-amber-600' : 
                                      'text-foreground'
                                    }`}>
                                      {age.label}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={getStatusColor(issue.status)}>
                                    {getStatusLabel(issue.status)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(issue.created_at), 'MMM d, HH:mm')}
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem 
                                        onClick={() => handleStatusChange(issue.id, 'in_investigation')}
                                        disabled={issue.status === 'resolved'}
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Start Investigation
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handleResolveClick(issue)}
                                        disabled={issue.status === 'resolved'}
                                      >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Resolve Issue
                                      </DropdownMenuItem>
                                      {issue.linked_renegotiation_id && (
                                        <DropdownMenuItem>
                                          <ArrowUpRight className="h-4 w-4 mr-2" />
                                          View Renegotiation
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Source Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Issue Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Auto (Logistics)</span>
                    </div>
                    <Badge variant="secondary">{stats?.autoLogged || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Sales Team</span>
                    </div>
                    <Badge variant="secondary">{stats?.manualSales || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Operations</span>
                    </div>
                    <Badge variant="secondary">{stats?.manualOps || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Problematic Suppliers */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Top Issue Suppliers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topSuppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No suppliers with issues
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topSuppliers.map((supplier, index) => (
                      <div key={supplier.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground w-4">
                            {index + 1}.
                          </span>
                          <div>
                            <p className="text-sm font-medium">{supplier.name}</p>
                            {supplier.is_at_risk && (
                              <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                                At Risk
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{supplier.issueCount}</p>
                          {supplier.criticalCount > 0 && (
                            <p className="text-xs text-red-600">{supplier.criticalCount} critical</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Critical Issues Alert */}
            {(stats?.critical || 0) > 0 && (
              <Card className="border-red-500/50 bg-red-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-600">Critical Issues Pending</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {stats?.critical} critical issue{stats?.critical !== 1 ? 's' : ''} require supplier justification before resolution.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Resolution Dialog */}
      <IssueResolutionDialog
        open={resolutionDialogOpen}
        onOpenChange={setResolutionDialogOpen}
        issue={selectedIssue}
      />
    </Layout>
  );
};

export default IssueResolutionDashboard;
