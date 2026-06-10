export const UNLOCK_GUIDANCE = {
  pageTitle: 'How Unlock Works',
  summary: 'Define sourcing areas and target prices for a subcategory, then collect supplier quotations to activate new materials.',
  storageKey: 'unlock',
  sections: [
    { title: 'What is this page for?', content: 'This is Mandate 1 — Unlock New Materials. Use it when you want to source a material subcategory into a new geographic area for the first time.' },
    { title: 'Workflow steps', content: '1. Select a subcategory\n2. Define non-overlapping geographic areas on the map\n3. Set the all-inclusive target price matrix (Material × Area)\n4. Collect and verify supplier quotations' },
    { title: 'Who does what?', content: '• Supply Officer: Defines areas and enters target prices\n• Supply Management: Reviews and approves target pricing benchmarks\n• System: Enforces sequential dependency (areas → prices → quotes)' },
    { title: 'What happens next?', content: 'Once supplier quotes are received and approved, supply units are automatically created. Move to the Supply Units page to assign selected/backup suppliers.' },
    { title: 'Key terms', content: '• Area: A named polygon zone within a subcategory\n• Target Price: The all-inclusive benchmark price per material per area\n• Unlock Cycle: A sourcing cycle that groups areas, prices, and quotes' },
    { title: 'Cautions', content: '• Areas must not overlap — the system enforces this\n• Target prices must be set before quotations can be submitted\n• Prices are per-MOQ and all-inclusive of delivery' },
  ],
};

export const SUPPLIER_MATERIALS_GUIDANCE = {
  pageTitle: 'How Supplier Quotes Works',
  summary: 'Central hub for managing all supplier quotes — manual and AI-extracted. Review, approve, and compare quotes to find the best pricing.',
  storageKey: 'supplier-materials',
  sections: [
    { title: 'What is this page for?', content: 'This page manages all supplier quotations. You can add quotes manually, upload documents for AI extraction, review pricing, and approve or reject quotes.' },
    { title: 'Manual vs AI quotes', content: '• Manual: Click "Add Quote" to enter items and delivery lines directly\n• AI: Click "Upload Quote" to extract pricing from a supplier PDF/image\nBoth paths produce the same result after approval.' },
    { title: 'Who does what?', content: '• Supply Officer: Creates quotes (manual or upload), enters delivery lines and allocations\n• Supply Management/Admin: Reviews and approves/rejects quotes\n• System: On approval, syncs delivery rates and generates supply unit candidates' },
    { title: 'What happens next?', content: 'Approved quotes create supply unit candidates automatically. Delivery rates are synced for operational use. Move to Supply Units to assign suppliers.' },
    { title: 'Key statuses', content: '• Quoted: Initial submission, awaiting review\n• Under Review: Being evaluated by management\n• Negotiating: Active price negotiation\n• Approved: Accepted and operational\n• Passed: Rejected or not competitive' },
    { title: 'Cautions', content: '• Delivery allocations should be built before approval for accurate landed-price calculation\n• AI extraction may need manual verification — always review items before approving' },
  ],
};

export const SUPPLIER_DETAIL_GUIDANCE = {
  pageTitle: 'How Supplier Profile Works',
  summary: 'Complete view of a single supplier — materials, delivery rates, issues, management actions, and supply unit assignments.',
  storageKey: 'supplier-detail',
  sections: [
    { title: 'What is this page for?', content: 'This is the comprehensive profile for one supplier. Use it to see all their materials/pricing, delivery coverage, issues, actions taken, and current supply unit assignments.' },
    { title: 'Available tabs', content: '• Materials: All quoted materials with prices and status\n• Delivery Rates: Zone-based delivery cost coverage\n• Issues: Reported problems with this supplier\n• Actions: Freeze, blacklist, demote, and other management actions\n• Supply Units: Current selected/backup/candidate assignments' },
    { title: 'Who does what?', content: '• Supply Officer: Reports issues, adds materials, manages delivery rates\n• Supply Management/Admin: Records management actions (freeze, blacklist)\n• System: Propagates freeze/blacklist to all supply unit assignments automatically' },
    { title: 'Cautions', content: '• Blacklisting a supplier removes them from all active supply unit assignments\n• Freezing prevents new orders but preserves existing assignments\n• Actions are logged permanently in the Actions tab' },
  ],
};

export const UNITS_GUIDANCE = {
  pageTitle: 'How Supply Units Works',
  summary: 'Manage material-zone assignments: promote candidates to selected/backup, compare landed prices, freeze or remove suppliers.',
  storageKey: 'units',
  sections: [
    { title: 'What is this page for?', content: 'Supply Units represent the operational assignment of a material to a zone. Each unit needs at least one "selected" supplier and ideally one "backup" supplier.' },
    { title: 'How assignment works', content: '• Candidates are auto-generated when quotes are approved\n• Promote a candidate to "selected" to make them the primary supplier for that unit\n• Promote to "backup" for fallback coverage\n• Promoting a new selected supplier automatically demotes the current one to backup' },
    { title: 'Who does what?', content: '• Supply Management/Admin: Makes assignment decisions (promote, demote, freeze, remove)\n• Supply Officer: Reviews candidates and recommends assignments\n• System: Auto-ranks candidates by landed price (lower = better)' },
    { title: 'KPI cards', content: '• Unit status cards: Planned/Sourcing/Active/Frozen/Inactive\n• Assignment cards: Selected/Backup/Frozen/Critical issues\n• Click cards to filter the list below' },
    { title: 'Key statuses', content: '• Planned: Unit created but no candidates yet\n• Sourcing: Candidates exist but no selected supplier\n• Active: Has a selected supplier assigned\n• Frozen: Temporarily disabled (e.g. supplier issue)\n• Inactive: No longer in active sourcing' },
    { title: 'Cautions', content: '• Removing the only selected supplier reverts the unit to "sourcing" status\n• Frozen units cannot receive new orders until unfrozen\n• Landed price = unit price + apportioned delivery cost per MOQ' },
  ],
};

