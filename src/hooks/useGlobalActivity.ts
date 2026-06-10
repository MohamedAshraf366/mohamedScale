import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import type { CustomerData } from "@/components/global/sections/CustomerSection";
import type { ProjectData } from "@/components/global/sections/ProjectSection";
import type { OpportunityData } from "@/components/global/sections/OpportunitySection";
import type { ContextData } from "@/components/global/sections/ContextSection";
import type { ActionItem } from "@/components/global/sections/NextActionsSection";
import { TASK_TYPES } from "@/components/global/sections/NextActionsSection";
import { saveQuotation } from "./useOpportunityQuotation";

interface GlobalActivityPayload {
  customer: CustomerData;
  project: ProjectData;
  opportunity: OpportunityData;
  context: ContextData;
  actions: ActionItem[];
}

/**
 * Upsert a location row.
 *  - If `existingLocationId` is provided, UPDATE that row in place (so we don't orphan rows).
 *  - Otherwise, INSERT a new row.
 * Returns the location id (existing or new).
 */
// async function upsertLocation(loc: any, existingLocationId?: string | null): Promise<string | null> {
//   if (!loc?.lat) return existingLocationId ?? null;
//   const payload = {
//     address_text: loc.address_text || null,
//     // city: loc.city || null,
//     // country: loc.country || "SA",
//     country: loc.country?.toUpperCase() || "SA",
//     city: loc.city?.toUpperCase() || null,
//     lat: loc.lat,
//     lng: loc.lng,
//     place_name: loc.place_name || null,
//     place_id: loc.place_id || null,
//     address_link: loc.address_link || null,
//     region_code: loc.region_code || "SA-01",
//     zone_code: loc.zone_code || null,
//   };
//   if (existingLocationId) {
//     const { error } = await supabase.from("locations").update(payload as any).eq("id", existingLocationId);
//     if (error) { console.error("Location update error:", error); return existingLocationId; }
//     return existingLocationId;
//   }
//   const { data, error } = await supabase.from("locations").insert(payload as any).select("id").single();
//   if (error) { console.error("Location insert error:", error); return null; }
//   return data.id;
// }


async function upsertLocation(loc: any, existingLocationId?: string | null): Promise<string | null> {
  if (!loc?.lat) return existingLocationId ?? null;
  
  // ✅ تحويل اسم المدينة إلى الصيغة الصحيحة لـ enum
  const cityMap: Record<string, string> = {
    "RIYADH": "Riyadh",
    "RIYAD": "Riyadh", 
    "الرياض": "Riyadh",
    "JEDDAH": "Jeddah",
    "JEDDA": "Jeddah",
    "جدة": "Jeddah",
    "DAMMAM": "Dammam",
    "الدمام": "Dammam",
    "MAKKAH": "Makkah",
    "MECCA": "Makkah",
    "مكة": "Makkah",
    "MEDINA": "Medina",
    "MADINAH": "Medina",
    "المدينة": "Medina",
    "KHOBAR": "Khobar",
    "الخبر": "Khobar",
    "DHAHRAN": "Dhahran",
    "الظهران": "Dhahran",
    "JUBAIL": "Jubail",
    "الجبيل": "Jubail",
    "QATIF": "Qatif",
    "القطيف": "Qatif",
    "HAFR AL BATIN": "Hafr Al Batin",
    "حفر الباطن": "Hafr Al Batin",
    "TABUK": "Tabuk",
    "تبوك": "Tabuk",
    "BURAIDAH": "Buraidah",
    "بريدة": "Buraidah",
    "AL HASA": "Al Hasa",
    "الاحساء": "Al Hasa",
  };
  
  // ✅ استخراج المدينة من المكان أو استخدام القيمة الموجودة
  let cityValue = loc.city?.toUpperCase()?.trim() || null;
  let finalCity = cityValue ? (cityMap[cityValue] || cityValue) : null;
  
  // ✅ إذا كانت المدينة مش موجودة، حاول استخراجها من address_text
  if (!finalCity && loc.address_text) {
    const address = loc.address_text.toUpperCase();
    for (const [key, value] of Object.entries(cityMap)) {
      if (address.includes(key)) {
        finalCity = value;
        break;
      }
    }
  }
  
  // ✅ تأكد من أن country صحيح
  const country = loc.country?.toUpperCase()?.trim() || "SA";
  const validCountries = ["SA", "AE", "KW", "QA", "BH", "OM", "JO", "EG"];
  const finalCountry = validCountries.includes(country) ? country : "SA";
  
  const payload = {
    address_text: loc.address_text || null,
    country: finalCountry,
    city: finalCity,  // ✅ الآن القيمة صحيحة للـ enum
    lat: Number(loc.lat),
    lng: Number(loc.lng),
    place_name: loc.place_name || null,
    place_id: loc.place_id || null,
    address_link: loc.address_link || null,
    region_code: loc.region_code || null,
    zone_code: loc.zone_code || null,
  };
  
  // ✅ إزالة القيم undefined
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });
  
  // console.log("📍 Upserting location with payload:", payload);
  
  if (existingLocationId) {
    const { error } = await supabase.from("locations").update(payload).eq("id", existingLocationId);
    if (error) { 
      console.error("Location update error:", error); 
      return existingLocationId; 
    }
    return existingLocationId;
  }
  
  const { data, error } = await supabase.from("locations").insert(payload).select("id").single();
  if (error) { 
    console.error("Location insert error:", error); 
    return null; 
  }
  return data.id;
}
/**
 * Diff/upsert contacts for an account.
 *  - `incoming` items WITH `id` -> UPDATE.
 *  - `incoming` items WITHOUT `id` -> INSERT.
 *  - DB rows whose id is NOT in incoming -> SOFT-DELETE.
 * Returns the id of the primary contact (for poc_contact_id sync).
 */
