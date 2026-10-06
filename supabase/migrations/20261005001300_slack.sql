-- Slack: ARK OS posts what happens to the team's Slack. Connected with a bot
-- token from a Slack app in the workspace (Settings → Integrations → Slack).
-- Each kind of thing (an application, a booking, a payment…) can be switched
-- on and sent to its own channel; the morning digest goes out with the daily
-- cron. Same integrations table as GHL; the token is admin-only through RLS.

alter table public.integrations drop constraint if exists integrations_key_check;
alter table public.integrations add constraint integrations_key_check
  check (key in ('ghl', 'guesty', 'slack'));

alter table public.integrations
  -- What the other side calls itself (the Slack workspace, say). Shown on the page.
  add column account_name text,
  -- Default channel for everything that has no channel of its own.
  add column channel text,
  -- Per kind: { "booking": { "on": true, "channel": "#front-desk" }, ... }
  add column rules jsonb not null default '{}'::jsonb;

insert into public.integrations (key) values ('slack');

-- Two more kinds of event: a message posted, and the morning digest.
alter table public.integration_events drop constraint if exists integration_events_kind_check;
alter table public.integration_events add constraint integration_events_kind_check
  check (kind in ('test', 'sync', 'push', 'webhook', 'notify', 'digest'));
