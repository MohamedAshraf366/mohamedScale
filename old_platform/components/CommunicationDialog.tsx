import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus, Trash2, Package, Target, Building2, AlertTriangle, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLogger';
import { Separator } from '@/components/ui/separator';
import FollowUpDialog from '@/components/FollowUpDialog';
import CommunicationFollowUpsSection, { PendingFollowUp } from '@/components/CommunicationFollowUpsSection';
import { useAuth } from '@/contexts/AuthContext';
import { useClientSuggestions } from '@/hooks/useClientSuggestions';
import { ClientAutoComplete, PersonAutoComplete } from '@/components/ClientAutoComplete';
import ClientHistoryPanel from '@/components/ClientHistoryPanel';
import MaterialStepSelector from '@/components/MaterialStepSelector';
import CategoryCombobox from '@/components/CategoryCombobox';
import QuotationDetailsSection, { QuotationDetails, QuotationItem } from '@/components/QuotationDetailsSection';

interface MaterialPrice {
  id?: string;
  material_id: string;
  material_name?: string;
  current_purchase_price: number | null;
}

interface CategoryNeed {
  id?: string;
  category_id: string;
  category_name?: string; // For display purposes (resolved from category_id)
  subcategory_name?: string;
  notes: string;
  isLegacy?: boolean; // Flag for invalid/legacy records
}

interface SupplyCategory {
  id: string;
  name: string;
}

interface Material {
  id: string;
  name: string;
}

const OBJECTION_TYPES = [
  { value: 'Not Interested', label: 'Not Interested' },
  { value: 'Price Too High', label: 'Price Too High' },
  { value: 'Specific Requirements Needed', label: 'Specific Requirements Needed' },
  { value: 'Payment Terms Issue', label: 'Payment Terms Issue' },
];

interface InitialClientData {
  company_name: string;
  person_name: string;
  contact_info: string;
  category?: string;
}

interface CommunicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communication: any | null;
  onSave: () => void;
  initialClientData?: InitialClientData | null;
}

interface ExistingFollowUp {
  id: string;
  follow_up_date: string;
  status_after: string | null;
  notes: string | null;
  action: string | null;
  created_at: string;
  user_id: string;
  communication_log_id: string;
  creator_name?: string;
  priority?: string | null;
  follow_up_type?: string | null;
  outcome?: string | null;
  reminder_enabled?: boolean;
  attachments?: string[];
  follow_up_channel?: string | null;
  client_response?: string | null;
}

