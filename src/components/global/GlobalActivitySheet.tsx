import { useState, useEffect, useLayoutEffect } from "react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, FolderKanban, Target, Check, Pencil, Loader2, Plus, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CustomerSection, type CustomerData } from "./sections/CustomerSection";
import { ProjectSection, type ProjectData } from "./sections/ProjectSection";
import { OpportunitySection, type OpportunityData } from "./sections/OpportunitySection";
import { ContextSection, type ContextData } from "./sections/ContextSection";
import { NextActionsSection, createEmptyAction, type ActionItem } from "./sections/NextActionsSection";
import { useGlobalActivity } from "@/hooks/useGlobalActivity";

export interface OpportunityPrefill {
  title?: string;
  interestLevel?: string;
  contactId?: string;
  estOrderDate?: Date | null;
  notes?: string;
  materialCategoryIds?: string[];
  quotationItems?: import("./sections/OpportunitySection").QuotationItemData[];
}

export interface GlobalActivityContext {
  action: "create" | "edit" | "update";
  entityType: "customer" | "project" | "opportunity";
  customerId?: string;
  customerName?: string;
  customerCode?: string;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  opportunityId?: string;
  opportunityName?: string;
  opportunityCode?: string;
  opportunityPrefill?: OpportunityPrefill;
}

interface GlobalActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: GlobalActivityContext;
}

/* ── Helpers ── */
function EntityChip({ icon, name, code, onToggle, onChangeCustomer, onChangeProject }: {
  icon: React.ReactNode; 
  name?: string; 
  code?: string;
  onToggle?: () => void;
  onChangeCustomer?: () => void;
  onChangeProject?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background/80 border">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name || "—"}</p>
        {code && <p className="text-xs text-muted-foreground font-mono">{code}</p>}
      </div>
      {onChangeProject && (
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onChangeProject();
          }}
        >
          Change
        </Button>
      )}
      {onChangeCustomer && (
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onChangeCustomer();
          }}
        >
          Change
        </Button>
      )}
      {onToggle && (
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}>
          <Pencil className="h-3 w-3" />
        </Button>
      )}
      <Check className="h-4 w-4 text-green-500 shrink-0" />
    </div>
  );
}

function SectionCollapseBar({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className="flex justify-end -mb-1">
      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground" onClick={onCollapse}>
        <ChevronUp className="h-3 w-3 mr-1" /> Hide fields
      </Button>
    </div>
  );
}

