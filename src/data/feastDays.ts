import { getAdventStart, getEasterDate } from '@/data/liturgicalCalendar';

/** The eight liturgical colours of the Roman rite. */
export type LiturgicalColor = 'white' | 'gold' | 'red' | 'green' | 'violet' | 'rose' | 'black' | 'blue';

export type FeastRank = 'solemnity' | 'feast' | 'memorial';

export interface FeastDay {
  name: string;
  rank: FeastRank;
  color: LiturgicalColor;
  /** Short line describing what the day celebrates. */
  note: string;
  glyph: string;
  motif: string;
}

export interface ColorPalette {
  accent: string;
  accentBright: string;
  accentDark: string;
  tint: string;
}

/** Deep, saturated renderings of each liturgical colour — built for the parchment background. */
export const COLOR_PALETTES: Record<LiturgicalColor, ColorPalette> = {
  white: { accent: '#8C6A1F', accentBright: '#B08A2E', accentDark: '#6B4F15', tint: '140,106,31' },
  gold: { accent: '#A67C1A', accentBright: '#C9A02E', accentDark: '#7E5C10', tint: '166,124,26' },
  red: { accent: '#A31F1F', accentBright: '#C72E2E', accentDark: '#7E1616', tint: '163,31,31' },
  green: { accent: '#1E6B3A', accentBright: '#2A8A4E', accentDark: '#15502B', tint: '30,107,58' },
  violet: { accent: '#5E2A6B', accentBright: '#7A3F8A', accentDark: '#451E52', tint: '94,42,107' },
  rose: { accent: '#B0526B', accentBright: '#CE6E88', accentDark: '#8C3F52', tint: '176,82,107' },
  black: { accent: '#3A3A42', accentBright: '#54545E', accentDark: '#26262C', tint: '58,58,66' },
  blue: { accent: '#2A4E8C', accentBright: '#3F6BB0', accentDark: '#1E3A68', tint: '42,78,140' },
};

