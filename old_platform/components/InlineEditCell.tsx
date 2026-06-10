import { useState, useRef, useEffect } from 'react';
import { Check, X, Loader2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InlineEditCellProps {
  value: string | null;
  onSave: (newValue: string) => Promise<void>;
  type: 'select' | 'text';
  options?: { value: string; label: string; className?: string }[];
  displayComponent?: React.ReactNode;
  className?: string;
  placeholder?: string;
}

export const InlineEditCell = ({
  value,
  onSave,
  type,
  options = [],
  displayComponent,
  className,
  placeholder = '-',
}: InlineEditCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && type === 'text' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, type]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking inside the container
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking inside a radix portal (dropdown content)
      const radixPortal = document.querySelector('[data-radix-popper-content-wrapper]');
      if (radixPortal && radixPortal.contains(target)) {
        return;
      }
      
      handleCancel();
    };

    if (isEditing && type === 'text') {
      // Only add click outside listener for text inputs, not selects
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, type]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(value || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isSaving) {
    return (
      <div className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div ref={containerRef} className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {type === 'select' ? (
          <Select
            value={editValue}
            onValueChange={(val) => {
              setEditValue(val);
              // Auto-save on select change
              setIsSaving(true);
              onSave(val).then(() => {
                setIsEditing(false);
                setIsSaving(false);
              }).catch(() => {
                setIsSaving(false);
              });
            }}
          >
            <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-[100]">
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs w-24"
              placeholder={placeholder}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleSave}
            >
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCancel}
            >
              <X className="h-3 w-3 text-red-600" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors",
        className
      )}
      onClick={handleStartEdit}
    >
      {displayComponent || (
        <span className="text-muted-foreground text-sm">
          {value || placeholder}
        </span>
      )}
    </div>
  );
};

// Status badge with inline editing
interface StatusEditCellProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
}

export const StatusEditCell = ({ value, onSave }: StatusEditCellProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-primary/15 text-primary border-primary/30';
      case 'In Follow-up':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'Closed':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <InlineEditCell
      value={value}
      onSave={onSave}
      type="select"
      options={[
        { value: 'Open', label: 'Open' },
        { value: 'In Follow-up', label: 'In Follow-up' },
        { value: 'Closed', label: 'Closed' },
      ]}
      displayComponent={
        <Badge className={getStatusColor(value)}>
          {value}
        </Badge>
      }
    />
  );
};

// Interest Level badge with inline editing
interface InterestLevelEditCellProps {
  value: string | null;
  onSave: (newValue: string) => Promise<void>;
}

export const InterestLevelEditCell = ({ value, onSave }: InterestLevelEditCellProps) => {
  const getInterestColor = (level: string | null) => {
    switch (level) {
      case 'High':
        return 'bg-green-500/15 text-green-600 border-green-500/30';
      case 'Medium':
        return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
      case 'Low':
        return 'bg-orange-500/15 text-orange-600 border-orange-500/30';
      case 'Not interested':
        return 'bg-red-500/15 text-red-600 border-red-500/30';
      default:
        return '';
    }
  };

  return (
    <InlineEditCell
      value={value}
      onSave={onSave}
      type="select"
      options={[
        { value: 'High', label: 'High' },
        { value: 'Medium', label: 'Medium' },
        { value: 'Low', label: 'Low' },
        { value: 'Not interested', label: 'Not interested' },
      ]}
      displayComponent={
        value ? (
          <Badge className={getInterestColor(value)}>
            {value}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )
      }
    />
  );
};

// Assigned To with inline editing
interface AssignedToEditCellProps {
  value: string | null;
  onSave: (newValue: string) => Promise<void>;
  users?: { value: string; label: string }[];
}

export const AssignedToEditCell = ({ value, onSave, users = [] }: AssignedToEditCellProps) => {
  // If we have a list of users, use select, otherwise use text input
  if (users.length > 0) {
    return (
      <InlineEditCell
        value={value}
        onSave={onSave}
        type="select"
        options={users}
        placeholder="Unassigned"
      />
    );
  }

  return (
    <InlineEditCell
      value={value}
      onSave={onSave}
      type="text"
      placeholder="Unassigned"
    />
  );
};