const CommunicationDialog = ({ open, onOpenChange, communication, onSave, initialClientData }: CommunicationDialogProps) => {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [supplyCategories, setSupplyCategories] = useState<SupplyCategory[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<ExistingFollowUp | null>(null);
  const [savedCommunication, setSavedCommunication] = useState<any>(null);
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUp[]>([]);
  const [existingFollowUps, setExistingFollowUps] = useState<ExistingFollowUp[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  
  // Smart client detection hook
  const {
    companySuggestions,
    personSuggestions,
    isExistingClient,
    searchCompanies,
    selectCompany,
    selectPerson,
    resetSuggestions,
    refreshClients,
  } = useClientSuggestions();
  
  // Get current user's name for default assigned_to
  const getCurrentUserName = () => {
    const currentMember = teamMembers.find(m => m.id === user?.id);
    return currentMember?.name || '';
  };

  const [formData, setFormData] = useState({
    company_name: '',
    category: '',
    person_name: '',
    contact_info: '',
    communication_channels: '',
    summary: '',
    quotation_required: false,
    follow_up_date: '',
    status: 'In Follow-up',
    notes: '',
    communication_date: new Date().toISOString().split('T')[0],
    assigned_to: '',
    // Structured summary fields
    outcome_notes: '',
    interest_level: '',
    other_projects: '',
    objection_type: '',
  });

  // Material prices and category needs
  const [materialPrices, setMaterialPrices] = useState<MaterialPrice[]>([]);
  const [categoryNeeds, setCategoryNeeds] = useState<CategoryNeed[]>([]);
  const [deletedPriceIds, setDeletedPriceIds] = useState<string[]>([]);
  const [deletedNeedIds, setDeletedNeedIds] = useState<string[]>([]);

  // Quotation details state
  const [quotationDetails, setQuotationDetails] = useState<QuotationDetails>({
    projectName: '',
    projectType: '',
    projectSize: '',
    currentPhase: '',
    district: '',
    city: '',
    location: '',
    quotationRequested: '',
    quotationType: '',
    isSoftQuotation: false,
    quotationSent: false,
    items: [{ material_id: '', quantity: '', unit_price: '', scale_price: 0, supplier_id: '' }],
  });

  // Check if interest level qualifies for quotation section
  const showQuotationSection = ['High', 'Medium', 'Low'].includes(formData.interest_level);
  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      fetchSupplyCategories();
      fetchMaterials();
      refreshClients();
    } else {
      resetSuggestions();
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');

      if (error) throw error;
      
      const members = data
        .filter(profile => profile.full_name)
        .map(profile => ({
          id: profile.id,
          name: profile.full_name!
        }));
      
      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  // Fetch supply categories from Materials Library (distinct categories from materials table)
  const fetchSupplyCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('category')
        .order('category');

      if (error) throw error;
      
      // Get unique categories from materials table (same source as Materials Library)
      const uniqueCategories = Array.from(
        new Set((data || []).map(m => m.category).filter(Boolean))
      ).sort();
      
      // Use category name as both id and name (materials use text, not FK)
      const categories = uniqueCategories.map(cat => ({
        id: cat,
        name: cat
      }));
      
      setSupplyCategories(categories);
    } catch (error) {
      console.error('Error fetching supply categories:', error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const fetchRelatedData = async (communicationId: string) => {
    try {
      // Fetch material prices
      const { data: pricesData, error: pricesError } = await supabase
        .from('communication_material_prices')
        .select('id, material_id, current_purchase_price, materials(name)')
        .eq('communication_id', communicationId);

      if (pricesError) throw pricesError;

      setMaterialPrices(
        (pricesData || []).map((p: any) => ({
          id: p.id,
          material_id: p.material_id,
          material_name: p.materials?.name,
          current_purchase_price: p.current_purchase_price,
        }))
      );

      // Fetch category needs - category_name is the source of truth (matching Materials Library)
      const { data: needsData, error: needsError } = await supabase
        .from('communication_material_needs')
        .select('id, category_name, subcategory_name, notes')
        .eq('communication_id', communicationId);

      if (needsError) throw needsError;

      // Get current valid categories from materials table for validation
      const { data: materialsData } = await supabase
        .from('materials')
        .select('category');
      
      const validCategories = new Set(
        (materialsData || []).map(m => m.category).filter(Boolean)
      );

      setCategoryNeeds(
        (needsData || []).map((n: any) => {
          const categoryName = n.category_name || '';
          const isValidCategory = validCategories.has(categoryName);
          
          return {
            id: n.id,
            category_id: categoryName, // Use category_name as id (text-based)
            category_name: categoryName,
            subcategory_name: n.subcategory_name || '',
            notes: n.notes || '',
            isLegacy: !isValidCategory && !!categoryName, // Legacy if not in current Materials Library
          };
        })
      );

      // Fetch quotation items for this communication
      const { data: quotationItemsData } = await supabase
        .from('quotation_items')
        .select('id, material_id, quantity, unit_price, supplier_id, materials(name, scale_price), suppliers(name)')
        .eq('communication_log_id', communicationId);

      if (quotationItemsData && quotationItemsData.length > 0) {
        setQuotationDetails(prev => ({
          ...prev,
          // If there are existing items, default to yes + qty-based (backward compatibility)
          quotationRequested: 'yes',
          quotationType: prev.isSoftQuotation ? 'soft' : 'qty-based',
          items: quotationItemsData.map((item: any) => ({
            id: item.id,
            material_id: item.material_id || '',
            material_name: item.materials?.name || '',
            quantity: item.quantity?.toString() || '',
            unit_price: item.unit_price?.toString() || '',
            scale_price: item.materials?.scale_price || 0,
            supplier_id: item.supplier_id || '',
            supplier_name: item.suppliers?.name || '',
          })),
        }));
      }

      // Fetch existing follow-ups
      await fetchFollowUps(communicationId);
    } catch (error) {
      console.error('Error fetching related data:', error);
    }
  };

  const fetchFollowUps = async (communicationId: string) => {
    try {
      setLoadingFollowUps(true);
      const { data, error } = await supabase
        .from('follow_up_history')
        .select(`
          *,
          profiles:user_id(full_name)
        `)
        .eq('communication_log_id', communicationId)
        .order('follow_up_date', { ascending: false });

      if (error) throw error;

      setExistingFollowUps(
        (data || []).map((f: any) => ({
          ...f,
          creator_name: f.profiles?.full_name || 'Unknown',
        }))
      );
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setLoadingFollowUps(false);
    }
  };

  const handleAddNewMember = () => {
    if (newMemberName.trim()) {
      const trimmedName = newMemberName.trim();
      if (!teamMembers.find(m => m.name === trimmedName)) {
        const tempMember = { id: 'temp-' + Date.now(), name: trimmedName };
        setTeamMembers(prev => [...prev, tempMember].sort((a, b) => a.name.localeCompare(b.name)));
        setFormData({ ...formData, assigned_to: trimmedName });
      } else {
        setFormData({ ...formData, assigned_to: trimmedName });
      }
      setNewMemberName('');
      setShowAddMember(false);
      setComboboxOpen(false);
    }
  };

  useEffect(() => {
    const defaultQuotationDetails: QuotationDetails = {
      projectName: '',
      projectType: '',
      projectSize: '',
      currentPhase: '',
      district: '',
      city: '',
      location: '',
      quotationRequested: '',
      quotationType: '',
      isSoftQuotation: false,
      quotationSent: false,
      items: [{ material_id: '', quantity: '', unit_price: '', scale_price: 0, supplier_id: '' }],
    };

    if (communication) {
      setFormData({
        company_name: communication.company_name || '',
        category: communication.category || '',
        person_name: communication.person_name || '',
        contact_info: communication.contact_info || '',
        communication_channels: communication.communication_channels || '',
        summary: communication.summary || '',
        quotation_required: communication.quotation_required || false,
        follow_up_date: communication.follow_up_date || '',
        status: communication.status || 'Open',
        notes: communication.notes || '',
        communication_date: communication.communication_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        assigned_to: communication.assigned_to || '',
        outcome_notes: communication.outcome_notes || '',
        interest_level: communication.interest_level || '',
        other_projects: communication.other_projects || '',
        objection_type: communication.objection_type || '',
      });
      // Determine quotation request status from existing data for backward compatibility
      // If there are quotation items, assume yes + qty-based; if soft quotation, yes + soft; otherwise no
      const hasExistingItems = communication.quotation_required || communication.is_soft_quotation;
      const quotationRequested = hasExistingItems ? 'yes' : 'no';
      const quotationType = communication.is_soft_quotation ? 'soft' : (hasExistingItems ? 'qty-based' : '');
      
      // Set quotation details from communication
      setQuotationDetails({
        projectName: (communication as any).deal_project_name || '',
        projectType: communication.project_type || '',
        projectSize: communication.project_size || '',
        currentPhase: communication.current_phase || '',
        district: communication.district || '',
        city: communication.city || '',
        location: communication.location || '',
        quotationRequested: quotationRequested as 'yes' | 'no' | '',
        quotationType: quotationType as 'soft' | 'qty-based' | '',
        isSoftQuotation: communication.is_soft_quotation || false,
        quotationSent: communication.quotation_sent || false,
        items: [{ material_id: '', quantity: '', unit_price: '', scale_price: 0, supplier_id: '' }],
      });
      fetchRelatedData(communication.id);
      setSavedCommunication(communication);
    } else if (initialClientData) {
      // Pre-fill with client data for new communication from existing client
      const defaultAssignedTo = teamMembers.find(m => m.id === user?.id)?.name || '';
      setFormData({
        company_name: initialClientData.company_name || '',
        category: initialClientData.category || '',
        person_name: initialClientData.person_name || '',
        contact_info: initialClientData.contact_info || '',
        communication_channels: '',
        summary: '',
        quotation_required: false,
        follow_up_date: '',
        status: 'In Follow-up',
        notes: '',
        communication_date: new Date().toISOString().split('T')[0],
        assigned_to: defaultAssignedTo,
        outcome_notes: '',
        interest_level: '',
        other_projects: '',
        objection_type: '',
      });
      setMaterialPrices([]);
      setCategoryNeeds([]);
      setQuotationDetails(defaultQuotationDetails);
      setSavedCommunication(null);
      setPendingFollowUps([]);
      setExistingFollowUps([]);
    } else {
      const defaultAssignedTo = teamMembers.find(m => m.id === user?.id)?.name || '';
      setFormData({
        company_name: '',
        category: '',
        person_name: '',
        contact_info: '',
        communication_channels: '',
        summary: '',
        quotation_required: false,
        follow_up_date: '',
        status: 'In Follow-up',
        notes: '',
        communication_date: new Date().toISOString().split('T')[0],
        assigned_to: defaultAssignedTo,
        outcome_notes: '',
        interest_level: '',
        other_projects: '',
        objection_type: '',
      });
      setMaterialPrices([]);
      setCategoryNeeds([]);
      setQuotationDetails(defaultQuotationDetails);
      setSavedCommunication(null);
      setPendingFollowUps([]);
      setExistingFollowUps([]);
    }
    setDeletedPriceIds([]);
    setDeletedNeedIds([]);
    setEditingFollowUp(null);
  }, [communication, initialClientData, open]);

  // Material price handlers
  const addMaterialPrice = () => {
    setMaterialPrices([...materialPrices, { material_id: '', current_purchase_price: null }]);
  };

  const updateMaterialPrice = (index: number, field: keyof MaterialPrice, value: any) => {
    const updated = [...materialPrices];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'material_id') {
      const mat = materials.find(m => m.id === value);
      updated[index].material_name = mat?.name;
    }
    setMaterialPrices(updated);
  };

  const removeMaterialPrice = (index: number) => {
    const item = materialPrices[index];
    if (item.id) {
      setDeletedPriceIds([...deletedPriceIds, item.id]);
    }
    setMaterialPrices(materialPrices.filter((_, i) => i !== index));
  };

  // Category need handlers
  const addCategoryNeed = () => {
    setCategoryNeeds([...categoryNeeds, { category_id: '', category_name: '', subcategory_name: '', notes: '' }]);
  };

  const updateCategoryNeed = (index: number, field: keyof CategoryNeed, value: any) => {
    const updated = [...categoryNeeds];
    updated[index] = { ...updated[index], [field]: value };
    
    // When category_id changes, update category_name for display and clear legacy flag
    if (field === 'category_id') {
      const cat = supplyCategories.find(c => c.id === value);
      updated[index].category_name = cat?.name || '';
      updated[index].isLegacy = false;
    }
    
    setCategoryNeeds(updated);
  };

  const removeCategoryNeed = (index: number) => {
    const item = categoryNeeds[index];
    if (item.id) {
      setDeletedNeedIds([...deletedNeedIds, item.id]);
    }
    setCategoryNeeds(categoryNeeds.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate objection_type is required when interest_level is "Not interested"
    if (formData.interest_level === 'Not interested' && !formData.objection_type) {
      toast.error('Please select an Objection Type for "Not interested" clients');
      return;
    }

    // Validate quotation quantity if not soft quotation and interest is High/Medium/Low
    if (showQuotationSection && !quotationDetails.isSoftQuotation) {
      const hasItemWithMaterial = quotationDetails.items.some(item => item.material_id);
      const missingQuantity = quotationDetails.items.some(item => 
        item.material_id && (!item.quantity || parseFloat(item.quantity) <= 0)
      );
      if (hasItemWithMaterial && missingQuantity) {
        toast.error('Quantity is required for quotation items. Enable "Soft Quotation" to make it optional.');
        return;
      }
    }

    try {
      // Build data to save including quotation fields if interest is High/Medium/Low
      const dataToSave: any = {
        ...formData,
        follow_up_date: formData.follow_up_date || null,
        interest_level: formData.interest_level || null,
        objection_type: formData.interest_level === 'Not interested' ? formData.objection_type : null,
      };

      // Add quotation details if interest level qualifies
      if (showQuotationSection) {
        dataToSave.project_type = quotationDetails.projectType || null;
        dataToSave.project_size = quotationDetails.projectSize || null;
        dataToSave.district = quotationDetails.district || null;
        dataToSave.city = quotationDetails.city || null;
        dataToSave.location = quotationDetails.location || null;
        dataToSave.is_soft_quotation = quotationDetails.isSoftQuotation;
        dataToSave.quotation_sent = quotationDetails.quotationSent;
        
        // Set current_phase (pipeline stage) based on quotation_sent
        // YES = "Proposals Sent", NO = keep as "Qualified Leads" or existing phase
        if (quotationDetails.quotationSent) {
          dataToSave.current_phase = 'Proposals Sent';
        } else if (!communication?.current_phase || communication?.quotation_sent) {
          // Only set to Qualified Leads if no existing phase or was previously Proposals Sent
          dataToSave.current_phase = quotationDetails.currentPhase || 'Qualified Leads';
        } else {
          // Preserve existing phase
          dataToSave.current_phase = quotationDetails.currentPhase || communication.current_phase;
        }
      }

      let communicationId = communication?.id;

      if (communication) {
        const { error } = await supabase
          .from('communication_log')
          .update(dataToSave)
          .eq('id', communication.id);

        if (error) throw error;
        
        // Log audit for update
        await logAudit({
          action: 'updated',
          module: 'Communications',
          recordId: communication.id,
          recordName: dataToSave.company_name || communication.company_name,
          oldValues: communication,
          newValues: dataToSave,
        });
        
        toast.success('Communication updated successfully');
      } else {
        const { data: newRecord, error } = await supabase
          .from('communication_log')
          .insert([dataToSave])
          .select()
          .single();

        if (error) throw error;
        
        communicationId = newRecord?.id;
        setSavedCommunication(newRecord);
        
        // Log audit for create
        if (newRecord) {
          await logAudit({
            action: 'created',
            module: 'Communications',
            recordId: newRecord.id,
            recordName: dataToSave.company_name,
            newValues: dataToSave,
          });
        }
        
        toast.success('Communication added successfully');
      }

      // Save material prices
      if (communicationId) {
        // Delete removed prices
        if (deletedPriceIds.length > 0) {
          await supabase
            .from('communication_material_prices')
            .delete()
            .in('id', deletedPriceIds);
        }

        // Upsert prices
        for (const price of materialPrices) {
          if (!price.material_id) continue;
          
          if (price.id) {
            await supabase
              .from('communication_material_prices')
              .update({
                material_id: price.material_id,
                current_purchase_price: price.current_purchase_price,
              })
              .eq('id', price.id);
          } else {
            await supabase
              .from('communication_material_prices')
              .insert({
                communication_id: communicationId,
                material_id: price.material_id,
                current_purchase_price: price.current_purchase_price,
              });
          }
        }

        // Delete removed needs
        if (deletedNeedIds.length > 0) {
          await supabase
            .from('communication_material_needs')
            .delete()
            .in('id', deletedNeedIds);
        }

        // Upsert category needs - using category_name as source of truth (text-based, matches Materials Library)
        for (const need of categoryNeeds) {
          if (!need.category_id) continue; // Skip if no category selected (category_id is actually the category name)
          
          if (need.id) {
            await supabase
              .from('communication_material_needs')
              .update({
                category_name: need.category_id, // category_id is actually the text name
                subcategory_name: need.subcategory_name || null,
                notes: need.notes,
              })
              .eq('id', need.id);
          } else {
            await supabase
              .from('communication_material_needs')
              .insert({
                communication_id: communicationId,
                category_name: need.category_id, // category_id is actually the text name
                subcategory_name: need.subcategory_name || null,
                notes: need.notes,
              });
          }
        }

        // Save quotation items if interest level qualifies
        if (showQuotationSection) {
          // Delete existing quotation items first
          await supabase
            .from('quotation_items')
            .delete()
            .eq('communication_log_id', communicationId);

          // Insert new quotation items
          const itemsToInsert = quotationDetails.items
            .filter(item => item.material_id) // Only save items with material selected
            .map(item => ({
              communication_log_id: communicationId,
              material_id: item.material_id || null,
              quantity: item.quantity ? parseFloat(item.quantity) : null,
              unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
              supplier_id: item.supplier_id || null,
            }));

          if (itemsToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('quotation_items')
              .insert(itemsToInsert);

            if (insertError) {
              console.error('Error saving quotation items:', insertError);
            }
          }
        }
        // Save pending follow-ups for new communications
        if (pendingFollowUps.length > 0 && user) {
          // Map UI status to database enum values
          const mapStatusToDb = (status: string): 'Open' | 'Closed' | 'In Follow-up' => {
            switch (status) {
              case 'Done': return 'Closed';
              case 'Cancelled': return 'Closed';
              default: return 'Open';
            }
          };
          
          for (const followUp of pendingFollowUps) {
            const followUpData = {
              communication_log_id: communicationId,
              action: followUp.action,
              notes: followUp.notes,
              client_response: followUp.clientResponse || null,
              follow_up_date: followUp.followUpDate.toISOString(),
              status_after: mapStatusToDb(followUp.statusAfter),
              priority: followUp.priority,
              follow_up_type: followUp.followUpType || null,
              reminder_enabled: followUp.reminderEnabled,
              user_id: user.id,
              follow_up_channel: followUp.followUpChannel || null,
            };

            const { data: insertedFollowUp, error: followUpError } = await supabase
              .from('follow_up_history')
              .insert(followUpData)
              .select()
              .single();

            if (followUpError) {
              console.error('Error creating follow-up:', followUpError);
            } else if (insertedFollowUp) {
              // Log to follow_up_audit_log
              await supabase.from('follow_up_audit_log').insert({
                follow_up_id: insertedFollowUp.id,
                communication_log_id: communicationId,
                action: 'created',
                changed_by: user.id,
                old_values: null,
                new_values: followUpData,
              });

              // Log to main audit_log
              await logAudit({
                action: 'created',
                module: 'Follow-ups',
                recordId: insertedFollowUp.id,
                recordName: followUp.action || 'New Follow-up',
                newValues: followUpData,
              });
            }
          }

          // Update communication status to "In Follow-up" if follow-ups were added
          await supabase
            .from('communication_log')
            .update({ status: 'In Follow-up' })
            .eq('id', communicationId);
        }
      }

      // Auto-create renegotiation for "Price Too High" objections
      if (communicationId && dataToSave.objection_type === 'Price Too High') {
        // Check if renegotiation already exists for this communication
        const { data: existingReneg } = await supabase
          .from('material_renegotiations')
          .select('id')
          .eq('objection_id', communicationId)
          .maybeSingle();

        if (!existingReneg) {
          // Get the first quotation item's material and price as the suggested price
          const firstItem = quotationDetails.items.find(item => item.material_id);
          const suggestedPrice = firstItem?.unit_price ? parseFloat(firstItem.unit_price) : (dataToSave.unit_price || null);
          const materialId = firstItem?.material_id || dataToSave.related_material_id;
          const supplierId = firstItem?.supplier_id || dataToSave.related_supplier_id;

          if (materialId) {
            // Fetch current scale_price for the material
            const { data: materialData } = await supabase
              .from('materials')
              .select('scale_price')
              .eq('id', materialId)
              .single();

            await supabase
              .from('material_renegotiations')
              .insert({
                objection_id: communicationId,
                material_id: materialId,
                supplier_id: supplierId || null,
                current_price: materialData?.scale_price || null,
                sales_suggested_price: suggestedPrice,
                approval_status: 'pending_supply_head',
              });

            toast.info('Price objection flagged for Supply Head review');
          }
        }
      }

      // Refresh client suggestions after save
      refreshClients();
      
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving communication:', error);
      toast.error('Failed to save communication');
    }
  };

  const handleOpenFollowUpDialog = (followUpToEdit?: ExistingFollowUp) => {
    if (!savedCommunication && !communication) {
      toast.error('Please save the communication first before adding follow-ups');
      return;
    }
    setEditingFollowUp(followUpToEdit || null);
    setFollowUpDialogOpen(true);
  };

  const handleFollowUpSaved = () => {
    if (communication) {
      fetchFollowUps(communication.id);
    }
    setEditingFollowUp(null);
  };

  // Pending follow-up handlers for new communications
  const handleAddPendingFollowUp = (followUp: PendingFollowUp) => {
    setPendingFollowUps(prev => [...prev, followUp]);
  };

  const handleUpdatePendingFollowUp = (id: string, followUp: PendingFollowUp) => {
    setPendingFollowUps(prev => prev.map(f => f.id === id ? followUp : f));
  };

  const handleRemovePendingFollowUp = (id: string) => {
    setPendingFollowUps(prev => prev.filter(f => f.id !== id));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{communication ? 'Edit Communication' : 'New Communication'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="communication_date">Date</Label>
                  <Input
                    id="communication_date"
                    type="date"
                    value={formData.communication_date}
                    onChange={(e) => setFormData({ ...formData, communication_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="In Follow-up">In Follow-up</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <ClientAutoComplete
                  value={formData.company_name}
                  onChange={(value) => setFormData({ ...formData, company_name: value })}
                  suggestions={companySuggestions}
                  onSearch={searchCompanies}
                  onSelect={(company) => {
                    const companyData = selectCompany(company);
                    if (companyData) {
                      // Auto-fill available fields from existing records
                      setFormData(prev => ({
                        ...prev,
                        company_name: company,
                        category: companyData.category || prev.category,
                      }));
                    }
                  }}
                  isExistingClient={isExistingClient}
                  label="Company Name"
                  placeholder="Start typing to search..."
                  required
                  onViewHistory={() => setHistoryPanelOpen(true)}
                />
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REDs">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          REDs
                        </span>
                      </SelectItem>
                      <SelectItem value="Large Contractor">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          Large Contractor
                        </span>
                      </SelectItem>
                      <SelectItem value="S&M Contractor">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          S&M Contractor
                        </span>
                      </SelectItem>
                      <SelectItem value="Others">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                          Others
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <PersonAutoComplete
                  value={formData.person_name}
                  onChange={(value) => setFormData({ ...formData, person_name: value })}
                  suggestions={personSuggestions}
                  onSelect={(person) => {
                    setFormData(prev => ({
                      ...prev,
                      person_name: person.person_name,
                      contact_info: person.contact_info || prev.contact_info,
                    }));
                  }}
                  label="Person Name"
                  placeholder={personSuggestions.length > 0 ? "Select or type new..." : "Enter person name"}
                  required
                />
                <div className="space-y-2">
                  <Label htmlFor="contact_info">
                    Contact Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="contact_info"
                    value={formData.contact_info}
                    onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                    placeholder="Phone number"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="communication_channels">Communication Channels</Label>
                <Select value={formData.communication_channels} onValueChange={(value) => setFormData({ ...formData, communication_channels: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WA">WA</SelectItem>
                    <SelectItem value="Phone call">Phone call</SelectItem>
                    <SelectItem value="In person">In person</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Structured Summary Section */}
              <Separator className="my-2" />
              
              {/* A) Outcome / Result Section */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-primary" />
                  Outcome / Result
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="outcome_notes">Visit / Communication Outcome</Label>
                  <Textarea
                    id="outcome_notes"
                    value={formData.outcome_notes}
                    onChange={(e) => setFormData({ ...formData, outcome_notes: e.target.value })}
                    placeholder="Describe what happened in this visit or call…"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="interest_level">Interest Level</Label>
                  <Select 
                    value={formData.interest_level} 
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      interest_level: value,
                      objection_type: value !== 'Not interested' ? '' : formData.objection_type 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select interest level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          High
                        </span>
                      </SelectItem>
                      <SelectItem value="Medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                          Medium
                        </span>
                      </SelectItem>
                      <SelectItem value="Low">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                          Low
                        </span>
                      </SelectItem>
                      <SelectItem value="Not interested">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          Not interested
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Objection Type - Only show when Interest Level is "Not interested" */}
                {formData.interest_level === 'Not interested' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="objection_type" className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Objection Type <span className="text-destructive">*</span>
                    </Label>
                    <Select 
                      value={formData.objection_type} 
                      onValueChange={(value) => setFormData({ ...formData, objection_type: value })}
                    >
                      <SelectTrigger className={!formData.objection_type ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select objection type (required)" />
                      </SelectTrigger>
                      <SelectContent>
                        {OBJECTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* B) Materials / Needs Section */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4 text-primary" />
                  Materials / Needs
                </div>
                
                {/* Client's current purchase prices */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Client's Current Purchase Price</Label>
                    <p className="text-xs text-muted-foreground">Select material and enter the price the client currently pays.</p>
                  </div>
                  
                  {materialPrices.map((price, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <MaterialStepSelector
                        value={price.material_id}
                        onValueChange={(materialId, materialName) => {
                          updateMaterialPrice(index, 'material_id', materialId);
                          if (materialName) {
                            const updated = [...materialPrices];
                            updated[index] = { ...updated[index], material_name: materialName };
                            setMaterialPrices(updated);
                          }
                        }}
                        placeholder="Search or select material"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        className="w-32"
                        value={price.current_purchase_price || ''}
                        onChange={(e) => updateMaterialPrice(index, 'current_purchase_price', e.target.value ? parseFloat(e.target.value) : null)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMaterialPrice(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button type="button" variant="outline" size="sm" onClick={addMaterialPrice}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add material price
                  </Button>
                </div>

                <Separator />

                {/* Requested Categories */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Requested Supply Categories</Label>
                    <p className="text-xs text-muted-foreground">High-level categories the client needs (e.g., CMU, Ready Mix, Steel).</p>
                  </div>
                  
                  {supplyCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No categories available. Add categories from the Materials Library.</p>
                  ) : (
                    categoryNeeds.map((need, index) => (
                      <div key={index} className="space-y-2 p-3 border rounded-lg bg-background">
                        {/* Legacy/Invalid Warning */}
                        {need.isLegacy && (
                          <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-400 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Legacy/Invalid category "{need.category_name}". Please re-select a valid category.</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          {/* Category Dropdown - Uses CategoryCombobox */}
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">Category</Label>
                            <CategoryCombobox
                              value={need.category_id}
                              onValueChange={(value) => {
                                updateCategoryNeed(index, 'category_id', value);
                              }}
                              placeholder="Select category"
                              isLegacy={need.isLegacy}
                              legacyLabel={need.category_name}
                            />
                          </div>
                          
                          {/* Delete Button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-5"
                            onClick={() => removeCategoryNeed(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        
                        {/* Notes Field */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                          <Input
                            placeholder="Specs, comments, or requirements..."
                            value={need.notes}
                            onChange={(e) => updateCategoryNeed(index, 'notes', e.target.value)}
                            className="bg-background"
                          />
                        </div>
                      </div>
                    ))
                  )}
                  
                  <Button type="button" variant="outline" size="sm" onClick={addCategoryNeed}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add requested category
                  </Button>
                </div>
              </div>

              {/* C) Projects Section */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4 text-primary" />
                  Projects
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="other_projects">Other Projects for This Client</Label>
                  <Textarea
                    id="other_projects"
                    value={formData.other_projects}
                    onChange={(e) => setFormData({ ...formData, other_projects: e.target.value })}
                    placeholder="List any other projects for this client and locations (if known)…"
                    rows={3}
                  />
                </div>
              </div>

              {/* Quotation Details Section - only visible for High/Medium/Low interest */}
              <QuotationDetailsSection
                details={quotationDetails}
                onChange={setQuotationDetails}
                isVisible={showQuotationSection}
              />

              <Separator className="my-2" />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="quotation_required"
                  checked={formData.quotation_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, quotation_required: checked as boolean })}
                />
                <Label htmlFor="quotation_required" className="cursor-pointer">Quotation Required</Label>
              </div>

              {/* Follow-up Section */}
              {!communication ? (
                // New communication: show inline follow-up section
                <CommunicationFollowUpsSection
                  interestLevel={formData.interest_level}
                  objectionType={formData.objection_type}
                  pendingFollowUps={pendingFollowUps}
                  onAddFollowUp={handleAddPendingFollowUp}
                  onUpdateFollowUp={handleUpdatePendingFollowUp}
                  onRemoveFollowUp={handleRemovePendingFollowUp}
                />
              ) : (
                // Existing communication: show timeline with existing follow-ups
                <CommunicationFollowUpsSection
                  interestLevel={formData.interest_level}
                  objectionType={formData.objection_type}
                  pendingFollowUps={pendingFollowUps}
                  onAddFollowUp={handleAddPendingFollowUp}
                  onUpdateFollowUp={handleUpdatePendingFollowUp}
                  onRemoveFollowUp={handleRemovePendingFollowUp}
                  existingFollowUps={existingFollowUps}
                  loadingFollowUps={loadingFollowUps}
                  onEditExistingFollowUp={(followUp) => handleOpenFollowUpDialog(followUp)}
                  onRefreshFollowUps={() => communication && fetchFollowUps(communication.id)}
                  isEditMode={true}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assigned To</Label>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        className="w-full justify-between"
                      >
                        {formData.assigned_to || "Select team member..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-popover" align="start">
                      <Command className="bg-popover">
                        <CommandInput placeholder="Search team member..." />
                        <CommandList>
                          <CommandEmpty>No team member found.</CommandEmpty>
                          <CommandGroup>
                            {teamMembers.map((member) => (
                              <CommandItem
                                key={member.id}
                                value={member.name}
                                onSelect={(currentValue) => {
                                  setFormData({ ...formData, assigned_to: currentValue === formData.assigned_to ? '' : currentValue });
                                  setComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.assigned_to === member.name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {member.name}
                              </CommandItem>
                            ))}
                            {showAddMember ? (
                              <div className="flex items-center gap-2 px-2 py-2">
                                <Input
                                  placeholder="Enter name..."
                                  value={newMemberName}
                                  onChange={(e) => setNewMemberName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddNewMember();
                                    }
                                  }}
                                  className="h-8"
                                  autoFocus
                                />
                                <Button size="sm" onClick={handleAddNewMember} className="h-8">
                                  Add
                                </Button>
                              </div>
                            ) : (
                              <CommandItem
                                onSelect={() => setShowAddMember(true)}
                                className="text-primary cursor-pointer"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add new member
                              </CommandItem>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      {(communication || savedCommunication) && (
        <FollowUpDialog
          open={followUpDialogOpen}
          onOpenChange={(open) => {
            setFollowUpDialogOpen(open);
            if (!open) setEditingFollowUp(null);
          }}
          communication={communication || savedCommunication}
          editingFollowUp={editingFollowUp}
          onSaved={() => {
            setFollowUpDialogOpen(false);
            handleFollowUpSaved();
            onSave();
          }}
        />
      )}

      {/* Client History Panel */}
      <ClientHistoryPanel
        open={historyPanelOpen}
        onOpenChange={setHistoryPanelOpen}
        companyName={formData.company_name}
      />
    </>
  );
};

export default CommunicationDialog;
