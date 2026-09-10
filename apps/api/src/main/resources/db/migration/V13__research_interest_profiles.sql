-- Only an explicit sharing action creates a profile. Private subscriptions remain private.
CREATE TABLE research.interest_profile (
    scope_key text NOT NULL REFERENCES research.scope(scope_key),
    user_id text NOT NULL,
    display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
    contact_url text NOT NULL CHECK (length(contact_url) <= 500 AND contact_url ~* '^https://'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(scope_key, user_id)
);
CREATE INDEX research_interest_scope_created ON research.interest_profile(scope_key, created_at, user_id);
