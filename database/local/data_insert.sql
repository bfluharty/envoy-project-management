-- Users
INSERT INTO envoy_schema.users (uuid, full_name, email, password, created_timestamp, modified_timestamp, is_active, entitlement)
VALUES
  ('b7e1a2e2-1c3a-4b2e-8e7a-1f2b3c4d5e6f', 'Alice Example', 'alice@example.com', 'hashedpassword1', NOW(), NOW(), true, 1),
  ('c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b4c', 'Bob Example', 'bob@example.com', 'hashedpassword2', NOW(), NOW(), true, 2);

-- Projects
INSERT INTO envoy_schema.projects (uuid, title, description, location, start_date, end_date, deadline, budget_amount, budget_currency_id, goals, user_uuid, created_timestamp, modified_timestamp, is_active)
VALUES
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Project Alpha', 'First project', '{"city":"New York"}', '2026-01-01', '2026-06-01', '2026-05-01', 10000.00, 1, 'Launch MVP', 'b7e1a2e2-1c3a-4b2e-8e7a-1f2b3c4d5e6f', NOW(), NOW(), true),
  ('e6f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b', 'Project Beta', 'Second project', '{"city":"London"}', '2026-02-01', '2026-07-01', '2026-06-01', 20000.00, 2, 'Expand Market', 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b4c', NOW(), NOW(), true);

-- Vendors
INSERT INTO envoy_schema.vendors (uuid, name, email, created_by, created_timestamp, modified_by, modified_timestamp, status_id, project_uuid, is_active)
VALUES
  ('f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f', 'Acme Corp', 'contact@acme.com', 'admin', NOW(), 'admin', NOW(), 1, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', true),
  ('0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c6d', 'Globex Inc', 'info@globex.com', 'admin', NOW(), 'admin', NOW(), 2, 'e6f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b', true);

-- Conversations
INSERT INTO envoy_schema.conversations (uuid, timestamp, project_uuid)
VALUES
  ('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', NOW(), 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'),
  ('b9c0d1e2-f3a4-4b5c-6d7e-8f9a0b1c2d3e', NOW(), 'e6f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b');

-- Conversation Turns
INSERT INTO envoy_schema.conversation_turns (uuid, timestamp, contents, conversation_uuid)
VALUES
  ('1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', NOW(), '{"message":"Hello"}', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a'),
  ('2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e', NOW(), '{"message":"Hi"}', 'b9c0d1e2-f3a4-4b5c-6d7e-8f9a0b1c2d3e');

-- Vendor Conversations
INSERT INTO envoy_schema.vendor_conversations (uuid, channel, user_id, created_timestamp, vendor_uuid)
VALUES
  ('3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f', 'email', 1, NOW(), 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f'),
  ('4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a', 'phone', 2, NOW(), '0a1b2c3d-4e5f-6a7b-8c9d-1e2f3a4b5c6d');

-- Messages
INSERT INTO envoy_schema.messages (uuid, body, created_by, created_timestamp, modified_by, modified_timestamp, subject, "from", "to", cc, bcc, sent_timestamp, vendor_conversation_uuid)
VALUES
  ('5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b', 'Test message 1', 'alice@example.com', NOW(), 'alice@example.com', NOW(), 'Subject 1', 'alice@example.com', 'bob@example.com', NULL, NULL, NOW(), '3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f'),
  ('6f7a8b9c-0d1e-4f2a-3b4c-5d6e7f8a9b0c', 'Test message 2', 'bob@example.com', NOW(), 'bob@example.com', NOW(), 'Subject 2', 'bob@example.com', 'alice@example.com', NULL, NULL, NOW(), '4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a');