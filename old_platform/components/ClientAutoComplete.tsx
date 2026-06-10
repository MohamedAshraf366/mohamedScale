import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, User, Check, AlertCircle, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  onSearch: (term: string) => void;
  onSelect: (company: string) => void;
  isExistingClient: boolean;
  label: string;
  placeholder?: string;
  required?: boolean;
  onViewHistory?: () => void;
}

export function ClientAutoComplete({
  value,
  onChange,
  suggestions,
  onSearch,
  onSelect,
  isExistingClient,
  label,
  placeholder,
  required,
  onViewHistory,
}: ClientAutoCompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showExistingNotice, setShowExistingNotice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    onSearch(newValue);
    setIsOpen(true);
    setShowExistingNotice(false);
  };

  // Handle suggestion selection
  const handleSelect = (company: string) => {
    onChange(company);
    onSelect(company);
    setIsOpen(false);
    setShowExistingNotice(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show notice when typing matches existing client
  useEffect(() => {
    if (isExistingClient && value.length >= 2) {
      setShowExistingNotice(true);
    }
  }, [isExistingClient, value]);

  return (
    <div ref={containerRef} className="relative space-y-2">
      <Label htmlFor="company_name" className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        {label}
      </Label>
      
      <Input
        ref={inputRef}
        id="company_name"
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        required={required}
        className={cn(
          isExistingClient && value && "border-primary/50 focus-visible:ring-primary/30"
        )}
      />

      {/* Existing Client Notice */}
      {showExistingNotice && isExistingClient && value && (
        <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-primary/10 border border-primary/20 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary shrink-0" />
            <span className="text-primary">
              Existing client detected. Data will be linked to previous records.
            </span>
          </div>
          {onViewHistory && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onViewHistory}
              className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
            >
              <History className="h-3.5 w-3.5 mr-1" />
              View History
            </Button>
          )}
        </div>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-1">
            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Existing Companies
            </div>
            {suggestions.map((company, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(company)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left",
                  value.toLowerCase() === company.toLowerCase() && "bg-accent"
                )}
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{company}</span>
                {value.toLowerCase() === company.toLowerCase() && (
                  <Check className="h-4 w-4 ml-auto text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface PersonAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: Array<{ person_name: string; contact_info: string | null }>;
  onSelect: (person: { person_name: string; contact_info: string | null }) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export function PersonAutoComplete({
  value,
  onChange,
  suggestions,
  onSelect,
  label,
  placeholder,
  required,
}: PersonAutoCompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
  };

  // Handle suggestion selection
  const handleSelect = (person: { person_name: string; contact_info: string | null }) => {
    onChange(person.person_name);
    onSelect(person);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter suggestions based on current value
  const filteredSuggestions = suggestions.filter(s =>
    s.person_name.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative space-y-2">
      <Label htmlFor="person_name" className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      
      <Input
        id="person_name"
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        required={required}
      />

      {/* Person Suggestions Badge */}
      {suggestions.length > 0 && !isOpen && !value && (
        <div className="flex flex-wrap gap-1 mt-1">
          <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80" onClick={() => setIsOpen(true)}>
            {suggestions.length} known contact{suggestions.length !== 1 ? 's' : ''} available
          </Badge>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-1">
            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Known Contacts at this Company
            </div>
            {filteredSuggestions.map((person, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(person)}
                className={cn(
                  "w-full flex flex-col items-start gap-0.5 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left",
                  value.toLowerCase() === person.person_name.toLowerCase() && "bg-accent"
                )}
              >
                <span className="font-medium">{person.person_name}</span>
                {person.contact_info && (
                  <span className="text-xs text-muted-foreground">{person.contact_info}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

