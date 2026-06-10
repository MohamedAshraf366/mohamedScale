import { useState, Fragment, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanban,
  MapPin,
  User,
  Plus,
  Trash2,
  MoreHorizontal,
  Pencil,
  ExternalLink,
  ChevronRight,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PhaseIndicator } from "@/components/shared/PhaseIndicator";
import {
  StageBadge,
  InterestBadge,
  DateCell,
  CodeCell,
} from "@/components/shared/TableCellRenderers";
import { GlobalActivitySheet, type GlobalActivityContext } from "@/components/global/GlobalActivitySheet";
import { SmartDeleteDialog } from "@/components/shared/SmartDeleteDialog";
import { DataTableToolbar, ColumnDef, FilterDef, SortOption } from "@/components/shared/DataTableToolbar";

interface ProjectsTableProps {
  customerId: string;
  customerName?: string;
}

interface ProjectRow {
  id: string;
  name: string;
  code: string | null;
  project_type: string | null;
  project_size: string | null;
  current_phase: string | null;
  created_at: string;
  location: {
    city: string | null;
    address_text: string | null;
    address_link: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  poc_contact: {
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: "name", label: "Name", defaultVisible: true, sortable: true },
  { id: "type", label: "Type", defaultVisible: true, sortable: true },
  { id: "size", label: "Size", defaultVisible: true, sortable: true },
  { id: "phase", label: "Phase", defaultVisible: true, sortable: true },
  { id: "location", label: "Location", defaultVisible: true, sortable: true },
  { id: "poc", label: "POC", defaultVisible: true, sortable: true },
  { id: "created", label: "Created", defaultVisible: false, sortable: true },
];

const PROJECT_TYPE_OPTIONS = [
  { value: "Residential", label: "Residential" },
  { value: "Commercial", label: "Commercial" },
  { value: "Industrial", label: "Industrial" },
  { value: "Infrastructure", label: "Infrastructure" },
  { value: "Mixed-Use", label: "Mixed-Use" },
  { value: "Other", label: "Other" },
];

const PROJECT_SIZE_OPTIONS = [
  { value: "Very Small", label: "Very Small" },
  { value: "Small", label: "Small" },
  { value: "Medium", label: "Medium" },
  { value: "Large", label: "Large" },
  { value: "Huge", label: "Huge" },
];

const PROJECT_PHASE_OPTIONS = [
  { value: "Site Preparation & Fencing", label: "Site Prep" },
  { value: "Foundation Works / Substructure", label: "Foundation" },
  { value: "Skeleton Works / Superstructure", label: "Skeleton" },
  { value: "Masonry & MEP Works", label: "MEP & Masonry" },
  { value: "Finishing Works", label: "Finishing" },
  { value: "Paused", label: "Paused" },
  { value: "Completed", label: "Completed" },
];

const FILTERS: FilterDef[] = [
  { id: "project_type", label: "Type", options: PROJECT_TYPE_OPTIONS },
  { id: "project_size", label: "Size", options: PROJECT_SIZE_OPTIONS },
  { id: "current_phase", label: "Phase", options: PROJECT_PHASE_OPTIONS },
];

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "project_type", label: "Type" },
  { value: "project_size", label: "Size" },
  { value: "current_phase", label: "Phase" },
  { value: "created_at", label: "Created" },
];

const STORAGE_KEY = "projects_visible_columns";

function getStoredColumns(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);
}

function storeColumns(columns: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
}

