/**
 * The shared prayer texts — one source for every surface that prays them:
 * the Prayer Library in Pocket Church, the Act of Contrition inside the
 * Confession door, and the closing prayers of the novenas. The texts are
 * the Church's traditional ones; this file only keeps them in one place so
 * no two surfaces can drift apart. (Moved out of PrayerLibrary.tsx on
 * Nov 14, 2026, when the Confession door and the novenas began praying
 * from the same shelf.)
 */

export interface PrayerEntry {
  title: string;
  text: string;
  source?: string;
}

export const PRAYERS: PrayerEntry[] = [
  {
    title: 'Nicene Creed',
    text: 'I believe in one God,\nthe Father almighty,\nmaker of heaven and earth,\nof all things visible and invisible.\n\nI believe in one Lord Jesus Christ,\nthe Only Begotten Son of God,\nborn of the Father before all ages.\nGod from God, Light from Light,\ntrue God from true God,\nbegotten, not made, consubstantial with the Father;\nthrough him all things were made.\nFor us men and for our salvation\nhe came down from heaven,\nand by the Holy Spirit was incarnate of the Virgin Mary,\nand became man.\n\nFor our sake he was crucified under Pontius Pilate,\nhe suffered death and was buried,\nand rose again on the third day\nin accordance with the Scriptures.\nHe ascended into heaven\nand is seated at the right hand of the Father.\nHe will come again in glory\nto judge the living and the dead\nand his kingdom will have no end.\n\nI believe in the Holy Spirit, the Lord, the giver of life,\nwho proceeds from the Father and the Son,\nwho with the Father and the Son is adored and glorified,\nwho has spoken through the prophets.\n\nI believe in one, holy, catholic and apostolic Church.\nI confess one Baptism for the forgiveness of sins\nand I look forward to the resurrection of the dead\nand the life of the world to come.\n\nAmen.',
    source: 'Council of Nicaea (325 AD)',
  },
  {
    title: 'Apostles\' Creed',
    text: 'I believe in God, the Father almighty,\nCreator of heaven and earth,\nand in Jesus Christ, his only Son, our Lord,\nwho was conceived by the Holy Spirit,\nborn of the Virgin Mary,\nsuffered under Pontius Pilate,\nwas crucified, died and was buried;\nhe descended into hell;\non the third day he rose again from the dead;\nhe ascended into heaven,\nand is seated at the right hand of God the Father almighty;\nfrom there he will come to judge\nthe living and the dead.\n\nI believe in the Holy Spirit,\nthe holy catholic Church,\nthe communion of saints,\nthe forgiveness of sins,\nthe resurrection of the body,\nand life everlasting.\n\nAmen.',
    source: 'Ancient Roman Symbol',
  },
  {
    title: 'Our Father',
    text: 'Our Father, who art in heaven,\nhallowed be Thy name;\nThy kingdom come;\nThy will be done on earth as it is in heaven.\n\nGive us this day our daily bread;\nand forgive us our trespasses,\nas we forgive those who trespass against us;\nand lead us not into temptation,\nbut deliver us from evil.\n\nAmen.',
    source: 'Matthew 6:9–13',
  },
  {
    title: 'Hail Mary',
    text: 'Hail Mary, full of grace,\nthe Lord is with thee.\nBlessed art thou among women,\nand blessed is the fruit of thy womb, Jesus.\n\nHoly Mary, Mother of God,\npray for us sinners,\nnow and at the hour of our death.\n\nAmen.',
    source: 'Luke 1:28, 42',
  },
  {
    title: 'Glory Be',
    text: 'Glory be to the Father,\nand to the Son,\nand to the Holy Spirit.\n\nAs it was in the beginning,\nis now, and ever shall be,\nworld without end.\n\nAmen.',
    source: 'Traditional doxology',
  },
  {
    title: 'Act of Contrition',
    text: 'O my God, I am heartily sorry for having offended You, and I detest all my sins because of Your just punishments, but most of all because they offend You, my God, who are all good and deserving of all my love.\n\nI firmly resolve, with the help of Your grace, to sin no more and to avoid the near occasion of sin.\n\nAmen.',
    source: 'Traditional',
  },
  {
    title: 'Anima Christi (Soul of Christ)',
    text: 'Soul of Christ, sanctify me.\nBody of Christ, save me.\nBlood of Christ, inebriate me.\nWater from the side of Christ, wash me.\nPassion of Christ, strengthen me.\nO good Jesus, hear me.\nWithin Thy wounds hide me.\nPermit me not to be separated from Thee.\nFrom the wicked foe defend me.\nAt the hour of my death call me.\nAnd bid me to come to Thee,\nthat with Thy saints I may praise Thee\nfor ever and ever.\n\nAmen.',
    source: 'St. Ignatius of Loyola',
  },
  {
    title: 'The Jesus Prayer',
    text: 'Lord Jesus Christ, Son of God, have mercy on me, a sinner.',
    source: 'Ancient Christian tradition',
  },
  {
    title: 'St. Michael the Archangel',
    text: 'St. Michael the Archangel, defend us in battle.\nBe our protection against the wickedness and snares of the devil.\nMay God rebuke him, we humbly pray;\nand do thou, O Prince of the Heavenly Host,\nby the power of God, thrust into hell Satan\nand all evil spirits who prowl through the world\nseeking the ruin of souls.\n\nAmen.',
    source: 'Pope Leo XIII',
  },
  {
    title: 'Guardian Angel Prayer',
    text: 'Angel of God, my guardian dear,\nto whom God\'s love commits me here,\never this day be at my side,\nto light and guard, to rule and guide.\n\nAmen.',
    source: 'Traditional',
  },
  {
    title: 'St. Joseph Protection Prayer',
    text: 'O St. Joseph, whose protection is so great, so strong, so prompt before the throne of God, I place in you all my interests and desires.\n\nO St. Joseph, do assist me by your powerful intercession, and obtain for me from your Divine Son all spiritual blessings, through Jesus Christ, our Lord.\n\nAmen.',
    source: 'Traditional',
  },
  {
    title: 'The Memorare',
    text: 'Remember, O most gracious Virgin Mary,\nthat never was it known\nthat anyone who fled to thy protection,\nimplored thy help,\nor sought thy intercession,\nwas left unaided.\n\nInspired by this confidence,\nI fly unto thee, O Virgin of virgins, my Mother.\nTo thee do I come, before thee I stand,\nsinful and sorrowful.\nO Mother of the Word Incarnate,\ndespise not my petitions,\nbut in thy mercy hear and answer me.\n\nAmen.',
    source: 'St. Bernard of Clairvaux',
  },
  {
    title: 'Hail, Holy Queen',
    text: 'Hail, Holy Queen, Mother of Mercy,\nour life, our sweetness, and our hope.\nTo thee do we cry, poor banished children of Eve;\nto thee do we send up our sighs,\nmourning and weeping in this valley of tears.\n\nTurn then, most gracious Advocate,\nthine eyes of mercy toward us,\nand after this our exile,\nshow unto us the blessed fruit of thy womb, Jesus.\n\nO clement, O loving, O sweet Virgin Mary!\nPray for us, O holy Mother of God,\nthat we may be made worthy of the promises of Christ.\n\nAmen.',
    source: 'Traditional',
  },
  {
    title: 'Serenity Prayer',
    text: 'God, grant me the serenity to accept the things I cannot change,\nthe courage to change the things I can,\nand the wisdom to know the difference.\n\nAmen.',
    source: 'Reinhold Niebuhr',
  },
];
