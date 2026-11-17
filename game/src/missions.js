// NEON COAST — the story: four missions from three invented contacts, told in phone messages.
// Maya Solano, a fixer who works out of the Marina Deli, gives the new driver Jett Rivera a
// first errand and later a bolt-hole run; Dex Marlowe of Neon Spray wants a particular car;
// Vince Calloway's pier pickup closes the story with a timed run the whole force tries to stop.
// A mission is a list of stages; each stage has one objective point (or one car) and the text
// the HUD shows while it is live. The game layer runs them; this file only describes them.

/**
 * Build the mission chain against a world's named places.
 * Stage kinds: 'pickup' (reach the point on foot), 'deliver' (reach the point any way),
 * 'steal' (get into the marked car), 'reach' (reach the point, however hot it gets).
 */
export function buildMissions(world) {
  const P = world.places;
  return [
    {
      id: 'first-run',
      from: 'Maya Solano',
      name: 'First Run',
      reward: 350,
      intro: [
        { who: 'Maya Solano', text: 'Jett? Maya. You come recommended, so here is a small trust exercise.' },
        { who: 'Maya Solano', text: 'A package is waiting behind the Marina Deli, up on Solano Avenue. Pick it up — on foot, no drama.' },
        { who: 'Maya Solano', text: 'Then take it to the Pier 9 Diner on the promenade. My cousin runs the kitchen. Do not open it.' },
      ],
      done: [
        { who: 'Maya Solano', text: 'Delivered, sealed, no drama. You would be amazed how rare that is. Money sent.' },
      ],
      stages: [
        { kind: 'pickup', x: P.packageA.x, y: P.packageA.y, label: 'Pick up the package behind the Marina Deli (on foot)' },
        { kind: 'deliver', x: P.diner.x, y: P.diner.y, label: 'Deliver the package to the Pier 9 Diner' },
      ],
    },
    {
      id: 'hot-wheels',
      from: 'Dex Marlowe',
      name: 'Hot Wheels',
      reward: 600,
      intro: [
        { who: 'Dex Marlowe', text: 'Dex, Neon Spray. Maya says you can drive. Prove it the fun way.' },
        { who: 'Dex Marlowe', text: 'A coral Vantara GT is sitting in the lot on Coral Row with my name on it — spiritually. Take it.' },
        { who: 'Dex Marlowe', text: 'Bring it to my garage bay at Neon Spray. Mind the paint. Mind the police more.' },
      ],
      done: [
        { who: 'Dex Marlowe', text: 'That is the car, and barely a scratch. You are wasted on honest work, friend.' },
      ],
      stages: [
        { kind: 'steal', label: 'Steal the coral Vantara GT from the Coral Row lot' },
        { kind: 'deliver', x: P.sprayZone.x + P.sprayZone.w / 2, y: P.sprayZone.y + P.sprayZone.h / 2, label: 'Deliver the Vantara to the Neon Spray garage', needsMarkedCar: true },
      ],
    },
    {
      id: 'lay-low',
      from: 'Maya Solano',
      name: 'Lay Low',
      reward: 800,
      intro: [
        { who: 'Maya Solano', text: 'Change of plans, Jett. A job went loud and the Harbor Precinct has your description.' },
        { who: 'Maya Solano', text: 'They are already rolling — three stars of attention, give or take. Shake them or outrun them.' },
        { who: 'Maya Solano', text: 'There is a safehouse behind the old cannery, northwest corner of the city. Get there. Stay free.' },
      ],
      done: [
        { who: 'Maya Solano', text: 'You made it. Lie low tonight; the city forgets fast. One more job after this, a big one.' },
      ],
      startHeat: 540,
      stages: [
        { kind: 'reach', x: P.hideout.x, y: P.hideout.y, label: 'Reach the safehouse in the northwest, whatever it takes' },
      ],
    },
    {
      id: 'the-big-drop',
      from: 'Vince Calloway',
      name: 'The Big Drop',
      reward: 1500,
      intro: [
        { who: 'Vince Calloway', text: 'Vince Calloway. Maya vouches, Dex vouches, so I am out of excuses not to trust you.' },
        { who: 'Vince Calloway', text: 'A case is waiting at the end of the pier. The moment you lift it, every badge in Neon Coast will smell it.' },
        { who: 'Vince Calloway', text: 'Two minutes, pier to the harbor warehouse, southwest docks. Drive like the tide is behind you.' },
      ],
      done: [
        { who: 'Vince Calloway', text: 'That is how you close a story, driver. Neon Coast is yours now — go enjoy it.' },
        { who: 'Maya Solano', text: 'Heard you ran the Big Drop. Drinks at the Velvet Lounge are on me. — M' },
      ],
      stages: [
        { kind: 'pickup', x: P.pierPickup.x, y: P.pierPickup.y, label: 'Take the case from the end of the pier (on foot)', setsHeat: 540 },
        { kind: 'deliver', x: P.warehouse.x, y: P.warehouse.y, label: 'Deliver the case to the harbor warehouse', timer: 120 },
      ],
    },
  ];
}

/** The phone message that opens the whole story, before the first mission is offered. */
export const STORY_INTRO = [
  { who: 'Maya Solano', text: 'Welcome to Neon Coast, Jett. Sun, salt air, and more work than the law allows.' },
  { who: 'Maya Solano', text: 'I have a little job when you are ready. Follow the gold marker — and keep my number.' },
];
