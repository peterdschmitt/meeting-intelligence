export type MeetingType = 'recurring' | 'interview' | 'one_on_one' | 'external_meeting' | 'general';

export interface ClassifierInput {
  title: string;             // cleaned (prefixes stripped)
  attendees: { email: string; name: string }[];
  companyId: string | null;
  hasPriorOccurrence: boolean;
}

export function classifyMeeting(input: ClassifierInput): MeetingType {
  const lower = input.title.toLowerCase();

  if (/\binterview\b/.test(lower)) return 'interview';

  if (input.hasPriorOccurrence) return 'recurring';

  // 1:1 detection: explicit "1:1", or " / " between two names, or exactly 2 attendees
  if (/\b1\s*[:x/]\s*1\b/.test(lower) || /\s\/\s/.test(input.title)) return 'one_on_one';
  if (input.attendees.length === 2) return 'one_on_one';

  if (input.companyId) return 'external_meeting';

  return 'general';
}
