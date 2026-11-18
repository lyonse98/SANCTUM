/**
 * The come-home texts (Erik, Nov 18, 2026): seven short welcomes, one for
 * each day of the return path a recipient walks after opening a
 * "Bring someone home" link. They are static, hand-authored words — no
 * model writes to someone at this door. Each is short (60–110 words),
 * anchored to a line of Scripture in public-domain phrasing, warm, and
 * free of guilt and pressure: nothing here counts an absence, names a
 * failing, or asks for an account of the years. Each day ends by
 * pointing gently toward Sunday Mass, and the seventh day hands the
 * reader onward — to a parish, and to the app itself if they want it.
 */
export interface ComeHomeDay {
  /** The day's name, in the printed voice. */
  title: string;
  /** The day's anchor — public-domain Scripture phrasing, quoted exactly. */
  scripture: string;
  /** Where the anchor stands. */
  citation: string;
  /** The welcome itself, 60–110 words. */
  body: string;
}

export const COME_HOME_DAYS: ComeHomeDay[] = [
  {
    title: 'Welcome home',
    scripture: 'Come to me, all you who labor and are heavily burdened, and I will give you rest.',
    citation: 'Matthew 11:28',
    body: 'However long it has been, and whatever has filled the years between, you are welcome here. Nothing is required of you to begin — no explanation, no apology rehearsed in advance. The Church has kept a place for you the whole time, the way a family keeps a chair at the table. This week, walk with us a little: one short reading each day, nothing more asked. And when Sunday comes, consider slipping into a pew near the back. You will not be a stranger there. You will be someone who came home.',
  },
  {
    title: 'The father who runs',
    scripture: 'I will arise and go to my father.',
    citation: 'Luke 15:18',
    body: 'There is a story Jesus told about a son who came home expecting a lecture, or worse — a place among the hired hands. He had his speech ready. His father never let him finish it: he saw him while he was still far off, and ran. That is the picture Jesus himself gives of God\u2019s heart toward anyone who turns around. You do not have to earn your way back step by step. You only have to start walking. The road home is shorter than it feels from far away — and Sunday\u2019s Mass is closer than you think.',
  },
  {
    title: 'A knock at the door',
    scripture: 'Behold, I stand at the door and knock.',
    citation: 'Revelation 3:20',
    body: 'Faith does not begin with having everything figured out. It begins with a knock answered — often hesitantly, often with a mess still on the other side of the door. God is not waiting for a cleaner version of you before he draws near; he draws near, and the clearing happens in his company. If all you can say today is \u201cI don\u2019t know, but I\u2019m listening,\u201d that is enough for today. Keep listening this week. And on Sunday, the doors of a church near you will be open — literally, and for you.',
  },
  {
    title: 'The shepherd who carries',
    scripture: 'He restores my soul.',
    citation: 'Psalm 23:3',
    body: 'Maybe what carried you away was not rebellion but weariness — life got loud, then busy, then years passed. The shepherd in Jesus\u2019s parable does not scold the sheep that wandered; he goes after it, and carries it home on his shoulders, rejoicing. Being found is not a reward for the strong. It is simply what love does. Let yourself be found a little this week: a few quiet minutes, a Gospel read slowly. And when Sunday comes, let the flock gather around you at Mass. There is a place in it with your name on it.',
  },
  {
    title: 'Nothing is too big',
    scripture: 'Whoever comes to me I will in no way throw out.',
    citation: 'John 6:37',
    body: 'Perhaps one thing in particular keeps you away — something you did, or failed to do, that feels too big to bring into a church. Hear this plainly: there is a sacrament for exactly that, and priests have heard everything you could say, usually before breakfast. Nothing in your past is a surprise to God, and none of it is the end of your story. Confession is not a courtroom; it is a homecoming with the words said out loud. This Sunday, you could simply sit through Mass and let that sink in. The rest can follow.',
  },
  {
    title: 'Come as you are',
    scripture: 'Come, everyone who thirsts, come to the waters.',
    citation: 'Isaiah 55:1',
    body: 'You do not have to become someone else before you come back. The invitation in Scripture never reads \u201cget your life in order, then come\u201d — it reads \u201ccome,\u201d full stop, addressed to the thirsty exactly as they are. Whatever you would bring through the door — the questions, the doubts, the unfinished business — bring it; the Church has room for all of it, and so does her Lord. Tomorrow is Sunday. You could be in a pew in the morning, just as you are, and let that be the whole brave step.',
  },
  {
    title: 'This morning, bread is broken',
    scripture: 'Stay with us, for it is almost evening.',
    citation: 'Luke 24:29',
    body: 'Today is Sunday, and the Church has gathered on this day for two thousand years. Once, two discouraged disciples walked away from everything, and a stranger fell into step beside them, opened the Scriptures, and was made known to them in the breaking of the bread. That breaking of the bread is still happening this morning, in a parish near you. Come and sit with us — nothing will be demanded of you, and no one will single you out. If this week has stirred something in you, Sanctum is here for the days after, too. The door stays open.',
  },
];
