-- Clear API keys from template organizations (public orgs with no forked_from).
-- Template orgs are the original public organizations used as starter templates.
-- They should not hold real API keys since any visitor can browse them.
UPDATE organizations
SET anthropic_api_key = NULL,
    openai_api_key = NULL
WHERE visibility = 'public'
  AND forked_from IS NULL;
