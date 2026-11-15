/**
 * The day's saint, for the reflection generator (saints in the content,
 * Erik's lean approved Nov 14, 2026, with his guardrail: the weave fires
 * ONLY when the calendar actually keeps a saint — never on ferial days,
 * never a rotation, never a fallback).
 *
 * The two tables below are EXTRACTED VERBATIM from src/lib/narratorCore.ts
 * (SAINT_LINES_N and FIXED_FEASTS_N — the same bank the narrator's spoken
 * celebration lines use), so the generator's facts can never drift from
 * the app's own: a saint's name and the one-line descriptor the bank
 * carries are the ceiling of what the weave may say. saintDay.test.ts
 * re-extracts both tables from the narratorCore source and fails on any
 * drift.
 *
 * Activation is deliberately conservative: the weave fires only when
 * SAINT_LINES_N holds the date (name AND descriptor both known). A day the
 * feast table names but the line bank does not (e.g. the Presentation of
 * Mary) gets NO weave — the generator is never sent a name without the
 * one true clause that may be said about them. Movable feasts and Sundays
 * are not in these tables at all, mirroring the bank's own semantics
 * (saintLineFor is the same plain MM-DD lookup); there is no liturgical
 * suppression logic here for the same reason there is none there.
 */

export type SaintRank = "solemnity" | "feast" | "memorial" | "optional-memorial";

