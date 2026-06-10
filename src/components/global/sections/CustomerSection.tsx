import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Building2, Plus, Trash2, User, MapPin, Check, ChevronsUpDown, ChevronDown, Phone } from "lucide-react";
import { CUSTOMER_TYPES } from "@/lib/customer-schema";
import { MapLocationPicker, type LocationResult } from "@/components/customers/MapLocationPicker";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface CustomerContactInput {
  id?: string;
  full_name: string;
  phone: string;
  email: string;
  role_title: string;
  is_primary: boolean;
  prefers_whatsapp: boolean;
  country_code?: string;
}

export interface CustomerData {
  mode: "chip" | "select" | "create" | "edit";
  selectedId: string;
  selectedName: string;
  selectedCode: string;
  displayName: string;
  customerType: string;
  contactPhone: string;
  legalName?: string;
  taxNumber?: string;
  website?: string;
  accountStatus?: string;
  pricingTier?: string;
  paymentTermsDays?: number | null;
  creditLimit?: number | null;
  customerNotes?: string;
  accountNotes?: string;
  contacts?: CustomerContactInput[];
  location?: LocationResult | null;
}

interface CustomerSectionProps {
  data: CustomerData;
  onChange: (data: CustomerData) => void;
}

const ARAB_COUNTRIES = [
  { code: "SA", short: "🇸🇦", name: "Saudi Arabia", dialCode: "+966", phoneLength: 9, example: "5XXXXXXX" },
  { code: "AE", short: "🇦🇪", name: "UAE", dialCode: "+971", phoneLength: 9, example: "5XXXXXXX" },
  { code: "KW", short: "🇰🇼", name: "Kuwait", dialCode: "+965", phoneLength: 8, example: "5XXXXXXX" },
  { code: "QA", short: "🇶🇦", name: "Qatar", dialCode: "+974", phoneLength: 8, example: "3XXXXXXX" },
  { code: "BH", short: "🇧🇭", name: "Bahrain", dialCode: "+973", phoneLength: 8, example: "3XXXXXXX" },
  { code: "OM", short: "🇴🇲", name: "Oman", dialCode: "+968", phoneLength: 8, example: "9XXXXXXX" },
  { code: "JO", short: "🇯🇴", name: "Jordan", dialCode: "+962", phoneLength: 9, example: "7XXXXXXXX" },
  { code: "EG", short: "🇪🇬", name: "Egypt", dialCode: "+20", phoneLength: 10, example: "1XXXXXXXXX" },
  { code: "PS", short: "🇵🇸", name: "Palestine", dialCode: "+970", phoneLength: 9, example: "5XXXXXXX" },
  { code: "LB", short: "🇱🇧", name: "Lebanon", dialCode: "+961", phoneLength: 8, example: "3XXXXXX" },
  { code: "SY", short: "🇸🇾", name: "Syria", dialCode: "+963", phoneLength: 9, example: "9XXXXXXX" },
  { code: "IQ", short: "🇮🇶", name: "Iraq", dialCode: "+964", phoneLength: 10, example: "7XXXXXXXX" },
  { code: "YE", short: "🇾🇪", name: "Yemen", dialCode: "+967", phoneLength: 9, example: "7XXXXXXX" },
  { code: "LY", short: "🇱🇾", name: "Libya", dialCode: "+218", phoneLength: 9, example: "9XXXXXXX" },
  { code: "TN", short: "🇹🇳", name: "Tunisia", dialCode: "+216", phoneLength: 8, example: "2XXXXXXX" },
  { code: "DZ", short: "🇩🇿", name: "Algeria", dialCode: "+213", phoneLength: 9, example: "5XXXXXXX" },
  { code: "MA", short: "🇲🇦", name: "Morocco", dialCode: "+212", phoneLength: 9, example: "6XXXXXXX" },
  { code: "MR", short: "🇲🇷", name: "Mauritania", dialCode: "+222", phoneLength: 8, example: "3XXXXXXX" },
  { code: "SD", short: "🇸🇩", name: "Sudan", dialCode: "+249", phoneLength: 9, example: "9XXXXXXX" },
  { code: "SO", short: "🇸🇴", name: "Somalia", dialCode: "+252", phoneLength: 8, example: "6XXXXXXX" },
  { code: "DJ", short: "🇩🇯", name: "Djibouti", dialCode: "+253", phoneLength: 8, example: "7XXXXXXX" },
  { code: "KM", short: "🇰🇲", name: "Comoros", dialCode: "+269", phoneLength: 7, example: "3XXXXXX" },
];

const DEFAULT_COUNTRY = ARAB_COUNTRIES.find(c => c.code === "SA")!;

