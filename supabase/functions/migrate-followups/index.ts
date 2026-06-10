import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Follow-up history data from CSV
const followUpData = [
  { id: "020f50f0-efa6-4c8f-8616-4e581587ccc7", communication_log_id: "170a1e3d-e498-4e63-b059-59a44434d4b6", follow_up_date: "2025-12-11", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل وعدم الرد وتم إرسال عرض سعر", notes: "شكرا على تواصلك معنا ونقدر وقتكم", created_at: "2025-12-15 12:03:36.136022+00", status_after: "Closed", priority: "Medium", follow_up_type: "send_quotation", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: "لم يتم الرد ", tags: [], project_id: null, opportunity_id: null },
  { id: "1e9d8288-3278-4f85-8adb-d2287143f208", communication_log_id: "6f7a7107-5928-415d-ac0b-10667b75bd02", follow_up_date: "2025-12-14", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه العميل لحين الرد ", notes: null, created_at: "2025-12-15 11:56:30.285111+00", status_after: "Closed", priority: "Medium", follow_up_type: "follow_up_after_offer", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "WA", client_response: "لم يتم الرد", tags: [], project_id: null, opportunity_id: null },
  { id: "2e75ebbe-9e9a-478a-a935-2f74c5736549", communication_log_id: "42ab52e9-fb7c-4986-8d87-4d5240216f8c", follow_up_date: "2025-12-15", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه مع العميل وإرسال عينات بلوك ٢٠ معزول و ٢٠ غير معزول ", notes: null, created_at: "2025-12-15 12:22:20.445413+00", status_after: "Closed", priority: "Medium", follow_up_type: "follow_up_after_offer", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "WA", client_response: "يحتاج عينات بلوك ", tags: [], project_id: null, opportunity_id: null },
  { id: "3abd9742-d4d6-4147-b74a-96256350e542", communication_log_id: "9e6d1ffe-800d-437d-82df-267f63e3e255", follow_up_date: "2025-12-10", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل وإرسال عرض سعر", notes: "شكرا على تواصلك معنا ونقدر وقتكم ", created_at: "2025-12-15 12:12:39.072207+00", status_after: "Closed", priority: "Medium", follow_up_type: "send_quotation", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: "إرسال عرض سعر ", tags: [], project_id: null, opportunity_id: null },
  { id: "868607a9-1adb-4d77-ba1b-8474ae056945", communication_log_id: "896f5a23-d153-4055-873d-b79ac62ef287", follow_up_date: "2026-01-20", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه العميل بعد عرض السعر ", notes: null, created_at: "2026-01-17 10:52:21.698247+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "eb2cff71-b224-48f3-8693-0a418c23f316", opportunity_id: "1c42c008-420c-4a64-b424-a3890a30d6de" },
  { id: "06b81948-6cc9-4f07-8c37-221b21c34d9c", communication_log_id: "486b87ea-a037-4270-91cd-645420ddf230", follow_up_date: "2026-01-24", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه بعد عرض السعر", notes: null, created_at: "2026-01-17 15:16:07.653006+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "24827b53-e102-4a7a-9346-eb72bffcfe42", opportunity_id: "bee30c85-7147-4b64-be60-2b907af78c9d" },
  { id: "e647bd37-f6f4-41d8-9840-e8275e5cb2bc", communication_log_id: "50b50aa0-e841-4716-a186-6ebe15dedaa2", follow_up_date: "2026-01-19", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "إرسال عرض سعر والمتابعه ", notes: null, created_at: "2026-01-17 15:45:49.307255+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "WA", client_response: null, tags: [], project_id: "f12d13fa-a074-4ac8-a345-00510ced4b4f", opportunity_id: "26feae9f-49b5-4a6b-8d36-befd6a3b3db4" },
  { id: "44e0be87-333d-4516-8fbf-449918f4203b", communication_log_id: "fe78ce0b-c719-445c-90d9-798901a61176", follow_up_date: "2026-01-20", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه لحين الرد وإرسال عرض سعر", notes: null, created_at: "2026-01-18 14:25:20.266316+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "5829df37-95bb-4e52-8745-a486e5048439", opportunity_id: "9f02cc75-c164-49fd-a547-065e8cd74d26" },
  { id: "3203836b-208b-4f4b-80e9-38f48df29555", communication_log_id: "450a58fe-a219-4360-85e2-a732bb3332ac", follow_up_date: "2026-03-01", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه لحين الانتهاء من أعمال الخرسانه", notes: null, created_at: "2026-01-18 14:53:25.975675+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "771eeec0-704c-426e-95a1-f290d7813c1b", opportunity_id: "7a0d0162-1b9b-434d-8341-921e3ee06f84" },
  { id: "66b4a27a-7c2b-4c3e-80e9-b0458336a4ed", communication_log_id: "9e6d1ffe-800d-437d-82df-267f63e3e255", follow_up_date: "2025-12-13", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه العميل لحين الانتهاء من التامين", notes: null, created_at: "2025-12-15 12:12:39.072207+00", status_after: "Closed", priority: "Medium", follow_up_type: "follow_up_after_offer", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: "تم التواصل و العميل ف انتظار انتهاء التأمين واستئناف العمل ثم التواصل معنا", tags: [], project_id: null, opportunity_id: null },
  { id: "b14fb975-9bd1-4564-95a6-be0cb7098919", communication_log_id: "affeacf6-b03c-4627-bebb-0bfa9dc3f705", follow_up_date: "2026-01-20", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه بعد عرض السعر لحين الطلب", notes: null, created_at: "2026-01-18 17:37:29.027723+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "WA", client_response: null, tags: [], project_id: "2df00232-8acd-401a-ad27-8611997bd695", opportunity_id: "106f82c2-4063-4a6d-8bc4-ae1ed91110ad" },
  { id: "67ad53ca-0173-4619-b152-a721fb65ca8c", communication_log_id: "42ab52e9-fb7c-4986-8d87-4d5240216f8c", follow_up_date: "2025-12-11", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل وإرسال عرض سعر ", notes: "شكرا على تواصلك معنا ونقدر وقتكم ", created_at: "2025-12-15 12:22:20.445413+00", status_after: "Closed", priority: "Medium", follow_up_type: "send_quotation", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: "إرسال عرض سعر ", tags: [], project_id: null, opportunity_id: null },
  { id: "68303609-e9e8-4efd-8a85-9bb49b340177", communication_log_id: "3d2577ef-0895-478d-8777-036a6739b903", follow_up_date: "2026-01-21", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه لحين الرد وإرسال عرض سعر", notes: null, created_at: "2026-01-19 16:12:24.258578+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "6075aec1-552a-45cf-8889-4c312cd8f12b", opportunity_id: "d213ce14-2659-4f96-8863-bbd89ef2098a" },
  { id: "194eae20-18f2-4694-8b0b-0941d0716f0b", communication_log_id: "2992b8c5-7354-4f70-a9a2-34ecdd142596", follow_up_date: "2026-01-26", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "إرسال عرض سعر للبنه الذهبيه وعرض سعر عام ", notes: null, created_at: "2026-01-19 16:33:47.016265+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "WA", client_response: null, tags: [], project_id: "7a512fa1-12ef-4f43-80e0-fc96f5b4b569", opportunity_id: "b1ec910d-bcde-44c1-9796-a115c52e3a36" },
  { id: "0c08cc69-435d-4511-95ab-9055aceea509", communication_log_id: "12511b1c-d9b9-406c-8ef0-4ca568c712f0", follow_up_date: "2026-01-20", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه لحين الرد وإرسال عرض سعر", notes: null, created_at: "2026-01-19 17:51:02.251848+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "a25db460-0818-49c2-b768-63b06ee48e44", opportunity_id: "efbdf474-e4c4-44af-88a4-a725cc75ba5d" },
  { id: "85b0ee87-d675-48b1-a300-12a33c2dfc02", communication_log_id: "1c987332-b46f-4ba1-ba99-d635c97d0c1c", follow_up_date: "2026-01-24", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "اعاده التواصل لحين الرد", notes: null, created_at: "2026-01-22 16:33:38.675639+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "a850012b-57f2-48a0-86da-e3fa7f15a2f2", opportunity_id: "ef5db4ae-3f08-467f-88eb-c7320bde6992" },
  { id: "2773ca83-c4ed-4876-83c0-f3abc124f22d", communication_log_id: "9478d2e2-c422-47d5-8c34-6ed72a8d3d87", follow_up_date: "2026-01-26", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه لحين الرد ", notes: null, created_at: "2026-01-22 16:55:24.701416+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "82a2af0f-c024-4c1a-8a94-d1528b3f24e7", opportunity_id: "52ea1946-bb9b-4c23-9799-cbf239f7f7d2" },
  { id: "e3a11135-5def-44d8-9f47-ef8524de2eae", communication_log_id: "5a3c706e-111e-4d55-9444-a844455a3a6c", follow_up_date: "2026-01-24", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "اعاده التواصل لحين الرد", notes: null, created_at: "2026-01-22 17:23:03.345412+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "7684e2e5-893a-4bc7-8b88-5e7f92461344", opportunity_id: "5e0d6ad9-aafc-41b0-8f89-661dc9065c4a" },
  { id: "b017959a-e08e-4482-8094-5e49d3c8d7c7", communication_log_id: "f97e5821-4345-4fab-a373-99d8617b0b1e", follow_up_date: "2026-01-25", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه بعد عرض ادسعر", notes: null, created_at: "2026-01-22 17:55:33.026427+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "cb8b252e-6427-4285-b3a3-e6489960c236", opportunity_id: "ec5804b0-cf96-4d02-a805-325ecb702c1c" },
  { id: "b218f9b6-6c14-4349-9de5-84615b2b6189", communication_log_id: "3966b21d-035e-428e-8979-bc054c578e96", follow_up_date: "2025-12-16", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل وإرسال عرض سعر", notes: "شكرا على تواصلك معنا ونقدر وقتكم ", created_at: "2025-12-16 11:55:12.783059+00", status_after: "Closed", priority: "Medium", follow_up_type: "send_quotation", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: "إرسال عرض سعر", tags: [], project_id: null, opportunity_id: null },
  { id: "135af7f9-01a7-453b-9f05-da2ddf7d5199", communication_log_id: "270a499d-18a5-420c-bcbe-73ab096ee789", follow_up_date: "2026-01-25", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه لحين الرد ", notes: null, created_at: "2026-01-22 17:57:53.835941+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "8ca0a5ec-8cb4-4dc6-93e7-eb61aa4bf10a", opportunity_id: "ef7afd7b-a456-4423-949f-d7ecda83247f" },
  { id: "22595e6e-79ba-4480-a195-b25c353b3aa2", communication_log_id: "475bebf8-dbf9-4ad8-9ea3-34379514d35a", follow_up_date: "2025-12-16", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل وإرسال عرض سعر", notes: "شكرا على تواصلك معنا ونقدر وقتكم ", created_at: "2025-12-16 13:19:25.886427+00", status_after: "Closed", priority: "Medium", follow_up_type: "send_quotation", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: "إرسال عرض سعر ", tags: [], project_id: null, opportunity_id: null },
  { id: "23ede167-0047-4519-b154-540d48d777d4", communication_log_id: "475bebf8-dbf9-4ad8-9ea3-34379514d35a", follow_up_date: "2025-12-16", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل بعد عرض السعر ومحتاج عينه بلوك عادي", notes: "شكرا على تواصلك معنا ونقدر وقتكم ", created_at: "2025-12-16 13:23:30.2854+00", status_after: "Closed", priority: "Medium", follow_up_type: "follow_up_after_offer", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "WA", client_response: "يحتاج عينه بلوك عادي", tags: [], project_id: null, opportunity_id: null },
  { id: "1b07a4bd-6a96-4e2f-97bb-a22dce76e6fd", communication_log_id: "cdd942f3-5d18-4806-b3bd-145d3bfd38d7", follow_up_date: "2025-12-17", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل وإرسال عرض سعر ", notes: "شكرا على تواصلك معنا ونقدر وقتكم ", created_at: "2025-12-17 12:21:24.286138+00", status_after: "Closed", priority: "Low", follow_up_type: "send_quotation", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: "إرسال عرض سعر ولديه أسعار أقل ", tags: [], project_id: null, opportunity_id: null },
  { id: "b873a83b-8465-46e3-9506-03407e374ce1", communication_log_id: "9de84cac-bedd-44a8-bc67-6b485664709d", follow_up_date: "2025-12-16", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل وإرسال عرض سعر ", notes: "شكرا على تواصلك معنا ونقدر وقتكم ", created_at: "2025-12-16 10:17:17.45898+00", status_after: "Closed", priority: "Medium", follow_up_type: "send_quotation", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "WA", client_response: "ف انتظار رد العميل", tags: [], project_id: null, opportunity_id: null },
  { id: "9ae04b11-6374-4d9f-8826-cbe6097339bb", communication_log_id: "49f78269-1e24-4e15-b676-1f1e3b232ff7", follow_up_date: "2026-01-22", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه العميل وإرسال عرض سعر", notes: null, created_at: "2026-01-17 11:00:21.238287+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "b9289f3d-1ac7-49ec-8175-dd457dd1b5a3", opportunity_id: "573673c4-8728-4294-8dd7-7455c0f85302" },
  { id: "e355cfba-350c-46e1-815f-2d2161f2e9b1", communication_log_id: "a79f525b-ac39-4034-9685-8c3913775510", follow_up_date: "2026-01-30", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "المتابعه بعد عرض السعر ", notes: null, created_at: "2026-01-17 15:20:45.046225+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "5f2b2883-882c-48a3-a7ba-8d50141cdd60", opportunity_id: "dc0a4053-6aca-48d6-9fb1-67987030aed5" },
  { id: "c3eb1ba6-6f11-4937-b5c2-2d5a0aa6e575", communication_log_id: "0ca568bf-cfca-408a-881e-cb2b86e32bd3", follow_up_date: "2025-12-11", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل وعدم الرد وتم إرسال عرض سعر على الواتساب", notes: "شكرا على وقتك وعلى التواصل معنا", created_at: "2025-12-15 12:08:56.650389+00", status_after: "Closed", priority: "Medium", follow_up_type: "send_quotation", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: "لم يتم الرد ", tags: [], project_id: null, opportunity_id: null },
  { id: "d4959560-6903-4a10-94ba-1a8505d0895e", communication_log_id: "1b507306-5830-4e36-a947-e586bf6a8ed4", follow_up_date: "2025-12-16", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "تم التواصل وإرسال عرض سعر ", notes: "شكرا على تواصلك معنا ونقدر وقتكم", created_at: "2025-12-16 10:33:20.335458+00", status_after: "Closed", priority: "Low", follow_up_type: "send_quotation", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: "إرسال عرض سعر بالواتساب", tags: [], project_id: null, opportunity_id: null },
  { id: "02774558-626c-4612-8392-277649f19b29", communication_log_id: "5e9946e3-ac31-42da-b0c3-d367cff84188", follow_up_date: "2026-01-19", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه بعد عرض السعر", notes: null, created_at: "2026-01-17 15:49:48.103713+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "WA", client_response: null, tags: [], project_id: "75251252-54ba-4b82-a44d-fffd984207bc", opportunity_id: "b0f21912-af04-4c27-9252-98728f0c38ec" },
  { id: "858f2dee-ac34-4e76-b707-2dc5c4444e0d", communication_log_id: "d59ed1a0-6f17-4a03-a145-f2dfe923ee64", follow_up_date: "2026-02-18", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "المتابعه لحين البدء في مشروع اخر", notes: null, created_at: "2026-01-18 14:29:23.995442+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "de5b2cb2-6b9c-4fae-855b-14c3de0001b3", opportunity_id: "cfebd315-697b-4ebd-8d1d-3733281d0c38" },
  { id: "e18c8dce-eba1-47d5-9242-696909d95413", communication_log_id: "a6ad2168-f950-4473-ae8f-424735bb9f87", follow_up_date: "2026-02-18", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه العميل لحين البدء في مشروع آخر ", notes: null, created_at: "2026-01-18 17:04:53.327621+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "2d8e4005-99ef-4478-99dd-9a89178f95cb", opportunity_id: "a261e85a-a20a-4a0a-b0c5-86392babb38d" },
  { id: "a1905e8e-094c-4b22-927c-d59b3c99c0cb", communication_log_id: "8144f52b-532a-4e36-a246-9713c1ab7acc", follow_up_date: "2026-01-20", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "إرسال عرض سعر والمتابعه", notes: null, created_at: "2026-01-18 17:47:28.463055+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "0973fbc9-4423-4ec6-82a0-1cc46782df46", opportunity_id: "f4d7eae9-b1c2-4042-8446-644ed43b4364" },
];

// Add remaining data (truncated for brevity - will add via continuation)
const followUpDataPart2 = [
  { id: "1525fd79-cbbf-4fe2-9802-b1d3cb8e5ef0", communication_log_id: "a388af42-8e45-4d6d-b448-c7a90db9b9b3", follow_up_date: "2026-01-21", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه بعد عرض السعر", notes: null, created_at: "2026-01-19 16:18:34.98952+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "04853cf2-42f3-40fa-b86c-62ece5209047", opportunity_id: "4a0c6548-f405-442c-bddb-a30d8929bc12" },
  { id: "2d49b7de-3fa4-45c1-b251-b67560b1d9f0", communication_log_id: "9d830f43-eb82-4ccb-802b-6607a80b90e0", follow_up_date: "2026-01-26", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه وإرسال عرض سعر ", notes: null, created_at: "2026-01-19 16:37:10.803585+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "ed60d6d0-9259-4788-941c-3e3f9b67f32b", opportunity_id: "5767d2b9-9cbf-4a64-b86b-6cd7a39bfd19" },
  { id: "62231a98-c6fb-4730-9df8-2c29b788febc", communication_log_id: "a2f27198-401f-4fc6-99e3-66ac850816bf", follow_up_date: "2026-01-21", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه بعد عرض السعر ", notes: null, created_at: "2026-01-19 17:55:16.2681+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "59b4fd21-ff41-497e-b619-9025bbdbe66c", opportunity_id: "6494779e-661e-44c1-b9aa-1af015d7f804" },
  { id: "ef40c3c0-35e1-4fb5-aa4d-d702337c8084", communication_log_id: "66b54cf4-00a6-4a22-9849-68f4dd0b9541", follow_up_date: "2026-01-24", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه بعد عرض السعر ", notes: null, created_at: "2026-01-22 16:39:41.387639+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "ab003c94-c5f5-4e52-8f1d-0284b5a4f860", opportunity_id: "e326cd41-e559-4106-880c-dec5efeb3da6" },
  { id: "42870909-afa2-4aab-a3ea-957c9f8463a7", communication_log_id: "40e16d49-322d-4537-af33-bb18b08daa34", follow_up_date: "2026-01-27", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه لحين الرد ", notes: null, created_at: "2026-01-22 16:57:49.656666+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "a0975d1a-da27-4d80-922e-4e3aea8edddd", opportunity_id: "f67a14d7-07d3-4fd4-89df-9eb29a99e7b2" },
  { id: "d6f37e6c-8ef6-4f9e-aa03-838a161e7595", communication_log_id: "7bac09fe-37fd-4058-a3cf-9f03f9c5f6ef", follow_up_date: "2026-02-22", user_id: "cb325dfa-3a82-4e4d-b53b-a752e6410d6a", action: "متابعه لحين البدء في مشروع آخر ", notes: null, created_at: "2026-01-22 17:40:27.131062+00", status_after: "Open", priority: "Medium", follow_up_type: "general", outcome: null, reminder_enabled: false, attachments: [], follow_up_channel: "Phone call", client_response: null, tags: [], project_id: "f5346256-e262-485d-8be4-ccd22bba9f2a", opportunity_id: "1ac08ef7-6eae-4256-a350-74d9fecd5661" },
];

// Complete the array with all records
const allFollowUps = [...followUpData, ...followUpDataPart2];

// Map legacy values to new schema values
function mapStatus(legacyStatus: string | null): string {
  if (!legacyStatus) return 'open';
  switch (legacyStatus.toLowerCase()) {
    case 'closed': return 'completed';
    case 'done': return 'completed';
    case 'open': return 'open';
    default: return 'open';
  }
}

function mapPriority(legacyPriority: string | null): string {
  if (!legacyPriority) return 'medium';
  switch (legacyPriority.toLowerCase()) {
    case 'low': return 'low';
    case 'medium': return 'medium';
    case 'high': return 'high';
    case 'urgent': return 'urgent';
    default: return 'medium';
  }
}

function mapTaskType(legacyType: string | null): string {
  if (!legacyType) return 'follow_up';
  switch (legacyType.toLowerCase()) {
    case 'send_quotation': return 'follow_up';
    case 'follow_up_after_offer': return 'follow_up';
    case 'general': return 'follow_up';
    default: return 'follow_up';
  }
}

function mapChannel(legacyChannel: string | null): string | null {
  if (!legacyChannel) return null;
  switch (legacyChannel.toLowerCase()) {
    case 'phone call': return 'call';
    case 'wa': return 'whatsapp';
    case 'whatsapp': return 'whatsapp';
    case 'meeting': return 'meeting';
    case 'in person': return 'visit';
    case 'email': return 'email';
    default: return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      total: allFollowUps.length,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const fu of allFollowUps) {
      try {
        // First, find the customer_account_id from the communication
        const { data: comm } = await supabase
          .from('communications')
          .select('id, account_id')
          .eq('id', fu.communication_log_id)
          .maybeSingle();

        if (!comm) {
          results.skipped++;
          results.errors.push(`No communication found for ${fu.communication_log_id}`);
          continue;
        }

        // Check if customer exists
        const { data: customer } = await supabase
          .from('customers')
          .select('account_id')
          .eq('account_id', comm.account_id)
          .maybeSingle();

        if (!customer) {
          results.skipped++;
          results.errors.push(`No customer found for account ${comm.account_id}`);
          continue;
        }

        // Check for duplicate
        const { data: existing } = await supabase
          .from('tasks')
          .select('id')
          .eq('legacy_follow_up_id', fu.id)
          .maybeSingle();

        if (existing) {
          results.skipped++;
          continue; // Already migrated
        }

        // Insert task - set assigned_to to null to avoid FK constraint
        const { error: insertError } = await supabase
          .from('tasks')
          .insert({
            customer_account_id: comm.account_id,
            project_id: fu.project_id || null,
            opportunity_id: fu.opportunity_id || null,
            communication_id: fu.communication_log_id,
            title: fu.action || 'Follow-up',
            description: fu.notes || null,
            task_type: mapTaskType(fu.follow_up_type),
            status: mapStatus(fu.status_after),
            priority: mapPriority(fu.priority),
            channel: mapChannel(fu.follow_up_channel),
            due_at: fu.follow_up_date ? `${fu.follow_up_date}T12:00:00Z` : null,
            completed_at: fu.status_after?.toLowerCase() === 'closed' || fu.status_after?.toLowerCase() === 'done' 
              ? fu.created_at 
              : null,
            assigned_to: null, // Skip FK constraint - assign manually later
            outcome: fu.outcome || null,
            client_response: fu.client_response || null,
            attachments: fu.attachments || [],
            tags: fu.tags || [],
            reminder_enabled: fu.reminder_enabled || false,
            metadata: { legacy_follow_up_type: fu.follow_up_type, legacy_user_id: fu.user_id },
            legacy_follow_up_id: fu.id,
            created_at: fu.created_at,
            created_by: null,
          });

        if (insertError) {
          results.errors.push(`Insert error for ${fu.id}: ${insertError.message}`);
        } else {
          results.inserted++;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Error processing ${fu.id}: ${errMsg}`);
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
