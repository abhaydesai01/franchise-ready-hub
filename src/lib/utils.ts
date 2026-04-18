import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString();
}

export function getScoreTier(score: number): { label: string; bgColor: string; textColor: string } {
  if (score >= 90) return { label: 'Ready', bgColor: '#C8102E', textColor: '#FFFFFF' };
  if (score >= 70) return { label: 'Good', bgColor: '#EDFAF3', textColor: '#0D4D28' };
  if (score >= 40) return { label: 'Fair', bgColor: '#FEF9C3', textColor: '#854D0E' };
  return { label: 'Weak', bgColor: '#FEE2E2', textColor: '#B91C1C' };
}

export function getTrackColors(track: string): { bg: string; border: string; text: string } {
  switch (track) {
    case 'Not Ready': return { bg: '#FFF3E0', border: '#D4882A', text: '#7A4D00' };
    case 'Franchise Ready': return { bg: '#EDFAF3', border: '#1B8A4A', text: '#0D4D28' };
    case 'Recruitment Only': return { bg: '#E8F0FD', border: '#1A5CB8', text: '#0C3570' };
    default: return { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' };
  }
}

export function getStatusColors(status: string): { bg: string; text: string } {
  switch (status) {
    case 'New': return { bg: '#EEF2FF', text: '#4338CA' };
    case 'Scoring': return { bg: '#FEF9C3', text: '#854D0E' };
    case 'Nurture': return { bg: '#FFF3E0', text: '#7A4D00' };
    case 'Active': return { bg: '#EDFAF3', text: '#0D4D28' };
    case 'Signed': return { bg: '#F0FDF4', text: '#14532D' };
    case 'Dead': return { bg: '#F1F5F9', text: '#475569' };
    case 'Draft': return { bg: '#F1F5F9', text: '#475569' };
    case 'Sent': return { bg: '#E8F0FD', text: '#1A5CB8' };
    case 'Opened': return { bg: '#FEF9C3', text: '#854D0E' };
    case 'Rejected': return { bg: '#FEE2E2', text: '#B91C1C' };
    case 'Pending': return { bg: '#F1F5F9', text: '#475569' };
    case 'Failed': return { bg: '#FEE2E2', text: '#B91C1C' };
    case 'In Progress': return { bg: '#FEF9C3', text: '#854D0E' };
    case 'Complete': return { bg: '#EDFAF3', text: '#0D4D28' };
    default: return { bg: '#F1F5F9', text: '#475569' };
  }
}

export function getProgramColors(program: string): { bg: string; text: string } {
  switch (program) {
    case 'Franchise Ready': return { bg: '#EDFAF3', text: '#0D4D28' };
    case 'Franchise Launch': return { bg: '#E8F0FD', text: '#0C3570' };
    case 'Franchise Performance': return { bg: '#FDEAED', text: '#7A1F2E' };
    default: return { bg: '#F1F5F9', text: '#475569' };
  }
}

export function getActivityIcon(type: string): { icon: string; bgColor: string } {
  switch (type) {
    case 'lead_added': return { icon: 'UserPlus', bgColor: '#EEF2FF' };
    case 'stage_changed': return { icon: 'ArrowRight', bgColor: '#FFF3E0' };
    case 'wa_sent': return { icon: 'MessageCircle', bgColor: '#EDFAF3' };
    case 'email_opened': return { icon: 'Mail', bgColor: '#E8F0FD' };
    case 'call_booked': return { icon: 'Phone', bgColor: '#FEF9C3' };
    case 'call_cancelled': return { icon: 'Phone', bgColor: '#FEE2E2' };
    case 'call_rescheduled': return { icon: 'Phone', bgColor: '#E0F2FE' };
    case 'proposal_sent': return { icon: 'FileText', bgColor: '#FDEAED' };
    case 'client_signed': return { icon: 'Trophy', bgColor: '#C8102E' };
    case 'note_added': return { icon: 'StickyNote', bgColor: '#F1F5F9' };
    default: return { icon: 'Circle', bgColor: '#F1F5F9' };
  }
}
