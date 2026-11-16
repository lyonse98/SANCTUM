import { getAdventStart, getEasterDate } from '@/data/liturgicalCalendar';

/** The eight liturgical colours of the Roman rite. */
export type LiturgicalColor = 'white' | 'gold' | 'red' | 'green' | 'violet' | 'rose' | 'black' | 'blue';

export type FeastRank = 'solemnity' | 'feast' | 'memorial' | 'optional-memorial';

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
  '01-02': { name: 'Sts. Basil the Great and Gregory Nazianzen', rank: 'memorial', color: 'white', note: 'Two friends of Cappadocia who defended the Trinity and taught the Church to pray.', glyph: '❦', motif: 'two Cappadocian lamps' },
  '01-03': { name: 'The Most Holy Name of Jesus', rank: 'optional-memorial', color: 'white', note: 'The name given by the angel — at its sound every knee bends.', glyph: '✦', motif: 'the name above all names' },
  '01-04': { name: 'St. Elizabeth Ann Seton', rank: 'memorial', color: 'white', note: 'The widow who founded America\'s Catholic schools.', glyph: '❧', motif: 'schoolhouse and widow\'s mite' },
  '01-05': { name: 'St. John Neumann', rank: 'memorial', color: 'white', note: 'The little bishop who built a school system for immigrants.', glyph: '❧', motif: 'schoolrooms of Philadelphia' },
  '01-06': { name: 'Epiphany', rank: 'solemnity', color: 'white', note: 'The Magi arrive, and the Light shines on every nation.', glyph: '✦', motif: 'journeying star' },
  '01-07': { name: 'St. Raymond of Penyafort', rank: 'optional-memorial', color: 'white', note: 'The Dominican who compiled the Church\'s law and guided penitents.', glyph: '❦', motif: 'canon law and confession' },
  '01-13': { name: 'St. Hilary of Poitiers', rank: 'optional-memorial', color: 'white', note: 'The bishop who stood against an empire\'s heresy.', glyph: '❦', motif: 'trinity defended' },
  '01-17': { name: 'St. Anthony of the Desert', rank: 'memorial', color: 'white', note: 'The first monk, who found God in the silence of the desert.', glyph: '✝', motif: 'desert cell' },
  '01-20': { name: 'St. Sebastian', rank: 'memorial', color: 'red', note: 'A soldier who would not renounce his faith.', glyph: '✝', motif: 'arrows and laurel' },
  '01-21': { name: 'St. Agnes', rank: 'memorial', color: 'red', note: 'A child martyr of Rome who chose Christ over every suitor.', glyph: '✝', motif: 'lamb and palm' },
  '01-22': { name: 'St. Vincent', rank: 'optional-memorial', color: 'red', note: 'The deacon of Saragossa who would not surrender the Scriptures.', glyph: '✝', motif: 'palm of the deacon' },
  '01-23': { name: 'St. Marianne Cope', rank: 'optional-memorial', color: 'white', note: 'The Franciscan sister who served the lepers of Hawaii and Molokai.', glyph: '✚', motif: 'mother of the outcasts' },
  '01-24': { name: 'St. Francis de Sales', rank: 'memorial', color: 'white', note: 'The gentle bishop who taught holiness to ordinary people.', glyph: '❦', motif: 'open book' },
  '01-25': { name: 'The Conversion of St. Paul', rank: 'feast', color: 'white', note: 'Saul the persecutor is struck blind by the Light — and rises an apostle.', glyph: '✦', motif: 'light on the Damascus road' },
  '01-26': { name: 'Sts. Timothy and Titus', rank: 'memorial', color: 'white', note: 'Paul\'s own disciples, bishops of Ephesus and Crete, keepers of the deposit.', glyph: '❦', motif: 'letters of Paul' },
  '01-27': { name: 'St. Angela Merici', rank: 'optional-memorial', color: 'white', note: 'The visionary who founded the first teaching order of women.', glyph: '❧', motif: 'schoolroom and candle' },
  '01-28': { name: 'St. Thomas Aquinas', rank: 'memorial', color: 'white', note: 'The theologian who married faith and reason.', glyph: '☀', motif: 'sun and dove' },
  '01-31': { name: 'St. John Bosco', rank: 'memorial', color: 'white', note: 'The priest who raised Turin\'s street boys with reason, religion, and kindness.', glyph: '❧', motif: 'schoolyard and oratory' },
  '02-02': { name: 'Presentation of the Lord', rank: 'feast', color: 'white', note: 'The Child is carried into the Temple — the Light meets His people.', glyph: '☀', motif: 'candlemas' },
  '02-03': { name: 'St. Blaise', rank: 'memorial', color: 'red', note: 'Bishop and martyr, protector of the throat.', glyph: '✝', motif: 'candles crossed' },
  '02-05': { name: 'St. Agatha', rank: 'memorial', color: 'red', note: 'The Sicilian virgin who would not yield, honoured at Catania beneath Etna.', glyph: '✝', motif: 'veil and volcano' },
  '02-06': { name: 'St. Paul Miki and Companions', rank: 'memorial', color: 'red', note: 'Twenty-six crosses on a Nagasaki hill — Japan\'s first martyrs sing on their crosses.', glyph: '✝', motif: 'crosses of Nagasaki' },
  '02-08': { name: 'St. Jerome Emiliani and St. Josephine Bakhita', rank: 'optional-memorial', color: 'white', note: 'A soldier who ransomed orphans, and a slave who forgave her captors.', glyph: '❧', motif: 'orphans and freedom' },
  '02-10': { name: 'St. Scholastica', rank: 'memorial', color: 'white', note: 'Benedict\'s twin, whose tears in prayer outweighed her brother\'s rule.', glyph: '❧', motif: 'dove and storm' },
  '02-11': { name: 'Our Lady of Lourdes', rank: 'memorial', color: 'blue', note: 'Mary appears to a poor girl in a grotto and opens a spring.', glyph: '❧', motif: 'grotto spring' },
  '02-14': { name: 'Sts. Cyril and Methodius', rank: 'memorial', color: 'white', note: 'Two brothers who gave the Slavs an alphabet and the liturgy in their own tongue.', glyph: '❦', motif: 'alphabet of the Slavs' },
  '02-17': { name: 'The Seven Holy Founders of the Servite Order', rank: 'optional-memorial', color: 'white', note: 'Seven Florentine merchants who left everything together to serve Our Lady.', glyph: '❧', motif: 'seven lilies' },
  '02-21': { name: 'St. Peter Damian', rank: 'optional-memorial', color: 'white', note: 'The hermit dragged from his cell to reform a corrupt age.', glyph: '❦', motif: 'hermit and reformer' },
  '02-22': { name: 'The Chair of St. Peter', rank: 'feast', color: 'white', note: 'The chair from which Peter still teaches — the unity of the Church in his office.', glyph: '✦', motif: 'keys and cathedra' },
  '02-23': { name: 'St. Polycarp', rank: 'memorial', color: 'red', note: 'John\'s own disciple, bishop of Smyrna, who at eighty-six would not curse Christ.', glyph: '✝', motif: 'fire of Smyrna' },
  '03-03': { name: 'St. Katharine Drexel', rank: 'optional-memorial', color: 'white', note: 'The Philadelphia heiress who spent her fortune on missions to the marginalized.', glyph: '✦', motif: 'heiress of the missions' },
  '03-04': { name: 'St. Casimir', rank: 'optional-memorial', color: 'white', note: 'The prince of Poland who chose prayer over the pleasures of a court.', glyph: '✦', motif: 'lily of the prince' },
  '03-07': { name: 'Sts. Perpetua and Felicity', rank: 'memorial', color: 'red', note: 'A mother and a slave girl die together at Carthage, and the mother\'s diary survives.', glyph: '✝', motif: 'prison diary and arena' },
  '03-08': { name: 'St. John of God', rank: 'optional-memorial', color: 'white', note: 'The bookseller who carried the sick on his own back.', glyph: '✚', motif: 'hospital and heart' },
  '03-09': { name: 'St. Frances of Rome', rank: 'optional-memorial', color: 'white', note: 'The wife and mother whose home became a hospital.', glyph: '❧', motif: 'lamp in the home' },
  '03-17': { name: 'St. Patrick', rank: 'feast', color: 'green', note: 'The slave who returned to convert the nation that had taken him.', glyph: '☘', motif: 'shamrock' },
  '03-18': { name: 'St. Cyril of Jerusalem', rank: 'optional-memorial', color: 'white', note: 'The bishop whose lectures prepared converts at the holy places.', glyph: '❦', motif: 'catechism of Jerusalem' },
  '03-19': { name: 'St. Joseph', rank: 'solemnity', color: 'white', note: 'The quiet carpenter, protector of the Redeemer.', glyph: '❧', motif: 'carpenter\'s square' },
  '03-23': { name: 'St. Turibius of Mongrovejo', rank: 'optional-memorial', color: 'white', note: 'The archbishop who walked his vast diocese on foot.', glyph: '❧', motif: 'roads of Peru' },
  '03-25': { name: 'The Annunciation', rank: 'solemnity', color: 'white', note: 'The angel speaks, and Mary says yes — and God becomes man.', glyph: '✦', motif: 'lily of Nazareth' },
  '04-02': { name: 'St. Francis of Paola', rank: 'optional-memorial', color: 'white', note: 'The hermit who ate almost nothing and advised kings.', glyph: '❧', motif: 'hermit of Calabria' },
  '04-04': { name: 'St. Isidore of Seville', rank: 'optional-memorial', color: 'white', note: 'The bishop whose encyclopedia preserved the learning of the ancient world.', glyph: '❦', motif: 'encyclopedia of the bishop' },
  '04-05': { name: 'St. Vincent Ferrer', rank: 'optional-memorial', color: 'white', note: 'The Dominican who preached repentance across a divided Europe.', glyph: '☀', motif: 'trumpet of judgment' },
  '04-07': { name: 'St. John Baptist de la Salle', rank: 'memorial', color: 'white', note: 'The priest who gave up his wealth to train teachers for poor boys.', glyph: '❧', motif: 'schoolroom of the poor' },
  '04-11': { name: 'St. Stanislaus', rank: 'memorial', color: 'red', note: 'The bishop slain at the altar by the king he had rebuked.', glyph: '✝', motif: 'altar of Kraków' },
  '04-13': { name: 'St. Martin I', rank: 'optional-memorial', color: 'red', note: 'The pope arrested in his own cathedral and starved in exile.', glyph: '✝', motif: 'exiled pope' },
  '04-23': { name: 'St. George', rank: 'memorial', color: 'red', note: 'The soldier-martyr who chose death over compromise.', glyph: '✝', motif: 'red cross banner' },
  '04-24': { name: 'St. Fidelis of Sigmaringen', rank: 'optional-memorial', color: 'red', note: 'The lawyer who gave up the courtroom and was killed preaching.', glyph: '✝', motif: 'lawyer turned friar' },
  '04-25': { name: 'St. Mark', rank: 'feast', color: 'red', note: 'The evangelist who quit and came back.', glyph: '❦', motif: 'winged lion' },
  '04-28': { name: 'St. Peter Chanel and St. Louis de Montfort', rank: 'optional-memorial', color: 'red', note: 'A missionary martyred on a Pacific island, and the apostle of the Rosary.', glyph: '✝', motif: 'island cross and rosary' },
  '04-29': { name: 'St. Catherine of Siena', rank: 'memorial', color: 'white', note: 'The mystic who spoke truth to popes.', glyph: '✦', motif: 'crown of thorns and lily' },
  '04-30': { name: 'St. Pius V', rank: 'optional-memorial', color: 'white', note: 'The Dominican pope who reformed the Church and prayed at Lepanto.', glyph: '✦', motif: 'white Dominican pope' },
  '05-01': { name: 'St. Joseph the Worker', rank: 'optional-memorial', color: 'white', note: 'The carpenter honoured on the workers\' day — labour made holy.', glyph: '❧', motif: 'workbench of Nazareth' },
  '05-02': { name: 'St. Athanasius', rank: 'memorial', color: 'white', note: 'Five times exiled for the divinity of Christ — Athanasius against the world.', glyph: '❦', motif: 'exile and creed' },
  '05-03': { name: 'Sts. Philip and James', rank: 'feast', color: 'red', note: 'Philip who asked to see the Father, and James who governed Jerusalem.', glyph: '✝', motif: 'two apostles' },
  '05-10': { name: 'St. John of Ávila and St. Damien de Veuster', rank: 'optional-memorial', color: 'white', note: 'The teacher of saints in Spain, and the priest who became one with the lepers of Molokai.', glyph: '✚', motif: 'letters and leper colony' },
  '05-12': { name: 'Sts. Nereus, Achilleus and Pancras', rank: 'optional-memorial', color: 'red', note: 'Roman martyrs of the first persecutions, remembered together.', glyph: '✝', motif: 'palms of Rome' },
  '05-13': { name: 'Our Lady of Fatima', rank: 'memorial', color: 'blue', note: 'Mary appears to three shepherd children with a call to prayer.', glyph: '✦', motif: 'sun and rosary' },
  '05-14': { name: 'St. Matthias', rank: 'feast', color: 'red', note: 'Chosen by lot to fill Judas\' place among the Twelve.', glyph: '✝', motif: 'the lot and the twelve' },
  '05-15': { name: 'St. Isidore the Farmer', rank: 'memorial', color: 'green', note: 'The labourer who prayed while he plowed.', glyph: '❧', motif: 'plough and wheat' },
  '05-18': { name: 'St. John I', rank: 'optional-memorial', color: 'red', note: 'The pope sent to a barbarian king and left to die in prison.', glyph: '✝', motif: 'pope in prison' },
  '05-20': { name: 'St. Bernardine of Siena', rank: 'optional-memorial', color: 'white', note: 'The friar who carried the Name of Jesus through the cities of Italy.', glyph: '☀', motif: 'name of Jesus banner' },
  '05-21': { name: 'St. Christopher Magallanes and Companions', rank: 'optional-memorial', color: 'red', note: 'A Mexican priest and his companions, martyred under persecution.', glyph: '✝', motif: 'palms of Mexico' },
  '05-22': { name: 'St. Rita of Cascia', rank: 'memorial', color: 'white', note: 'Wife, mother, widow, nun — and saint of the impossible.', glyph: '❦', motif: 'rose and thorn' },
  '05-25': { name: 'St. Bede the Venerable, St. Gregory VII and St. Mary Magdalene de\' Pazzi', rank: 'optional-memorial', color: 'white', note: 'A monk who wrote England\'s history, a reforming pope, and a Carmelite mystic.', glyph: '❦', motif: 'scriptorium, tiara and ecstasy' },
  '05-27': { name: 'St. Augustine of Canterbury', rank: 'optional-memorial', color: 'white', note: 'The monk sent by Gregory the Great who became the first Archbishop of Canterbury.', glyph: '✝', motif: 'cross over England' },
  '05-29': { name: 'St. Paul VI', rank: 'optional-memorial', color: 'white', note: 'The pope who closed Vatican II and carried it into the world.', glyph: '✦', motif: 'pilgrim pope' },
  '05-31': { name: 'The Visitation', rank: 'feast', color: 'white', note: 'Mary hurries to Elizabeth, and the child in the womb leaps for joy.', glyph: '✦', motif: 'hill country of Judah' },
  '06-01': { name: 'St. Justin', rank: 'memorial', color: 'red', note: 'The philosopher who found the truth he sought and died for it at Rome.', glyph: '✝', motif: 'philosopher\'s cloak' },
  '06-02': { name: 'Sts. Marcellinus and Peter', rank: 'optional-memorial', color: 'red', note: 'A priest and an exorcist of Rome, martyred together under Diocletian.', glyph: '✝', motif: 'catacomb palms' },
  '06-05': { name: 'St. Boniface', rank: 'memorial', color: 'red', note: 'The apostle of Germany who felled the pagan oak and died under Frisian swords.', glyph: '✝', motif: 'oak of Thor' },
  '06-06': { name: 'St. Norbert', rank: 'optional-memorial', color: 'white', note: 'The courtier struck by lightning who became a wandering preacher and archbishop.', glyph: '✦', motif: 'monstrance and white habit' },
  '06-09': { name: 'St. Ephrem', rank: 'optional-memorial', color: 'white', note: 'The Syrian deacon whose hymns taught the faith by song.', glyph: '❦', motif: 'harp of the Spirit' },
  '06-11': { name: 'St. Barnabas', rank: 'memorial', color: 'red', note: 'The son of encouragement who vouched for Saul and journeyed with Paul.', glyph: '✝', motif: 'field sold and journeys' },
  '06-13': { name: 'St. Anthony of Padua', rank: 'memorial', color: 'white', note: 'The preacher and finder of what is lost.', glyph: '❦', motif: 'lily and book' },
  '06-19': { name: 'St. Romuald', rank: 'optional-memorial', color: 'white', note: 'The restless abbot who founded hermitages and never stayed to enjoy them.', glyph: '❧', motif: 'ladder to heaven' },
  '06-21': { name: 'St. Aloysius Gonzaga', rank: 'memorial', color: 'white', note: 'The heir who renounced a marquisate and died nursing plague victims at twenty-three.', glyph: '❧', motif: 'lily and plague ward' },
  '06-22': { name: 'St. Paulinus of Nola and Sts. John Fisher and Thomas More', rank: 'optional-memorial', color: 'white', note: 'A poet-bishop of Nola, and the bishop and chancellor who died rather than bend to a king.', glyph: '❦', motif: 'bells and bishop\'s staff' },
  '06-24': { name: 'Nativity of John the Baptist', rank: 'solemnity', color: 'white', note: 'The forerunner is born — the voice crying in the wilderness.', glyph: '☀', motif: 'wilderness reed' },
  '06-27': { name: 'St. Cyril of Alexandria', rank: 'optional-memorial', color: 'white', note: 'The patriarch who defended Mary as Mother of God at Ephesus.', glyph: '❦', motif: 'pillar of the faith' },
  '06-28': { name: 'St. Irenaeus', rank: 'memorial', color: 'red', note: 'Polycarp\'s pupil, who had heard John — the Church\'s living link to the apostles.', glyph: '✝', motif: 'bridge to the apostles' },
  '06-29': { name: 'Sts. Peter and Paul', rank: 'solemnity', color: 'red', note: 'The rock and the firebrand — two flawed men who built the Church.', glyph: '✝', motif: 'crossed keys and sword' },
  '07-01': { name: 'St. Junípero Serra', rank: 'optional-memorial', color: 'white', note: 'The Franciscan who founded the California missions on foot.', glyph: '❧', motif: 'missions of California' },
  '07-03': { name: 'St. Thomas', rank: 'feast', color: 'red', note: 'The doubter whose touch became the Church\'s confession: My Lord and my God.', glyph: '✝', motif: 'wounds and confession' },
  '07-04': { name: 'St. Elizabeth of Portugal', rank: 'optional-memorial', color: 'white', note: 'The queen who made peace between kings and hid alms in her cloak.', glyph: '❦', motif: 'roses and peace' },
  '07-05': { name: 'St. Anthony Zaccaria', rank: 'optional-memorial', color: 'white', note: 'The physician-priest who founded the Barnabites and revived devotion to the Eucharist.', glyph: '❦', motif: 'eucharistic renewal' },
  '07-06': { name: 'St. Maria Goretti', rank: 'optional-memorial', color: 'red', note: 'The eleven-year-old who forgave her murderer from her deathbed.', glyph: '✝', motif: 'lilies and forgiveness' },
  '07-09': { name: 'St. Augustine Zhao Rong and Companions', rank: 'optional-memorial', color: 'red', note: 'A Chinese priest and the martyrs of China, who died across two centuries of persecution.', glyph: '✝', motif: 'palms of China' },
  '07-11': { name: 'St. Benedict', rank: 'feast', color: 'white', note: 'The father of Western monasticism — prayer and work.', glyph: '✝', motif: 'rule and cross' },
  '07-13': { name: 'St. Henry', rank: 'optional-memorial', color: 'white', note: 'The Holy Roman Emperor who founded dioceses and prayed like a monk.', glyph: '✦', motif: 'crown and church' },
  '07-14': { name: 'St. Camillus de Lellis', rank: 'memorial', color: 'white', note: 'The gambling soldier who became a servant of the sick.', glyph: '✚', motif: 'red cross of service' },
  '07-15': { name: 'St. Bonaventure', rank: 'memorial', color: 'white', note: 'The Seraphic Doctor who led the Franciscans and taught the mind\'s road to God.', glyph: '❦', motif: 'seraph and journey of the mind' },
  '07-16': { name: 'Our Lady of Mount Carmel', rank: 'memorial', color: 'blue', note: 'The scapular, and Mary\'s protection for those who serve.', glyph: '✦', motif: 'scapular and star' },
  '07-20': { name: 'St. Apollinaris', rank: 'optional-memorial', color: 'red', note: 'The first bishop of Ravenna, beaten again and again and never silenced.', glyph: '✝', motif: 'ravenna martyr' },
  '07-21': { name: 'St. Lawrence of Brindisi', rank: 'optional-memorial', color: 'white', note: 'The Capuchin who preached in many languages and led troops with a crucifix.', glyph: '☀', motif: 'preacher of armies' },
  '07-22': { name: 'St. Mary Magdalene', rank: 'feast', color: 'white', note: 'The first witness of the Resurrection — the apostle to the apostles.', glyph: '✦', motif: 'empty tomb' },
  '07-23': { name: 'St. Bridget of Sweden', rank: 'optional-memorial', color: 'white', note: 'The Swedish mother of eight whose revelations moved popes.', glyph: '✦', motif: 'revelations and pilgrimage' },
  '07-24': { name: 'St. Sharbel Makhluf', rank: 'optional-memorial', color: 'white', note: 'The Maronite hermit whose tomb draws pilgrims from every faith.', glyph: '☾', motif: 'hermit of Lebanon' },
  '07-25': { name: 'St. James', rank: 'feast', color: 'red', note: 'The first apostle to be martyred.', glyph: '✝', motif: 'pilgrim shell' },
  '07-26': { name: 'Sts. Joachim and Anne', rank: 'memorial', color: 'white', note: 'The parents of Mary, grandparents of the Lord, honoured from the Church\'s early centuries.', glyph: '✦', motif: 'golden gate' },
  '07-29': { name: 'Sts. Martha, Mary and Lazarus', rank: 'memorial', color: 'white', note: 'The household of Bethany — the server, the listener, and the friend raised from the dead.', glyph: '❧', motif: 'house of Bethany' },
  '07-30': { name: 'St. Peter Chrysologus', rank: 'optional-memorial', color: 'white', note: 'The archbishop of Ravenna whose short sermons were golden.', glyph: '❦', motif: 'golden words' },
  '07-31': { name: 'St. Ignatius of Loyola', rank: 'memorial', color: 'white', note: 'The soldier who was broken and rebuilt into a founder.', glyph: '☀', motif: 'banner of the exercises' },
  '08-01': { name: 'St. Alphonsus Liguori', rank: 'memorial', color: 'white', note: 'The lawyer who founded the Redemptorists and taught the Church how to pray and confess.', glyph: '❦', motif: 'confessional and catechism' },
  '08-02': { name: 'St. Eusebius of Vercelli and St. Peter Julian Eymard', rank: 'optional-memorial', color: 'white', note: 'An exiled bishop who defended the faith, and the apostle of the Eucharist.', glyph: '✦', motif: 'exile and eucharist' },
  '08-04': { name: 'St. John Vianney', rank: 'memorial', color: 'white', note: 'The country priest who heard confessions for eighteen hours a day.', glyph: '✝', motif: 'confessional lamp' },
  '08-05': { name: 'Dedication of the Basilica of St. Mary Major', rank: 'optional-memorial', color: 'white', note: 'The dedication of Rome\'s great Marian basilica, built after Ephesus proclaimed Mary Mother of God.', glyph: '✦', motif: 'snow in august' },
  '08-06': { name: 'The Transfiguration', rank: 'feast', color: 'white', note: 'On the mountain His face shone like the sun — a glimpse of glory before the cross.', glyph: '☀', motif: 'Mount Tabor' },
  '08-07': { name: 'St. Sixtus II and Companions, and St. Cajetan', rank: 'optional-memorial', color: 'red', note: 'A pope seized at the altar with his deacons, and the priest who trusted Providence in a bankrupt city.', glyph: '✝', motif: 'pope and deacons' },
  '08-08': { name: 'St. Dominic', rank: 'memorial', color: 'white', note: 'The founder of the preachers, who gave us the Rosary.', glyph: '✦', motif: 'dog and torch' },
  '08-09': { name: 'St. Teresa Benedicta of the Cross', rank: 'optional-memorial', color: 'red', note: 'The philosopher who became a Carmelite and died at Auschwitz.', glyph: '✝', motif: 'cross at Auschwitz' },
  '08-10': { name: 'St. Lawrence', rank: 'feast', color: 'red', note: 'The deacon who joked on the gridiron.', glyph: '✝', motif: 'gridiron and flame' },
  '08-11': { name: 'St. Clare of Assisi', rank: 'memorial', color: 'white', note: 'The noblewoman who fled to follow Francis.', glyph: '✦', motif: 'monstrance and light' },
  '08-12': { name: 'St. Jane Frances de Chantal', rank: 'optional-memorial', color: 'white', note: 'The widowed baroness who founded the Visitation sisters with Francis de Sales.', glyph: '❧', motif: 'visitation mother' },
  '08-13': { name: 'Sts. Pontian and Hippolytus', rank: 'optional-memorial', color: 'red', note: 'A pope and the rival who opposed him, reconciled as prisoners in the mines of Sardinia.', glyph: '✝', motif: 'reconciled in exile' },
  '08-14': { name: 'St. Maximilian Kolbe', rank: 'memorial', color: 'red', note: 'The friar who took a stranger\'s place at Auschwitz.', glyph: '✝', motif: 'crown of thorns and lily' },
  '08-15': { name: 'The Assumption', rank: 'solemnity', color: 'white', note: 'Mary is taken up — the first fruits of the Resurrection.', glyph: '✦', motif: 'queen crowned in light' },
  '08-19': { name: 'St. John Eudes', rank: 'optional-memorial', color: 'white', note: 'The missionary who first spread devotion to the Hearts of Jesus and Mary.', glyph: '❦', motif: 'hearts of Jesus and Mary' },
  '08-20': { name: 'St. Bernard of Clairvaux', rank: 'memorial', color: 'white', note: 'The abbot of tears and fire.', glyph: '❦', motif: 'honeycomb and lily' },
  '08-21': { name: 'St. Pius X', rank: 'memorial', color: 'white', note: 'The parish-priest pope who opened the Communion rail to children.', glyph: '✦', motif: 'communion of children' },
  '08-22': { name: 'Queenship of the Blessed Virgin Mary', rank: 'memorial', color: 'white', note: 'A week after the Assumption, the Church honours Mary reigning with her Son.', glyph: '✦', motif: 'crown of the mother' },
  '08-23': { name: 'St. Rose of Lima', rank: 'optional-memorial', color: 'white', note: 'The first saint of the Americas, hidden in a garden hermitage.', glyph: '❦', motif: 'roses of Lima' },
  '08-24': { name: 'St. Bartholomew', rank: 'feast', color: 'red', note: 'Nathanael, who asked if anything good could come from Nazareth — and followed.', glyph: '✝', motif: 'fig tree and Armenia' },
  '08-25': { name: 'St. Louis IX', rank: 'memorial', color: 'white', note: 'The king who washed the feet of the poor.', glyph: '✦', motif: 'crown and oak' },
  '08-27': { name: 'St. Monica', rank: 'memorial', color: 'white', note: 'Seventeen years of tears and prayer for her son — and Augustine was converted.', glyph: '❧', motif: 'tears of a mother' },
  '08-28': { name: 'St. Augustine', rank: 'memorial', color: 'white', note: 'The restless heart that finally found its rest.', glyph: '☀', motif: 'burning heart and book' },
  '08-29': { name: 'The Passion of St. John the Baptist', rank: 'memorial', color: 'red', note: 'The forerunner loses his head for the truth about a king\'s marriage.', glyph: '✝', motif: 'head on a platter' },
  '09-03': { name: 'St. Gregory the Great', rank: 'memorial', color: 'white', note: 'The monk made pope against his will.', glyph: '❦', motif: 'dove and scroll' },
  '09-05': { name: 'St. Teresa of Calcutta', rank: 'memorial', color: 'white', note: 'The nun who served Christ in the dying of the streets.', glyph: '❧', motif: 'sari and lamp' },
  '09-08': { name: 'Nativity of the Blessed Virgin Mary', rank: 'feast', color: 'white', note: 'The birth of Mary — the first light before the sunrise of Christ.', glyph: '✦', motif: 'dawn of salvation' },
  '09-09': { name: 'St. Peter Claver', rank: 'memorial', color: 'white', note: 'The Jesuit who met the slave ships at Cartagena for forty years.', glyph: '✚', motif: 'slave of the slaves' },
  '09-12': { name: 'The Most Holy Name of Mary', rank: 'optional-memorial', color: 'white', note: 'The name of the Mother, honoured after the victory of Vienna.', glyph: '✦', motif: 'name of Mary' },
  '09-13': { name: 'St. John Chrysostom', rank: 'memorial', color: 'white', note: 'The golden-mouthed preacher exiled for telling an empress the truth.', glyph: '❦', motif: 'golden mouth' },
  '09-14': { name: 'Exaltation of the Holy Cross', rank: 'feast', color: 'red', note: 'The instrument of death becomes the tree of life.', glyph: '✝', motif: 'glorified cross' },
  '09-15': { name: 'Our Lady of Sorrows', rank: 'memorial', color: 'white', note: 'The mother who stood at the foot of the cross.', glyph: '✝', motif: 'seven sorrows' },
  '09-16': { name: 'Sts. Cornelius and Cyprian', rank: 'memorial', color: 'red', note: 'A pope and a bishop who held the persecuted Church together and died for it.', glyph: '✝', motif: 'pope and bishop in exile' },
  '09-17': { name: 'St. Robert Bellarmine and St. Hildegard of Bingen', rank: 'optional-memorial', color: 'white', note: 'A cardinal-theologian of the Counter-Reformation, and the abbess whose visions mapped heaven and earth.', glyph: '❦', motif: 'controversies and visions' },
  '09-19': { name: 'St. Januarius', rank: 'optional-memorial', color: 'red', note: 'The bishop of Benevento whose relic draws Naples to its cathedral.', glyph: '✝', motif: 'blood of Naples' },
  '09-20': { name: 'Sts. Andrew Kim Tae-gŏn, Paul Chŏng Ha-sang and Companions', rank: 'memorial', color: 'red', note: 'Korea\'s first priest and his companions, martyred for a faith carried into a closed kingdom.', glyph: '✝', motif: 'rivers of Korea' },
  '09-21': { name: 'St. Matthew', rank: 'feast', color: 'red', note: 'The tax collector called from the counting table.', glyph: '❦', motif: 'ledger and quill' },
  '09-23': { name: 'St. Padre Pio', rank: 'memorial', color: 'white', note: 'Pray, hope, and don\'t worry.', glyph: '✝', motif: 'stigmata and prayer' },
  '09-26': { name: 'Sts. Cosmas and Damian', rank: 'optional-memorial', color: 'red', note: 'Twin brothers and physicians who healed without payment and died for Christ.', glyph: '✚', motif: 'twin physicians' },
  '09-27': { name: 'St. Vincent de Paul', rank: 'memorial', color: 'white', note: 'The slave who became the apostle of the poor and of the clergy.', glyph: '❧', motif: 'galley slaves and poor' },
  '09-28': { name: 'St. Wenceslaus and St. Lawrence Ruiz and Companions', rank: 'optional-memorial', color: 'red', note: 'A Bohemian duke murdered by his brother, and the martyrs of Nagasaki led by a Filipino father.', glyph: '✝', motif: 'bohemia and nagasaki' },
  '09-29': { name: 'Sts. Michael, Gabriel & Raphael', rank: 'feast', color: 'white', note: 'The archangels — warriors, messengers, and healers.', glyph: '✦', motif: 'archangels\' wings' },
  '09-30': { name: 'St. Jerome', rank: 'memorial', color: 'white', note: 'The irascible scholar whose Latin Bible served the Church for a thousand years.', glyph: '❦', motif: 'lion and Vulgate' },
  '10-01': { name: 'St. Thérèse of Lisieux', rank: 'memorial', color: 'white', note: 'The Little Way — great love in small things.', glyph: '❦', motif: 'shower of roses' },
  '10-02': { name: 'Guardian Angels', rank: 'memorial', color: 'white', note: 'The unseen companions given to every soul.', glyph: '✦', motif: 'sheltering wing' },
  '10-04': { name: 'St. Francis of Assisi', rank: 'feast', color: 'white', note: 'The rich man who stripped himself bare for Christ.', glyph: '❧', motif: 'wolf and birds' },
  '10-05': { name: 'St. Faustina Kowalska', rank: 'memorial', color: 'white', note: 'The apostle of Divine Mercy.', glyph: '✦', motif: 'rays of mercy' },
  '10-06': { name: 'St. Bruno and Bl. Marie Rose Durocher', rank: 'optional-memorial', color: 'white', note: 'The founder of the Carthusians, and a Canadian foundress of teaching sisters.', glyph: '☾', motif: 'desert and classroom' },
  '10-07': { name: 'Our Lady of the Rosary', rank: 'memorial', color: 'white', note: 'The beads that hold the whole Gospel.', glyph: '✦', motif: 'rosary crown' },
  '10-09': { name: 'St. Denis and Companions, St. John Leonardi and St. John Henry Newman', rank: 'optional-memorial', color: 'red', note: 'The first bishop of Paris, a reformer of clergy, and the convert cardinal of Oxford.', glyph: '✝', motif: 'paris, reform and oxford' },
  '10-11': { name: 'St. John XXIII', rank: 'optional-memorial', color: 'white', note: 'The jovial pope who opened the windows of the Church at Vatican II.', glyph: '✦', motif: 'good pope john' },
  '10-14': { name: 'St. Callistus I', rank: 'optional-memorial', color: 'red', note: 'The former slave who became pope and defended mercy for the fallen.', glyph: '✝', motif: 'catacombs and mercy' },
  '10-15': { name: 'St. Teresa of Avila', rank: 'memorial', color: 'white', note: 'Let nothing disturb you. God never changes.', glyph: '✦', motif: 'interior castle' },
  '10-16': { name: 'St. Hedwig and St. Margaret Mary Alacoque', rank: 'optional-memorial', color: 'white', note: 'A duchess who founded monasteries, and the nun of the Sacred Heart visions.', glyph: '❦', motif: 'duchess and sacred heart' },
  '10-17': { name: 'St. Ignatius of Antioch', rank: 'memorial', color: 'red', note: 'God\'s wheat, ground by the beasts of Rome — his letters burn on the road to martyrdom.', glyph: '✝', motif: 'wheat of God' },
  '10-18': { name: 'St. Luke', rank: 'feast', color: 'red', note: 'The physician and evangelist of the merciful heart.', glyph: '❦', motif: 'winged ox and scroll' },
  '10-19': { name: 'Sts. Jean de Brébeuf & Isaac Jogues', rank: 'memorial', color: 'red', note: 'The Jesuit martyrs who carried the Gospel to North America.', glyph: '✝', motif: 'cross and canoe' },
  '10-22': { name: 'St. John Paul II', rank: 'memorial', color: 'white', note: 'Be not afraid.', glyph: '✦', motif: 'cross and compass' },
  '10-23': { name: 'St. John of Capistrano', rank: 'optional-memorial', color: 'white', note: 'The Franciscan lawyer-preacher who rallied Europe at Belgrade.', glyph: '☀', motif: 'banner of Belgrade' },
  '10-28': { name: 'Sts. Simon and Jude', rank: 'feast', color: 'red', note: 'Jude, the patron of lost causes.', glyph: '✝', motif: 'axe and flame' },
  '11-01': { name: 'All Saints', rank: 'solemnity', color: 'white', note: 'The whole cloud of witnesses — known and unknown.', glyph: '✦', motif: 'cloud of witnesses' },
  '11-02': { name: 'All Souls', rank: 'solemnity', color: 'black', note: 'We pray for the faithful departed. Love is stronger than death.', glyph: '✝', motif: 'candles and remembrance' },
  '11-03': { name: 'St. Martin de Porres', rank: 'memorial', color: 'white', note: 'The lay brother of radical humility.', glyph: '❧', motif: 'broom and cross' },
  '11-04': { name: 'St. Charles Borromeo', rank: 'memorial', color: 'white', note: 'The cardinal who stayed in plague-stricken Milan and reformed a Church.', glyph: '❦', motif: 'plague of Milan' },
  '11-09': { name: 'Dedication of the Lateran Basilica', rank: 'feast', color: 'white', note: 'The dedication of the pope\'s own cathedral — mother and head of all the churches.', glyph: '✦', motif: 'mother and head of churches' },
  '11-10': { name: 'St. Leo the Great', rank: 'memorial', color: 'white', note: 'The pope who faced down Attila and defined the faith at Chalcedon.', glyph: '❦', motif: 'Tome and Attila' },
  '11-11': { name: 'St. Martin of Tours', rank: 'memorial', color: 'white', note: 'He cut his cloak in half for a beggar who was Christ.', glyph: '❦', motif: 'divided cloak' },
  '11-12': { name: 'St. Josaphat', rank: 'memorial', color: 'red', note: 'The archbishop martyred for healing the breach between East and West.', glyph: '✝', motif: 'bridge of unity' },
  '11-13': { name: 'St. Frances Xavier Cabrini', rank: 'memorial', color: 'white', note: 'The nun who crossed an ocean to build schools and hospitals for immigrants.', glyph: '✦', motif: 'ship and schoolhouse' },
  '11-15': { name: 'St. Albert the Great', rank: 'optional-memorial', color: 'white', note: 'The Dominican who taught Aquinas and mapped the natural world.', glyph: '❦', motif: 'universal doctor' },
  '11-16': { name: 'St. Margaret of Scotland and St. Gertrude', rank: 'optional-memorial', color: 'white', note: 'A queen who reformed Scotland\'s court, and the Saxon mystic of the Sacred Heart.', glyph: '❦', motif: 'queen and mystic' },
  '11-17': { name: 'St. Elizabeth of Hungary', rank: 'memorial', color: 'white', note: 'The princess who gave away her fortune and served the sick herself.', glyph: '❦', motif: 'roses and bread' },
  '11-18': { name: 'Dedication of the Basilicas of Sts. Peter and Paul', rank: 'optional-memorial', color: 'white', note: 'The dedication of the two great Roman basilicas raised over the apostles\' tombs.', glyph: '✦', motif: 'basilica and keys' },
  '11-21': { name: 'Presentation of the Blessed Virgin Mary', rank: 'memorial', color: 'white', note: 'The child Mary is offered to God in the Temple.', glyph: '✦', motif: 'temple steps' },
  '11-22': { name: 'St. Cecilia', rank: 'memorial', color: 'red', note: 'The martyr who sang to God in her heart.', glyph: '❦', motif: 'lyre and crown' },
  '11-23': { name: 'Sts. Clement I and Columban', rank: 'optional-memorial', color: 'red', note: 'A pope martyred in exile, and the Irish abbot who carried the faith across Europe.', glyph: '✝', motif: 'keys and cloister' },
  '11-24': { name: 'Sts. Andrew Dung-Lac and Companions', rank: 'memorial', color: 'red', note: 'A Vietnamese priest and 116 companions who would not renounce Christ.', glyph: '✝', motif: 'palm and cross' },
  '11-25': { name: 'St. Catherine of Alexandria', rank: 'optional-memorial', color: 'red', note: 'The young philosopher of Alexandria who out-argued the emperor\'s scholars.', glyph: '✝', motif: 'wheel and wisdom' },
  '11-30': { name: 'St. Andrew', rank: 'feast', color: 'red', note: 'The first called, who preached from his own cross.', glyph: '✝', motif: 'saltire cross' },
  '12-03': { name: 'St. Francis Xavier', rank: 'memorial', color: 'white', note: 'The missionary who baptized nations.', glyph: '✦', motif: 'crab and crucifix' },
  '12-04': { name: 'St. John Damascene', rank: 'optional-memorial', color: 'white', note: 'The monk of Mar Saba who defended the icons and wrote the faith\'s first summa.', glyph: '❦', motif: 'defender of images' },
  '12-06': { name: 'St. Nicholas', rank: 'memorial', color: 'white', note: 'The bishop who gave in secret and struck at heresy.', glyph: '❦', motif: 'three golden balls' },
  '12-07': { name: 'St. Ambrose', rank: 'memorial', color: 'white', note: 'The governor made bishop by acclamation — who then baptized Augustine.', glyph: '❦', motif: 'beehive and crozier' },
  '12-09': { name: 'St. Juan Diego', rank: 'optional-memorial', color: 'white', note: 'The humble Aztec convert to whom Our Lady of Guadalupe appeared.', glyph: '✦', motif: 'winter roses' },
  '12-08': { name: 'The Immaculate Conception', rank: 'solemnity', color: 'blue', note: 'Mary, preserved from sin from the first moment.', glyph: '✦', motif: 'woman clothed with the sun' },
  '12-10': { name: 'Our Lady of Loreto', rank: 'optional-memorial', color: 'blue', note: 'The Holy House of Nazareth, honoured at Loreto.', glyph: '✦', motif: 'holy house' },
  '12-11': { name: 'St. Damasus I', rank: 'optional-memorial', color: 'white', note: 'The pope who honoured the martyrs\' tombs and commissioned the Vulgate.', glyph: '✦', motif: 'pope of the catacombs' },
  '12-12': { name: 'Our Lady of Guadalupe', rank: 'feast', color: 'blue', note: 'The Mother who left her image on a poor man\'s cloak.', glyph: '✦', motif: 'tilma of roses' },
  '12-13': { name: 'St. Lucy', rank: 'memorial', color: 'red', note: 'Her name means light — and she died for it.', glyph: '☀', motif: 'candles and eyes' },
  '12-14': { name: 'St. John of the Cross', rank: 'memorial', color: 'white', note: 'The dark night is not the absence of God.', glyph: '☾', motif: 'dark night and poem' },
  '12-21': { name: 'St. Peter Canisius', rank: 'optional-memorial', color: 'white', note: 'The Jesuit whose catechisms taught Germany.', glyph: '❦', motif: 'catechism of Germany' },
  '12-23': { name: 'St. John of Kanty', rank: 'optional-memorial', color: 'white', note: 'The Kraków professor who gave his goods to the poor on the road.', glyph: '❧', motif: 'professor of Kraków' },
  '12-25': { name: 'The Nativity of the Lord', rank: 'solemnity', color: 'gold', note: 'The Word became flesh and dwelt among us.', glyph: '✦', motif: 'nativity star' },
  '12-26': { name: 'St. Stephen', rank: 'feast', color: 'red', note: 'The first martyr, who forgave his killers as he died.', glyph: '✝', motif: 'stones and palms' },
  '12-27': { name: 'St. John the Evangelist', rank: 'feast', color: 'white', note: 'The beloved disciple, the apostle of love.', glyph: '❦', motif: 'eagle and chalice' },
  '12-28': { name: 'The Holy Innocents', rank: 'feast', color: 'red', note: 'The children who died in Christ\'s place.', glyph: '✝', motif: 'palms of the innocent' },
  '12-29': { name: 'St. Thomas Becket', rank: 'optional-memorial', color: 'red', note: 'The archbishop murdered in his own cathedral for defending the Church\'s liberty.', glyph: '✝', motif: 'cathedral and sword' },
  '12-31': { name: 'St. Sylvester I', rank: 'optional-memorial', color: 'white', note: 'The pope who shepherded the Church into the peace of Constantine.', glyph: '✦', motif: 'keys and tiara' },
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