async function syncContacts(
  accountId: string,
  incoming: Array<{ id?: string; full_name: string; phone: string; email: string; role_title: string; is_primary: boolean; prefers_whatsapp: boolean }>,
): Promise<string | null> {
  // Snapshot existing live contacts
  const { data: existing } = await supabase
    .from("contacts").select("id, is_primary").eq("account_id", accountId).is("deleted_at", null);

  const incomingIds = new Set(incoming.map(c => c.id).filter(Boolean) as string[]);
  const toSoftDelete = (existing ?? []).filter(e => !incomingIds.has(e.id)).map(e => e.id);

  if (toSoftDelete.length > 0) {
    await supabase.from("contacts").update({
      deleted_at: new Date().toISOString(),
      deleted_reason: "removed_via_edit",
    } as any).in("id", toSoftDelete);
  }

  let primaryId: string | null = null;

  for (const c of incoming) {
    if (!c.full_name?.trim()) continue; // skip empty rows
    const payload = {
      account_id: accountId,
      full_name: c.full_name.trim(),
      phone: c.phone?.trim() || null,
      email: c.email?.trim() || null,
      role_title: c.role_title?.trim() || null,
      is_primary: !!c.is_primary,
      prefers_whatsapp: !!c.prefers_whatsapp,
    };
    if (c.id) {
      const { error } = await supabase.from("contacts").update(payload).eq("id", c.id);
      if (error) throw error;
      if (c.is_primary) primaryId = c.id;
    } else {
      const { data: ins, error } = await supabase.from("contacts").insert(payload).select("id").single();
      if (error) throw error;
      if (c.is_primary) primaryId = ins.id;
    }
  }

  return primaryId;
}


