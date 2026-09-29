// Original summaries, not quoted dialogue. S-keys match CHARACTER_RESEARCH.md.
// A source's medium is explicit: an official manga recap is not anime evidence.
const sources = {
  S4: 'https://en.dragon-ball-official.com/news/01_689.html',
  S5: 'https://en.dragon-ball-official.com/news/01_1752.html',
  S6: 'https://en.dragon-ball-official.com/news/01_1858.html',
  S7: 'https://en.dragon-ball-official.com/news/01_941.html',
  S8: 'https://en.dragon-ball-official.com/news/01_1819.html',
  S9: 'https://en.dragon-ball-official.com/news/01_1166.html',
  S10: 'https://en.dragon-ball-official.com/news/01_1178.html',
  S11: 'https://en.dragon-ball-official.com/news/01_2350.html',
  S12: 'https://en.dragon-ball-official.com/news/01_3483.html',
  S13: 'https://en.dragon-ball-official.com/news/01_1257.html',
  S14: 'https://en.dragon-ball-official.com/news/01_3878.html',
  S21: 'https://en.dragon-ball-official.com/news/01_838.html',
  S22: 'https://en.dragon-ball-official.com/news/01_3484.html',
  S23: 'https://en.dragon-ball-official.com/news/01_4397.html',
  S24: 'https://en.dragon-ball-official.com/news/01_900.html',
};
const fact = (text, key, medium = 'Dragon Ball manga') => Object.freeze({ text, source: sources[key], medium });