const typeColors: Record<string, string> = {
  Residential: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  Commercial: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  Industrial: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  Infrastructure: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "Mixed-Use": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  Other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const sizeColors: Record<string, string> = {
  "Very Small": "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300",
  Small: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300",
  Medium: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  Large: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  Huge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function ProjectsTable({ customerId, customerName = "Customer" }: ProjectsTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getStoredColumns);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [activeSort, setActiveSort] = useState<SortOption | null>({ column: "created_at", direction: "desc" });
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  
  // Unified activity sheet state
  const [showActivity, setShowActivity] = useState(false);
  const [activityCtx, setActivityCtx] = useState<GlobalActivityContext | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Delete state
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteProjectName, setDeleteProjectName] = useState("");

  const softDeleteMutation = useMutation({
    mutationFn: async ({ projectId, reason }: { projectId: string; reason: string }) => {
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString(), deleted_reason: reason } as any)
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["customer-projects-table"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["customer-projects-count"] });
      setDeleteProjectId(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete project"),
  });

  const statusChangeMutation = useMutation({
    mutationFn: async ({ projectId, phase }: { projectId: string; phase: string }) => {
      const { error } = await supabase
        .from("projects")
        .update({ current_phase: phase })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project status updated");
      queryClient.invalidateQueries({ queryKey: ["customer-projects-table"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["customer-projects-table", customerId, searchQuery, activeFilters, activeSort],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select(`
          id, name, code, project_type, project_size, current_phase, created_at,
          location:locations(city, address_text, address_link, lat, lng),
          poc_contact:contacts!projects_poc_fkey(full_name, phone, email)
        `)
        .eq("customer_account_id", customerId)
        .is("deleted_at", null);

      if (activeFilters.project_type && activeFilters.project_type !== "all") {
        query = query.eq("project_type", activeFilters.project_type);
      }
      if (activeFilters.project_size && activeFilters.project_size !== "all") {
        query = query.eq("project_size", activeFilters.project_size);
      }
      if (activeFilters.current_phase && activeFilters.current_phase !== "all") {
        query = query.eq("current_phase", activeFilters.current_phase);
      }
      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }
      if (activeSort) {
        query = query.order(activeSort.column, { ascending: activeSort.direction === "asc" });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProjectRow[];
    },
  });

  const projectIds = projects?.map(p => p.id) || [];
  // const { data: oppsData } = useQuery({
  //   queryKey: ["project-opps-nested", projectIds],
  //   queryFn: async () => {
  //     if (projectIds.length === 0) return {};
  //     const { data, error } = await supabase
  //       .from("opportunities")
  //       .select("id, title, code, stage, interest_level, created_at, project_id")
  //       .in("project_id", projectIds)
  //       .order("created_at", { ascending: false });
  //     if (error) throw error;
  //     const grouped: Record<string, typeof data> = {};
  //     data?.forEach(opp => {
  //       if (!grouped[opp.project_id]) grouped[opp.project_id] = [];
  //       grouped[opp.project_id].push(opp);
  //     });
  //     return grouped;
  //   },
  //   enabled: projectIds.length > 0,
  // });
const { data: oppsData, refetch: refetchOpps } = useQuery({
    queryKey: ["project-opps-nested", projectIds, refreshTrigger], // ✅ أضف refreshTrigger
    queryFn: async () => {
      if (projectIds.length === 0) return {};
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, title, code, stage, interest_level, created_at, project_id")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const grouped: Record<string, typeof data> = {};
      data?.forEach(opp => {
        if (!grouped[opp.project_id]) grouped[opp.project_id] = [];
        grouped[opp.project_id].push(opp);
      });
      return grouped;
    },
    enabled: projectIds.length > 0,
    staleTime: 0, // ✅ البيانات تعتبر قديمة فوراً
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (!showActivity && activityCtx?.entityType === 'opportunity' && activityCtx?.action === 'create') {
      console.log("🟢 Opportunity created, refreshing data...");
      
      // إعادة fetch المشاريع
      queryClient.invalidateQueries({ queryKey: ["customer-projects-table", customerId] });
      queryClient.invalidateQueries({ queryKey: ["projects", customerId] });
      
      // ✅ زيادة refreshTrigger لإعادة fetch الفرص
      setRefreshTrigger(prev => prev + 1);
      
      // ✅ أيضاً refetch مباشرة
      setTimeout(() => {
        refetchOpps();
      }, 100);
      
      // إعادة تعيين السياق
      setActivityCtx(null);
    }
  }, [showActivity, activityCtx, customerId, queryClient, refetchOpps]);

  // ✅ أيضاً عند إنشاء مشروع جديد، نحتاج لتحديث الفرص (لأن المشروع قد يكون له فرص)
  useEffect(() => {
    if (!showActivity && activityCtx?.entityType === 'project' && activityCtx?.action === 'create') {
      console.log("🟢 Project created, refreshing data...");
      
      // إعادة fetch المشاريع
      queryClient.invalidateQueries({ queryKey: ["customer-projects-table", customerId] });
      queryClient.invalidateQueries({ queryKey: ["projects", customerId] });
      
      // ✅ زيادة refreshTrigger
      setRefreshTrigger(prev => prev + 1);
      
      // إعادة تعيين السياق
      setActivityCtx(null);
    }
  }, [showActivity, activityCtx, customerId, queryClient]);

  const toggleColumn = (columnId: string) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((c) => c !== columnId)
        : [...prev, columnId];
      storeColumns(newColumns);
      return newColumns;
    });
  };

  const handleFilterChange = (filterId: string, value: string) => {
    setActiveFilters((prev) => ({ ...prev, [filterId]: value }));
  };

  const toggleExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  };

  const openActivityForProject = (projectId: string, projectName: string, projectCode: string | null) => {
    setActivityCtx({ action: 'edit', entityType: 'project', customerId, customerName, projectId, projectName, projectCode: projectCode || undefined });
    setShowActivity(true);
  };

  // const openActivityForNewOpp = (projectId: string, projectName: string, projectCode: string | null) => {
  //   setActivityCtx({ action: 'create', entityType: 'opportunity', customerId, customerName, projectId, projectName, projectCode: projectCode || undefined });
  //   setShowActivity(true);
  // };

  // const openActivityForNewProject = () => {
  //   setActivityCtx({ action: 'create', entityType: 'project', customerId, customerName });
  //   setShowActivity(true);
  // };
  // في ProjectsTable.tsx، تأكد من هذه الدوال:

// ✅ فتح شيت لإضافة مشروع جديد
const openActivityForNewProject = () => {
  console.log("🟡 Opening new project with customerId:", customerId);
  
  // ✅ تعيين السياق أولاً
  const newContext: GlobalActivityContext = { 
    action: 'create', 
    entityType: 'project', 
    customerId, 
    customerName,
  };
  
  console.log("🟡 Setting context:", newContext);
  setActivityCtx(newContext);
  
  // ✅ ثم فتح الـ Sheet
  setShowActivity(true);
};


// ✅ فتح شيت لإضافة فرصة جديدة (قد تنشئ مشروعاً أولاً)
const openActivityForNewOpp = (projectId?: string, projectName?: string, projectCode?: string | null) => {
  if (projectId) {
    // مشروع موجود → نفتح إضافة فرصة مباشرة
    setActivityCtx({ 
      action: 'create', 
      entityType: 'opportunity', 
      customerId, 
      customerName, 
      projectId, 
      projectName, 
      projectCode: projectCode || undefined 
    });
  } else {
    // لا يوجد مشروع → نفتح إنشاء مشروع أولاً
    setActivityCtx({ 
      action: 'create',      // action = 'create'
      entityType: 'project', // entityType = 'project'
      customerId, 
      customerName,
    });
  }
  setShowActivity(true);
};

  const isVisible = (columnId: string) => visibleColumns.includes(columnId);
  const visibleColumnCount = visibleColumns.length + 2;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataTableToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search projects..."
        columns={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        sortOptions={SORT_OPTIONS}
        activeSort={activeSort}
        onSortChange={setActiveSort}
      />

      <div className="flex justify-end">
        <Button onClick={openActivityForNewProject}>
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      {!projects || projects.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No projects found
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] sticky left-0 bg-background z-10" />
                  {isVisible("name") && <TableHead>Name</TableHead>}
                  {isVisible("type") && <TableHead>Type</TableHead>}
                  {isVisible("size") && <TableHead>Size</TableHead>}
                  {isVisible("phase") && <TableHead>Phase</TableHead>}
                  {isVisible("location") && <TableHead>Location</TableHead>}
                  {isVisible("poc") && <TableHead>POC</TableHead>}
                  {isVisible("created") && <TableHead>Created</TableHead>}
                  <TableHead className="w-[50px] sticky right-0 bg-background z-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const opps = oppsData?.[project.id] || [];
                  const isExpanded = expandedProjects.has(project.id);

                  return (
                    <Fragment key={project.id}>
                      <TableRow className="cursor-pointer">
                        <TableCell className="p-2 sticky left-0 bg-background z-10">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(project.id);
                            }}
                          >
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-90"
                              )}
                            />
                          </Button>
                        </TableCell>

                        {isVisible("name") && (
                          <TableCell onClick={() => navigate(`/sales/projects/${project.id}`)}>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                                <FolderKanban className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium">{project.name}</span>
                                {project.code && (
                                  <p className="text-xs font-mono text-muted-foreground">{project.code}</p>
                                )}
                                {opps.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {opps.length} opportunit{opps.length !== 1 ? "ies" : "y"}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        )}

                        {isVisible("type") && (
                          <TableCell onClick={() => navigate(`/sales/projects/${project.id}`)}>
                            {project.project_type ? (
                              <Badge variant="secondary" className={typeColors[project.project_type] || ""}>
                                {project.project_type}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}

                        {isVisible("size") && (
                          <TableCell onClick={() => navigate(`/sales/projects/${project.id}`)}>
                            {project.project_size ? (
                              <Badge variant="outline" className={sizeColors[project.project_size] || ""}>
                                {project.project_size}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}

                        {isVisible("phase") && (
                          <TableCell onClick={() => navigate(`/sales/projects/${project.id}`)}>
                            <PhaseIndicator phase={project.current_phase} />
                          </TableCell>
                        )}

                        {isVisible("location") && (
                          <TableCell>
                            {project.location && (project.location.address_link || (project.location.lat && project.location.lng)) ? (
                              <a
                                href={project.location.address_link || `https://www.google.com/maps?q=${project.location.lat},${project.location.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MapPin className="h-3.5 w-3.5" />
                                {project.location.city || project.location.address_text || "View on map"}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}

                        {isVisible("poc") && (
                          <TableCell>
                            {project.poc_contact ? (
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{project.poc_contact.full_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}

                        {isVisible("created") && (
                          <TableCell>
                            <DateCell date={project.created_at} />
                          </TableCell>
                        )}

                        <TableCell className="sticky right-0 bg-background z-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openActivityForProject(project.id, project.name, project.code)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openActivityForNewOpp(project.id, project.name, project.code)}>
                                <Target className="h-4 w-4 mr-2" />
                                Add Opportunity
                              </DropdownMenuItem>
                              {project.location && (project.location.address_link || (project.location.lat && project.location.lng)) && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    const link = project.location?.address_link ||
                                      `https://www.google.com/maps?q=${project.location?.lat},${project.location?.lng}`;
                                    window.open(link, "_blank");
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open in Maps
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setDeleteProjectId(project.id);
                                  setDeleteProjectName(project.name);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Opportunities */}
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={visibleColumnCount} className="p-0">
                            <div className="py-2 px-8">
                              {opps.length === 0 ? (
                                <div className="flex items-center justify-between py-1 text-muted-foreground text-sm">
                                  <span>No opportunities yet</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openActivityForNewOpp(project.id, project.name, project.code)}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Opportunity
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  {opps.map((opp, index) => (
                                    <div
                                      key={opp.id}
                                      className={cn(
                                        "flex items-center justify-between py-1.5 px-2 text-sm hover:bg-muted/50 rounded cursor-pointer",
                                        index !== opps.length - 1 && "border-b border-border/50"
                                      )}
                                      onClick={() => navigate(`/sales/opportunities/${opp.id}`)}
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <Target className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <span className="font-medium truncate">{opp.title}</span>
                                        <CodeCell code={opp.code} />
                                        <StageBadge stage={opp.stage} />
                                        <InterestBadge level={opp.interest_level} />
                                      </div>
                                      <DateCell date={opp.created_at} />
                                    </div>
                                  ))}
                                  <div className="pt-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => openActivityForNewOpp(project.id, project.name, project.code)}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Opportunity
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <GlobalActivitySheet
  open={showActivity}
  onOpenChange={(open) => {
    setShowActivity(open);
    if (!open) {
      // ✅ عند الإغلاق، امسح السياق بعد فترة قصيرة
      setTimeout(() => setActivityCtx(null), 100);
    }
  }}
  context={activityCtx || undefined}
/>

      {deleteProjectId && (
        <SmartDeleteDialog
          open={!!deleteProjectId}
          onOpenChange={(open) => { if (!open) setDeleteProjectId(null); }}
          entityType="project"
          entityName={deleteProjectName}
          onConfirm={(reason) => softDeleteMutation.mutate({ projectId: deleteProjectId!, reason })}
          onStatusChange={(phase) => {
            statusChangeMutation.mutate({ projectId: deleteProjectId!, phase });
            setDeleteProjectId(null);
          }}
          isLoading={softDeleteMutation.isPending}
        />
      )}
    </div>
  );
}