export function useGlobalActivity(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: GlobalActivityPayload) => {
      const { customer, project, opportunity, context, actions } = payload;

      if (!context.summary.trim()) throw new Error("Context summary is required");

      // Validate: communication occurred_at must not be in the future
      if (context.occurredAt && context.occurredAt.getTime() < Date.now()) {
  throw new Error("Communication time cannot be in the past. Please select current or future time");
}

      // 1. Resolve customer
      let accountId = customer.selectedId;

      if ((customer.mode === "edit" || customer.mode === "chip") && accountId) {
        const trimmedName = customer.displayName?.trim() || "";
        if (customer.mode === "edit" && !trimmedName) throw new Error("Customer name cannot be empty");

        // Fetch existing location_id so we can update-in-place rather than orphan rows
        const { data: existingAcc } = await supabase
          .from("accounts").select("location_id").eq("id", accountId).single();

        const accountUpdate: any = {
          legal_name: customer.legalName || null, tax_number: customer.taxNumber || null,
          website: customer.website || null, status: customer.accountStatus || "active",
          notes: customer.accountNotes || null,
        };
        if (trimmedName) accountUpdate.display_name = trimmedName;

        const { error: accErr } = await supabase.from("accounts").update(accountUpdate).eq("id", accountId);
        if (accErr) throw accErr;

        const { error: custErr } = await supabase.from("customers").update({
          customer_type: customer.customerType || "SME", pricing_tier: customer.pricingTier || null,
          payment_terms_days: customer.paymentTermsDays ?? null, credit_limit: customer.creditLimit ?? null,
          notes: customer.customerNotes || null,
        }).eq("account_id", accountId);
        if (custErr) throw custErr;

        // Location: update in place if exists, else insert
        if (customer.location?.lat) {
          const locId = await upsertLocation(customer.location, existingAcc?.location_id ?? null);
          if (locId && locId !== existingAcc?.location_id) {
            await supabase.from("accounts").update({ location_id: locId }).eq("id", accountId);
          }
        }

        // Contacts: diff/upsert (no more delete-all, preserves IDs and history)
        if (customer.contacts && customer.contacts.length > 0) {
          const primaryId = await syncContacts(accountId, customer.contacts);
          if (primaryId) await supabase.from("accounts").update({ poc_contact_id: primaryId }).eq("id", accountId);
        }
      } else if (customer.mode === "create") {
        if (!customer.displayName?.trim()) throw new Error("Customer name is required");

        // Use the first contact (or null) as the RPC's atomic primary contact
        const firstContact = customer.contacts?.[0];

        // Atomic creation via RPC: account + customer + first contact + location.
        // Either all succeed or all roll back (no orphan accounts).
        const { data: newAccountId, error: createErr } = await supabase.rpc("create_customer", {
          p_display_name: customer.displayName.trim(),
          p_legal_name: customer.legalName || null,
          p_tax_number: customer.taxNumber || null,
          p_website: customer.website || null,
          p_account_status: customer.accountStatus || "active",
          p_account_notes: customer.accountNotes || null,
          p_customer_type: customer.customerType || "SME",
          p_pricing_tier: customer.pricingTier || null,
          p_payment_terms_days: customer.paymentTermsDays ?? null,
          p_credit_limit: customer.creditLimit ?? null,
          p_customer_notes: customer.customerNotes || null,
          p_contact_name: firstContact?.full_name?.trim() || null,
          p_contact_phone: firstContact?.phone?.trim() || customer.contactPhone?.trim() || null,
          p_contact_email: firstContact?.email?.trim() || null,
          p_contact_role: firstContact?.role_title?.trim() || null,
          p_prefers_whatsapp: firstContact?.prefers_whatsapp ?? true,
          p_location: customer.location?.lat ? (customer.location as any) : null,
        });
        if (createErr) throw createErr;
        accountId = newAccountId as string;

        // Insert any ADDITIONAL contacts (the RPC handles only the first one atomically)
        const extraContacts = (customer.contacts || []).slice(1).filter(c => c.full_name?.trim());
        if (extraContacts.length > 0) {
          const inserts = extraContacts.map(c => ({
            account_id: accountId,
            full_name: c.full_name.trim(),
            phone: c.phone?.trim() || null,
            email: c.email?.trim() || null,
            role_title: c.role_title?.trim() || null,
            is_primary: false, // primary is always the first contact (set by RPC)
            prefers_whatsapp: !!c.prefers_whatsapp,
          }));
          await supabase.from("contacts").insert(inserts);
        }
      }

      if (!accountId) throw new Error("Customer is required");

      // 2. Resolve project
      let projectId = project.selectedId;

      if ((project.mode === "edit" || project.mode === "chip") && projectId) {
        const updates: any = {
          name: project.name.trim() || undefined, project_type: project.projectType || null,
          project_size: project.projectSize || null, current_phase: project.currentPhase || null,
          notes: project.notes || null, poc: project.pocId || null,
        };
        const { error: projErr } = await supabase.from("projects").update(updates).eq("id", projectId);
        if (projErr) throw projErr;

        if (project.location?.lat) {
          const { data: existingProj } = await supabase
            .from("projects").select("location_id").eq("id", projectId).single();
          const locId = await upsertLocation(project.location, existingProj?.location_id ?? null);
          if (locId && locId !== existingProj?.location_id) {
            await supabase.from("projects").update({ location_id: locId }).eq("id", projectId);
          }
        }
            } else if (project.mode === "create" || project.mode === "default") {
  const projectName = project.mode === "default" ? "General" : project.name.trim();
  if (!projectName) throw new Error("Project name is required");

  // ✅ الخطوة 1: إذا كان فيه موقع، احفظه أولاً
  let locationId = null;
  if (project.location?.lat) {
    locationId = await upsertLocation(project.location, null);
    // console.log("📍 Created location with ID:", locationId);
  }

  // ✅ الخطوة 2: أنشئ المشروع مع location_id من البداية
  const { data: newProject, error: projErr } = await supabase.from("projects").insert({
    customer_account_id: accountId, 
    name: projectName,
    project_type: project.projectType || null, 
    current_phase: project.currentPhase || null,
    location_id: locationId,  // ✅ مهم جداً!
  }).select("id").single();
  
  if (projErr) throw projErr;
  projectId = newProject.id;

  // ✅ لو الموقع ما اتحفظش قبل كدة لأي سبب، حاول تحفظه بعدين
  if (project.location?.lat && !locationId) {
    const locId = await upsertLocation(project.location, null);
    if (locId) {
      await supabase.from("projects").update({ location_id: locId }).eq("id", projectId);
      // console.log("📍 Updated project with location ID:", locId);
    }
  }
}

      // 3. Resolve opportunity
      let opportunityId = opportunity.selectedId || null;

      if ((opportunity.mode === "edit" || opportunity.mode === "chip") && opportunityId) {
        const isNotInterestedEdit = opportunity.interestLevel === "Not interested";
        const allowedStages = ["discovery", "rfp", "negotiation"];
        const stageOverride =
          opportunity.mode === "edit" && !isNotInterestedEdit && opportunity.stage && allowedStages.includes(opportunity.stage)
            ? { stage: opportunity.stage }
            : {};
        const { error: oppErr } = await supabase.from("opportunities").update({
          title: opportunity.title.trim() || undefined, interest_level: opportunity.interestLevel || null,
          expected_close_date: opportunity.estOrderDate?.toISOString() || null,
          contact_id: opportunity.contactId || null, priority: opportunity.priority || "medium",
          notes: opportunity.notes || null,
          ...(opportunity.materialCategoryIds?.length ? { metadata: { material_category_ids: opportunity.materialCategoryIds } } : {}),
          ...stageOverride,
          ...(isNotInterestedEdit ? { stage: "lost", lost_at: new Date().toISOString(), lost_reason: opportunity.notInterestedReason || "Not interested" } : {}),
        }).eq("id", opportunityId);
        if (oppErr) throw oppErr;

        try {
            if (opportunity.quotationItems && opportunity.quotationItems.length > 0) {
              await saveQuotation({
                opportunityId,
                customerAccountId: accountId,
                projectId: projectId!,
                items: opportunity.quotationItems as any,
                deliveryDate: opportunity.deliveryDate ?? null,
                deliveryMode: opportunity.deliveryMode,
                globalMargin: opportunity.globalMargin ?? 0,
              });
            }
          } catch (quotationError) {
            console.error("Quotation save failed, but continuing with main flow:", quotationError);
          }

      } else if (opportunity.mode === "create") {
        if (!opportunity.title.trim()) throw new Error("Opportunity title is required");
        if (!projectId) throw new Error("Project is required for opportunity");

        const isNotInterested = opportunity.interestLevel === "Not interested";
        const { data: newOpp, error: oppErr } = await supabase.from("opportunities").insert({
          customer_account_id: accountId, project_id: projectId,
          title: opportunity.title.trim(), interest_level: opportunity.interestLevel || null,
          expected_close_date: opportunity.estOrderDate?.toISOString() || null,
          contact_id: opportunity.contactId || null, priority: opportunity.priority || "medium",
          notes: opportunity.notes || null,
          stage: isNotInterested ? "lost" : "discovery",
          ...(isNotInterested ? { lost_at: new Date().toISOString(), lost_reason: opportunity.notInterestedReason || "Not interested" } : {}),
          ...(opportunity.materialCategoryIds?.length ? { metadata: { material_category_ids: opportunity.materialCategoryIds } } : {}),
        } as any).select("id").single();
        if (oppErr) throw oppErr;
        opportunityId = newOpp.id;

        // Create quotation items for new opportunity
        try {
            if (opportunity.quotationItems && opportunity.quotationItems.length > 0) {
              await saveQuotation({
                opportunityId,
                customerAccountId: accountId,
                projectId: projectId!,
                items: opportunity.quotationItems as any,
                deliveryDate: opportunity.deliveryDate ?? null,
                deliveryMode: opportunity.deliveryMode,
                globalMargin: opportunity.globalMargin ?? 0,
              });
            }
          } catch (quotationError) {
            console.error("Quotation save failed, but continuing with main flow:", quotationError);
          }
      }

      // 4. Log context
      const isNotInterested = opportunity.interestLevel === "Not interested";
      const commMetadata: Record<string, any> = {};
      if (context.contextType === "internal_note") commMetadata.context_type = "internal_note";
      if (isNotInterested) {
        commMetadata.type = "status_change";
        commMetadata.new_stage = "lost";
        commMetadata.lost_reason = opportunity.notInterestedReason || "Not interested";
      }
      const { data: comm, error: commErr } = await supabase.from("communications").insert({
        account_id: accountId, project_id: projectId || null, opportunity_id: opportunityId,
        channel: context.contextType === "internal_note" ? "internal" : context.channel,
        summary: context.summary.trim(),
        direction: context.contextType === "communication" ? "outbound" : null,
        occurred_at: context.occurredAt?.toISOString() || new Date().toISOString(),
        metadata: commMetadata,
      }).select("id").single();
      if (commErr) throw commErr;

      // 5. Auto-complete open tasks attached to this opportunity (use full summary, no truncation)
      if (opportunityId && (opportunity.mode === "chip" || opportunity.mode === "select" || opportunity.mode === "edit")) {
        await supabase.from("tasks").update({
          status: "done", completed_at: new Date().toISOString(),
          outcome: context.summary.trim(),
        }).eq("opportunity_id", opportunityId).in("status", ["open", "in_progress"]);
      }

      // 6. Create next actions (skip if not interested — opportunity is closed)
      if (!isNotInterested) {
        for (const action of actions) {
          if (!action.taskType || !action.dueDate) continue;
          const title = action.taskType === "custom"
            ? action.customTitle
            : TASK_TYPES.find(t => t.value === action.taskType)?.label || action.taskType;
          await supabase.from("tasks").insert({
            customer_account_id: accountId, project_id: projectId || null,
            opportunity_id: opportunityId, communication_id: comm.id,
            title, task_type: "follow_up", status: "open",
            due_at: action.dueDate.toISOString(),
            channel: context.contextType === "communication" ? context.channel : null,
          });
        }
      }

        return { accountId, projectId, opportunityId, commId: comm.id }
    },

    onSuccess: (data) => {
  toast.success("Update saved successfully");
  
  const keys = [
    "entity-timeline", 
    "opportunity-timeline", 
    "customers", 
    "customer-list", 
    "customer-profile",
    "sales-customers", 
    "projects", 
    "opportunities", 
    "opportunity", 
    "opportunity-quotation", 
    "tasks",
    "project-detail", 
    "project-opportunities", 
    "customer-metrics", 
    "customer-projects-table",
    "customer-contacts",
    "customer-edit-data",
    "customer-detail",
    "contacts-for-account",
    "customer-projects-count", 
    "pipeline-opportunities", 
    "pipeline-last-activities",
    "pipeline-next-followups", 
    "sales-tasks-open", 
    "sales-tasks-done",
    "customer-projects",
    "project-opportunities",
    "customer-opportunities",
    
    // ✅ أضف هذه المفاتيح المهمة للـ Opportunities
    "opportunities-list",
    "customer-opportunities-table",
    "project-opportunities-list",
  ];
  
  keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
  
  // ✅ إعادة fetch الـ opportunities المرتبطة بالمشروع
  if (data?.projectId) {
    queryClient.invalidateQueries({ queryKey: ["project-opportunities", data.projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-opps-nested", data.projectId] });
  }
  
  // ✅ إعادة fetch الـ opportunities المرتبطة بالعميل
  if (data?.accountId) {
    queryClient.invalidateQueries({ queryKey: ["customer-opportunities", data.accountId] });
    queryClient.invalidateQueries({ queryKey: ["opportunities", data.accountId] });
  }
  
  onSuccess?.();
},
    onError: (error: any) => toast.error(error.message || "Failed to save update"),
  });
}
