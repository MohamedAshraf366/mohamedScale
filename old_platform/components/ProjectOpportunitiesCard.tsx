import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Briefcase, 
  Target, 
  ChevronDown, 
  ChevronRight, 
  Plus,
  MapPin,
  Calendar,
  MessageSquare,
  ClipboardList,
  ShoppingCart,
  Lock,
  ArrowRight,
  CheckCircle2,
  Handshake
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ConvertToDealDialog } from './ConvertToDealDialog';

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  interest_level?: string | null;
  expected_value?: number | null;
  expected_close_date?: string | null;
  is_closed?: boolean | null;
  won?: boolean | null;
  has_initial_conversation?: boolean;
  activities_count?: number;
  // Deal fields
  is_deal?: boolean | null;
  deal_id?: string | null;
  is_locked?: boolean | null;
  client_id: string;
  project_id: string;
}

interface Project {
  id: string;
  name: string;
  status?: string | null;
  project_type?: string | null;
  project_size?: string | null;
  current_phase?: string | null;
  city?: string | null;
  district?: string | null;
  opportunities?: Opportunity[];
  opportunities_count?: number;
}

interface ProjectOpportunitiesCardProps {
  project: Project;
  clientId: string;
  onViewProject: (project: Project) => void;
  onAddOpportunity: (projectId: string) => void;
  onStartConversation: (opportunityId: string, opportunityName: string) => void;
  onAddFollowUp: (opportunityId: string) => void;
  onCreateOrder: (opportunityId: string) => void;
  onViewOpportunity: (opportunity: Opportunity) => void;
}

export const ProjectOpportunitiesCard = ({
  project,
  clientId,
  onViewProject,
  onAddOpportunity,
  onStartConversation,
  onAddFollowUp,
  onCreateOrder,
  onViewOpportunity,
}: ProjectOpportunitiesCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [convertDealOpportunity, setConvertDealOpportunity] = useState<Opportunity | null>(null);
  const opportunities = project.opportunities || [];
  const hasOpportunities = opportunities.length > 0;

  const getStageColor = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case 'discovery':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
      case 'qualification':
        return 'bg-purple-500/10 text-purple-700 border-purple-500/30';
      case 'proposal':
        return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
      case 'negotiation':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/30';
      case 'order confirmed':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30';
      case 'closed won':
        return 'bg-green-500/10 text-green-700 border-green-500/30';
      case 'closed lost':
        return 'bg-red-500/10 text-red-700 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadge = (opp: Opportunity) => {
    // Show Deal badge if converted
    if (opp.is_deal) {
      return (
        <div className="flex items-center gap-1.5">
          <Badge className="bg-emerald-500/20 text-emerald-700 border-0 gap-1">
            <Handshake className="h-3 w-3" />
            Deal
          </Badge>
          {opp.deal_id && (
            <Badge variant="outline" className="text-xs font-mono">
              {opp.deal_id}
            </Badge>
          )}
          {opp.is_locked && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      );
    }

    if (opp.is_closed) {
      return opp.won ? (
        <Badge className="bg-green-500/20 text-green-700 border-0">Won</Badge>
      ) : (
        <Badge className="bg-red-500/20 text-red-700 border-0">Lost</Badge>
      );
    }
    return (
      <Badge variant="outline" className={cn("text-xs", getStageColor(opp.stage))}>
        {opp.stage}
      </Badge>
    );
  };

  const getInterestBadge = (level: string | null | undefined) => {
    switch (level) {
      case 'High':
        return <Badge className="bg-green-500/20 text-green-700 border-0 text-xs">High</Badge>;
      case 'Medium':
        return <Badge className="bg-amber-500/20 text-amber-700 border-0 text-xs">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-orange-500/20 text-orange-700 border-0 text-xs">Low</Badge>;
      case 'Not interested':
        return <Badge className="bg-red-500/20 text-red-700 border-0 text-xs">Not interested</Badge>;
      default:
        return null;
    }
  };

  // Check if opportunity can be converted to deal
  const canConvertToDeal = (opp: Opportunity) => {
    return (
      !opp.is_deal &&
      !opp.is_closed &&
      opp.has_initial_conversation &&
      (opp.stage?.toLowerCase() === 'negotiation' || opp.stage?.toLowerCase() === 'proposal')
    );
  };

  return (
    <>
      <Card className="overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {project.name}
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        project.status === 'Active' && 'text-green-600 border-green-500/30',
                        project.status === 'Completed' && 'text-blue-600 border-blue-500/30',
                        project.status === 'On Hold' && 'text-amber-600 border-amber-500/30'
                      )}>
                        {project.status || 'Active'}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {project.project_type && (
                        <span>{project.project_type}</span>
                      )}
                      {(project.city || project.district) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[project.city, project.district].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {opportunities.length} {opportunities.length === 1 ? 'Opportunity' : 'Opportunities'}
                  </Badge>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              {!hasOpportunities ? (
                <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
                  <Target className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-1">No opportunities yet</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Start a sales conversation for this project
                  </p>
                  <Button 
                    size="sm" 
                    onClick={() => onAddOpportunity(project.id)}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Start Opportunity
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {opportunities.map((opp) => (
                    <div 
                      key={opp.id}
                      className={cn(
                        "p-4 rounded-lg border transition-colors",
                        opp.is_deal 
                          ? "bg-emerald-500/5 border-emerald-500/20" 
                          : "bg-muted/20 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{opp.name}</span>
                            {getInterestBadge(opp.interest_level)}
                            {getStatusBadge(opp)}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {opp.expected_value && (
                              <span className="font-medium text-foreground">
                                SAR {opp.expected_value.toLocaleString()}
                              </span>
                            )}
                            {opp.expected_close_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(opp.expected_close_date), 'MMM d, yyyy')}
                              </span>
                            )}
                            {opp.is_deal ? (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Handed over to Operations
                              </Badge>
                            ) : opp.has_initial_conversation ? (
                              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                Conversation Started
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
                                Awaiting Initial Conversation
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {opp.is_deal ? (
                            // Deal is locked - show read-only actions
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => onViewOpportunity(opp)}
                              className="gap-1 h-8"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              View Deal
                            </Button>
                          ) : !opp.has_initial_conversation ? (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => onStartConversation(opp.id, opp.name)}
                              className="gap-1 h-8"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Start Conversation
                            </Button>
                          ) : (
                            <>
                              {canConvertToDeal(opp) && (
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  onClick={() => setConvertDealOpportunity({
                                    ...opp,
                                    client_id: clientId,
                                    project_id: project.id,
                                  })}
                                  className="gap-1 h-8 bg-emerald-600 hover:bg-emerald-700"
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                  Convert to Deal
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => onAddFollowUp(opp.id)}
                                className="gap-1 h-8"
                              >
                                <ClipboardList className="h-3.5 w-3.5" />
                                Follow-up
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => onCreateOrder(opp.id)}
                                className="gap-1 h-8"
                              >
                                <ShoppingCart className="h-3.5 w-3.5" />
                                Order
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add New Opportunity Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAddOpportunity(project.id)}
                    className="w-full gap-1.5 border-2 border-dashed text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add Another Opportunity
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Convert to Deal Dialog */}
      {convertDealOpportunity && (
        <ConvertToDealDialog
          open={!!convertDealOpportunity}
          onOpenChange={(open) => !open && setConvertDealOpportunity(null)}
          opportunity={convertDealOpportunity}
        />
      )}
    </>
  );
};

export default ProjectOpportunitiesCard;
