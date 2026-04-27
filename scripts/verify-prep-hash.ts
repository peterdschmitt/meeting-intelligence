import { hashPrepContext } from '@/lib/prep-hash';
import type { PrepContext } from '@/lib/prep-context';

function ctx(overrides: Partial<PrepContext> = {}): PrepContext {
  return {
    type: 'recurring',
    meeting: { id: 'm1', title: 'Daily Sync', cleanedTitle: 'Daily Sync', startAt: new Date('2026-04-27T15:00:00Z'), endAt: null },
    attendees: [{ name: 'Alice', email: 'alice@x.com', roleAtMeeting: null }, { name: 'Bob', email: 'bob@x.com', roleAtMeeting: null }],
    attendeeContacts: [],
    priorOccurrence: null,
    openActions: { peter: [], external: [] },
    company: null,
    priorMeetings: [],
    ...overrides,
  };
}

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

const a = ctx();
const b = ctx();
check('identical contexts → identical hash', hashPrepContext(a) === hashPrepContext(b));

const reorderedAttendees = ctx({
  attendees: [{ name: 'Bob', email: 'bob@x.com', roleAtMeeting: null }, { name: 'Alice', email: 'alice@x.com', roleAtMeeting: null }],
});
check('reordered attendees → identical hash', hashPrepContext(a) === hashPrepContext(reorderedAttendees));

const newAttendee = ctx({
  attendees: [...a.attendees, { name: 'Carol', email: 'carol@x.com', roleAtMeeting: null }],
});
check('added attendee → different hash', hashPrepContext(a) !== hashPrepContext(newAttendee));

const newAction = ctx({
  openActions: { peter: [{ title: 'follow up', assignee: 'peter', dueDate: null, urgencyTier: 'none' }], external: [] },
});
check('added action item → different hash', hashPrepContext(a) !== hashPrepContext(newAction));

console.log(failures === 0 ? '\nALL OK' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