function formatPhoneNumber(raw: string, dialCode: string): string {
  let cleaned = raw.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  
  if (cleaned.startsWith(dialCode)) {
    return cleaned;
  }
  
  if (cleaned.startsWith('+')) {
    const parts = cleaned.match(/\+(\d+)(.*)/);
    if (parts) {
      const existingCode = '+' + parts[1];
      const rest = parts[2];
      if (existingCode === dialCode) return cleaned;
      return dialCode + rest;
    }
  }
  
  while (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  return dialCode + cleaned;
}

function isValidPhone(phone: string, countryCode: string): boolean {
  const country = ARAB_COUNTRIES.find(c => c.code === countryCode);
  if (!country) return phone.length > 5;
  
  const formatted = formatPhoneNumber(phone, country.dialCode);
  const localNumber = formatted.replace(country.dialCode, '');
  
  const validPrefixes = ['5', '6', '7', '9', '3', '2', '1'];
  const firstDigit = localNumber[0];
  
  return localNumber.length === country.phoneLength && 
         validPrefixes.includes(firstDigit) &&
         /^\d+$/.test(localNumber);
}

function extractLocalNumber(phone: string, dialCode: string): string {
  const formatted = formatPhoneNumber(phone, dialCode);
  return formatted.replace(dialCode, '');
}

interface PhoneInputProps {
  value: string;
  countryCode: string;
  onValueChange: (phone: string, countryCode: string) => void;
  placeholder?: string;
  required?: boolean;
}



function PhoneInput({ value, countryCode, onValueChange, placeholder, required }: PhoneInputProps) {
  const [localNumber, setLocalNumber] = useState(() => {
    const country = ARAB_COUNTRIES.find(c => c.code === countryCode);
    if (country && value) {
      return extractLocalNumber(value, country.dialCode);
    }
    return value.replace(/[^\d]/g, '');
  });
  
  const [displayError, setDisplayError] = useState(false);
  const [open, setOpen] = useState(false);
  
  const selectedCountry = ARAB_COUNTRIES.find(c => c.code === countryCode) || DEFAULT_COUNTRY;
  
  const handleCountryChange = (newCode: string) => {
    const newCountry = ARAB_COUNTRIES.find(c => c.code === newCode)!;
    const newFullNumber = formatPhoneNumber(localNumber, newCountry.dialCode);
    onValueChange(newFullNumber, newCode);
    setOpen(false);
  };
  
  const handleLocalNumberChange = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '');
    setLocalNumber(digits);
    
    if (digits) {
      const newFullNumber = formatPhoneNumber(digits, selectedCountry.dialCode);
      onValueChange(newFullNumber, countryCode);
      setDisplayError(!isValidPhone(newFullNumber, countryCode));
    } else {
      onValueChange('', countryCode);
      setDisplayError(false);
    }
  };
  
  return (
    <div className="flex gap-2">
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-[90px] shrink-0 justify-between"
            >
              <div className="flex items-center gap-1.5">
                <span>{selectedCountry.short}</span>
                <span className="text-xs">{selectedCountry.dialCode}</span>
              </div>
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search country..." className="h-8" />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {ARAB_COUNTRIES.map((country) => (
                    <CommandItem
                      key={country.code}
                      value={`${country.name} ${country.code} ${country.dialCode}`}
                      onSelect={() => handleCountryChange(country.code)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span>{country.short}</span>
                        <span className="text-sm">{country.code}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{country.dialCode}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="flex-1">
        <Input
          value={localNumber}
          onChange={e => handleLocalNumberChange(e.target.value)}
          placeholder={placeholder || `${selectedCountry.example}`}
          className={cn(displayError && "border-destructive focus-visible:ring-destructive")}
        />
        {displayError && (
          <p className="text-[10px] text-destructive mt-0.5">
            Phone number must be {selectedCountry.phoneLength} digits
          </p>
        )}
      </div>
    </div>
  );
}

function emptyContact(isPrimary: boolean, countryCode: string = DEFAULT_COUNTRY.code): CustomerContactInput {
  return {
    full_name: "",
    phone: "",
    email: "",
    role_title: "",
    is_primary: isPrimary,
    prefers_whatsapp: true,
    country_code: countryCode,
  };
}

