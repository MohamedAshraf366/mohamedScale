
-- Purge all sales-related data in FK-safe order for migration prep
-- 1. Communication action items (FK → communications)
DELETE FROM communication_action_items;
-- 2. Communications
DELETE FROM communications;
-- 3. Quotation items (FK → quotations)
DELETE FROM quotation_items;
-- 4. Quotations
DELETE FROM quotations;
-- 5. Order items (FK → orders)
DELETE FROM order_items;
-- 6. Invoices (FK → orders, quotations)
DELETE FROM invoices;
-- 7. Payments (FK → invoices) - already empty but safe
DELETE FROM payments;
-- 8. Orders
DELETE FROM orders;
-- 9. Opportunities (FK → projects, customers)
DELETE FROM opportunities;
-- 10. Projects (FK → customers/accounts, locations)
DELETE FROM projects;
-- 11. Contacts (FK → accounts)
DELETE FROM contacts;
-- 12. Customers (FK → accounts)
DELETE FROM customers;
-- 13. Customer accounts (only those not used by suppliers)
DELETE FROM accounts WHERE id NOT IN (SELECT account_id FROM suppliers);
-- 14. Activity log
DELETE FROM activity_log;
-- 15. Attachments related to sales entities
DELETE FROM attachments;
