

# Franchise Ready CRM — Full Build Plan

## Overview
Complete internal CRM application with 9 pages, brand design system, mock data layer, and API-ready architecture. Built with React + Vite + React Router (adapted from the Next.js spec to Lovable's stack).

## Design System Setup
- Register all brand color tokens in Tailwind config (crimson, sidebar, surface, card, border, muted, ink, track colors, status pills, score badges)
- Import Inter from Google Fonts
- Apply all typography rules (sidebar labels 11px/500/uppercase, card titles 15px/600, body 14px, headings 22px/700, metrics 32px/700)
- Card style: white, radius 10px, 1px border #E8E6E0, subtle shadow, 24px padding
- Crimson primary buttons, secondary outlined buttons, input focus states

## Layout Shell
- Fixed left sidebar (220px, #1A1A1A) with "Franchise Ready" wordmark logo
- 9 nav items with Lucide icons, active state with crimson left border + tint
- User avatar + logout pinned to bottom
- Top header bar with page title, search, notifications bell, "Add Lead" button
- Responsive: icon-only sidebar on tablet, bottom tab bar on mobile

## API & Data Layer
- `/lib/api.ts` — typed fetch functions for every endpoint in the spec
- `/lib/mockData.ts` — realistic seed data (30+ leads across all tracks/stages, proposals, calls, clients, sequences, notifications)
- `/lib/mockApi.ts` — mock handlers that return seed data with filtering, pagination, and search support, matching the exact API contract
- Custom hooks (`useLeads`, `useLead`, `useDashboard`, `useCalls`, `useProposals`, `useAutomation`, `useClients`) using TanStack Query, pointed at mock handlers now but trivially swappable to real `/api/` endpoints
- TypeScript types for Lead, Proposal, DiscoveryCall, Client, Notification, AutomationStep, TeamMember

## Page 1 — Dashboard `/dashboard`
- 5 metric cards (Total Leads, Not Ready, Franchise Ready, Recruitment Only, Signed Clients) with icons, delta chips
- Conversion funnel (horizontal bars with drop-off percentages)
- Today's agenda (color-coded task list)
- Activity feed (last 20 events, colored icons, relative timestamps)
- Track split donut chart (Recharts PieChart)

## Page 2 — Pipeline `/pipeline` (Core Page)
- Track filter tabs with count chips
- Sort/search toolbar
- 3 track groups (Not Ready: 4 cols, Franchise Ready: 4 cols, Recruitment Only: 1 col)
- Track group headers with colored backgrounds, collapse toggles
- Kanban columns with lead cards — drag-and-drop via @dnd-kit
- Lead cards showing name, score badge, phone, track/stage pills, last activity, duration, 3-dot menu
- Click card → opens Lead Profile drawer

## Page 3 — Leads List `/leads`
- Filterable/searchable data table with all specified columns
- Track/stage/score colored pills
- Bulk actions, CSV export button
- Filter panel (track, stage, score range, date, assigned to, source)
- Pagination with configurable page size

## Page 4 — Lead Profile (Drawer + `/leads/:id`)
- 580px right drawer with sticky header (name, track/stage, action buttons)
- Contact info card, Franchise Score card (5 dimension progress bars), Discovery Call card
- Activity timeline with inline note input
- Automation status card with sequence progress

## Page 5 — Discovery Calls `/calls`
- 3 tabs: Upcoming, Completed, No-Shows
- Upcoming: mini calendar + call list for selected date
- Completed/No-Shows: tables with relevant columns and actions

## Page 6 — Proposals `/proposals`
- Status tabs (All/Draft/Sent/Opened/Signed/Rejected) with counts
- Proposals table with status pills
- Generate Proposal flow: 3-step modal (select lead → review context/program → rich text editor with TipTap)

## Page 7 — Automation `/automation`
- Vertical tabs: Sequences | Activity Log
- Sequence cards with track accent borders, stats, edit button
- Edit Sequence drawer with drag-to-reorder steps (@dnd-kit)
- Activity log table with filters

## Page 8 — Clients `/clients`
- 3 metric cards
- Clients table with program pills, onboarding status bars
- Expandable rows showing referral details

## Page 9 — Settings `/settings`
- Sub-navigation tabs: Pipeline, WA Templates, Email Templates, Team, Integrations
- Score routing threshold sliders
- Template editors with variable chips
- Team management table with invite modal
- Integration cards with connection status and API key inputs

## Global Components
- Add Lead modal (accessible from any page)
- Notification drawer (from bell icon)
- Skeleton loaders (shimmer effect, matching content shapes — no spinners)
- Toast notifications (sonner, styled with colored left borders)
- Confirm dialogs for destructive actions
- Empty states with illustrations per page
- Score badge, Track pill, Stage pill reusable components

## Auth Placeholder
- Simple `/login` page with centered card, brand wordmark, email/password fields
- Auth context checking `isAuthenticated` — redirects to login if not set
- No real auth logic — UI shell only