export const VALIDITY_GUIDANCE = {
  pageTitle: 'How Validity Monitoring Works',
  summary: 'Track quote expiry dates, send confirmation outreach to suppliers, and escalate to renegotiation when prices change.',
  storageKey: 'validity',
  sections: [
    { title: 'What is this page for?', content: 'This is Mandate 3 — Price Confirmation & Validity. Use it to monitor which supplier quotes are expiring and proactively confirm or renegotiate pricing.' },
    { title: 'Workflow', content: '1. System flags quotes as "expiring soon" (within 14 days)\n2. Supply Officer sends confirmation outreach via WhatsApp\n3. Supplier confirms or indicates price change\n4. Management approves extension or creates renegotiation case' },
    { title: 'Who does what?', content: '• Supply Officer: Monitors expiry, sends outreach, records supplier responses\n• Supply Management/Admin: Approves extensions, creates renegotiation cases\n• System: Auto-derives validity status from dates and records' },
    { title: 'Key statuses', content: '• Active: Valid and not expiring soon\n• Expiring Soon: Within 14 days of expiry\n• Awaiting Supplier: Outreach sent, waiting for response\n• Supplier Changed: Supplier indicated a price change\n• Awaiting Management: Supplier confirmed, needs management approval\n• Expired: Past valid_until date' },
    { title: 'Cautions', content: '• Validity is derived from supplier_quotes.valid_until — this is the source of truth\n• Only management/admin roles can approve validity extensions\n• If a supplier changes price, create a renegotiation case instead of extending' },
  ],
};

export const RENEGOTIATION_GUIDANCE = {
  pageTitle: 'How Renegotiation Works',
  summary: 'Manage cases where supplier pricing needs to be renegotiated — triggered by expiry, price changes, or performance issues.',
  storageKey: 'renegotiation',
  sections: [
    { title: 'What is this page for?', content: 'This is Mandate 2 — Renegotiate Existing Materials. Track and resolve cases where current supplier pricing is no longer competitive or valid.' },
    { title: 'When to use', content: '• When a validity record shows "supplier changed"\n• When a quote expires without confirmation\n• When competitive market intelligence suggests better pricing is available\n• When supplier performance issues warrant renegotiation' },
    { title: 'Who does what?', content: '• Supply Officer: Creates cases, sends outreach, records received quotes\n• Supply Management/Admin: Reviews cases, makes resolution decisions\n• System: Can auto-create cases from expired validity records' },
    { title: 'Lifecycle', content: '• Open → Outreach Sent → Quote Received → Under Review → Resolved/Cancelled\n• Each status transition should include notes explaining the decision' },
    { title: 'What happens next?', content: 'Resolution typically means either:\n• New quote submitted and approved (replacement)\n• Existing pricing accepted with extension\n• Supplier replaced via Supply Units page' },
    { title: 'Cautions', content: '• Don\'t resolve without recording the outcome\n• Renegotiation cases link to the original quote for audit trail\n• Outreach uses WhatsApp/Fatai if configured' },
  ],
};

export const ISSUES_GUIDANCE = {
  pageTitle: 'How Supplier Issues Works',
  summary: 'Report and track supplier-related problems — quality issues, delivery failures, pricing disputes, and communication breakdowns.',
  storageKey: 'issues',
  sections: [
    { title: 'What is this page for?', content: 'This is part of Mandate 4 — Supplier Relationship Management. Use it to formally record and resolve problems with specific suppliers.' },
    { title: 'When to use', content: '• Quality problems with delivered materials\n• Delivery delays or failures\n• Pricing disputes or unexpected changes\n• Communication breakdowns\n• Compliance or contractual issues' },
    { title: 'Who does what?', content: '• Supply Officer: Reports issues, investigates, tracks resolution\n• Supply Management/Admin: Escalates critical issues, records management actions\n• Any authenticated user: Can report issues' },
    { title: 'Severity levels', content: '• Minor: Inconvenience, no operational impact\n• Major: Operational impact, needs timely resolution\n• Critical: Immediate risk, may trigger freeze or blacklist' },
    { title: 'Lifecycle', content: '• Open → Investigating → Escalated → Resolved → Closed\n• Critical issues should be escalated promptly\n• Resolution notes are required when closing' },
    { title: 'Cautions', content: '• Critical issues may warrant a management action (freeze/blacklist) via the Supplier Detail page\n• Issue counts appear in Supply Unit KPIs — unresolved issues affect supplier health scoring' },
  ],
};

export const FATAI_TEST_GUIDANCE = {
  pageTitle: 'Fatai/WhatsApp Test Panel',
  summary: 'Admin-only testing page for WhatsApp integration via Fatai. Use to verify outbound message delivery and inbound webhook reception.',
  storageKey: 'fatai-test',
  sections: [
    { title: 'What is this page for?', content: 'This is an admin/developer tool for testing the WhatsApp/Fatai integration. It is not part of the production Supply workflow.' },
    { title: 'Who can use this?', content: 'Admin users only. This page is not visible to regular supply officers or management.' },
    { title: 'Cautions', content: '• Test messages are sent to real phone numbers — use carefully\n• Webhook events may take a few seconds to appear\n• This page does not affect any Supply module data' },
  ],
};