/** MM-DD -> the saint's name and the bank's one-line descriptor. */
export const SAINT_LINES: Record<string, { name: string; line: string }> = {
  "01-28": {
    "name": "St. Thomas Aquinas",
    "line": "The Dominican friar who married faith and reason."
  },
  "01-31": {
    "name": "St. John Bosco",
    "line": "A priest who dedicated his life to troubled youth, founding schools and orphanages for boys others had given up on."
  },
  "08-14": {
    "name": "St. Maximilian Kolbe",
    "line": "A Franciscan friar who volunteered to die in place of a stranger at Auschwitz."
  },
  "08-28": {
    "name": "St. Augustine",
    "line": "A philosopher, partygoer, and seeker who chased pleasure for years before his mother's prayers and a Bible verse brought him to his knees."
  },
  "08-27": {
    "name": "St. Monica",
    "line": "A mother who prayed for her wayward son Augustine for 17 years without giving up."
  },
  "09-23": {
    "name": "St. Padre Pio",
    "line": "A Capuchin friar who bore the stigmata for 50 years, heard confessions for hours daily, and could read souls."
  },
  "10-04": {
    "name": "St. Francis of Assisi",
    "line": "A rich young man who stripped naked in the town square, renounced his inheritance, and rebuilt the Church one stone at a time."
  },
  "10-01": {
    "name": "St. Thérèse of Lisieux",
    "line": "A cloistered Carmelite who died at 24 and taught the \"Little Way\" — doing small things with great love."
  },
  "07-31": {
    "name": "St. Ignatius of Loyola",
    "line": "A soldier whose leg was shattered by a cannonball."
  },
  "07-11": {
    "name": "St. Benedict",
    "line": "A young man who fled corrupt Rome for a cave in the mountains."
  },
  "10-15": {
    "name": "St. Teresa of Avila",
    "line": "A Carmelite reformer and mystic who wrote the Interior Castle."
  },
  "12-14": {
    "name": "St. John of the Cross",
    "line": "A Carmelite mystic and poet who was imprisoned by his own brothers in a dark cell for months."
  },
  "01-17": {
    "name": "St. Anthony of the Desert",
    "line": "The first monk."
  },
  "08-04": {
    "name": "St. John Vianney",
    "line": "A parish priest who barely passed seminary but became the patron of parish priests."
  },
  "09-05": {
    "name": "St. Teresa of Calcutta",
    "line": "A tiny nun who picked up the dying from the streets of Calcutta."
  },
  "10-22": {
    "name": "St. John Paul II",
    "line": "The pope who survived an assassination attempt, helped bring down communism, and wrote more encyclicals than any pope in history."
  },
  "06-22": {
    "name": "St. Thomas More",
    "line": "A lawyer, father, and Lord Chancellor who chose death over betraying his conscience."
  },
  "01-24": {
    "name": "St. Francis de Sales",
    "line": "A gentle bishop who won back thousands of Calvinists to the faith through kindness, not argument."
  },
  "08-20": {
    "name": "St. Bernard of Clairvaux",
    "line": "A Cistercian abbot who preached the Second Crusade, advised popes, and wrote luminous sermons on the Song of Songs."
  },
  "04-29": {
    "name": "St. Catherine of Siena",
    "line": "A Dominican tertiary who counseled popes and cared for the dying."
  },
  "06-13": {
    "name": "St. Anthony of Padua",
    "line": "A Franciscan preacher known for his eloquence and his love of the poor."
  },
  "01-02": {
    "name": "St. Basil the Great",
    "line": "A bishop who built hospitals, defended the faith against heresy, and wrote the rule of life still followed by Eastern monks."
  },
  "09-13": {
    "name": "St. John Chrysostom",
    "line": "The \"golden-mouthed\" preacher of Constantinople."
  },
  "10-05": {
    "name": "St. Faustina Kowalska",
    "line": "A Polish nun who received visions of Jesus as Divine Mercy."
  },
  "03-19": {
    "name": "St. Joseph",
    "line": "The quiet foster father of Jesus."
  },
  "06-29": {
    "name": "St. Paul",
    "line": "The persecutor turned apostle."
  },
  "06-24": {
    "name": "St. John the Baptist",
    "line": "The forerunner who ate locusts in the desert and pointed to the Lamb."
  },
  "09-29": {
    "name": "St. Michael the Archangel",
    "line": "The warrior angel who cast Satan from heaven."
  },
  "10-28": {
    "name": "St. Jude Thaddeus",
    "line": "The patron of lost causes."
  },
  "07-25": {
    "name": "St. Christopher",
    "line": "The patron of travelers."
  },
  "10-18": {
    "name": "St. Luke",
    "line": "A physician, painter, and the author of the Gospel of Luke and Acts."
  },
  "10-19": {
    "name": "Sts. Jean de Brébeuf & Isaac Jogues",
    "line": "French Jesuit missionaries who brought the Gospel to the Huron and Iroquois peoples of North America."
  },
  "04-25": {
    "name": "St. Mark",
    "line": "The Gospel writer who was Peter's interpreter and Paul's failed companion."
  },
  "09-21": {
    "name": "St. Matthew",
    "line": "A tax collector — a collaborator, a traitor to his people — who Jesus called from the counting table."
  },
  "11-01": {
    "name": "All Saints",
    "line": "The feast of everyone who made it home — the known and the unknown, the famous and the forgotten."
  },
  "11-02": {
    "name": "All Souls",
    "line": "The feast of the faithful departed."
  },
  "12-06": {
    "name": "St. Nicholas",
    "line": "A bishop who punched a heretic at the Council of Nicaea and secretly gave gold to poor girls so they could marry."
  },
  "12-13": {
    "name": "St. Lucy",
    "line": "A young Sicilian martyr who consecrated her virginity and was killed for it."
  },
  "12-07": {
    "name": "St. Ambrose",
    "line": "The bishop who baptized Augustine."
  },
  "12-26": {
    "name": "St. Stephen",
    "line": "The first martyr."
  },
  "12-27": {
    "name": "St. John the Evangelist",
    "line": "The beloved disciple who leaned on Jesus at the Last Supper."
  },
  "02-03": {
    "name": "St. Blaise",
    "line": "A bishop and martyr, patron of throat ailments."
  },
  "02-14": {
    "name": "St. Valentine",
    "line": "A priest and martyr who secretly married Christian couples."
  },
  "03-17": {
    "name": "St. Patrick",
    "line": "A kidnapped slave who escaped Ireland, returned as a bishop, and converted a nation."
  },
  "04-23": {
    "name": "St. George",
    "line": "A Roman soldier martyred for refusing to renounce Christ."
  },
  "05-22": {
    "name": "St. Rita of Cascia",
    "line": "A wife, mother, then widow, then nun."
  },
  "05-26": {
    "name": "St. Philip Neri",
    "line": "The \"Apostle of Rome\" who founded the Oratory."
  },
  "06-03": {
    "name": "St. Charles Lwanga",
    "line": "A young Ugandan page who was burned alive for resisting the king's abuse."
  },
  "06-05": {
    "name": "St. Boniface",
    "line": "The \"Apostle of Germany\" who chopped down the sacred oak of Thor and built a chapel from its wood."
  },
  "07-14": {
    "name": "St. Camillus de Lellis",
    "line": "A gambling addict and soldier who lost everything, found Christ in a hospital, and founded an order to serve the sick."
  },
  "07-22": {
    "name": "St. Mary Magdalene",
    "line": "The first witness of the Resurrection."
  },
  "07-23": {
    "name": "St. Bridget of Sweden",
    "line": "A mystic, mother of eight, and widow who founded an order and received revelations from Christ."
  },
  "08-11": {
    "name": "St. Clare of Assisi",
    "line": "A young noblewoman who fled an arranged marriage to follow Francis."
  },
  "08-10": {
    "name": "St. Lawrence",
    "line": "A deacon who was grilled alive — and joked \"Turn me over, I'm done on this side.\" He is the patron of comedians and cooks."
  },
  "08-08": {
    "name": "St. Dominic",
    "line": "The founder of the Order of Preachers."
  },
  "08-09": {
    "name": "St. Edith Stein",
    "line": "A Jewish philosopher who became a Carmelite nun and died at Auschwitz."
  },
  "08-21": {
    "name": "St. Pius X",
    "line": "A pope who lowered the age of First Communion and fought modernism."
  },
  "08-23": {
    "name": "St. Rose of Lima",
    "line": "The first saint of the Americas."
  },
  "09-03": {
    "name": "St. Gregory the Great",
    "line": "A monk made pope against his will."
  },
  "09-17": {
    "name": "St. Robert Bellarmine",
    "line": "A Jesuit cardinal and theologian who defended the faith against Protestant reformers."
  },
  "09-27": {
    "name": "St. Vincent de Paul",
    "line": "A priest who was captured by pirates, enslaved, and freed."
  },
  "09-28": {
    "name": "St. Wenceslaus",
    "line": "A duke of Bohemia who was murdered by his brother for being too Christian."
  },
  "09-30": {
    "name": "St. Jerome",
    "line": "The scholar who translated the Bible into Latin — the Vulgate."
  },
  "10-16": {
    "name": "St. Margaret Mary Alacoque",
    "line": "A Visitation nun who received visions of the Sacred Heart."
  },
  "11-03": {
    "name": "St. Martin de Porres",
    "line": "A Dominican lay brother in Lima — the illegitimate son of a freed slave."
  },
  "11-04": {
    "name": "St. Charles Borromeo",
    "line": "A cardinal who reformed the Church after the Council of Trent."
  },
  "11-11": {
    "name": "St. Martin of Tours",
    "line": "A Roman soldier who cut his cloak in half to share with a beggar — who turned out to be Christ."
  },
  "11-15": {
    "name": "St. Albert the Great",
    "line": "A Dominican bishop and scientist — the teacher of Aquinas."
  },
  "11-17": {
    "name": "St. Elizabeth of Hungary",
    "line": "A princess who built a hospital and served the sick with her own hands."
  },
  "11-12": {
    "name": "St. Josaphat",
    "line": "A Ruthenian archbishop martyred in 1623 for working to heal the split between East and West."
  },
  "11-21": {
    "name": "Presentation of the Blessed Virgin Mary",
    "line": "The feast of the child Mary presented in the Temple, offered wholly to God by her parents."
  },
  "11-24": {
    "name": "Sts. Andrew Dung-Lac and Companions",
    "line": "A Vietnamese priest beheaded in 1839 for refusing to renounce Christ — one of the 117 martyrs of Vietnam."
  },
  "11-22": {
    "name": "St. Cecilia",
    "line": "A Roman martyr and patron of musicians."
  },
  "11-30": {
    "name": "St. Andrew",
    "line": "The first apostle called — Peter's brother."
  },
  "12-03": {
    "name": "St. Francis Xavier",
    "line": "A Jesuit missionary who baptized tens of thousands in India, Indonesia, and Japan."
  },
  "12-08": {
    "name": "Immaculate Conception",
    "line": "The feast of Mary, preserved from original sin from the first moment of her existence."
  },
  "12-09": {
    "name": "St. Juan Diego",
    "line": "A poor Aztec convert on whose cloak Our Lady of Guadalupe left her image in 1531."
  },
  "12-12": {
    "name": "Our Lady of Guadalupe",
    "line": "Mary appeared to Juan Diego, a poor indigenous man, and left her image on his tilma."
  },
  "12-21": {
    "name": "St. Peter Canisius",
    "line": "A Jesuit who defended the faith in Germany after the Reformation."
  },
  "12-29": {
    "name": "St. Thomas Becket",
    "line": "The chancellor turned Archbishop of Canterbury who defended the Church's liberty against his friend King Henry II."
  },
  "12-31": {
    "name": "St. Sylvester I",
    "line": "The pope who led the Church out of the catacombs into the peace of Constantine."
  },
  "01-20": {
    "name": "St. Sebastian",
    "line": "A Roman soldier who secretly served Christ until he was found out, shot full of arrows, and left for dead — then recovered and confronted the emperor again."
  },
  "05-15": {
    "name": "St. Isidore the Farmer",
    "line": "A poor farm laborer who prayed while he plowed."
  },
  "08-25": {
    "name": "St. Louis IX",
    "line": "King of France, father of eleven, crusader, and a man who washed the feet of the poor."
  },
  "10-24": {
    "name": "St. Kaleb of Ethiopia",
    "line": "A king of Ethiopia who answered the call to defend Christians being persecuted in Arabia."
  },
  "06-26": {
    "name": "St. Josemaría Escrivá",
    "line": "A priest who taught that ordinary work is a path to holiness."
  },
  "10-12": {
    "name": "Blessed Carlo Acutis",
    "line": "A teenager who loved computers, coding, and the Eucharist."
  },
  "11-23": {
    "name": "St. Miguel Pro",
    "line": "A Jesuit priest in Mexico who was executed by the government for his faith."
  },
  "02-23": {
    "name": "St. Polycarp",
    "line": "A disciple of the Apostle John, bishop of Smyrna, martyred at 86."
  },
  "06-21": {
    "name": "St. Aloysius Gonzaga",
    "line": "A young nobleman who gave up a fortune to join the Jesuits."
  },
  "03-15": {
    "name": "St. Longinus",
    "line": "The Roman centurion who pierced Christ's side with a spear and, seeing the blood and water, declared \"Truly this was the Son of God.\" A soldier who found faith at the cross."
  },
  "09-20": {
    "name": "St. Eustace",
    "line": "A Roman general who saw a stag with a cross between its antlers while hunting."
  },
  "01-21": {
    "name": "St. Meinrad",
    "line": "A hermit who lived in a forest in Switzerland."
  },
  "11-13": {
    "name": "St. Frances Xavier Cabrini",
    "line": "An Italian nun who crossed the Atlantic in 1889 and built schools, hospitals, and orphanages for immigrants across America."
  },
  "06-30": {
    "name": "St. Adolf",
    "line": "A monk in Spain who refused to renounce his faith before the Moors and was martyred."
  },
  "02-06": {
    "name": "St. Paul Miki",
    "line": "A Japanese Jesuit seminarian crucified with twenty-five companions in Nagasaki."
  },
  "08-16": {
    "name": "St. Roch",
    "line": "A pilgrim who ministered to plague victims until he caught the plague himself."
  },
  "04-21": {
    "name": "St. Conrad of Parzham",
    "line": "A porter at a Franciscan friary for forty-one years."
  },
  "10-06": {
    "name": "St. Bruno",
    "line": "The founder of the Carthusian order, the strictest monks in the Church."
  },
  "02-27": {
    "name": "St. Gabriel Possenti",
    "line": "A young Passionist seminarian known for his charm and holiness."
  },
  "01-07": {
    "name": "St. Raymond of Penyafort",
    "line": "A Catalan Dominican who compiled the decretals of canon law for Pope Gregory IX."
  },
  "01-13": {
    "name": "St. Hilary of Poitiers",
    "line": "A bishop of Poitiers who defended the divinity of Christ against the Arian emperors."
  },
  "01-22": {
    "name": "St. Vincent",
    "line": "A deacon of Saragossa martyred under Diocletian in 304."
  },
  "01-23": {
    "name": "St. Marianne Cope",
    "line": "A German-born Franciscan sister in New York who led her sisters to Hawaii in 1883 to care for leprosy patients."
  },
  "01-27": {
    "name": "St. Angela Merici",
    "line": "An Italian visionary who founded the Ursulines in 1535 to teach poor girls."
  },
  "02-08": {
    "name": "St. Jerome Emiliani",
    "line": "A Venetian soldier who was captured in war and freed after prayer to Our Lady."
  },
  "02-17": {
    "name": "The Seven Holy Founders of the Servite Order",
    "line": "Seven Florentine merchants who in 1233 left their businesses and families to live in prayer together on Monte Senario."
  },
  "02-21": {
    "name": "St. Peter Damian",
    "line": "A hermit of Fonte Avellana who became the fiercest reformer of the eleventh-century Church."
  },
  "03-03": {
    "name": "St. Katharine Drexel",
    "line": "A Philadelphia heiress who gave her fortune to found schools and missions for Native American and African American children."
  },
  "03-04": {
    "name": "St. Casimir",
    "line": "A prince of Poland who died at twenty-five, known for prayer, chastity, and care for the poor."
  },
  "03-08": {
    "name": "St. John of God",
    "line": "A Portuguese bookseller in Granada who, after a breakdown and conversion, founded hospitals for the poor and sick."
  },
  "03-09": {
    "name": "St. Frances of Rome",
    "line": "A Roman wife and mother who turned her palace into a hospital during plague and famine."
  },
  "03-18": {
    "name": "St. Cyril of Jerusalem",
    "line": "A bishop of Jerusalem whose catechetical lectures to new converts still survive from the fourth century."
  },
  "03-23": {
    "name": "St. Turibius of Mongrovejo",
    "line": "A Spanish archbishop of Lima who spent twenty-five years traveling his enormous diocese on foot."
  },
  "04-02": {
    "name": "St. Francis of Paola",
    "line": "A Calabrian hermit who founded the Minim Order and lived on a diet of herbs and bread."
  },
  "04-04": {
    "name": "St. Isidore of Seville",
    "line": "A bishop of Seville whose Etymologies gathered the knowledge of the ancient world into twenty books."
  },
  "04-05": {
    "name": "St. Vincent Ferrer",
    "line": "A Dominican preacher who walked across Europe calling Christians to repentance during the Western Schism."
  },
  "04-13": {
    "name": "St. Martin I",
    "line": "A pope seized by imperial soldiers in the Lateran and carried off to exile in the Crimea."
  },
  "04-24": {
    "name": "St. Fidelis of Sigmaringen",
    "line": "A lawyer who abandoned a successful practice to become a Capuchin friar."
  },
  "04-28": {
    "name": "St. Peter Chanel",
    "line": "A French Marist priest martyred on the island of Futuna in 1841."
  },
  "04-30": {
    "name": "St. Pius V",
    "line": "A Dominican friar who became pope and carried out the reforms of the Council of Trent."
  },
  "05-10": {
    "name": "St. John of Ávila",
    "line": "A Spanish priest whose letters and preaching reformed the clergy of Andalusia and guided saints."
  },
  "05-12": {
    "name": "Sts. Nereus and Achilleus",
    "line": "Roman soldiers who were converted to Christ and put to death for their faith."
  },
  "05-18": {
    "name": "St. John I",
    "line": "A pope sent by the Arian king Theodoric to negotiate in Constantinople."
  },
  "05-20": {
    "name": "St. Bernardine of Siena",
    "line": "A Franciscan preacher who carried a banner of the Holy Name through the cities of Italy."
  },
  "05-21": {
    "name": "St. Christopher Magallanes and Companions",
    "line": "A Mexican priest shot by government troops in 1927 during the persecution of the Church."
  },
  "05-25": {
    "name": "St. Bede the Venerable",
    "line": "An English monk whose Ecclesiastical History of the English People preserved the story of a nation's conversion."
  },
  "05-27": {
    "name": "St. Augustine of Canterbury",
    "line": "A Roman monk sent by Pope Gregory the Great to evangelize the Anglo-Saxons."
  },
  "05-29": {
    "name": "St. Paul VI",
    "line": "The pope who brought the Second Vatican Council to its close and began the Church's modern pilgrim journeys."
  },
  "06-02": {
    "name": "Sts. Marcellinus and Peter",
    "line": "A Roman priest and an exorcist martyred together under Diocletian around 304."
  },
  "06-06": {
    "name": "St. Norbert",
    "line": "A courtier converted when lightning threw him from his horse."
  },
  "06-09": {
    "name": "St. Ephrem",
    "line": "A Syrian deacon whose hymns earned him the title Harp of the Holy Spirit."
  },
  "06-19": {
    "name": "St. Romuald",
    "line": "An Italian nobleman who became a monk after witnessing a murder in his family."
  },
  "06-27": {
    "name": "St. Cyril of Alexandria",
    "line": "A patriarch of Alexandria who presided at the Council of Ephesus in 431."
  },
  "07-01": {
    "name": "St. Junípero Serra",
    "line": "A Mallorcan Franciscan who founded nine missions along the California coast."
  },
  "07-04": {
    "name": "St. Elizabeth of Portugal",
    "line": "A queen of Portugal who made peace between warring kings of her own family."
  },
  "07-05": {
    "name": "St. Anthony Zaccaria",
    "line": "A physician in Cremona who became a priest and founded the Barnabites."
  },
  "07-06": {
    "name": "St. Maria Goretti",
    "line": "An Italian girl of eleven who died in 1902 resisting an assault by a farmhand named Alessandro Serenelli."
  },
  "07-09": {
    "name": "St. Augustine Zhao Rong and Companions",
    "line": "A Chinese soldier who converted while guarding a captured missionary and was ordained a priest."
  },
  "07-13": {
    "name": "St. Henry",
    "line": "A Holy Roman Emperor who founded the diocese of Bamberg and strengthened the Church across Germany."
  },
  "07-20": {
    "name": "St. Apollinaris",
    "line": "The first bishop of Ravenna, sent there according to tradition by Saint Peter himself."
  },
  "07-21": {
    "name": "St. Lawrence of Brindisi",
    "line": "A Capuchin friar who preached across Europe in the languages of the peoples he visited."
  },
  "07-24": {
    "name": "St. Sharbel Makhluf",
    "line": "A Maronite monk and hermit of Lebanon who lived in near-total solitude at Annaya."
  },
  "07-30": {
    "name": "St. Peter Chrysologus",
    "line": "An archbishop of Ravenna whose brief, burning sermons earned him the name Chrysologus, golden-worded."
  },
  "08-02": {
    "name": "St. Eusebius of Vercelli",
    "line": "The first bishop of Vercelli, exiled to the East for refusing to condemn Saint Athanasius."
  },
  "08-07": {
    "name": "St. Sixtus II and Companions",
    "line": "A pope arrested while celebrating Mass in the catacombs in 258 and executed with four of his deacons."
  },
  "08-12": {
    "name": "St. Jane Frances de Chantal",
    "line": "A French widow who, under the guidance of Saint Francis de Sales, founded the Order of the Visitation in 1610."
  },
  "08-13": {
    "name": "St. Pontian",
    "line": "A pope deported to the mines of Sardinia under the emperor Maximinus in 235."
  },
  "08-19": {
    "name": "St. John Eudes",
    "line": "A French missionary priest who preached across Normandy and founded seminaries to reform the clergy."
  },
  "09-09": {
    "name": "St. Peter Claver",
    "line": "A Spanish Jesuit who spent forty years meeting slave ships in the port of Cartagena."
  },
  "09-19": {
    "name": "St. Januarius",
    "line": "A bishop of Benevento martyred under Diocletian around 305."
  },
  "09-26": {
    "name": "Sts. Cosmas and Damian",
    "line": "Twin brothers and physicians in Arabia who treated the sick without accepting payment."
  },
  "10-09": {
    "name": "St. Denis and Companions",
    "line": "The first bishop of Paris, beheaded on Montmartre under a third-century persecution."
  },
  "10-11": {
    "name": "St. John XXIII",
    "line": "A pope elected at seventy-six as a caretaker who instead summoned the Second Vatican Council."
  },
  "10-14": {
    "name": "St. Callistus I",
    "line": "A former slave who rose to manage the Church's first official cemetery in Rome and then became pope."
  },
  "10-23": {
    "name": "St. John of Capistrano",
    "line": "An Italian lawyer and governor who became a Franciscan and preached across Europe."
  },
  "11-16": {
    "name": "St. Margaret of Scotland",
    "line": "An English princess who became queen of Scotland and reformed its court and Church."
  },
  "11-25": {
    "name": "St. Catherine of Alexandria",
    "line": "A young scholar of Alexandria who, by tradition, confounded the fifty philosophers sent to argue her out of her faith."
  },
  "12-04": {
    "name": "St. John Damascene",
    "line": "A monk of Mar Saba near Jerusalem who defended the veneration of images during the iconoclast controversy."
  },
  "12-11": {
    "name": "St. Damasus I",
    "line": "A pope who adorned the tombs of the martyrs in the Roman catacombs with verses of his own."
  },
  "12-23": {
    "name": "St. John of Kanty",
    "line": "A professor of theology at Kraków who shared his salary and possessions with the poor."
  }
};