function Zone({ color, label, children }: { color: "blue" | "amber" | "emerald"; label: string; children: React.ReactNode }) {
  const styles = {
    blue: "bg-blue-50/50 dark:bg-blue-950/20 border-l-blue-400 dark:border-l-blue-600",
    amber: "bg-amber-50/50 dark:bg-amber-950/20 border-l-amber-400 dark:border-l-amber-600",
    emerald: "bg-emerald-50/50 dark:bg-emerald-950/20 border-l-emerald-400 dark:border-l-emerald-600",
  };
  return (
    <div className={cn("rounded-lg p-4 border-l-2 space-y-3", styles[color])}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function getTitle(ctx: GlobalActivityContext): string {
  const titles: Record<string, Record<string, string>> = {
    create: { customer: "Add Customer", project: "Add Project", opportunity: "Add Opportunity" },
    edit: { customer: "Edit Customer", project: "Edit Project", opportunity: "Edit Opportunity" },
    update: { customer: "Add Update", project: "Add Update", opportunity: "Add Update" },
  };
  return titles[ctx.action]?.[ctx.entityType] || "Add Update";
}

const DEFAULT_CTX: GlobalActivityContext = { action: "create", entityType: "customer" };

type EntityVisibility = "chip" | "select" | "create" | "edit" | "none";

function initCustomerMode(ctx: GlobalActivityContext): EntityVisibility {
  const { action, entityType, customerId } = ctx;

  // ✅ في حالة update على opportunity، منع إنشاء عميل جديد
  if (action === "update" && entityType === "opportunity") {
    return "chip"; // أو "select" ولكن بدون خيار create
  }

  if (customerId) {
    if (action === "update" && entityType === "opportunity") {
      return "chip";
    }

    if (action === "update") {
      return "chip";
    }

    if (action === "edit" && entityType === "customer") {
      return "edit";
    }

    const entityLevel: Record<string, number> = {
      customer: 0,
      project: 1,
      opportunity: 2,
    };

    const target = entityLevel[entityType] ?? 0;
    const self = entityLevel["customer"];

    return self >= target ? "edit" : "chip";
  }

  // ✅ في حالة update على opportunity، منع create
  if (action === "update" && entityType === "opportunity") {
    return "select"; // select فقط بدون create
  }

  if (entityType === "customer" && action === "create") {
    return "create";
  }

  return "select";
}

function initProjectMode(ctx: GlobalActivityContext): EntityVisibility {
  const { entityType, projectId, action } = ctx;

  if (projectId) {
    if (action === "update") {
      return "chip";
    }

    if (action === "edit" && entityType === "project") {
      return "edit";
    }

    const entityLevel: Record<string, number> = {
      customer: 0,
      project: 1,
      opportunity: 2,
    };

    const target = entityLevel[entityType] ?? 0;
    return 1 >= target ? "edit" : "chip";
  }

  if (entityType === "project" && action === "create") {
    return "create";
  }

  if (entityType === "opportunity") {
    return "select";
  }

  return "chip";
}

function initOppMode(ctx: GlobalActivityContext): EntityVisibility {
  const { entityType, opportunityId, action } = ctx;

  if (opportunityId) {
    if (action === "update") {
      return "edit";
    }

    if (action === "edit" && entityType === "opportunity") {
      return "edit";
    }

    return "edit";
  }

  if (entityType === "opportunity" && action === "create") {
    return "create";
  }

  if (entityType === "opportunity") {
    return "select";
  }

  return "none";
}

function initCustomer(ctx: GlobalActivityContext): CustomerData {
  const mode = initCustomerMode(ctx);
  
  return {
    mode: mode as CustomerData["mode"],
    selectedId: ctx.customerId || "",
    selectedName: ctx.customerName || "",
    selectedCode: ctx.customerCode || "",
    displayName: "",
    customerType: "SME",
    contactPhone: "",
  };
}

function initProject(ctx: GlobalActivityContext): ProjectData {
  return {
    mode: initProjectMode(ctx) as ProjectData["mode"],
    selectedId: ctx.projectId || "",
    selectedName: ctx.projectName || "",
    selectedCode: ctx.projectCode || "",
    name: "",
    projectType: "",
    currentPhase: "",
  };
}

function initOpportunity(ctx: GlobalActivityContext): OpportunityData {
  const mode = initOppMode(ctx);
  const prefill = ctx.opportunityPrefill;
  return {
    mode: mode as OpportunityData["mode"],
    selectedId: ctx.opportunityId || "",
    selectedName: ctx.opportunityName || "",
    selectedCode: ctx.opportunityCode || "",
    title: prefill?.title || "",
    interestLevel: prefill?.interestLevel || "Medium",
    estOrderDate: prefill?.estOrderDate || null,
    contactId: prefill?.contactId || "",
    notes: prefill?.notes || "",
    materialCategoryIds: prefill?.materialCategoryIds || [],
    ...(mode === "create" ? { quotationItems: prefill?.quotationItems || [] } : {}),
  };
}

export function GlobalActivitySheet({ open, onOpenChange, context }: GlobalActivitySheetProps) {
  const ctx = context || DEFAULT_CTX;

  const [customer, setCustomer] = useState<CustomerData>(initCustomer(ctx));
  const [project, setProject] = useState<ProjectData>(initProject(ctx));
  const [opportunity, setOpportunity] = useState<OpportunityData>(initOpportunity(ctx));
  const [contextData, setContextData] = useState<ContextData>({ contextType: "communication", channel: "whatsapp", summary: "", occurredAt: null });
  const [actions, setActions] = useState<ActionItem[]>([createEmptyAction()]);
  const [isChangingCustomer, setIsChangingCustomer] = useState(false);
  const [isChangingProject, setIsChangingProject] = useState(false);

  useLayoutEffect(() => {
    if (open && context) {
      const c = context;
      
      const newCustomer = initCustomer(c);
      const newProject = initProject(c);
      const newOpportunity = initOpportunity(c);
      
      setCustomer(newCustomer);
      setProject(newProject);
      setOpportunity(newOpportunity);
      setContextData({ contextType: "communication", channel: "whatsapp", summary: "", occurredAt: null });
      setActions([createEmptyAction()]);
      setIsChangingCustomer(false);
      setIsChangingProject(false);
    }
  }, [open, context]);

  const mutation = useGlobalActivity(() => onOpenChange(false));

  const effectiveCustomerId = customer.selectedId || ctx.customerId || "";
  const effectiveProjectId = project.selectedId || ctx.projectId || "";

  const isNotInterested = opportunity.interestLevel === "Not interested";

  // ✅ عند تغيير العميل، نخفي المشروع تماماً
  useEffect(() => {
    if (isChangingCustomer) {
      // إعادة تعيين المشروع بالكامل
      setProject({
        mode: "select",
        selectedId: "",
        selectedName: "",
        selectedCode: "",
        name: "",
        projectType: "",
        currentPhase: "",
      });
      setOpportunity({
        mode: "none",
        selectedId: "",
        selectedName: "",
        selectedCode: "",
        title: "",
        interestLevel: "Medium",
        estOrderDate: null,
        contactId: "",
        notes: "",
        materialCategoryIds: [],
      });
    }
  }, [isChangingCustomer]);

  // ✅ عند اختيار عميل جديد، ننهي وضع التغيير
  useEffect(() => {
    if (isChangingCustomer && customer.selectedId && customer.mode !== "create") {
      setIsChangingCustomer(false);
      toast.success(`Customer changed to: ${customer.selectedName}`);
    }
  }, [customer.selectedId, customer.mode]);

  // ✅ عند تغيير المشروع، نعيد تعيين الفرصة
  useEffect(() => {
    if (isChangingProject) {
      setOpportunity({
        mode: "none",
        selectedId: "",
        selectedName: "",
        selectedCode: "",
        title: "",
        interestLevel: "Medium",
        estOrderDate: null,
        contactId: "",
        notes: "",
        materialCategoryIds: [],
      });
    }
  }, [isChangingProject]);

  // ✅ عند اختيار مشروع جديد، ننهي وضع التغيير
  useEffect(() => {
    if (isChangingProject && project.selectedId) {
      setIsChangingProject(false);
      toast.success(`Project changed to: ${project.selectedName}`);
    }
  }, [project.selectedId]);

  const validate = (): boolean => {
    if (!contextData.summary.trim()) {
      toast.error("Context summary is required");
      return false;
    }

    const projectNeedsLocation = (project.mode === "create" || project.mode === "edit") && !(project as any).location;
    if (projectNeedsLocation) {
      toast.error("Project location is required");
      return false;
    }
    
    if (isNotInterested && !(opportunity.notInterestedReason || "").trim()) {
      toast.error("Reason for 'Not Interested' is required");
      return false;
    }

    if (!isNotInterested && actions.filter(a => a.taskType && a.dueDate).length === 0) {
      toast.error("At least one next action with a due date is required");
      return false;
    }
    
    if (!effectiveCustomerId && customer.mode !== "create") {
      toast.error("Customer is required. Please select or create a customer.");
      return false;
    }
    
    if (ctx.entityType === "opportunity" && ctx.action === "create") {
      if (!effectiveCustomerId && customer.mode !== "create") {
        toast.error("Please select or create a customer for this opportunity");
        return false;
      }
    }

    if ((opportunity.mode === "create" || opportunity.selectedId) && !project.selectedId && project.mode !== "create") {
      toast.error("Project is required before adding an opportunity.");
      return false;
    }

    if (project.mode === "create" && opportunity.selectedId) {
      toast.error("Cannot attach an existing opportunity to a new project. Please create a new opportunity for this project.");
      return false;
    }

    if (customer.mode === "create" && project.selectedId) {
      toast.error("Cannot attach an existing project to a new customer. Please create a new project for this customer.");
      return false;
    }

    // Quotation send-guard — refuse save if the builder reported unresolved gaps
    // (missing zone, missing supplier, missing price, missing delivery rate).
    const blockers = (opportunity as any)._quoteBlockers as string[] | undefined;
    if (blockers && blockers.length > 0 && !isNotInterested) {
      toast.error("Fix the quotation before saving", { description: blockers[0] });
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    if (ctx.entityType === "project" && ctx.action === "create" && ctx.customerId) {
      if (customer.mode === "create") {
        setCustomer(prev => ({ ...prev, mode: "select", selectedId: ctx.customerId || "" }));
        toast.error("Please wait, correcting customer mode...");
        return;
      }
    }
    
    mutation.mutate({ customer, project, opportunity, context: contextData, actions });
  };

  const addCascadeProject = () => {
    setIsChangingProject(false);
    setProject(p => ({ ...p, mode: "create" }));
  };
  
  const addCascadeOpp = () => setOpportunity(p => ({ ...p, mode: "create", quotationItems: [] }));

  const toggleFields = (entity: "customer" | "project" | "opportunity") => {
    if (entity === "customer") setCustomer(p => ({ ...p, mode: p.mode === "chip" ? "edit" : "chip" }));
    if (entity === "project") setProject(p => ({ ...p, mode: p.mode === "chip" ? "edit" : "chip" }));
    if (entity === "opportunity") setOpportunity(p => ({ ...p, mode: p.mode === "chip" ? "edit" : "chip",  title: p.mode === "chip" ? p.selectedName || p.title : p.title,}));
  };

  const entityHierarchy: Record<string, number> = { customer: 0, project: 1, opportunity: 2 };
  const targetLevel = entityHierarchy[ctx.entityType] ?? 0;

  const handleCustomerChange = (d: CustomerData) => {
    if (d.mode === "create") {
      setIsChangingCustomer(true);
      setCustomer(d);
      return;
    }
    
    if (ctx.entityType === "opportunity" && ctx.action === "update") {
      setCustomer(d);
      return;
    }
    
    if (d.selectedId && !customer.selectedId && d.mode === "select") {
      const isTargetOrBelow = entityHierarchy["customer"] >= targetLevel;
      setCustomer({ ...d, mode: isTargetOrBelow ? "edit" : "chip" });
    } else {
      setCustomer(d);
    }
  };

  const handleProjectChange = (d: ProjectData) => {
    if (d.mode === "create") {
      setIsChangingProject(false);
      setProject(d);
      return;
    }
    
    setProject(d);
  };

  const handleOppChange = (d: OpportunityData) => {
    if (d.selectedId && !opportunity.selectedId && d.mode === "select") {
      const isTargetOrBelow = entityHierarchy["opportunity"] >= targetLevel;
      setOpportunity({ ...d, mode: isTargetOrBelow ? "edit" : "chip" });
    } else {
      setOpportunity(d);
    }
  };

  const handleChangeCustomer = () => {
    setIsChangingCustomer(true);
    
    setCustomer(prev => ({ 
      ...prev, 
      mode: "select",
      selectedId: "",
      selectedName: "",
      selectedCode: ""
    }));
    
    toast.info("Please select or create a new customer");
  };

  const handleChangeProject = () => {
    setIsChangingProject(true);
    
    setProject(prev => ({
      ...prev,
      mode: "select",
      selectedId: "",
      selectedName: "",
      selectedCode: "",
      name: ""
    }));
    
    toast.info("Please select a new project");
  };

  const customerMode = customer.mode;
  const projectMode = project.mode;

  const customerReady = customerMode === "create" || customerMode === "edit" || !!effectiveCustomerId;
  const projectReady = projectMode === "create" || projectMode === "edit" || projectMode === "default" || !!effectiveProjectId;

  // ✅ تحديد ما إذا كان المشروع ظاهراً
  const showProject = (customer.selectedId || customer.mode === "create") && !isChangingCustomer && !isChangingProject;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[90vw] sm:w-[75vw] max-w-[90vw] sm:max-w-[75vw] flex flex-col p-0 rounded-l-xl">
          <SheetHeader className="px-6 pt-6">
          <SheetTitle>{getTitle(ctx)}</SheetTitle>
          <SheetDescription>
            
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <form onSubmit={handleSubmit} className="space-y-4 py-4">

            <Zone color="blue" label="What's changing">
              <div className="space-y-3">

                {/* ── CUSTOMER ── */}
                {customerMode === "chip" && (customer.selectedId || ctx.customerId) && (
                  <EntityChip
                    icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
                    name={customer.selectedName || ctx.customerName}
                    code={customer.selectedCode || ctx.customerCode}
                    onToggle={() => toggleFields("customer")}
                    onChangeCustomer={ctx.action === "update" && ctx.entityType === "opportunity" ? handleChangeCustomer : undefined}
                  />
                )}
                {customerMode === "edit" && customer.selectedId && (
                  <SectionCollapseBar onCollapse={() => toggleFields("customer")} />
                )}
                {(customerMode === "select" || customerMode === "create" || customerMode === "edit") && (
                  <CustomerSection 
                    data={customer} 
                    onChange={(d) => {
                      if (d.mode === "create") {
                        setIsChangingCustomer(true);
                        setCustomer(d);
                      } else {
                        setCustomer(d);
                      }
                    }} 
                  />
                )}

                {/* ── PROJECT ── */}
                {showProject && (
                  <>
                    {projectMode === "chip" && (project.selectedId || ctx.projectId) && (
                      <EntityChip
                        icon={<FolderKanban className="h-4 w-4 text-muted-foreground" />}
                        name={project.selectedName || ctx.projectName}
                        code={project.selectedCode || ctx.projectCode}
                        onToggle={() => toggleFields("project")}
                        onChangeProject={handleChangeProject}
                      />
                    )}
                    {projectMode === "edit" && project.selectedId && (
                      <SectionCollapseBar onCollapse={() => toggleFields("project")} />
                    )}
                    {(projectMode === "select" || projectMode === "create" || projectMode === "edit" || projectMode === "default") && (
                      <ProjectSection 
                        data={project} 
                        onChange={handleProjectChange} 
                        customerAccountId={customer.selectedId || ctx.customerId || ""} 
                      />
                    )}
                    {projectMode === "chip" && !project.selectedId && !ctx.projectId && customerReady && (
                      <Button type="button" variant="outline" size="sm" className="w-full text-xs border-dashed" onClick={addCascadeProject}>
                        <Plus className="h-3 w-3 mr-1" /> Add Project
                      </Button>
                    )}
                  </>
                )}

                {/* ── OPPORTUNITY ── */}
                {showProject && (effectiveProjectId || project.mode === "create") && (
                  <>
                    {opportunity.mode === "chip" && (opportunity.selectedId || ctx.opportunityId) && (
                      <EntityChip
                        icon={<Target className="h-4 w-4 text-muted-foreground" />}
                        name={opportunity.selectedName || ctx.opportunityName}
                        code={opportunity.selectedCode || ctx.opportunityCode}
                        onToggle={() => toggleFields("opportunity")}
                      />
                    )}
                    {opportunity.mode === "edit" && opportunity.selectedId && (
                      <SectionCollapseBar onCollapse={() => toggleFields("opportunity")} />
                    )}
                    {(opportunity.mode === "select" || opportunity.mode === "create" || opportunity.mode === "edit") && (
                      <>
                        {(effectiveProjectId || project.mode === "create" || project.mode === "default") ? (
                          <OpportunitySection 
                            data={opportunity} 
                            onChange={handleOppChange} 
                            projectId={effectiveProjectId} 
                            customerAccountId={effectiveCustomerId} 
                          />
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Select or create a project above to add opportunity details</p>
                        )}
                      </>
                    )}
                    {opportunity.mode === "none" && projectReady && (
                      <Button type="button" variant="outline" size="sm" className="w-full text-xs border-dashed" onClick={addCascadeOpp}>
                        <Plus className="h-3 w-3 mr-1" /> Add Opportunity
                      </Button>
                    )}
                  </>
                )}

              </div>
            </Zone>

            <Zone color="amber" label="Why">
              <ContextSection data={contextData} onChange={setContextData} />
            </Zone>

            {!isNotInterested && (
              <Zone color="emerald" label="What's next">
                <NextActionsSection actions={actions} onChange={setActions} />
              </Zone>
            )}
          </form>
        </ScrollArea>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (ctx.action === "edit" ? "Save Changes" : "Save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
} 