-- ShopQA initial schema

create table if not exists reports (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  figma_url       text,
  web_url         text not null,
  viewports       text[] not null default '{"desktop"}',
  status          text not null default 'processing'
                  check (status in ('processing', 'completed', 'failed')),
  overall_score   integer check (overall_score >= 0 and overall_score <= 100),
  summary         jsonb,
  user_id         uuid,
  parent_report_id uuid references reports(id)
);

create table if not exists issues (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references reports(id) on delete cascade,
  category        text not null,
  subcategory     text not null,
  severity        text not null check (severity in ('critical', 'warning', 'info')),
  title           text not null,
  description     text not null,
  expected_value  text,
  actual_value    text,
  element         text,
  suggestion      text,
  screenshot_key  text,
  metadata        jsonb,
  resolved        boolean default false
);

create table if not exists screenshots (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references reports(id) on delete cascade,
  type            text not null,
  viewport        text not null,
  storage_path    text not null,
  width           integer not null,
  height          integer not null
);

create table if not exists report_modules (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references reports(id) on delete cascade,
  module          text not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'running', 'completed', 'failed')),
  score           integer check (score >= 0 and score <= 100),
  started_at      timestamptz,
  completed_at    timestamptz,
  error           text
);

-- Indexes
create index if not exists idx_issues_report_id on issues(report_id);
create index if not exists idx_issues_severity on issues(severity);
create index if not exists idx_screenshots_report_id on screenshots(report_id);
create index if not exists idx_report_modules_report_id on report_modules(report_id);
create index if not exists idx_reports_status on reports(status);
create index if not exists idx_reports_created_at on reports(created_at desc);

-- Enable realtime for report_modules (for progress tracking)
alter publication supabase_realtime add table report_modules;