/** MM-DD -> [celebration name, rank] for the fixed feasts. */
export const FIXED_FEASTS: Record<string, [string, SaintRank]> = {
  "01-01": [
    "Mary, Mother of God",
    "solemnity"
  ],
  "01-03": [
    "The Most Holy Name of Jesus",
    "optional-memorial"
  ],
  "01-06": [
    "Epiphany",
    "solemnity"
  ],
  "01-07": [
    "St. Raymond of Penyafort",
    "optional-memorial"
  ],
  "01-13": [
    "St. Hilary of Poitiers",
    "optional-memorial"
  ],
  "01-17": [
    "St. Anthony of the Desert",
    "memorial"
  ],
  "01-20": [
    "St. Sebastian",
    "memorial"
  ],
  "01-22": [
    "St. Vincent",
    "optional-memorial"
  ],
  "01-23": [
    "St. Marianne Cope",
    "optional-memorial"
  ],
  "01-24": [
    "St. Francis de Sales",
    "memorial"
  ],
  "01-27": [
    "St. Angela Merici",
    "optional-memorial"
  ],
  "01-28": [
    "St. Thomas Aquinas",
    "memorial"
  ],
  "02-02": [
    "Presentation of the Lord",
    "feast"
  ],
  "02-03": [
    "St. Blaise",
    "memorial"
  ],
  "02-08": [
    "St. Jerome Emiliani and St. Josephine Bakhita",
    "optional-memorial"
  ],
  "02-11": [
    "Our Lady of Lourdes",
    "memorial"
  ],
  "02-14": [
    "St. Valentine",
    "memorial"
  ],
  "02-17": [
    "The Seven Holy Founders of the Servite Order",
    "optional-memorial"
  ],
  "02-21": [
    "St. Peter Damian",
    "optional-memorial"
  ],
  "03-03": [
    "St. Katharine Drexel",
    "optional-memorial"
  ],
  "03-04": [
    "St. Casimir",
    "optional-memorial"
  ],
  "03-08": [
    "St. John of God",
    "optional-memorial"
  ],
  "03-09": [
    "St. Frances of Rome",
    "optional-memorial"
  ],
  "03-17": [
    "St. Patrick",
    "feast"
  ],
  "03-18": [
    "St. Cyril of Jerusalem",
    "optional-memorial"
  ],
  "03-19": [
    "St. Joseph",
    "solemnity"
  ],
  "03-23": [
    "St. Turibius of Mongrovejo",
    "optional-memorial"
  ],
  "03-25": [
    "The Annunciation",
    "solemnity"
  ],
  "04-02": [
    "St. Francis of Paola",
    "optional-memorial"
  ],
  "04-04": [
    "St. Isidore of Seville",
    "optional-memorial"
  ],
  "04-05": [
    "St. Vincent Ferrer",
    "optional-memorial"
  ],
  "04-13": [
    "St. Martin I",
    "optional-memorial"
  ],
  "04-23": [
    "St. George",
    "memorial"
  ],
  "04-24": [
    "St. Fidelis of Sigmaringen",
    "optional-memorial"
  ],
  "04-25": [
    "St. Mark",
    "feast"
  ],
  "04-28": [
    "St. Peter Chanel and St. Louis de Montfort",
    "optional-memorial"
  ],
  "04-29": [
    "St. Catherine of Siena",
    "memorial"
  ],
  "04-30": [
    "St. Pius V",
    "optional-memorial"
  ],
  "05-01": [
    "St. Joseph the Worker",
    "optional-memorial"
  ],
  "05-10": [
    "St. John of Ávila and St. Damien de Veuster",
    "optional-memorial"
  ],
  "05-12": [
    "Sts. Nereus, Achilleus and Pancras",
    "optional-memorial"
  ],
  "05-13": [
    "Our Lady of Fatima",
    "memorial"
  ],
  "05-15": [
    "St. Isidore the Farmer",
    "memorial"
  ],
  "05-18": [
    "St. John I",
    "optional-memorial"
  ],
  "05-20": [
    "St. Bernardine of Siena",
    "optional-memorial"
  ],
  "05-21": [
    "St. Christopher Magallanes and Companions",
    "optional-memorial"
  ],
  "05-22": [
    "St. Rita of Cascia",
    "memorial"
  ],
  "05-25": [
    "St. Bede the Venerable, St. Gregory VII and St. Mary Magdalene de' Pazzi",
    "optional-memorial"
  ],
  "05-27": [
    "St. Augustine of Canterbury",
    "optional-memorial"
  ],
  "05-29": [
    "St. Paul VI",
    "optional-memorial"
  ],
  "06-02": [
    "Sts. Marcellinus and Peter",
    "optional-memorial"
  ],
  "06-06": [
    "St. Norbert",
    "optional-memorial"
  ],
  "06-09": [
    "St. Ephrem",
    "optional-memorial"
  ],
  "06-13": [
    "St. Anthony of Padua",
    "memorial"
  ],
  "06-19": [
    "St. Romuald",
    "optional-memorial"
  ],
  "06-22": [
    "St. Paulinus of Nola and Sts. John Fisher and Thomas More",
    "optional-memorial"
  ],
  "06-24": [
    "Nativity of John the Baptist",
    "solemnity"
  ],
  "06-27": [
    "St. Cyril of Alexandria",
    "optional-memorial"
  ],
  "06-29": [
    "Sts. Peter and Paul",
    "solemnity"
  ],
  "07-01": [
    "St. Junípero Serra",
    "optional-memorial"
  ],
  "07-04": [
    "St. Elizabeth of Portugal",
    "optional-memorial"
  ],
  "07-05": [
    "St. Anthony Zaccaria",
    "optional-memorial"
  ],
  "07-06": [
    "St. Maria Goretti",
    "optional-memorial"
  ],
  "07-09": [
    "St. Augustine Zhao Rong and Companions",
    "optional-memorial"
  ],
  "07-11": [
    "St. Benedict",
    "feast"
  ],
  "07-13": [
    "St. Henry",
    "optional-memorial"
  ],
  "07-14": [
    "St. Camillus de Lellis",
    "memorial"
  ],
  "07-16": [
    "Our Lady of Mount Carmel",
    "memorial"
  ],
  "07-20": [
    "St. Apollinaris",
    "optional-memorial"
  ],
  "07-21": [
    "St. Lawrence of Brindisi",
    "optional-memorial"
  ],
  "07-22": [
    "St. Mary Magdalene",
    "feast"
  ],
  "07-23": [
    "St. Bridget of Sweden",
    "optional-memorial"
  ],
  "07-24": [
    "St. Sharbel Makhluf",
    "optional-memorial"
  ],
  "07-25": [
    "St. James",
    "feast"
  ],
  "07-30": [
    "St. Peter Chrysologus",
    "optional-memorial"
  ],
  "07-31": [
    "St. Ignatius of Loyola",
    "memorial"
  ],
  "08-02": [
    "St. Eusebius of Vercelli and St. Peter Julian Eymard",
    "optional-memorial"
  ],
  "08-04": [
    "St. John Vianney",
    "memorial"
  ],
  "08-05": [
    "Dedication of the Basilica of St. Mary Major",
    "optional-memorial"
  ],
  "08-07": [
    "St. Sixtus II and Companions, and St. Cajetan",
    "optional-memorial"
  ],
  "08-08": [
    "St. Dominic",
    "memorial"
  ],
  "08-09": [
    "St. Teresa Benedicta of the Cross",
    "optional-memorial"
  ],
  "08-10": [
    "St. Lawrence",
    "feast"
  ],
  "08-11": [
    "St. Clare of Assisi",
    "memorial"
  ],
  "08-12": [
    "St. Jane Frances de Chantal",
    "optional-memorial"
  ],
  "08-13": [
    "Sts. Pontian and Hippolytus",
    "optional-memorial"
  ],
  "08-14": [
    "St. Maximilian Kolbe",
    "memorial"
  ],
  "08-15": [
    "The Assumption",
    "solemnity"
  ],
  "08-19": [
    "St. John Eudes",
    "optional-memorial"
  ],
  "08-20": [
    "St. Bernard of Clairvaux",
    "memorial"
  ],
  "08-23": [
    "St. Rose of Lima",
    "optional-memorial"
  ],
  "08-25": [
    "St. Louis IX",
    "memorial"
  ],
  "08-28": [
    "St. Augustine",
    "memorial"
  ],
  "09-03": [
    "St. Gregory the Great",
    "memorial"
  ],
  "09-05": [
    "St. Teresa of Calcutta",
    "memorial"
  ],
  "09-09": [
    "St. Peter Claver",
    "optional-memorial"
  ],
  "09-12": [
    "The Most Holy Name of Mary",
    "optional-memorial"
  ],
  "09-14": [
    "Exaltation of the Holy Cross",
    "feast"
  ],
  "09-15": [
    "Our Lady of Sorrows",
    "memorial"
  ],
  "09-17": [
    "St. Robert Bellarmine and St. Hildegard of Bingen",
    "optional-memorial"
  ],
  "09-19": [
    "St. Januarius",
    "optional-memorial"
  ],
  "09-21": [
    "St. Matthew",
    "feast"
  ],
  "09-23": [
    "St. Padre Pio",
    "memorial"
  ],
  "09-26": [
    "Sts. Cosmas and Damian",
    "optional-memorial"
  ],
  "09-28": [
    "St. Wenceslaus and St. Lawrence Ruiz and Companions",
    "optional-memorial"
  ],
  "09-29": [
    "Sts. Michael, Gabriel & Raphael",
    "feast"
  ],
  "10-01": [
    "St. Thérèse of Lisieux",
    "memorial"
  ],
  "10-02": [
    "Guardian Angels",
    "memorial"
  ],
  "10-04": [
    "St. Francis of Assisi",
    "feast"
  ],
  "10-05": [
    "St. Faustina Kowalska",
    "memorial"
  ],
  "10-06": [
    "St. Bruno and Bl. Marie Rose Durocher",
    "optional-memorial"
  ],
  "10-07": [
    "Our Lady of the Rosary",
    "memorial"
  ],
  "10-09": [
    "St. Denis and Companions, St. John Leonardi and St. John Henry Newman",
    "optional-memorial"
  ],
  "10-11": [
    "St. John XXIII",
    "optional-memorial"
  ],
  "10-14": [
    "St. Callistus I",
    "optional-memorial"
  ],
  "10-15": [
    "St. Teresa of Avila",
    "memorial"
  ],
  "10-16": [
    "St. Hedwig and St. Margaret Mary Alacoque",
    "optional-memorial"
  ],
  "10-18": [
    "St. Luke",
    "feast"
  ],
  "10-19": [
    "Sts. Jean de Brébeuf & Isaac Jogues",
    "memorial"
  ],
  "10-22": [
    "St. John Paul II",
    "memorial"
  ],
  "10-23": [
    "St. John of Capistrano",
    "optional-memorial"
  ],
  "10-28": [
    "Sts. Simon and Jude",
    "feast"
  ],
  "11-01": [
    "All Saints",
    "solemnity"
  ],
  "11-02": [
    "All Souls",
    "solemnity"
  ],
  "11-03": [
    "St. Martin de Porres",
    "memorial"
  ],
  "11-11": [
    "St. Martin of Tours",
    "memorial"
  ],
  "11-12": [
    "St. Josaphat",
    "memorial"
  ],
  "11-13": [
    "St. Frances Xavier Cabrini",
    "memorial"
  ],
  "11-15": [
    "St. Albert the Great",
    "optional-memorial"
  ],
  "11-16": [
    "St. Margaret of Scotland and St. Gertrude",
    "optional-memorial"
  ],
  "11-17": [
    "St. Elizabeth of Hungary",
    "memorial"
  ],
  "11-18": [
    "Dedication of the Basilicas of Sts. Peter and Paul",
    "optional-memorial"
  ],
  "11-21": [
    "Presentation of the Blessed Virgin Mary",
    "memorial"
  ],
  "11-22": [
    "St. Cecilia",
    "memorial"
  ],
  "11-24": [
    "Sts. Andrew Dung-Lac and Companions",
    "memorial"
  ],
  "11-25": [
    "St. Catherine of Alexandria",
    "optional-memorial"
  ],
  "11-30": [
    "St. Andrew",
    "feast"
  ],
  "12-03": [
    "St. Francis Xavier",
    "memorial"
  ],
  "12-04": [
    "St. John Damascene",
    "optional-memorial"
  ],
  "12-06": [
    "St. Nicholas",
    "memorial"
  ],
  "12-07": [
    "St. Ambrose",
    "memorial"
  ],
  "12-08": [
    "The Immaculate Conception",
    "solemnity"
  ],
  "12-09": [
    "St. Juan Diego",
    "optional-memorial"
  ],
  "12-10": [
    "Our Lady of Loreto",
    "optional-memorial"
  ],
  "12-11": [
    "St. Damasus I",
    "optional-memorial"
  ],
  "12-12": [
    "Our Lady of Guadalupe",
    "feast"
  ],
  "12-13": [
    "St. Lucy",
    "memorial"
  ],
  "12-14": [
    "St. John of the Cross",
    "memorial"
  ],
  "12-21": [
    "St. Peter Canisius",
    "optional-memorial"
  ],
  "12-23": [
    "St. John of Kanty",
    "optional-memorial"
  ],
  "12-25": [
    "The Nativity of the Lord",
    "solemnity"
  ],
  "12-26": [
    "St. Stephen",
    "feast"
  ],
  "12-27": [
    "St. John the Evangelist",
    "feast"
  ],
  "12-28": [
    "The Holy Innocents",
    "feast"
  ],
  "12-29": [
    "St. Thomas Becket",
    "optional-memorial"
  ],
  "12-31": [
    "St. Sylvester I",
    "optional-memorial"
  ]
};

