/**
 * The Way of the Cross according to the method of St. Alphonsus Liguori —
 * the received traditional text (the Grimm English translation, public
 * domain), not a paraphrase composed for the app. Each station keeps the
 * form the Church has prayed for two and a half centuries: the versicle
 * and response, St. Alphonsus's consideration, his prayer, then the Our
 * Father, Hail Mary, and Glory Be, "Lord Jesus, crucified," and the verse
 * of the Stabat Mater sung between stations. (Pocket Church audit,
 * Nov 20, 2026, item 3 — the Pray door had no Stations at all, and Lent is
 * the season this app exists for.)
 */

export interface Station {
  /** The station's title, as the booklets name it. */
  title: string;
  /** "Consider…" — St. Alphonsus's meditation on the station. */
  consideration: string;
  /** The prayer the consideration opens into. */
  prayer: string;
  /** The Stabat Mater verse sung after this station. */
  stabatMater: string;
}

export const STATIONS_VERSICLE = 'We adore Thee, O Christ, and we bless Thee.';
export const STATIONS_RESPONSE = 'Because by Thy holy Cross Thou hast redeemed the world.';

/** The booklet's direction before the preparatory prayer. */
export const STATIONS_OPENING_RUBRIC =
  'Kneeling, make an Act of Contrition, and form the intention of gaining the indulgences attached to this devotion, whether for yourself or for the souls in Purgatory.';

export const STATIONS_PREPARATORY_PRAYER =
  'My Lord Jesus Christ, Thou hast made this journey to die for me with love unutterable, and I have so many times unworthily abandoned Thee; but now I love Thee with my whole heart, and because I love Thee I repent sincerely for ever having offended Thee. Pardon me, my God, and permit me to accompany Thee on this journey. Thou goest to die for love of me; I wish also, my beloved Redeemer, to die for love of Thee. My Jesus, I will live and die always united to Thee.';

