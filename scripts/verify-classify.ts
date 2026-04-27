import { classifyMeeting } from '@/lib/classify-meeting';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

check('interview title', classifyMeeting({
  title: 'Kirk Byrens — Operations Officer 2nd Interview',
  attendees: [{ email: 'kirk@example.com', name: 'Kirk' }, { email: 'peter@example.com', name: 'Peter' }],
  companyId: null,
  hasPriorOccurrence: false,
}) === 'interview');

check('recurring (has prior)', classifyMeeting({
  title: 'Daily Pipeline Updates',
  attendees: [],
  companyId: null,
  hasPriorOccurrence: true,
}) === 'recurring');

check('1:1 by colon notation', classifyMeeting({
  title: 'Peter 1:1 with Jon',
  attendees: [],
  companyId: null,
  hasPriorOccurrence: false,
}) === 'one_on_one');

check('1:1 by slash and 2 attendees', classifyMeeting({
  title: 'Peter / Jon',
  attendees: [{ email: 'p@x', name: 'P' }, { email: 'j@x', name: 'J' }],
  companyId: null,
  hasPriorOccurrence: false,
}) === 'one_on_one');

check('external_meeting (companyId set, no other signal)', classifyMeeting({
  title: 'TCC Marketing/Lead Gen Discussion',
  attendees: [],
  companyId: 'abc-123',
  hasPriorOccurrence: false,
}) === 'external_meeting');

check('general fallback', classifyMeeting({
  title: 'Random thing',
  attendees: [],
  companyId: null,
  hasPriorOccurrence: false,
}) === 'general');

console.log(failures === 0 ? '\nALL OK' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
