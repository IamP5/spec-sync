-- The locked scope selects one active replay. Failed generations must remain auditable while a
-- subsequent retry is allowed to create another work item for the same immutable source.
DROP INDEX research.research_replay_revision;
CREATE INDEX research_replay_history ON research.work(replayed_from_work_id,scope_key) WHERE replayed_from_work_id IS NOT NULL;