/** Fixed-date feasts, keyed MM-DD. */
export const FIXED_FEASTS: Record<string, FeastDay> = {
  '01-01': { name: 'Mary, Mother of God', rank: 'solemnity', color: 'white', note: 'The octave day of Christmas, honouring the woman who bore God.', glyph: '✦', motif: 'crown and lilies' },
  '01-06': { name: 'Epiphany', rank: 'solemnity', color: 'white', note: 'The Magi arrive, and the Light shines on every nation.', glyph: '✦', motif: 'journeying star' },
  '01-17': { name: 'St. Anthony of the Desert', rank: 'memorial', color: 'white', note: 'The first monk, who found God in the silence of the desert.', glyph: '✝', motif: 'desert cell' },
  '01-20': { name: 'St. Sebastian', rank: 'memorial', color: 'red', note: 'A soldier who would not renounce his faith.', glyph: '✝', motif: 'arrows and laurel' },
  '01-24': { name: 'St. Francis de Sales', rank: 'memorial', color: 'white', note: 'The gentle bishop who taught holiness to ordinary people.', glyph: '❦', motif: 'open book' },
  '01-28': { name: 'St. Thomas Aquinas', rank: 'memorial', color: 'white', note: 'The theologian who married faith and reason.', glyph: '☀', motif: 'sun and dove' },
  '02-02': { name: 'Presentation of the Lord', rank: 'feast', color: 'white', note: 'The Child is carried into the Temple — the Light meets His people.', glyph: '☀', motif: 'candlemas' },
  '02-03': { name: 'St. Blaise', rank: 'memorial', color: 'red', note: 'Bishop and martyr, protector of the throat.', glyph: '✝', motif: 'candles crossed' },
  '02-11': { name: 'Our Lady of Lourdes', rank: 'memorial', color: 'blue', note: 'Mary appears to a poor girl in a grotto and opens a spring.', glyph: '❧', motif: 'grotto spring' },
  '02-14': { name: 'St. Valentine', rank: 'memorial', color: 'red', note: 'The martyr who married lovers at the cost of his life.', glyph: '❦', motif: 'bound hearts' },
  '03-17': { name: 'St. Patrick', rank: 'feast', color: 'green', note: 'The slave who returned to convert the nation that had taken him.', glyph: '☘', motif: 'shamrock' },
  '03-19': { name: 'St. Joseph', rank: 'solemnity', color: 'white', note: 'The quiet carpenter, protector of the Redeemer.', glyph: '❧', motif: 'carpenter\'s square' },
  '03-25': { name: 'The Annunciation', rank: 'solemnity', color: 'white', note: 'The angel speaks, and Mary says yes — and God becomes man.', glyph: '✦', motif: 'lily of Nazareth' },
  '04-23': { name: 'St. George', rank: 'memorial', color: 'red', note: 'The soldier-martyr who chose death over compromise.', glyph: '✝', motif: 'red cross banner' },
  '04-25': { name: 'St. Mark', rank: 'feast', color: 'red', note: 'The evangelist who quit and came back.', glyph: '❦', motif: 'winged lion' },
  '04-29': { name: 'St. Catherine of Siena', rank: 'memorial', color: 'white', note: 'The mystic who spoke truth to popes.', glyph: '✦', motif: 'crown of thorns and lily' },
  '05-13': { name: 'Our Lady of Fatima', rank: 'memorial', color: 'blue', note: 'Mary appears to three shepherd children with a call to prayer.', glyph: '✦', motif: 'sun and rosary' },
  '05-15': { name: 'St. Isidore the Farmer', rank: 'memorial', color: 'green', note: 'The labourer who prayed while he plowed.', glyph: '❧', motif: 'plough and wheat' },
  '05-22': { name: 'St. Rita of Cascia', rank: 'memorial', color: 'white', note: 'Wife, mother, widow, nun — and saint of the impossible.', glyph: '❦', motif: 'rose and thorn' },
  '06-13': { name: 'St. Anthony of Padua', rank: 'memorial', color: 'white', note: 'The preacher and finder of what is lost.', glyph: '❦', motif: 'lily and book' },
  '06-24': { name: 'Nativity of John the Baptist', rank: 'solemnity', color: 'white', note: 'The forerunner is born — the voice crying in the wilderness.', glyph: '☀', motif: 'wilderness reed' },
  '06-29': { name: 'Sts. Peter and Paul', rank: 'solemnity', color: 'red', note: 'The rock and the firebrand — two flawed men who built the Church.', glyph: '✝', motif: 'crossed keys and sword' },
  '07-11': { name: 'St. Benedict', rank: 'feast', color: 'white', note: 'The father of Western monasticism — prayer and work.', glyph: '✝', motif: 'rule and cross' },
  '07-14': { name: 'St. Camillus de Lellis', rank: 'memorial', color: 'white', note: 'The gambling soldier who became a servant of the sick.', glyph: '✚', motif: 'red cross of service' },
  '07-16': { name: 'Our Lady of Mount Carmel', rank: 'memorial', color: 'blue', note: 'The scapular, and Mary\'s protection for those who serve.', glyph: '✦', motif: 'scapular and star' },
  '07-22': { name: 'St. Mary Magdalene', rank: 'feast', color: 'white', note: 'The first witness of the Resurrection — the apostle to the apostles.', glyph: '✦', motif: 'empty tomb' },
  '07-25': { name: 'St. James', rank: 'feast', color: 'red', note: 'The first apostle to be martyred.', glyph: '✝', motif: 'pilgrim shell' },
  '07-31': { name: 'St. Ignatius of Loyola', rank: 'memorial', color: 'white', note: 'The soldier who was broken and rebuilt into a founder.', glyph: '☀', motif: 'banner of the exercises' },
  '08-04': { name: 'St. John Vianney', rank: 'memorial', color: 'white', note: 'The country priest who heard confessions for eighteen hours a day.', glyph: '✝', motif: 'confessional lamp' },
  '08-08': { name: 'St. Dominic', rank: 'memorial', color: 'white', note: 'The founder of the preachers, who gave us the Rosary.', glyph: '✦', motif: 'dog and torch' },
  '08-10': { name: 'St. Lawrence', rank: 'feast', color: 'red', note: 'The deacon who joked on the gridiron.', glyph: '✝', motif: 'gridiron and flame' },
  '08-11': { name: 'St. Clare of Assisi', rank: 'memorial', color: 'white', note: 'The noblewoman who fled to follow Francis.', glyph: '✦', motif: 'monstrance and light' },
  '08-14': { name: 'St. Maximilian Kolbe', rank: 'memorial', color: 'red', note: 'The friar who took a stranger\'s place at Auschwitz.', glyph: '✝', motif: 'crown of thorns and lily' },
  '08-15': { name: 'The Assumption', rank: 'solemnity', color: 'white', note: 'Mary is taken up — the first fruits of the Resurrection.', glyph: '✦', motif: 'queen crowned in light' },
  '08-20': { name: 'St. Bernard of Clairvaux', rank: 'memorial', color: 'white', note: 'The abbot of tears and fire.', glyph: '❦', motif: 'honeycomb and lily' },
  '08-25': { name: 'St. Louis IX', rank: 'memorial', color: 'white', note: 'The king who washed the feet of the poor.', glyph: '✦', motif: 'crown and oak' },
  '08-28': { name: 'St. Augustine', rank: 'memorial', color: 'white', note: 'The restless heart that finally found its rest.', glyph: '☀', motif: 'burning heart and book' },
  '09-03': { name: 'St. Gregory the Great', rank: 'memorial', color: 'white', note: 'The monk made pope against his will.', glyph: '❦', motif: 'dove and scroll' },
  '09-05': { name: 'St. Teresa of Calcutta', rank: 'memorial', color: 'white', note: 'The nun who served Christ in the dying of the streets.', glyph: '❧', motif: 'sari and lamp' },
  '09-14': { name: 'Exaltation of the Holy Cross', rank: 'feast', color: 'red', note: 'The instrument of death becomes the tree of life.', glyph: '✝', motif: 'glorified cross' },
  '09-15': { name: 'Our Lady of Sorrows', rank: 'memorial', color: 'white', note: 'The mother who stood at the foot of the cross.', glyph: '✝', motif: 'seven sorrows' },
  '09-21': { name: 'St. Matthew', rank: 'feast', color: 'red', note: 'The tax collector called from the counting table.', glyph: '❦', motif: 'ledger and quill' },
  '09-23': { name: 'St. Padre Pio', rank: 'memorial', color: 'white', note: 'Pray, hope, and don\'t worry.', glyph: '✝', motif: 'stigmata and prayer' },
  '09-29': { name: 'Sts. Michael, Gabriel & Raphael', rank: 'feast', color: 'white', note: 'The archangels — warriors, messengers, and healers.', glyph: '✦', motif: 'archangels\' wings' },
  '10-01': { name: 'St. Thérèse of Lisieux', rank: 'memorial', color: 'white', note: 'The Little Way — great love in small things.', glyph: '❦', motif: 'shower of roses' },
  '10-02': { name: 'Guardian Angels', rank: 'memorial', color: 'white', note: 'The unseen companions given to every soul.', glyph: '✦', motif: 'sheltering wing' },
  '10-04': { name: 'St. Francis of Assisi', rank: 'feast', color: 'white', note: 'The rich man who stripped himself bare for Christ.', glyph: '❧', motif: 'wolf and birds' },
  '10-05': { name: 'St. Faustina Kowalska', rank: 'memorial', color: 'white', note: 'The apostle of Divine Mercy.', glyph: '✦', motif: 'rays of mercy' },
  '10-07': { name: 'Our Lady of the Rosary', rank: 'memorial', color: 'white', note: 'The beads that hold the whole Gospel.', glyph: '✦', motif: 'rosary crown' },
  '10-15': { name: 'St. Teresa of Avila', rank: 'memorial', color: 'white', note: 'Let nothing disturb you. God never changes.', glyph: '✦', motif: 'interior castle' },
  '10-18': { name: 'St. Luke', rank: 'feast', color: 'red', note: 'The physician and evangelist of the merciful heart.', glyph: '❦', motif: 'winged ox and scroll' },
  '10-19': { name: 'Sts. Jean de Brébeuf & Isaac Jogues', rank: 'memorial', color: 'red', note: 'The Jesuit martyrs who carried the Gospel to North America.', glyph: '✝', motif: 'cross and canoe' },
  '10-22': { name: 'St. John Paul II', rank: 'memorial', color: 'white', note: 'Be not afraid.', glyph: '✦', motif: 'cross and compass' },
  '10-28': { name: 'Sts. Simon and Jude', rank: 'feast', color: 'red', note: 'Jude, the patron of lost causes.', glyph: '✝', motif: 'axe and flame' },
  '11-01': { name: 'All Saints', rank: 'solemnity', color: 'white', note: 'The whole cloud of witnesses — known and unknown.', glyph: '✦', motif: 'cloud of witnesses' },
  '11-02': { name: 'All Souls', rank: 'solemnity', color: 'black', note: 'We pray for the faithful departed. Love is stronger than death.', glyph: '✝', motif: 'candles and remembrance' },
  '11-03': { name: 'St. Martin de Porres', rank: 'memorial', color: 'white', note: 'The lay brother of radical humility.', glyph: '❧', motif: 'broom and cross' },
  '11-11': { name: 'St. Martin of Tours', rank: 'memorial', color: 'white', note: 'He cut his cloak in half for a beggar who was Christ.', glyph: '❦', motif: 'divided cloak' },
  '11-22': { name: 'St. Cecilia', rank: 'memorial', color: 'red', note: 'The martyr who sang to God in her heart.', glyph: '❦', motif: 'lyre and crown' },
  '11-30': { name: 'St. Andrew', rank: 'feast', color: 'red', note: 'The first called, who preached from his own cross.', glyph: '✝', motif: 'saltire cross' },
  '12-03': { name: 'St. Francis Xavier', rank: 'memorial', color: 'white', note: 'The missionary who baptized nations.', glyph: '✦', motif: 'crab and crucifix' },
  '12-06': { name: 'St. Nicholas', rank: 'memorial', color: 'white', note: 'The bishop who gave in secret and struck at heresy.', glyph: '❦', motif: 'three golden balls' },
  '12-08': { name: 'The Immaculate Conception', rank: 'solemnity', color: 'blue', note: 'Mary, preserved from sin from the first moment.', glyph: '✦', motif: 'woman clothed with the sun' },
  '12-12': { name: 'Our Lady of Guadalupe', rank: 'feast', color: 'blue', note: 'The Mother who left her image on a poor man\'s cloak.', glyph: '✦', motif: 'tilma of roses' },
  '12-13': { name: 'St. Lucy', rank: 'memorial', color: 'red', note: 'Her name means light — and she died for it.', glyph: '☀', motif: 'candles and eyes' },
  '12-14': { name: 'St. John of the Cross', rank: 'memorial', color: 'white', note: 'The dark night is not the absence of God.', glyph: '☾', motif: 'dark night and poem' },
  '12-25': { name: 'The Nativity of the Lord', rank: 'solemnity', color: 'gold', note: 'The Word became flesh and dwelt among us.', glyph: '✦', motif: 'nativity star' },
  '12-26': { name: 'St. Stephen', rank: 'feast', color: 'red', note: 'The first martyr, who forgave his killers as he died.', glyph: '✝', motif: 'stones and palms' },
  '12-27': { name: 'St. John the Evangelist', rank: 'feast', color: 'white', note: 'The beloved disciple, the apostle of love.', glyph: '❦', motif: 'eagle and chalice' },
  '12-28': { name: 'The Holy Innocents', rank: 'feast', color: 'red', note: 'The children who died in Christ\'s place.', glyph: '✝', motif: 'palms of the innocent' },
};

