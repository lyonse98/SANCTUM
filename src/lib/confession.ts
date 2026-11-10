import type { Audience } from '@/types';

/**
 * The Confession Guide's examination data — one module so both tracks are tested
 * against the same shape. The commandment structure and doctrine are identical for
 * everyone; what differs is the examination of a life actually lived: the men's
 * set is the original, the women's set adapts the spouse-specific questions, the
 * ninth commandment's traditional address, and the Duties of State (Wife / Mother
 * / Worker beside Husband / Father / Worker). Neither set presumes the state of
 * life — every section sits beside questions anyone can answer.
 */

export interface Commandment {
  num: string;
  title: string;
  questions: string[];
}

export const COMMANDMENTS: Commandment[] = [
  {
    num: 'I',
    title: 'I am the Lord your God; you shall not have strange gods before Me',
    questions: [
      'Have I put anything — work, money, pleasure, sports, politics — above God?',
      'Have I neglected daily prayer or skipped Mass on Sundays?',
      'Have I dabbled in the occult, horoscopes, tarot, or New Age practices?',
      'Have I received Communion in a state of mortal sin?',
    ],
  },
  {
    num: 'II',
    title: 'You shall not take the name of the Lord in vain',
    questions: [
      'Have I used God\'s name carelessly or in anger?',
      'Have I sworn falsely or taken an oath I could not keep?',
      'Have I spoken disrespectfully of holy things?',
    ],
  },
  {
    num: 'III',
    title: 'Remember to keep holy the Lord\'s Day',
    questions: [
      'Have I missed Mass on Sundays or Holy Days without serious reason?',
      'Have I arrived late or left early without need?',
      'Have I done unnecessary work on Sundays that could have been done another day?',
    ],
  },
  {
    num: 'IV',
    title: 'Honor your father and mother',
    questions: [
      'Have I been disobedient or disrespectful to my parents or those in authority?',
      'Have I neglected my family — spouse, children, parents — in their needs?',
      'Have I failed to lead my household in faith?',
    ],
  },
  {
    num: 'V',
    title: 'You shall not kill',
    questions: [
      'Have I held hatred or grudges against anyone?',
      'Have I caused physical or emotional harm to another?',
      'Have I abused alcohol or drugs, or harmed my body?',
      'Have I led anyone into sin through my words or actions?',
    ],
  },
  {
    num: 'VI',
    title: 'You shall not commit adultery',
    questions: [
      'Have I been unfaithful to my spouse in thought, word, or deed?',
      'Have I viewed pornography or engaged in lustful thoughts?',
      'Have I dressed or acted immodestly?',
      'Have I used contraception or supported practices against life?',
    ],
  },
  {
    num: 'VII',
    title: 'You shall not steal',
    questions: [
      'Have I stolen or damaged property belonging to others?',
      'Have I cheated in business or failed to pay debts?',
      'Have I been greedy or failed to share with those in need?',
      'Have I wasted time or resources at work?',
    ],
  },
  {
    num: 'VIII',
    title: 'You shall not bear false witness',
    questions: [
      'Have I lied, gossiped, or spread rumors?',
      'Have I damaged someone\'s reputation through my words?',
      'Have I failed to defend the truth when I should have?',
      'Have I been a hypocrite — professing one thing and living another?',
    ],
  },
  {
    num: 'IX',
    title: 'You shall not covet your neighbor\'s wife',
    questions: [
      'Have I entertained lustful thoughts about another person?',
      'Have I been jealous of others\' marriages or relationships?',
      'Have I failed to guard my eyes and imagination?',
    ],
  },
  {
    num: 'X',
    title: 'You shall not covet your neighbor\'s goods',
    questions: [
      'Have I been envious of what others have?',
      'Have I been greedy or discontented with what God has given me?',
      'Have I failed to be generous with my resources?',
    ],
  },
];

/** Women's overrides by commandment number — everything not listed is shared verbatim. */
const COMMANDMENT_OVERRIDES_WOMEN: Record<string, Partial<Commandment>> = {
  IV: {
    questions: [
      'Have I been disobedient or disrespectful to my parents or those in authority?',
      'Have I neglected my family — spouse, children, parents — in their needs?',
      'Have I failed to nurture the faith of my household?',
    ],
  },
  IX: {
    title: 'You shall not covet your neighbor\'s husband',
  },
};

export const COMMANDMENTS_WOMEN: Commandment[] = COMMANDMENTS.map((cmd) => {
  const override = COMMANDMENT_OVERRIDES_WOMEN[cmd.num];
  return override ? { ...cmd, ...override } : cmd;
});

export function getCommandments(audience: Audience): Commandment[] {
  return audience === 'women' ? COMMANDMENTS_WOMEN : COMMANDMENTS;
}

export interface DutyOfState {
  label: string;
  questions: string[];
}

export const DUTIES_OF_STATE: DutyOfState[] = [
  { label: 'As a Husband', questions: [
    'Have I loved my wife sacrificially, as Christ loved the Church?',
    'Have I led my family in prayer and faith?',
    'Have I been patient, or have I been harsh or controlling?',
  ]},
  { label: 'As a Father', questions: [
    'Have I been present with my children — not just physically, but emotionally?',
    'Have I taught them the faith by word and example?',
    'Have I disciplined with love, not anger?',
  ]},
  { label: 'As a Worker', questions: [
    'Have I worked diligently, as for the Lord and not for men?',
    'Have I been honest in my dealings?',
    'Have I let work become an idol at the expense of family and faith?',
  ]},
];

export const DUTIES_OF_STATE_WOMEN: DutyOfState[] = [
  { label: 'As a Wife', questions: [
    'Have I loved my husband with patience and respect, even when it costs me?',
    'Have I prayed for my husband — truly prayed, not only worried about him?',
    'Have I been gentle and honest, or have I been harsh, contemptuous, or controlling?',
  ]},
  { label: 'As a Mother', questions: [
    'Have I been present with my children — not just physically, but emotionally?',
    'Have I taught them the faith by word and example?',
    'Have I disciplined with love, not anger or exasperation?',
  ]},
  { label: 'As a Worker', questions: [
    'Have I worked diligently, as for the Lord and not for human approval?',
    'Have I been honest in my dealings?',
    'Have I let work become an idol at the expense of family and faith?',
  ]},
];

export function getDutiesOfState(audience: Audience): DutyOfState[] {
  return audience === 'women' ? DUTIES_OF_STATE_WOMEN : DUTIES_OF_STATE;
}
