/**
 * The Guides tab: general advice on spending candy. Each section is a heading
 * and a list of tips; edit freely. New-Pokémon notes live in ./meta.tsx and
 * show above these.
 */
/** Where to send players who want more meta discussion (end of the Guides tab). */
export const META_DISCORD_URL = "https://discord.gg/pokemonsleep";

export interface GuideSection {
  id: string;
  title: string;
  /** Shown under the title while the section is collapsed. */
  collapsed: string;
  intro?: React.ReactNode;
  /** Each tip is a bullet: the title in bold, then the body as running text. */
  tips: { title: string; body: React.ReactNode }[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "sending-candy",
    title: "Sending Candy to Your Friends",
    collapsed: "New to friends? How the candy you send is chosen.",
    intro: (
      <p>
        At the end of each research session you keep one photo, and that Pokémon&apos;s candy is what every friend gets
        from you when they open your sleep report.
      </p>
    ),
    tips: [
      {
        title: "The photo you keep is the candy you send",
        body: (
          <>
            When the session&apos;s photo first appears, tap it to pick a different Pokémon. If you&apos;ve already moved on
            to the next screen, you can still tap the photo to change it. Your Tier List shows which candy your friends
            want most.
          </>
        ),
      },
      {
        title: "Star rating doesn't change the candy",
        body: <>Stars reflect how rare the sleep style is. They don&apos;t change which candy your friends get or how many.</>,
      },
      {
        title: "Send candy people actually use",
        body: (
          <>
            Most players want candy for strong Pokémon they use often. Many remove friends who keep sending candy they
            don&apos;t want, or who autopick. Shinies are often forgiven. Not sure what to send? Check your Tier List.
          </>
        ),
      },
      {
        title: "Don't autopick",
        body: (
          <>
            Autopicking means always keeping the photo the game chooses. The game picks for high star ratings, shinies
            and new sleep styles, not for whether the Pokémon is worth building, so its pick is often candy nobody
            wants.
          </>
        ),
      },
      {
        title: "Fill your friend list early",
        body: (
          <>
            You can get candy from each friend once a day, so a full list of 50 means up to 50 candy a day. Sharing
            reports back and forth also raises your friendship levels, which come with rewards.
          </>
        ),
      },
      {
        title: "Friendship levels pay off",
        body: (
          <>
            Each new level brings a reward:
            <ul>
              <li>Level 1: 1 Handy Candy S</li>
              <li>Level 2: 1 Ingredient Ticket S</li>
              <li>Level 3: 1 Linking Cord</li>
              <li>Level 4: 2 Ingredient Ticket S</li>
              <li>Level 5: 2 Handy Candy S</li>
            </ul>
            Some events also give better odds on their currency with high-level friends, so a level 5 friend is worth
            keeping over starting a new friendship.
          </>
        ),
      },
    ],
  },
  {
    id: "candy-considerations",
    title: "Candy Considerations",
    collapsed: "Which candy goes furthest for your friends.",
    tips: [
      {
        title: "Rare species cost more candy",
        body: (
          <>
            Mythicals, legendaries and pseudo-legendaries need more candy per level than other species, so each candy you
            send matters more to them. If one sits just below a common Pokémon on your friends&apos; Tier List, it&apos;s
            often the better gift.
          </>
        ),
      },
      {
        title: "16-pip Pokémon are rare",
        body: (
          <>
            Pokémon that take 16 pips to catch are rare in this game. If one ranks decently high on your friends&apos;
            Tier List, consider sending its candy over a common Pokémon that sits a tier higher.
          </>
        ),
      },
    ],
  },
  {
    id: "leveling",
    title: "What Leveling Actually Does",
    collapsed: "When leveling is worth the candy, by specialty.",
    intro: (
      <p>
        Pokémon help a little faster as they level up, but the effect is tiny, so leveling just for speed isn&apos;t a
        good use of candy. Level a Pokémon when it&apos;s about to reach a sub skill (levels 10, 25, 50, 70 and 80) or a
        milestone that helps it a lot. What counts as a milestone depends on its specialty:
      </p>
    ),
    tips: [
      {
        title: "Berry Specialists: level to the cap",
        body: <>Berries get stronger with every level, so Berry Specialists get value out of each level all the way to the cap.</>,
      },
      {
        title: "Skill Specialists with strength skills: level to the cap too",
        body: (
          <>
            Skills like <b>Charge Strength M</b> and <b>Berry Burst</b> add strength for Snorlax, and berries add strength
            too. These Pokémon still want to trigger their skill, but it isn&apos;t their only source of strength, so
            leveling them to the cap is a real boost.
          </>
        ),
      },
      {
        title: "Ingredient Specialists: aim for level 30, then 60",
        body: (
          <>
            Ingredient Specialists get their biggest boosts at 30 and 60, when they unlock their second and third
            ingredients. Getting there takes a lot of candy, but after 60 they don&apos;t gain much beyond their sub skills
            at 70 and 80. Expect them to slide down your Tier List as your friends finish building theirs.
          </>
        ),
      },
      {
        title: "Skill Specialists with support skills: level to their best sub skill, then stop",
        body: (
          <>
            Skills like <b>Extra Tasty S</b> and <b>Dream Shard Magnet S</b> have no leveling milestones; their big
            boosts come from Main Skill Seeds. The best use of candy is to level them to their best sub skill and stop
            there.
          </>
        ),
      },
    ],
  },
];