export const INTEL = Object.freeze({
  goku: {
    summary: 'An Earth-raised Saiyan and lifelong martial artist. Adult Z/Super presentation: athletic build, asymmetric black hair and orange gi.',
    achievements: [
      fact('Teleported the self-destructing Cell away from Earth, sacrificing his life to save the planet.', 'S14'),
      fact('Destroyed Kid Buu with the Spirit Bomb, aided by Vegeta, North Kai, Mr. Satan and the people supplying energy.', 'S14'),
      fact('Helped Universe 7 win the Tournament of Power alongside his teammates; Android 17, not Goku, was the last fighter standing and tournament winner.', 'S24', 'Dragon Ball Super manga'),
    ],
    style: 'An adaptable close-range martial artist with varied ki techniques. Ultra Instinct is a distinct technique, not another numbered Super Saiyan tier.',
    trainingTip: 'Game drill: vary light-light-heavy with a delayed guard, then punish the response rather than repeating one string.',
  },
  vegeta: {
    summary: 'The Saiyan prince, shown as an adult in the Z/Super era. Compact muscular frame, upright hair, pronounced widow\'s peak and fitted armor.',
    achievements: [
      fact('Defeated Android 19 after arriving as a Super Saiyan when Goku was incapacitated by his heart virus.', 'S14'),
      fact('Trained with Future Trunks in the Room of Spirit and Time to prepare for Cell.', 'S11'),
      fact('Joined Goku through Potara fusion as Vegito, who overwhelmed Super Buu; this was a combined achievement, not Vegeta alone.', 'S14'),
    ],
    style: 'Disciplined pressure, compact strikes and forceful ki volleys. Red God belongs to the Broly film here; no Super-TV SS3 or manga Ultra Ego preset.',
    trainingTip: 'Game drill: approach behind a blast, stop outside heavy range, and beam only after a confirmed opening.',
  },
  jiren: {
    summary: 'Universe 11\'s Pride Trooper ace in the Super Universe Survival era. Bald gray head, large dark eyes and a very broad, muscular torso.',
    achievements: [
      fact('Broke through Hit\'s Time Lag and knocked him out of the Tournament of Power.', 'S5', 'Dragon Ball Super manga'),
      fact('Neutralized Goku and Vegeta\'s combined beam attack, then eliminated Vegeta before eventually losing to Universe 7\'s teamwork.', 'S5', 'Dragon Ball Super manga'),
    ],
    style: 'Economical counter-striking and controlled bursts of strength. Full Power and Limit Break are power releases, never Saiyan forms.',
    trainingTip: 'Game drill: hold center, block the first attack, and commit to a heavy counter only after the opponent misses.',
  },
  frieza: {
    summary: 'The galactic emperor in a Z/Super final-form presentation. Smooth white-and-purple body, slender limbs and a long muscular tail; Golden is a separate transformation.',
    achievements: [
      fact('Built an interplanetary empire by conquering and subjugating worlds before his invasion of Namek.', 'S8'),
      fact('Charged Jiren out of bounds together with Goku at the Tournament of Power\'s climax, enabling Android 17\'s victory.', 'S24', 'Dragon Ball Super manga'),
    ],
    style: 'Precision ki zoning and tail-assisted reach. Earlier horned bodies are different forms; Black Frieza is outside this animation-scoped form pool.',
    trainingTip: 'Game drill: fire one blast, move sideways, and punish pursuit instead of holding a stationary firing line.',
  },
  beerus: {
    summary: 'Universe 7\'s God of Destruction, introduced in Battle of Gods. A slender purple feline with tall ears, long tail and a broad ceremonial collar.',
    achievements: [
      fact('Defeated Super Saiyan 3 Goku in just two hits during their first encounter.', 'S4', 'Dragon Ball Z: Battle of Gods animated film'),
      fact('Overpowered Earth\'s defenders at Bulma\'s party, then spared Earth after recognizing Goku\'s potential.', 'S4', 'Dragon Ball Z: Battle of Gods animated film'),
    ],
    style: 'Minimal-motion counters and destructive ki, contrasting a light frame with tremendous force. His selectable releases are game abstractions, not new canonical transformations.',
    trainingTip: 'Game drill: evade a committed heavy, answer once, then reset your spacing without chasing.',
  },
  gohan: {
    summary: 'Goku\'s half-Saiyan son, presented as an adult protector in Z/Super with Super Hero film forms. Lean muscular build, sharp forelock and Piccolo-inspired purple gi.',
    achievements: [
      fact('Awakened Super Saiyan 2 at the Cell Games and defeated the Cell Juniors attacking his allies.', 'S9'),
      fact('Destroyed Cell with a one-handed Kamehameha while supported by Goku from the afterlife.', 'S9'),
      fact('Had his latent potential drawn out by the Elder Supreme Kai before returning to confront Super Buu.', 'S14'),
    ],
    style: 'Protective counterattacks and explosive follow-through. Cell-era feats are childhood history, not adult events; Beast belongs to the Super Hero film.',
    trainingTip: 'Game drill: guard a short string, create space, and convert the next clean hit into a heavy finisher.',
  },
  piccolo: {
    summary: 'A Namekian warrior and mentor in Z/Super, with Super Hero film upgrades. Tall green body, antennae, pointed ears and long limbs; not the original Demon King.',
    achievements: [
      fact('Defeated Raditz with the Special Beam Cannon after Gohan weakened him and Goku held him in place.', 'S10'),
      fact('Trained Gohan during the year before Vegeta and Nappa arrived on Earth.', 'S10'),
      fact('Sacrificed his life by intercepting Nappa\'s attack to protect Gohan.', 'S10'),
    ],
    style: 'Analytical spacing, long-reach strikes and a carefully prepared piercing beam. Namekian fusion is a story event; Orange Piccolo is a film transformation.',
    trainingTip: 'Game drill: intercept an approach, retreat one step, then charge only while the opponent recovers.',
  },
  trunks: {
    summary: 'Future Trunks, not the present-day child. An athletic half-Saiyan with a sword and cropped jacket; the Super-era presentation uses blue hair and a red scarf.',
    achievements: [
      fact('Defeated Mecha Frieza and King Cold when they arrived on Earth.', 'S11'),
      fact('Warned Goku about the androids and brought medicine for the heart illness that killed him in Trunks\' future.', 'S11'),
      fact('Returned to his own timeline and defeated its Androids 17 and 18 and Cell after training in the past.', 'S11'),
    ],
    style: 'Decisive sword-and-ki bursts. Z\'s bulky power-up sacrificed speed; Super anime Rage is not Super Saiyan Blue.',
    trainingTip: 'Game drill: close distance after an enemy whiff, use a short sword rush, then evade out before retaliation.',
  },
  android18: {
    summary: 'A human-origin, perpetual-energy cyborg and Android 17\'s twin. Adult Z/Super presentation with a blonde bob and an athletic, human-looking build.',
    achievements: [
      fact('Defeated Super Saiyan Vegeta during the androids\' initial confrontation.', 'S14'),
      fact('Kicked Jewel out of the 25th Tenkaichi Budokai battle royale.', 'S12'),
      fact('Exposed Goten and Trunks inside Mighty Mask\'s disguise with a Kienzan, causing their disqualification; she later deliberately let Mr. Satan win.', 'S12'),
    ],
    style: 'Efficient kicks and sustained pressure. Perpetual energy does not grant invulnerability; Energy Overdrive is an original gameplay technique, not a canonical form.',
    trainingTip: 'Game drill: use short kick strings, maintain guard between them, and punish an opponent who exhausts their ki.',
  },
  cell: {
    summary: 'Perfect Cell from the Android/Cell era, a bio-engineered fighter with stolen cellular traits. Spotted green carapace, tall crown and black back plates; not Cell Max.',
    achievements: [
      fact('Absorbed Android 18 after Android 17 to attain his Perfect Form.', 'S13'),
      fact('Regenerated the damage from Vegeta\'s Final Flash and defeated him, then exposed Trunks\' power-heavy form\'s speed weakness.', 'S13'),
      fact('Regenerated from his surviving core after self-destruction and returned stronger, before Gohan finally destroyed him.', 'S13'),
    ],
    style: 'An analytical all-rounder with copied techniques and regeneration. Absorption and revival are narrative events, not an unrestricted in-game healing loop.',
    trainingTip: 'Game drill: identify a repeated approach, intercept it with a blast, and change your follow-up if it is blocked.',
  },
  buu: {
    summary: 'Good, round-bodied Buu in the late-Z/Super presentation: pink elastic body, head tentacle and white trousers. The early feats below concern fat Buu before his good/evil split.',
    achievements: [
      fact('Overpowered Gohan, the Supreme Kai and Dabura after Babidi released the original fat Buu.', 'S14'),
      fact('Survived Vegeta\'s self-sacrificing explosion, which failed to destroy fat Buu.', 'S14'),
    ],
    style: 'Elastic close-range brawling, irregular rhythm and sweet transmutation. Good Buu is not Kid Buu; Angry Power is a game-only release, not an absorption ladder.',
    trainingTip: 'Game drill: alternate a patient guard with a sudden close-range heavy instead of attacking at one fixed rhythm.',
  },
  hit: {
    summary: 'Universe 6\'s veteran assassin in Super. A tall purple humanoid with a segmented head and long armored coat that conceals his stance and legs.',
    achievements: [
      fact('Defeated Super Saiyan Blue Vegeta with Time Skip in the Universe 6 versus Universe 7 tournament.', 'S6', 'Dragon Ball Super manga'),
      fact('Reached the final bout against Monaka after Goku voluntarily left the ring, then deliberately conceded by ring-out.', 'S6', 'Dragon Ball Super manga'),
    ],
    style: 'Timing-based evasion and precise counters. Time Skip refinements are techniques, not Saiyan transformations; manga-specific limitations are not universal anime rules.',
    trainingTip: 'Game drill: evade the predictable second strike and use the counter window rather than trading repeated blows.',
  },
  broly: {
    summary: 'The kind-hearted Saiyan from Dragon Ball Super: Broly, not the Z-film incarnation. Massive muscular frame, wild hair and Ba\'s green ear-pelt around his waist.',
    achievements: [
      fact('Harnessed Great Ape power without becoming a giant ape and overpowered Super Saiyan God Vegeta and Goku.', 'S7', 'Dragon Ball Super: Broly animated film'),
      fact('As a Super Saiyan, deflected the combined Kamehameha and Galick Gun of Blue Goku and Vegeta.', 'S7', 'Dragon Ball Super: Broly animated film'),
      fact('Awakened Super Saiyan Full Power while fighting Gogeta; Cheelai\'s wish saved him from defeat, rather than Broly defeating Gogeta.', 'S7', 'Dragon Ball Super: Broly animated film'),
    ],
    style: 'An escalating close-range bruiser whose rage increases his size and disrupts his control. No invented SS2, SS3 or Blue forms.',
    trainingTip: 'Game drill: walk into heavy range behind guard, strike once on a clear opening, and avoid wasting ki on a missed chase.',
  },
  android17: {
    summary: 'Android 18\'s twin, a human-origin cyborg with perpetual energy. Super-era ranger presentation: lean athletic build, straight black hair and a green-and-white top.',
    achievements: [
      fact('Blocked Piccolo\'s surrounding ki blasts with his Barrier during their Android/Cell-era battle.', 'S21'),
      fact('Won the Tournament of Power as its last remaining fighter after Goku and Frieza went out of bounds with Jiren.', 'S24', 'Dragon Ball Super manga'),
      fact('Used the Super Dragon Balls prize to restore the other universes erased during the Tournament of Power.', 'S24', 'Dragon Ball Super manga'),
    ],
    style: 'Barrier defense, patient positioning and efficient ki use. Barrier Focus is an original game technique release, not Super 17 from GT or a Saiyan transformation.',
    trainingTip: 'Game drill: protect your position with guard, evade around an incoming beam, and counter while its user is recovering.',
  },
  krillin: {
    summary: 'An adult Earthling martial artist and Goku\'s longtime friend in Z/Super. Short, compact athletic build with a shaved head and six forehead marks.',
    achievements: [
      fact('Cut off the tip of second-form Frieza\'s tail with a Kienzan, interrupting his attack on Gohan.', 'S8'),
      fact('Helped Trunks destroy the larval Cell and Dr. Gero\'s laboratory in the present timeline.', 'S22'),
      fact('Asked Shenron to remove the explosives from Androids 17 and 18 after the Cell Games; the wish did not turn them back into ordinary humans.', 'S22'),
    ],
    style: 'Resourceful feints, Solar Flare distractions and precise disc attacks offset a short reach. Focused Ki is an original technique state, not a Saiyan form.',
    trainingTip: 'Game drill: approach at an angle, evade a heavy swing, and land a short counter before retreating.',
  },
  tien: {
    summary: 'Tien, called Tenshinhan in the official profiles, is an adult Earth martial artist of the former Crane School. Tall, muscular and bald, with a distinctive third eye.',
    achievements: [
      fact('Held second-form Cell back long enough for Android 18 to escape with the injured Android 16.', 'S14'),
      fact('Saved Dende by cancelling Super Buu\'s energy wave with a Kikoho; he did not defeat Buu.', 'S23'),
    ],
    style: 'Disciplined stances and committed Tri-Beam control, with precise hand positioning. Tri-Beam Focus is an original technique release, not a new canonical transformation.',
    trainingTip: 'Game drill: establish safe spacing, wait for a recovery window, and commit your beam only when the lane is clear.',
  },
});

for (const entry of Object.values(INTEL)) {
  Object.freeze(entry.achievements);
  Object.freeze(entry);
}
