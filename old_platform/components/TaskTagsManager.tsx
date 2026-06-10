import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, Plus, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

// Predefined tag colors
const TAG_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-600 border-red-500/30',
  important: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  review: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  client: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  internal: 'bg-gray-500/15 text-gray-600 border-gray-500/30',
  followup: 'bg-green-500/15 text-green-600 border-green-500/30',
  meeting: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
  call: 'bg-pink-500/15 text-pink-600 border-pink-500/30',
};

// Default color for custom tags
const DEFAULT_TAG_COLOR = 'bg-primary/15 text-primary border-primary/30';

export const getTagColor = (tag: string): string => {
  const lowerTag = tag.toLowerCase();
  return TAG_COLORS[lowerTag] || DEFAULT_TAG_COLOR;
};

interface TaskTagsDisplayProps {
  tags: string[];
  maxDisplay?: number;
  size?: 'sm' | 'default';
}

export const TaskTagsDisplay = ({ tags, maxDisplay = 3, size = 'sm' }: TaskTagsDisplayProps) => {
  if (!tags || tags.length === 0) return null;
  
  const displayTags = tags.slice(0, maxDisplay);
  const remainingCount = tags.length - maxDisplay;
  
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {displayTags.map((tag) => (
        <Badge 
          key={tag} 
          variant="outline" 
          className={cn(
            getTagColor(tag),
            size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'
          )}
        >
          {tag}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className={cn(
          "bg-muted text-muted-foreground border-muted-foreground/30",
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'
        )}>
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
};

interface TaskTagsEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export const TaskTagsEditor = ({ tags, onChange, suggestions = [] }: TaskTagsEditorProps) => {
  const [newTag, setNewTag] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const handleAddTag = () => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onChange([...tags, trimmedTag]);
      setNewTag('');
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };
  
  const filteredSuggestions = suggestions.filter(
    s => !tags.includes(s) && s.toLowerCase().includes(newTag.toLowerCase())
  );
  
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge 
            key={tag} 
            variant="outline" 
            className={cn(getTagColor(tag), "pr-1")}
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="ml-1 hover:bg-foreground/10 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            placeholder="Add a tag..."
            className="h-8 text-sm"
          />
          {isOpen && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 py-1 max-h-32 overflow-auto">
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange([...tags, suggestion]);
                    setNewTag('');
                  }}
                >
                  <Badge variant="outline" className={cn(getTagColor(suggestion), "text-xs")}>
                    {suggestion}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button 
          type="button" 
          size="sm" 
          variant="outline" 
          onClick={handleAddTag}
          disabled={!newTag.trim()}
          className="h-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

interface TaskTagsInlineProps {
  tags: string[];
  onUpdate: (tags: string[]) => Promise<void>;
  suggestions?: string[];
}

export const TaskTagsInline = ({ tags, onUpdate, suggestions = [] }: TaskTagsInlineProps) => {
  const [localTags, setLocalTags] = useState(tags);
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSave = async () => {
    await onUpdate(localTags);
    setIsOpen(false);
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
          {tags.length > 0 ? (
            <TaskTagsDisplay tags={tags} maxDisplay={2} />
          ) : (
            <span className="flex items-center gap-1 text-xs">
              <Tag className="h-3 w-3" />
              Add tags
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <TaskTagsEditor 
          tags={localTags} 
          onChange={setLocalTags}
          suggestions={suggestions}
        />
        <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setLocalTags(tags);
              setIsOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