export function CustomerSection({ data, onChange }: CustomerSectionProps) {
  const [showLocation, setShowLocation] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);

  const { data: customersList } = useQuery({
    queryKey: ["customers-select-list"],
    queryFn: async () => {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, display_name, code")
        .is("deleted_at", null)
        .order("display_name");
      return accounts || [];
    },
    enabled: data.mode === "select",
  });

  const { data: fullCustomer } = useQuery({
    queryKey: ["customer-edit-data", data.selectedId],
    queryFn: async () => {
      const [{ data: cust }, { data: account }, { data: contacts }] = await Promise.all([
        supabase.from("customers").select("*").eq("account_id", data.selectedId).single(),
        supabase.from("accounts").select("*, location:locations(*)").eq("id", data.selectedId).single(),
        supabase.from("contacts").select("*").eq("account_id", data.selectedId).is("deleted_at", null).order("is_primary", { ascending: false }),
      ]);
      return { customer: cust, account, contacts: contacts || [] };
    },
    enabled: data.mode === "edit" && !!data.selectedId,
  });

  const populatedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (data.mode !== "edit") populatedIdRef.current = null;
  }, [data.mode]);

  useEffect(() => {
    if (data.mode === "edit" && fullCustomer && data.selectedId && populatedIdRef.current !== data.selectedId) {
      populatedIdRef.current = data.selectedId;
      const loc = (fullCustomer.account as any)?.location;
      
      const contactsWithCountry = (fullCustomer.contacts || []).map(c => {
        let countryCode = DEFAULT_COUNTRY.code;
        if (c.phone) {
          const matchedCountry = ARAB_COUNTRIES.find(country => c.phone.startsWith(country.dialCode));
          if (matchedCountry) countryCode = matchedCountry.code;
        }
        return {
          id: c.id,
          full_name: c.full_name,
          phone: c.phone || "",
          email: c.email || "",
          role_title: c.role_title || "",
          is_primary: c.is_primary,
          prefers_whatsapp: c.prefers_whatsapp,
          country_code: countryCode,
        };
      });
      
      onChange({
        ...data,
        displayName: fullCustomer.account?.display_name || "",
        legalName: fullCustomer.account?.legal_name || "",
        taxNumber: fullCustomer.account?.tax_number || "",
        website: fullCustomer.account?.website || "",
        accountStatus: fullCustomer.account?.status || "active",
        accountNotes: fullCustomer.account?.notes || "",
        customerType: fullCustomer.customer?.customer_type || "SME",
        pricingTier: fullCustomer.customer?.pricing_tier || "",
        paymentTermsDays: fullCustomer.customer?.payment_terms_days,
        creditLimit: fullCustomer.customer?.credit_limit ? Number(fullCustomer.customer.credit_limit) : null,
        customerNotes: fullCustomer.customer?.notes || "",
        contacts: contactsWithCountry.length > 0 ? contactsWithCountry : [emptyContact(true)],
        location: loc ? {
          address_text: loc.address_text || "", city: loc.city || "", country: loc.country || "SA",
          place_name: loc.place_name || "", place_id: loc.place_id || "",
          lat: Number(loc.lat) || 0, lng: Number(loc.lng) || 0,
          address_link: loc.address_link || "",
          region_code: (loc.region_code as string) || 'SA-01',
          zone_code: (loc.zone_code as string) || null,
          zone_name: null,
        } : null,
      });
      if (loc) setShowLocation(true);
    }
  }, [fullCustomer, data.mode, data.selectedId]);

  useEffect(() => {
    if (data.mode === "create" && (!data.contacts || data.contacts.length === 0)) {
      const seed: CustomerContactInput = {
        ...emptyContact(true),
        phone: data.contactPhone || "",
      };
      onChange({ ...data, contacts: [seed] });
    }
  }, [data.mode]);

  if (data.mode === "chip") return null;

  if (data.mode === "select") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">Select Customer</h3>
        </div>
        <Popover open={selectOpen} onOpenChange={setSelectOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={selectOpen}
              className="w-full justify-between font-normal"
            >
              {data.selectedId
                ? customersList?.find(c => c.id === data.selectedId)?.display_name || data.selectedName || "Select customer..."
                : "Select customer..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[200] bg-popover border shadow-md" align="start">
            <Command>
              <CommandInput placeholder="Search customers..." />
              <CommandList>
                <CommandEmpty>No customers found.</CommandEmpty>
                <CommandGroup>
                  {(customersList || []).map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.display_name || c.id}
                      onSelect={() => {
                        onChange({
                          ...data,
                          selectedId: c.id,
                          selectedName: c.display_name || "",
                          selectedCode: c.code || "",
                        });
                        setSelectOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", data.selectedId === c.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span className="text-sm">{c.display_name || "Unnamed"}</span>
                        {c.code && <span className="text-xs text-muted-foreground font-mono">{c.code}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full text-xs border-dashed"
          onClick={() => onChange({ ...data, mode: "create", contacts: [emptyContact(true)] })}
        >
          <Plus className="h-3 w-3 mr-1" /> New Customer
        </Button>
      </div>
    );
  }

  const isEdit = data.mode === "edit";
  const contacts = data.contacts || [];

  // أضف هذه الدالة في CustomerSection
const checkPhoneExists = async (phone: string, accountId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("phone", phone)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .maybeSingle();
  
  return !!data;
};

// ثم استخدمها عند إضافة contact جديد
const addContact = async () => {
  const newContact = emptyContact(contacts.length === 0, DEFAULT_COUNTRY.code);
  const phoneExists = await checkPhoneExists(newContact.phone, data.selectedId);
  if (phoneExists) {
    toast.error("This phone number already exists for this customer");
    return;
  }
  onChange({ ...data, contacts: [...contacts, newContact] });
};
  const updateContact = (i: number, field: keyof CustomerContactInput, value: any) => {
    const u = [...contacts];
    (u[i] as any)[field] = value;
    onChange({ ...data, contacts: u });
  };
  
  const updatePhone = (i: number, phone: string, countryCode: string) => {
    const u = [...contacts];
    u[i].phone = phone;
    u[i].country_code = countryCode;
    onChange({ ...data, contacts: u });
  };
  
  const removeContact = (i: number) => {
    const next = contacts.filter((_, idx) => idx !== i);
    if (contacts[i]?.is_primary && next.length > 0) next[0] = { ...next[0], is_primary: true };
    onChange({ ...data, contacts: next });
  };
  
  const setPrimary = (i: number) =>
    onChange({ ...data, contacts: contacts.map((c, idx) => ({ ...c, is_primary: idx === i })) });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">{isEdit ? "Edit Customer" : "New Customer"}</h3>
      </div>

      <div className="space-y-3 p-3 rounded-lg border bg-background/50">
        <div className="space-y-2">
          <Label className="text-xs">Name *</Label>
          <Input value={data.displayName} onChange={e => onChange({ ...data, displayName: e.target.value })} placeholder="Company name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Type</Label>
            <Select value={data.customerType} onValueChange={v => onChange({ ...data, customerType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CUSTOMER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Status</Label>
            <Select value={data.accountStatus || "active"} onValueChange={v => onChange({ ...data, accountStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Collapsible open={showMoreDetails} onOpenChange={setShowMoreDetails}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="text-xs w-full justify-between gap-1">
              <span>More details (legal, tax, terms...)</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", showMoreDetails && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Legal Name</Label>
                <Input value={data.legalName || ""} onChange={e => onChange({ ...data, legalName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tax Number</Label>
                <Input value={data.taxNumber || ""} onChange={e => onChange({ ...data, taxNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Website</Label>
                <Input value={data.website || ""} onChange={e => onChange({ ...data, website: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Pricing Tier</Label>
                <Input value={data.pricingTier || ""} onChange={e => onChange({ ...data, pricingTier: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Payment Terms (days)</Label>
                <Input type="number" value={data.paymentTermsDays ?? ""} onChange={e => onChange({ ...data, paymentTermsDays: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Credit Limit (SAR)</Label>
                <Input type="number" value={data.creditLimit ?? ""} onChange={e => onChange({ ...data, creditLimit: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Customer Notes</Label>
              <Textarea rows={2} value={data.customerNotes || ""} onChange={e => onChange({ ...data, customerNotes: e.target.value })} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={showLocation} onOpenChange={setShowLocation}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="text-xs w-full justify-start gap-1">
              <MapPin className="h-3 w-3" />
              {data.location ? `📍 ${data.location.city || data.location.address_text || "Location set"}` : "Add Location"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <MapLocationPicker
              initialLat={data.location?.lat}
              initialLng={data.location?.lng}
              onLocationSelect={loc => onChange({ ...data, location: loc })}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1">
            <User className="h-3 w-3" /> Contacts {!isEdit && <span className="text-destructive">*</span>}
          </Label>
          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={addContact}>
            <Plus className="h-3 w-3 mr-1" /> Add another
          </Button>
        </div>
        {contacts.map((contact, i) => (
          <div key={contact.id ?? `new-${i}`} className="p-3 rounded-lg border bg-background/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                Contact {i + 1} {contact.is_primary && <span className="text-primary">(Primary)</span>}
              </span>
              <div className="flex gap-1">
                {!contact.is_primary && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPrimary(i)}>
                    Set Primary
                  </Button>
                )}
                {contacts.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeContact(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <Input
              placeholder={!isEdit ? "Full name *" : "Full name"}
              value={contact.full_name}
              onChange={e => updateContact(i, "full_name", e.target.value)}
            />
            
            <PhoneInput
              value={contact.phone}
              countryCode={contact.country_code || DEFAULT_COUNTRY.code}
              onValueChange={(phone, countryCode) => updatePhone(i, phone, countryCode)}
              placeholder="Mobile number"
              required={!isEdit}
            />
            
            <Input 
              placeholder="Email" 
              value={contact.email} 
              onChange={e => updateContact(i, "email", e.target.value)} 
            />
            <Input 
              placeholder="Role / Title" 
              value={contact.role_title} 
              onChange={e => updateContact(i, "role_title", e.target.value)} 
            />
            <div className="flex items-center gap-2">
              <Switch checked={contact.prefers_whatsapp} onCheckedChange={v => updateContact(i, "prefers_whatsapp", v)} />
              <span className="text-xs text-muted-foreground">Prefers WhatsApp</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}