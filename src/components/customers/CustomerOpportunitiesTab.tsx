import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CustomerOpportunitiesTabProps {
  customerId: string;
}

const stageColors: Record<string, string> = {
  lead: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  discovery: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  rfp: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  negotiation: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  won: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function CustomerOpportunitiesTab({ customerId }: CustomerOpportunitiesTabProps) {
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ["customer-opportunities-full", customerId],
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No opportunities found for this customer
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {opportunities.map((opp) => (
        <Card key={opp.id} className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-950/50 flex items-center justify-center">
                  <Target className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="font-medium">{opp.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn("text-xs", stageColors[opp.stage] || stageColors.lead)}>
                      {opp.stage}
                    </Badge>
                    {opp.interest_level && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          opp.interest_level === "high" && "border-green-500 text-green-600",
                          opp.interest_level === "medium" && "border-yellow-500 text-yellow-600",
                          opp.interest_level === "low" && "border-red-500 text-red-600"
                        )}
                      >
                        {opp.interest_level}
                      </Badge>
                    )}
                  </div>
                  {opp.description && (
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {opp.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right space-y-1">
                {opp.expected_close_date && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(opp.expected_close_date), "MMM d, yyyy")}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
