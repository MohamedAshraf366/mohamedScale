import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, User, Phone, MapPin, Calendar, Tag, 
  MessageSquare, TrendingUp, FileText, Plus, CalendarClock,
  CheckCircle2, XCircle, Clock, RefreshCw, Eye, Pencil,
  ExternalLink, BarChart3, Users
} from 'lucide-react';
import { format } from 'date-fns';
import { useClientProfile } from '@/hooks/useClientProfile';
import { Skeleton } from '@/components/ui/skeleton';

interface ClientProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string | null;
  onNewCommunication?: (clientData: { company_name: string; person_name: string; contact_info: string; category?: string }) => void;
  onAddFollowUp?: (communicationId: string) => void;
  onViewCommunication?: (communicationId: string) => void;
  onEditCommunication?: (communicationId: string) => void;
}

export function ClientProfileModal({
  open,
  onOpenChange,
  companyName,
  onNewCommunication,
  onAddFollowUp,
  onViewCommunication,
  onEditCommunication,
}: ClientProfileModalProps) {
  const { profileData, loading, error } = useClientProfile(companyName);
  const [activeTab, setActiveTab] = useState('communications');

  const handleNewCommunication = () => {
    if (profileData && onNewCommunication) {
      onNewCommunication({
        company_name: profileData.companyName,
        person_name: profileData.personNames[0] || '',
        contact_info: profileData.contactInfo[0] || '',
        category: profileData.categories[0],
      });
      onOpenChange(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'Open':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Open</Badge>;
      case 'Closed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Closed</Badge>;
      case 'In Follow-up':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">In Follow-up</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const getInterestBadge = (level: string | null) => {
    switch (level) {
      case 'High':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">High</Badge>;
      case 'Medium':
        return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30">Low</Badge>;
      case 'Not interested':
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Not interested</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Not set</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-primary" />
            Client Profile
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">
            <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>{error}</p>
          </div>
        ) : !profileData ? (
          <div className="p-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No client data found</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-auto">
            <div className="space-y-6 p-1">
              {/* Client Header Card */}
              <Card className="border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div className="space-y-3 flex-1 min-w-[300px]">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-bold">{profileData.companyName}</h2>
                        {profileData.isReturningClient ? (
                          <Badge className="bg-primary/20 text-primary border-primary/30">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Returning Client ({profileData.totalInteractions})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            New Client
                          </Badge>
                        )}
                        {profileData.communications.some(c => c.interest_level === 'High') && (
                          <Badge className="bg-green-500/20 text-green-700">High Interest</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {profileData.personNames.length > 0 && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{profileData.personNames.join(', ')}</span>
                          </div>
                        )}
                        {profileData.contactInfo.length > 0 && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{profileData.contactInfo.join(', ')}</span>
                          </div>
                        )}
                        {profileData.categories.length > 0 && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Tag className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{profileData.categories.join(', ')}</span>
                          </div>
                        )}
                        {(profileData.cities.length > 0 || profileData.districts.length > 0) && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {[...profileData.cities, ...profileData.districts].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                        {profileData.firstInteractionDate && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span>First: {format(new Date(profileData.firstInteractionDate), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                        {profileData.lastInteractionDate && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span>Last: {format(new Date(profileData.lastInteractionDate), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-col gap-2">
                      <Button size="sm" onClick={handleNewCommunication}>
                        <Plus className="h-4 w-4 mr-1" />
                        New Communication
                      </Button>
                      {profileData.hasOpenQuotation && (
                        <Button size="sm" variant="outline" className="text-green-600 border-green-500/30">
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Close Deal
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Analytics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 pb-4 text-center">
                    <MessageSquare className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-2xl font-bold text-primary">{profileData.totalInteractions}</p>
                    <p className="text-xs text-muted-foreground">Total Interactions</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 pb-4 text-center">
                    <CalendarClock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                    <p className="text-2xl font-bold text-amber-500">
                      {profileData.followUpStats.completed}/{profileData.followUpStats.total}
                    </p>
                    <p className="text-xs text-muted-foreground">Follow-ups Done</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 pb-4 text-center">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-2xl font-bold text-green-500">{profileData.dealsClosedCount}</p>
                    <p className="text-xs text-muted-foreground">Deals Closed</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 pb-4 text-center">
                    <TrendingUp className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-2xl font-bold text-blue-500">{profileData.conversionRate}%</p>
                    <p className="text-xs text-muted-foreground">Conversion Rate</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs for Communications and Quotations */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="communications" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Communications ({profileData.communications.length})
                  </TabsTrigger>
                  <TabsTrigger value="quotations" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Deals & Quotations ({profileData.quotations.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="communications" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Date</TableHead>
                              <TableHead>Channel</TableHead>
                              <TableHead>Topic</TableHead>
                              <TableHead>Interest</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Follow-up</TableHead>
                              <TableHead>Assigned</TableHead>
                              <TableHead className="w-[80px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {profileData.communications.map((comm) => (
                              <TableRow key={comm.id}>
                                <TableCell className="whitespace-nowrap">
                                  {comm.communication_date 
                                    ? format(new Date(comm.communication_date), 'MMM d, yyyy')
                                    : '-'}
                                </TableCell>
                                <TableCell>{comm.communication_channels || '-'}</TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {comm.topic || comm.summary || '-'}
                                </TableCell>
                                <TableCell>{getInterestBadge(comm.interest_level)}</TableCell>
                                <TableCell>{getStatusBadge(comm.status)}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {comm.follow_up_date 
                                    ? format(new Date(comm.follow_up_date), 'MMM d')
                                    : '-'}
                                </TableCell>
                                <TableCell>{comm.assigned_to || '-'}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7"
                                      onClick={() => onViewCommunication?.(comm.id)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7"
                                      onClick={() => onEditCommunication?.(comm.id)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="quotations" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      {profileData.quotations.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No quotations or deals found</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Interest</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[80px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {profileData.quotations.map((quote) => (
                                <TableRow key={quote.id}>
                                  <TableCell className="whitespace-nowrap">
                                    {quote.communication_date 
                                      ? format(new Date(quote.communication_date), 'MMM d, yyyy')
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {quote.is_soft_quotation ? (
                                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                                        Soft Quote
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">Regular</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>{getInterestBadge(quote.interest_level)}</TableCell>
                                  <TableCell>
                                    {quote.deal_value_total 
                                      ? `SAR ${quote.deal_value_total.toLocaleString()}`
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {quote.deal_completed ? (
                                      <Badge className="bg-green-500/20 text-green-700">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Closed
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-amber-600">
                                        Open
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7"
                                      onClick={() => onViewCommunication?.(quote.id)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
