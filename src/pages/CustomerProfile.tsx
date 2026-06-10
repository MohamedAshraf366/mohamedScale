import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft, Plus, FolderKanban, TrendingUp, ShoppingCart,
  MessageSquare, Activity, DollarSign, ChevronDown, Globe,
  FileText, CreditCard, User, Phone, Mail, MessageSquarePlus, Trash2, Pencil,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ProjectsTable } from "@/components/customers/ProjectsTable";
import { GlobalActivitySheet, type GlobalActivityContext } from "@/components/global/GlobalActivitySheet";
import { EntityTimeline } from "@/components/global/EntityTimeline";
import { SmartDeleteDialog } from "@/components/shared/SmartDeleteDialog";

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showDetails, setShowDetails] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [activityContext, setActivityContext] = useState<GlobalActivityContext | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const handleBack = () => navigate("/sales/customers");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(`
          *,
          account:accounts!customers_account_id_fkey(
            id, display_name, legal_name, status, code, tax_number, website, notes
          )
        `)
        .eq("account_id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["customer-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, role_title, phone, email, is_primary")
        .eq("account_id", id)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: projectsCount = 0 } = useQuery({
    queryKey: ["customer-projects-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("customer_account_id", id)
        .is("deleted_at", null);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  const { data: metrics } = useQuery({
    queryKey: ["customer-metrics", id],
    queryFn: async () => {
      const { count: oppsCount } = await supabase
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("customer_account_id", id)
        .is("deleted_at", null);

      const { count: activeOpps } = await supabase
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("customer_account_id", id)
        .eq("status", "open")
        .is("deleted_at", null);

      const { data: ordersData } = await supabase
        .from("orders")
        .select("total, status")
        .eq("customer_account_id", id);

      const ordersCount = ordersData?.length || 0;
      const activeOrders = ordersData?.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length || 0;
      const totalSalesVolume = ordersData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: recentComms } = await supabase
        .from("communications")
        .select("*", { count: "exact", head: true })
        .eq("account_id", id)
        .is("deleted_at", null)
        .gte("occurred_at", thirtyDaysAgo.toISOString());

      const { data: lastComm } = await supabase
        .from("communications")
        .select("occurred_at")
        .eq("account_id", id)
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        oppsCount: oppsCount || 0,
        activeOpps: activeOpps || 0,
        ordersCount,
        activeOrders,
        totalSalesVolume,
        recentComms: recentComms || 0,
        lastActivity: lastComm?.occurred_at || null,
      };
    },
    enabled: !!id,
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from("accounts")
        .update({ deleted_at: new Date().toISOString(), deleted_reason: reason, status: "deleted" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer deleted");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate("/sales/customers");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  });

  const statusChangeMutation = useMutation({
    mutationFn: async (stage: string) => {
      const { error } = await supabase
        .from("customers")
        .update({ lifecycle_stage: stage })
        .eq("account_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer status updated");
      queryClient.invalidateQueries({ queryKey: ["customer-profile", id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  const formatCurrency = (value: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value);
  };

  const displayName = customer?.account?.display_name || customer?.account?.legal_name || "Customer";
  const initials = displayName.slice(0, 2).toUpperCase();

  const openActivity = (action: 'create' | 'edit' | 'update', entityType: 'customer' | 'project' | 'opportunity') => {
    setActivityContext({ action, entityType, customerId: id, customerName: displayName, customerCode: customer?.account?.code || undefined });
    setShowActivity(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-24" />
          <div className="flex gap-6">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!customer) {
    return (
      <AppLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <div className="mt-8 text-center text-muted-foreground">Customer not found</div>
        </div>
      </AppLayout>
    );
  }

  const lifecycleColors: Record<string, string> = {
    lead: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    prospect: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    active: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    churned: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    blacklisted: "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Customers
        </Button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{displayName}</h1>
                {customer.account?.code && (
                  <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {customer.account.code}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {customer.account?.legal_name && customer.account.legal_name !== displayName && (
                  <p className="text-muted-foreground text-sm">{customer.account.legal_name}</p>
                )}
                <Badge className={lifecycleColors[customer.lifecycle_stage] || "bg-muted"}>
                  {customer.lifecycle_stage}
                </Badge>
                <Badge variant="outline">{customer.customer_type}</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openActivity('update', 'customer')}>
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Add Update
            </Button>
            <Button variant="outline" onClick={() => openActivity('edit', 'customer')}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Customer
            </Button>
            <Button variant="outline" onClick={() => openActivity('create', 'project')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Metrics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <FolderKanban className="h-4 w-4" />Projects
              </div>
              <p className="text-2xl font-semibold">{projectsCount}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/sales/pipeline?customer=${id}`)}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />Opportunities
              </div>
              <p className="text-2xl font-semibold">{metrics?.oppsCount || 0}</p>
              {(metrics?.activeOpps ?? 0) > 0 && <p className="text-xs text-green-600">{metrics?.activeOpps} active</p>}
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/orders?customer=${id}`)}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ShoppingCart className="h-4 w-4" />Orders
              </div>
              <p className="text-2xl font-semibold">{metrics?.ordersCount || 0}</p>
              {(metrics?.activeOrders ?? 0) > 0 && <p className="text-xs text-green-600">{metrics?.activeOrders} active</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" />Sales Volume
              </div>
              <p className="text-xl font-semibold">{formatCurrency(metrics?.totalSalesVolume || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <MessageSquare className="h-4 w-4" />Activity (30d)
              </div>
              <p className="text-2xl font-semibold">{metrics?.recentComms || 0}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Activity className="h-4 w-4" />Last Activity
              </div>
              <p className="text-lg font-medium">
                {metrics?.lastActivity
                  ? formatDistanceToNow(new Date(metrics.lastActivity), { addSuffix: true })
                  : "No activity yet"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Customer Details - Collapsible */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-lg font-medium flex items-center justify-between">
                  <span>Customer Details</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Business</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span>{customer.customer_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stage</span>
                        <Badge className={lifecycleColors[customer.lifecycle_stage] || "bg-muted"} variant="secondary">{customer.lifecycle_stage}</Badge>
                      </div>
                      {customer.pricing_tier && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pricing Tier</span>
                          <span>{customer.pricing_tier}</span>
                        </div>
                      )}
                      {customer.account?.tax_number && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax Number</span>
                          <span className="font-mono text-xs">{customer.account.tax_number}</span>
                        </div>
                      )}
                      {customer.account?.website && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Website</span>
                          <a href={customer.account.website} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1">
                            <Globe className="h-3 w-3" />Visit
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Financial</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credit Limit</span>
                        <span>{customer.credit_limit ? formatCurrency(Number(customer.credit_limit)) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Terms</span>
                        <span>{customer.payment_terms_days ? `${customer.payment_terms_days} days` : '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Contacts</h4>
                    <div className="space-y-3">
                      {contacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No contacts</p>
                      ) : (
                        contacts.slice(0, 3).map((contact) => (
                          <div key={contact.id} className="flex items-start gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">
                                {contact.full_name}
                                {contact.is_primary && <Badge variant="secondary" className="ml-1 text-[10px]">Primary</Badge>}
                              </p>
                              {contact.role_title && <p className="text-xs text-muted-foreground">{contact.role_title}</p>}
                              <div className="flex gap-3 mt-0.5">
                                {contact.phone && (
                                  <a href={`tel:${contact.phone}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> {contact.phone}
                                  </a>
                                )}
                                {contact.email && (
                                  <a href={`mailto:${contact.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> {contact.email}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                {(customer.notes || customer.account?.notes) && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</h4>
                    <p className="text-sm whitespace-pre-wrap">{customer.notes || customer.account?.notes}</p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityTimeline
              entityType="customer"
              entityId={id!}
              entityCreatedAt={customer.created_at}
            />
          </CardContent>
        </Card>

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectsTable customerId={id!} customerName={displayName} />
          </CardContent>
        </Card>

        <GlobalActivitySheet
          open={showActivity}
          onOpenChange={setShowActivity}
          context={activityContext || undefined}
        />

        <SmartDeleteDialog
          open={showDelete}
          onOpenChange={setShowDelete}
          entityType="customer"
          entityName={displayName}
          onConfirm={(reason) => softDeleteMutation.mutate(reason)}
          onStatusChange={(stage) => statusChangeMutation.mutate(stage)}
          isLoading={softDeleteMutation.isPending}
        />
      </div>
    </AppLayout>
  );
}
