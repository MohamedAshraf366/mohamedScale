import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Phone,
  MessageSquare,
  Mail,
  Star,
  CheckCircle,
  Clock,
  ChevronDown,
  Filter,
} from "lucide-react";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface CustomerTimelineProps {
  customerId: string;
}

type TimelineItem = {
  id: string;
  type: "communication" | "opportunity" | "task";
  title: string;
  subtitle?: string;
  date: Date;
  status?: string;
  channel?: string;
  interestLevel?: string;
  stage?: string;
};

export function CustomerTimeline({ customerId }: CustomerTimelineProps) {
  const [filter, setFilter] = useState<"all" | "follow-ups" | "opportunities">("all");

  // Fetch communications
  const { data: communications, isLoading: loadingComms } = useQuery({
    queryKey: ["customer-communications", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communications")
        .select("*")
        .eq("account_id", customerId)
        .order("occurred_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch opportunities
  const { data: opportunities, isLoading: loadingOpps } = useQuery({
    queryKey: ["customer-opportunities-timeline", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("customer_account_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch tasks
  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["customer-tasks-timeline", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("customer_account_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingComms || loadingOpps || loadingTasks;

  // Combine and sort all items
  const timelineItems: TimelineItem[] = [];

  if (filter === "all" || filter === "follow-ups") {
    communications?.forEach((comm) => {
      timelineItems.push({
        id: comm.id,
        type: "communication",
        title: comm.subject || `Communication with ${comm.contact_id ? "contact" : "customer"}`,
        subtitle: comm.outcome || comm.summary,
        date: new Date(comm.occurred_at),
        channel: comm.channel,
      });
    });

    tasks?.forEach((task) => {
      timelineItems.push({
        id: task.id,
        type: "task",
        title: task.title,
        subtitle: task.description || undefined,
        date: new Date(task.due_at || task.created_at),
        status: task.status,
        channel: task.channel || undefined,
      });
    });
  }

  if (filter === "all" || filter === "opportunities") {
    opportunities?.forEach((opp) => {
      timelineItems.push({
        id: opp.id,
        type: "opportunity",
        title: `Opportunity: ${opp.title}`,
        subtitle: `Stage: ${opp.stage}`,
        date: new Date(opp.created_at),
        stage: opp.stage,
        interestLevel: opp.interest_level || undefined,
      });
    });
  }

  // Sort by date descending
  timelineItems.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Group by date
  const groupedItems: { date: Date; items: TimelineItem[] }[] = [];
  timelineItems.forEach((item) => {
    const existingGroup = groupedItems.find((g) => isSameDay(g.date, item.date));
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groupedItems.push({ date: item.date, items: [item] });
    }
  });

  const getChannelIcon = (channel?: string) => {
    switch (channel) {
      case "phone":
      case "phone_call":
        return <Phone className="h-4 w-4" />;
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: TimelineItem["type"]) => {
    switch (type) {
      case "opportunity":
        return <Star className="h-4 w-4 text-yellow-500" />;
      case "task":
        return <Calendar className="h-4 w-4 text-primary" />;
      default:
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "completed":
      case "done":
        return "bg-green-500";
      case "open":
        return "bg-yellow-500";
      case "overdue":
        return "bg-red-500";
      default:
        return "bg-blue-500";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="flex bg-muted rounded-lg p-1">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "follow-ups" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("follow-ups")}
          >
            Follow-ups
          </Button>
          <Button
            variant={filter === "opportunities" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("opportunities")}
          >
            Opportunities
          </Button>
        </div>

        <Button variant="outline" size="sm" className="ml-auto">
          <Calendar className="h-4 w-4 mr-2" />
          All Time
        </Button>
      </div>

      {/* Timeline */}
      {groupedItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No activity found for this customer
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedItems.map((group) => (
            <div key={group.date.toISOString()} className="relative">
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full border-2 border-muted flex items-center justify-center text-sm font-medium bg-background">
                  {format(group.date, "d")}
                </div>
                <div>
                  <div className="font-medium">
                    {format(group.date, "EEEE, MMM d, yyyy")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ({formatDistanceToNow(group.date, { addSuffix: true })})
                  </div>
                </div>
              </div>

              {/* Items for this date */}
              <div className="ml-5 border-l-2 border-muted pl-6 space-y-3">
                {group.items.map((item) => (
                  <div key={item.id} className="relative">
                    {/* Dot on timeline */}
                    <div
                      className={cn(
                        "absolute -left-[29px] top-3 h-3 w-3 rounded-full",
                        getStatusColor(item.status)
                      )}
                    />

                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                              {getTypeIcon(item.type)}
                            </div>
                            <div>
                              <div className="font-medium">{item.title}</div>
                              {item.subtitle && (
                                <div className="text-sm text-muted-foreground">
                                  {item.subtitle}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {item.channel && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.channel}
                                  </Badge>
                                )}
                                {item.status && (
                                  <Badge
                                    variant={item.status === "open" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {item.status}
                                  </Badge>
                                )}
                                {item.interestLevel && (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      item.interestLevel === "high" && "border-green-500 text-green-600",
                                      item.interestLevel === "medium" && "border-yellow-500 text-yellow-600",
                                      item.interestLevel === "low" && "border-red-500 text-red-600"
                                    )}
                                  >
                                    {item.interestLevel}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{format(item.date, "h:mm a")}</span>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