/** Moveable feasts, resolved from Easter and Advent each year. */
interface MoveableFeast extends FeastDay {
  /** Days from Easter Sunday (negative = before). */
  easterOffset?: number;
  /** Sunday of Advent (1-4). */
  adventSunday?: number;
}

const MOVEABLE_FEASTS: MoveableFeast[] = [
  { name: 'Ash Wednesday', rank: 'feast', color: 'violet', note: 'Remember that you are dust, and to dust you shall return.', glyph: '✝', motif: 'ashes and sackcloth', easterOffset: -46 },
  { name: 'Palm Sunday', rank: 'solemnity', color: 'red', note: 'The King enters His city to the sound of palms.', glyph: '❧', motif: 'palms and donkey', easterOffset: -7 },
  { name: 'Holy Thursday', rank: 'solemnity', color: 'white', note: 'The Last Supper — the night the Eucharist was given.', glyph: '✦', motif: 'chalice and basin', easterOffset: -3 },
  { name: 'Good Friday', rank: 'solemnity', color: 'red', note: 'The Son of God dies for the sins of the world.', glyph: '✝', motif: 'crucifix and nails', easterOffset: -2 },
  { name: 'Holy Saturday', rank: 'solemnity', color: 'violet', note: 'The silence of the tomb, and the harrowing of hell.', glyph: '☾', motif: 'sealed tomb', easterOffset: -1 },
  { name: 'Easter Sunday', rank: 'solemnity', color: 'gold', note: 'He is risen. Death has been defeated.', glyph: '☀', motif: 'empty tomb and light', easterOffset: 0 },
  { name: 'Divine Mercy Sunday', rank: 'solemnity', color: 'white', note: 'The ocean of mercy opened by the risen Christ.', glyph: '✦', motif: 'rays of mercy', easterOffset: 7 },
  { name: 'The Ascension', rank: 'solemnity', color: 'white', note: 'He is taken up, and sends us out.', glyph: '☀', motif: 'ascending cloud', easterOffset: 39 },
  { name: 'Pentecost', rank: 'solemnity', color: 'red', note: 'The Spirit descends in fire and the Church is born.', glyph: '✦', motif: 'tongues of flame', easterOffset: 49 },
  { name: 'Trinity Sunday', rank: 'solemnity', color: 'white', note: 'One God in three persons — the mystery of love.', glyph: '✦', motif: 'triquetra', easterOffset: 56 },
  { name: 'Corpus Christi', rank: 'solemnity', color: 'white', note: 'The Body and Blood of Christ, carried through the streets.', glyph: '☀', motif: 'monstrance procession', easterOffset: 63 },
  { name: 'The Sacred Heart', rank: 'solemnity', color: 'white', note: 'The heart of Christ, burning with love for men.', glyph: '❦', motif: 'flaming heart', easterOffset: 68 },
  { name: 'Gaudete Sunday', rank: 'feast', color: 'rose', note: 'Rejoice — the Lord is near.', glyph: '✦', motif: 'rose candle', adventSunday: 3 },
  { name: 'Laetare Sunday', rank: 'feast', color: 'rose', note: 'Rejoice, Jerusalem — halfway through the desert.', glyph: '✦', motif: 'rose of Jerusalem', easterOffset: -21 },
  { name: 'Christ the King', rank: 'solemnity', color: 'white', note: 'The King of the universe, crowned with thorns.', glyph: '✦', motif: 'crown and sceptre', adventSunday: 0 },
];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * The feast or solemnity celebrated on a given date, or null on an ordinary day.
 * Moveable feasts (Easter cycle, Advent cycle) are resolved for the year first.
 */
export function getFeastForDate(date: Date = new Date()): FeastDay | null {
  const year = date.getFullYear();
  const easter = getEasterDate(year);
  const adventStart = getAdventStart(year);

  for (const feast of MOVEABLE_FEASTS) {
    if (feast.easterOffset !== undefined) {
      if (sameDay(date, addDays(easter, feast.easterOffset))) return feast;
    } else if (feast.adventSunday !== undefined) {
      // adventSunday 1-4 = that Sunday of Advent; 0 = Christ the King, the Sunday before Advent.
      const offset = feast.adventSunday === 0 ? -7 : (feast.adventSunday - 1) * 7;
      if (sameDay(date, addDays(adventStart, offset))) return feast;
    }
  }

  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return FIXED_FEASTS[mmdd] ?? null;
}