export const STATIONS: Station[] = [
  {
    title: 'Jesus Is Condemned to Death',
    consideration:
      'Consider that Jesus, after having been scourged and crowned with thorns, was unjustly condemned by Pilate to die on the Cross.',
    prayer:
      'My adorable Jesus, it was not Pilate, no, it was my sins that condemned Thee to die. I beseech Thee, by the merits of this sorrowful journey, to assist my soul in its journey towards eternity. I love Thee, my beloved Jesus; I love Thee more than myself; I repent with my whole heart for having offended Thee. Never permit me to separate myself from Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'At the cross her station keeping,\nStood the mournful Mother weeping,\nClose to Jesus to the last.',
  },
  {
    title: 'Jesus Is Made to Carry His Cross',
    consideration:
      'Consider how Jesus, in making this journey with the Cross on His shoulders, thought of us, and for us offered to His Father the death He was about to undergo.',
    prayer:
      'My most beloved Jesus, I embrace all the tribulations Thou hast destined for me until death. I beseech Thee, by the merits of the pain Thou didst suffer in carrying Thy Cross, to give me the necessary help to carry mine with perfect patience and resignation. I love Thee, Jesus my love; I repent of having offended Thee. Never permit me to separate myself from Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'Through her heart, His sorrow sharing,\nAll His bitter anguish bearing,\nNow at length the sword has passed.',
  },
  {
    title: 'Jesus Falls the First Time',
    consideration:
      'Consider, my soul, this first fall of Jesus under His Cross. His flesh was torn by the scourges, His head crowned with thorns, and He had lost a great quantity of blood. He was so weakened that He could scarcely walk, and yet He had to carry this great load upon His shoulders. The soldiers struck Him rudely, and thus He fell several times in His journey.',
    prayer:
      'My beloved Jesus, it is not the weight of the Cross, but my sins, which have made Thee suffer so much pain. Ah, by the merits of this first fall, deliver me from the misfortune of falling into mortal sin. I love Thee, O my Jesus, with my whole heart; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'O how sad and sore distressed\nWas that Mother, highly blest,\nOf the sole-begotten One.',
  },
  {
    title: 'Jesus Meets His Sorrowful Mother',
    consideration:
      'Consider the meeting of the Son and the Mother, which took place on this journey. Jesus and Mary looked at each other, and their looks became as so many arrows to wound those hearts which loved each other so tenderly.',
    prayer:
      'My most loving Jesus, by the sorrow Thou didst experience in this meeting, grant me the grace of a truly devoted love for Thy most holy Mother. And thou, my Queen, who wast overwhelmed with sorrow, obtain for me by thy intercession a continual and tender remembrance of the Passion of thy Son. I love Thee, Jesus my love; I repent of ever having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'Christ above in torment hangs,\nShe beneath beholds the pangs\nOf her dying, glorious Son.',
  },
  {
    title: 'Simon of Cyrene Helps Jesus to Carry His Cross',
    consideration:
      'Consider that the Jews, seeing that at each step Jesus, from weakness, was on the point of expiring, and fearing that He would die on the way, when they wished Him to die the ignominious death of the Cross, constrained Simon the Cyrenian to carry the Cross behind our Lord.',
    prayer:
      'My most sweet Jesus, I will not refuse the Cross, as the Cyrenian did; I accept it; I embrace it. I accept in particular the death Thou hast destined for me, with all the pains that may accompany it; I unite it to Thy death, I offer it to Thee. Thou hast died for love of me; I will die for love of Thee, and to please Thee. Help me by Thy grace. I love Thee, Jesus my love; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'Is there one who would not weep,\nWhelmed in miseries so deep,\nChrist’s dear Mother to behold?',
  },
  {
    title: 'Veronica Wipes the Face of Jesus',
    consideration:
      'Consider that the holy woman named Veronica, seeing Jesus so afflicted, and His Face bathed in sweat and blood, presented Him with a towel, with which He wiped His adorable Face, leaving on it the impression of His holy countenance.',
    prayer:
      'My most beloved Jesus, Thy Face was beautiful before, but in this journey it has lost all its beauty, and wounds and blood have disfigured it. Alas, my soul also was once beautiful, when it received Thy grace in Baptism; but I have disfigured it since by my sins; Thou alone, my Redeemer, canst restore it to its former beauty. Do this by Thy Passion, O Jesus. I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'Can the human heart refrain\nFrom partaking in her pain,\nIn that Mother’s pain untold?',
  },
  {
    title: 'Jesus Falls the Second Time',
    consideration:
      'Consider the second fall of Jesus under the Cross — a fall which renews the pain of all the wounds of the head and members of our afflicted Lord.',
    prayer:
      'My most gentle Jesus, how many times Thou hast pardoned me, and how many times have I fallen again, and begun again to offend Thee! Oh, by the merits of this new fall, give me the necessary help to persevere in Thy grace until death. Grant that in all temptations which assail me I may always commend myself to Thee. I love Thee, Jesus my love, with my whole heart; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'Bruised, derided, cursed, defiled,\nShe beheld her tender Child,\nAll with bloody scourges rent.',
  },
  {
    title: 'The Women of Jerusalem Weep over Jesus',
    consideration:
      'Consider that these women wept with compassion at seeing Jesus in such a pitiable state, streaming with blood, as He walked along. But Jesus said to them: “Weep not for Me, but for your children.”',
    prayer:
      'My Jesus, laden with sorrows, I weep for the offences I have committed against Thee, because of the pains they have deserved, and still more because of the displeasure they have caused Thee, who hast loved me so much. It is Thy love, more than the fear of hell, which causes me to weep for my sins. My Jesus, I love Thee more than myself; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'For the sins of His own nation\nSaw Him hang in desolation\nTill His spirit forth He sent.',
  },
  {
    title: 'Jesus Falls the Third Time',
    consideration:
      'Consider the third fall of Jesus Christ. His weakness was extreme, and the cruelty of His executioners was excessive, who tried to hasten His steps when He had scarcely strength to move.',
    prayer:
      'Ah, my outraged Jesus, by the merits of the weakness Thou didst suffer in going to Calvary, give me strength sufficient to conquer all human respect, and all my wicked passions, which have led me to despise Thy friendship. I love Thee, Jesus my love, with my whole heart; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'O thou Mother! fount of love!\nTouch my spirit from above,\nMake my heart with thine accord.',
  },
  {
    title: 'Jesus Is Stripped of His Garments',
    consideration:
      'Consider the violence with which the executioners stripped Jesus. His inner garments adhered to His torn flesh, and they dragged them off so roughly that the skin came with them. Compassionate your Saviour thus cruelly treated, and say to Him:',
    prayer:
      'My innocent Jesus, by the merits of the torment Thou hast felt, help me to strip myself of all affection to things of earth, in order that I may place all my love in Thee, who art so worthy of my love. I love Thee, O Jesus, with my whole heart; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'Make me feel as thou hast felt;\nMake my soul to glow and melt\nWith the love of Christ my Lord.',
  },
  {
    title: 'Jesus Is Nailed to the Cross',
    consideration:
      'Consider that Jesus, after being thrown on the Cross, extended His hands, and offered to His eternal Father the sacrifice of His death for our salvation. These barbarians fastened Him with nails, and then, raising the Cross, allowed Him to die with anguish on this infamous gibbet.',
    prayer:
      'My Jesus! loaded with contempt, nail my heart to Thy feet, that it may ever remain there, to love Thee, and never quit Thee again. I love Thee more than myself; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'Holy Mother! pierce me through,\nIn my heart each wound renew\nOf my Saviour crucified.',
  },
  {
    title: 'Jesus Dies upon the Cross',
    consideration:
      'Consider that thy Jesus, after three hours’ agony on the Cross, consumed at length with anguish, abandons Himself to the weight of His body, bows His head, and dies.',
    prayer:
      'O my dying Jesus, I kiss devoutly the Cross on which Thou didst die for love of me. I have merited by my sins to die a miserable death; but Thy death is my hope. Ah, by the merits of Thy death, give me grace to die, embracing Thy feet, and burning with love for Thee. I yield my soul into Thy hands. I love Thee with my whole heart; I repent of ever having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'Let me share with thee His pain,\nWho for all my sins was slain,\nWho for me in torments died.',
  },
  {
    title: 'Jesus Is Taken Down from the Cross',
    consideration:
      'Consider that, our Lord having expired, two of His disciples, Joseph and Nicodemus, took Him down from the Cross, and placed Him in the arms of His afflicted Mother, who received Him with unutterable tenderness, and pressed Him to her bosom.',
    prayer:
      'O Mother of Sorrow, for the love of this thy Son, accept me for thy servant and pray to Him for me. And Thou, my Redeemer, since Thou hast died for me, permit me to love Thee; for I wish but to love Thee, my Jesus, and I repent of ever having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'Let me mingle tears with thee,\nMourning Him who mourned for me,\nAll the days that I may live.',
  },
  {
    title: 'Jesus Is Laid in the Sepulchre',
    consideration:
      'Consider that the disciples carried the body of Jesus to bury it, accompanied by His holy Mother, who arranged it in the sepulchre with her own hands. They then closed the tomb and all withdrew.',
    prayer:
      'Ah, my buried Jesus, I kiss the stone that encloses Thee. But Thou didst rise again on the third day. I beseech Thee, by Thy resurrection, make me rise glorious with Thee at the last day, to be always united with Thee in heaven, to praise Thee and love Thee forever. I love Thee, and I repent of ever having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.',
    stabatMater: 'By the Cross with thee to stay,\nThere to weep and pray,\nIs all I ask of thee to give.',
  },
];

/** After the fourteenth station, the devotion is completed with the Our
 *  Father, Hail Mary, and Glory Be said five times in honor of the five
 *  wounds — then this prayer, and one set for the Pope's intention. */
export const STATIONS_CLOSING_RUBRIC =
  'To complete the devotion, say the Our Father, the Hail Mary, and the Glory Be five times, in honor of the Passion of Jesus Christ.';

export const STATIONS_CLOSING_PRAYER_TITLE = 'Prayer to Jesus Christ Crucified';

export const STATIONS_CLOSING_PRAYER =
  'Behold, O kind and most sweet Jesus, I cast myself upon my knees in Thy sight, and with the most fervent desire of my soul I pray and beseech Thee that Thou wouldst impress upon my heart lively sentiments of faith, hope, and charity, with true contrition for my sins, and a firm purpose of amendment; while with deep affection and grief of soul I ponder within myself and mentally contemplate Thy five wounds, having before my eyes the words which David the prophet spoke concerning Thee: “They have pierced My hands and My feet; they have numbered all My bones.”';

export const STATIONS_FINAL_RUBRIC =
  'At the end, say one Our Father, Hail Mary, and Glory Be for the intention of the Sovereign Pontiff.';
