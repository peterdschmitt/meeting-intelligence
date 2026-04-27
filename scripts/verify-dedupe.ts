import { dedupeEvents, fuzzyTitleMatch, isLikelyDuplicate } from '@/lib/dedupe';
import type { ParsedIcsEvent } from '@/lib/ics';

function ev(partial: Partial<ParsedIcsEvent>): ParsedIcsEvent {
  return {
    uid: 'u',
    summary: '',
    cleanedSummary: '',
    description: '',
    location: '',
    startAt: new Date('2026-04-27T15:00:00Z'),
    endAt: new Date('2026-04-27T15:30:00Z'),
    attendees: [],
    joinUrl: null,
    platform: null,
    calendarSource: 'conversely',
    ...partial,
  };
}

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

console.log('fuzzyTitleMatch:');
check('fw stripped vs original', fuzzyTitleMatch('True Choice Morning Huddle', 'True Choice Morning Huddle'));
check('partial token overlap > 80%', fuzzyTitleMatch('Operations Officer Interview Kirk', 'Operations Officer Interview Richard'));
check('empty title returns false', !fuzzyTitleMatch('', 'foo'));
check('different meetings dont match', !fuzzyTitleMatch('Pipeline review', 'Engineering retro'));

console.log('isLikelyDuplicate:');
check('same UID', isLikelyDuplicate(ev({ uid: 'a' }), ev({ uid: 'a' })));
check('different UID + same time + fuzzy title', isLikelyDuplicate(
  ev({ uid: 'a', cleanedSummary: 'True Choice Morning Huddle' }),
  ev({ uid: 'b', cleanedSummary: 'True Choice Morning Huddle' }),
));
check('different UID + 30 min apart not dup', !isLikelyDuplicate(
  ev({ uid: 'a', startAt: new Date('2026-04-27T15:00:00Z') }),
  ev({ uid: 'b', startAt: new Date('2026-04-27T15:30:00Z') }),
));

console.log('dedupeEvents priority:');
const result = dedupeEvents([
  ev({ uid: 'cb', cleanedSummary: 'True Choice Morning Huddle', calendarSource: 'cranbrook' }),
  ev({ uid: 'cv', cleanedSummary: 'True Choice Morning Huddle', calendarSource: 'conversely' }),
]);
check('only one survivor', result.length === 1);
check('conversely wins over cranbrook', result[0]?.calendarSource === 'conversely');

console.log('dedupeEvents ordering:');
const ordered = dedupeEvents([
  ev({ uid: 'late', startAt: new Date('2026-04-27T17:00:00Z') }),
  ev({ uid: 'early', startAt: new Date('2026-04-27T09:00:00Z') }),
]);
check('sorted ascending by startAt', ordered[0].uid === 'early');

console.log(failures === 0 ? '\nALL OK' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