export interface ReflectionSaint {
  name: string;
  /** The bank's one-line descriptor — the only fact the weave may use. */
  descriptor: string;
  /** The day's rank when the feast table carries one, else null. */
  rank: SaintRank | null;
}

/**
 * The saint the generator may weave for a date, or null when the day
 * carries none the bank can describe. Name and descriptor come from the
 * same bank entry; the rank rides along when the feast table has the day.
 */
export function saintForReflectionDate(dateISO: string): ReflectionSaint | null {
  const mmdd = dateISO.slice(5);
  const entry = SAINT_LINES[mmdd];
  if (!entry) return null;
  const feast = FIXED_FEASTS[mmdd];
  return { name: entry.name, descriptor: entry.line, rank: feast ? feast[1] : null };
}

/**
 * The weave instruction appended to the generation input on a saint day.
 * One sentence of connection, inside the existing length envelopes — the
 * weave replaces words, it does not add a paragraph. Facts are fenced to
 * the name and the one clause the bank carries: no new biographical
 * claims, no quotations, no intercession promises; the saint is witness
 * and example, and the challenge stays the reader's own act.
 */
export function saintWeaveBlock(saint: ReflectionSaint): string {
  const head = saint.rank
    ? `Today the Church keeps the ${saint.rank.replace(/-/g, " ")} of ${saint.name}: ${saint.descriptor}`
    : `Today the Church remembers ${saint.name}: ${saint.descriptor}`;
  return [
    head,
    "Weave the saint in ONCE: let either the Reflect question or the Challenge carry ONE sentence of connection — who this saint was, in the one true clause above, tied to today's Gospel — within the usual lengths. The weave replaces words; it does not add length. Use ONLY the name and the clause given here: no other biographical claims, no quotations, no promises of intercession. The saint stands as witness and example; the Challenge stays the reader's own act.",
  ].join("\n");
}

/**
 * The block buildInput appends for a date — the weave on a saint day, and
 * the EMPTY STRING on any other day, so a ferial day's generation input
 * stays byte-identical to what it was before the weave existed.
 */
export function buildInputSaintBlock(dateISO: string): string {
  const saint = saintForReflectionDate(dateISO);
  return saint ? saintWeaveBlock(saint) : "";
}
