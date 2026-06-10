import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Image,
  File,
  Download,
  Trash2,
  Calendar,
  User,
  FolderOpen,
  Ruler,
  Calculator,
  CalendarClock,
  MapPin,
  Building2,
  Pencil,
  Info,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { EditProjectDialog } from './EditProjectDialog';
import { format } from 'date-fns';

interface ProjectDocument {
  id: string;
  project_id: string;
  category: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  client_id: string;
  city?: string;
  district?: string;
  location?: string;
  project_type?: string;
  project_size?: string;
  current_phase?: string;
  status?: string;
  notes?: string;
  created_at: string;
}

interface ProjectDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onProjectUpdated?: (updatedProject: Project) => void;
}

const DOCUMENT_CATEGORIES = [
  {
    id: 'drawings_design',
    label: 'Drawings & Design',
    icon: Ruler,
    allowedTypes: ['.pdf', '.dwg', '.jpg', '.jpeg', '.png'],
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/vnd.dwg', 'application/acad', 'application/x-dwg'],
  },
  {
    id: 'boq_quantities',
    label: 'BOQ & Quantities',
    icon: Calculator,
    allowedTypes: ['.pdf', '.xls', '.xlsx', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'],
    allowedMimes: [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
    ],
  },
  {
    id: 'schedule_planning',
    label: 'Schedule & Planning',
    icon: CalendarClock,
    allowedTypes: ['.pdf', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'],
    allowedMimes: [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
    ],
  },
];

export const ProjectDetailsDialog = ({
  open,
  onOpenChange,
  project,
  onProjectUpdated,
}: ProjectDetailsDialogProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(project);

  const fetchDocuments = useCallback(async () => {
    if (!project?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    if (open && project?.id) {
      setCurrentProject(project);
      fetchDocuments();
    }
  }, [open, project?.id, fetchDocuments, project]);

  const handleProjectUpdated = (updatedProject: Project) => {
    setCurrentProject(updatedProject);
    onProjectUpdated?.(updatedProject);
  };

  const handleCompletedToggle = async (checked: boolean) => {
    if (!currentProject) return;
    
    const newStatus = checked ? 'Completed' : 'Active';
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', currentProject.id)
        .select()
        .single();

      if (error) throw error;

      const updatedProject = { ...currentProject, status: newStatus };
      setCurrentProject(updatedProject);
      onProjectUpdated?.(updatedProject);
      toast.success(checked ? 'Project marked as completed' : 'Project reactivated');
    } catch (error: any) {
      console.error('Error updating project status:', error);
      toast.error('Failed to update project status');
    }
  };

  const handleFileUpload = async (file: File, categoryId: string) => {
    if (!project?.id || !user) return;

    const category = DOCUMENT_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;

    // Validate file type
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValidType = category.allowedTypes.some(
      (type) => type.toLowerCase() === fileExt || category.allowedMimes.includes(file.type)
    );

    if (!isValidType) {
      toast.error(`Invalid file type. Allowed: ${category.allowedTypes.join(', ')}`);
      return;
    }

    setUploading(categoryId);
    try {
      const filePath = `${project.id}/${categoryId}/${Date.now()}_${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save document record
      const { error: dbError } = await supabase.from('project_documents').insert({
        project_id: project.id,
        category: categoryId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type || fileExt,
        file_size: file.size,
        uploaded_by: user.id,
        uploaded_by_name: user.email || 'Unknown',
      });

      if (dbError) throw dbError;

      toast.success('File uploaded successfully');
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(null);
    }
  };

  const handleDownload = async (doc: ProjectDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async (doc: ProjectDocument) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error: dbError } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleDrop = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    setDragOver(null);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0], categoryId);
    }
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    setDragOver(categoryId);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return <Image className="h-4 w-4" />;
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocumentsByCategory = (categoryId: string) => {
    return documents.filter((doc) => doc.category === categoryId);
  };

  if (!project || !currentProject) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5 text-primary" />
              {currentProject.name}
            </DialogTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit Project</TooltipContent>
            </Tooltip>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Project Details</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                {currentProject.city && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">City:</span>
                    <span>{currentProject.city}</span>
                  </div>
                )}
                {currentProject.district && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">District:</span>
                    <span>{currentProject.district}</span>
                  </div>
                )}
                {currentProject.project_type && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Type:</span>
                    <span>{currentProject.project_type}</span>
                  </div>
                )}
                {currentProject.project_size && (
                  <div className="flex items-center gap-2 text-sm">
                    <Ruler className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Size:</span>
                    <span>{currentProject.project_size}</span>
                  </div>
                )}
                {currentProject.current_phase && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Phase:</span>
                    <Badge variant="outline">{currentProject.current_phase}</Badge>
                  </div>
                )}
                {currentProject.status && (
                  <div className="flex items-center gap-2 text-sm">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="secondary">{currentProject.status}</Badge>
                  </div>
                )}
              </div>
              {currentProject.notes && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    {currentProject.notes}
                  </p>
                </div>
              )}

              {/* Project Completed Toggle */}
              <div className="flex items-center space-x-3 p-3 mt-4 rounded-lg bg-muted/30 border border-border/50">
                <Checkbox
                  id="project-completed-view"
                  checked={currentProject.status === 'Completed'}
                  onCheckedChange={handleCompletedToggle}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="project-completed-view"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Project Completed (No new opportunities allowed)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When enabled, status is set to "Completed" and adding new opportunities is disabled
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[200px]">
                    Existing opportunities remain visible. Only new opportunity creation is disabled.
                  </TooltipContent>
                </Tooltip>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 mt-4">
              {DOCUMENT_CATEGORIES.map((category) => {
                const CategoryIcon = category.icon;
                const categoryDocs = getDocumentsByCategory(category.id);
                const isUploading = uploading === category.id;
                const isDragOver = dragOver === category.id;

                return (
                  <Card
                    key={category.id}
                    className={`transition-all ${isDragOver ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="h-5 w-5 text-primary" />
                          {category.label}
                          <Badge variant="secondary" className="ml-2">
                            {categoryDocs.length}
                          </Badge>
                        </div>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept={category.allowedTypes.join(',')}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, category.id);
                              e.target.value = '';
                            }}
                            disabled={isUploading}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUploading}
                            asChild
                          >
                            <span>
                              <Upload className="h-4 w-4 mr-1" />
                              {isUploading ? 'Uploading...' : 'Upload'}
                            </span>
                          </Button>
                        </label>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                          isDragOver
                            ? 'border-primary bg-primary/5'
                            : 'border-border/50'
                        }`}
                        onDrop={(e) => handleDrop(e, category.id)}
                        onDragOver={(e) => handleDragOver(e, category.id)}
                        onDragLeave={handleDragLeave}
                      >
                        {categoryDocs.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No documents uploaded</p>
                            <p className="text-xs mt-1">
                              Drag & drop files here or click Upload
                            </p>
                            <p className="text-xs mt-1 opacity-70">
                              Allowed: {category.allowedTypes.join(', ')}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {categoryDocs.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {getFileIcon(doc.file_type)}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {doc.file_name}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {doc.uploaded_by_name || 'Unknown'}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(doc.created_at), 'MMM d, yyyy')}
                                      </span>
                                      <span>{formatFileSize(doc.file_size)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleDownload(doc)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(doc)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <EditProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        project={currentProject}
        onSuccess={handleProjectUpdated}
      />
    </>
  );
};
