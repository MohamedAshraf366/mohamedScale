import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Image, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

interface AttachmentPreviewProps {
  filePath: string;
  bucketName: string;
  onRemove?: () => void;
  showRemove?: boolean;
}

const getFileType = (fileName: string): 'image' | 'pdf' | 'excel' | 'other' => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['xlsx', 'xls'].includes(ext || '')) return 'excel';
  return 'other';
};

const getFileIcon = (fileType: 'image' | 'pdf' | 'excel' | 'other') => {
  switch (fileType) {
    case 'image':
      return <Image className="h-3 w-3 text-blue-500" />;
    case 'pdf':
      return <FileText className="h-3 w-3 text-red-500" />;
    case 'excel':
      return <FileSpreadsheet className="h-3 w-3 text-green-500" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

const AttachmentPreview = ({
  filePath,
  bucketName,
  onRemove,
  showRemove = true,
}: AttachmentPreviewProps) => {
  const [imageError, setImageError] = useState(false);
  const fileName = filePath.split('/').pop() || 'file';
  const fileType = getFileType(fileName);

  // Get public URL for the file
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);
  
  const publicUrl = urlData?.publicUrl;

  const handleOpenFile = () => {
    if (publicUrl) {
      window.open(publicUrl, '_blank');
    }
  };

  const renderPreviewContent = () => {
    if (fileType === 'image' && publicUrl && !imageError) {
      return (
        <div className="space-y-2">
          <img
            src={publicUrl}
            alt={fileName}
            className="max-w-[280px] max-h-[200px] rounded-md object-contain bg-muted"
            onError={() => setImageError(true)}
          />
          <p className="text-xs text-muted-foreground truncate max-w-[280px]">
            {fileName}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleOpenFile}
          >
            Open Full Size
          </Button>
        </div>
      );
    }

    if (fileType === 'pdf' && publicUrl) {
      return (
        <div className="space-y-2">
          <div className="w-[280px] h-[200px] rounded-md border bg-muted overflow-hidden">
            <iframe
              src={`${publicUrl}#toolbar=0&navpanes=0`}
              className="w-full h-full"
              title={fileName}
            />
          </div>
          <p className="text-xs text-muted-foreground truncate max-w-[280px]">
            {fileName}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleOpenFile}
          >
            Open PDF
          </Button>
        </div>
      );
    }

    // Default preview for Excel and other files
    return (
      <div className="space-y-2 text-center py-4">
        <div className="flex justify-center">
          {fileType === 'excel' ? (
            <FileSpreadsheet className="h-12 w-12 text-green-500" />
          ) : (
            <FileText className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
        <p className="text-sm font-medium truncate max-w-[200px]">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {fileType === 'excel' ? 'Excel Spreadsheet' : 'Document'}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={handleOpenFile}
        >
          Download File
        </Button>
      </div>
    );
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/80 text-xs group cursor-pointer",
            "hover:bg-muted transition-colors border border-transparent hover:border-border"
          )}
        >
          {getFileIcon(fileType)}
          <span
            className="max-w-[120px] truncate hover:underline"
            onClick={handleOpenFile}
          >
            {fileName}
          </span>
          {showRemove && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 opacity-50 group-hover:opacity-100 ml-1"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-auto p-3"
        sideOffset={8}
      >
        {renderPreviewContent()}
      </HoverCardContent>
    </HoverCard>
  );
};

export default AttachmentPreview;
