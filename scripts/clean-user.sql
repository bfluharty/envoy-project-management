DO $$
DECLARE
  target_email text := 'benjaminfluharty@gmail.com';
  target_user_id integer;
  target_user_uuid uuid;
BEGIN
  SELECT id, uuid
  INTO target_user_id, target_user_uuid
  FROM envoy_schema.users
  WHERE lower(email) = lower(target_email);

  IF target_user_uuid IS NULL THEN
    RAISE NOTICE 'No user found for %', target_email;
    RETURN;
  END IF;

  RAISE NOTICE 'Deleting user % (%)', target_email, target_user_uuid;

  UPDATE envoy_schema.anonymous_onboarding_drafts
  SET
    registered_user_uuid = NULL,
    consumed_by_user_uuid = NULL,
    consumed_project_uuid = NULL
  WHERE registered_user_uuid = target_user_uuid
     OR consumed_by_user_uuid = target_user_uuid
     OR consumed_project_uuid IN (
       SELECT uuid FROM envoy_schema.projects WHERE user_uuid = target_user_uuid
     );

  UPDATE envoy_schema.vendor_listings
  SET
    claimed_by_user_uuid = NULL,
    claimed_at = NULL,
    claim_status = 'UNCLAIMED'
  WHERE claimed_by_user_uuid = target_user_uuid;

  UPDATE envoy_schema.vendor_listings
  SET owner_user_uuid = NULL
  WHERE owner_user_uuid = target_user_uuid;

  DELETE FROM envoy_schema.project_insights
  WHERE project_uuid IN (
    SELECT uuid FROM envoy_schema.projects WHERE user_uuid = target_user_uuid
  );

  DELETE FROM envoy_schema.conversation_turns
  WHERE conversation_uuid IN (
    SELECT c.uuid
    FROM envoy_schema.conversations c
    JOIN envoy_schema.projects p ON p.uuid = c.project_uuid
    WHERE p.user_uuid = target_user_uuid
  );

  DELETE FROM envoy_schema.conversations
  WHERE project_uuid IN (
    SELECT uuid FROM envoy_schema.projects WHERE user_uuid = target_user_uuid
  );

  DELETE FROM envoy_schema.project_vendors
  WHERE project_uuid IN (
    SELECT uuid FROM envoy_schema.projects WHERE user_uuid = target_user_uuid
  );

  DELETE FROM envoy_schema.vendors
  WHERE user_uuid = target_user_uuid;

  DELETE FROM envoy_schema.projects
  WHERE user_uuid = target_user_uuid;

  DELETE FROM envoy_schema.users
  WHERE uuid = target_user_uuid;

  RAISE NOTICE 'Deleted user % (%)', target_email, target_user_uuid;
END $$;

commit;


select * from envoy_schema.users;
