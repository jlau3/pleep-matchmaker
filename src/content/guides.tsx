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
  intro?: React.ReactNode;
  tips: { title: string; body: React.ReactNode }[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "candy-considerations",
    title: "Candy Considerations",
    tips: [
      {
        title: "Rare species cost more candy",
        body: (
          <p>
            Mythicals, legendaries and pseudo-legendaries need more candy per level than other species, so each candy you
            send matters more to them. If one sits just below a common Pokémon on your friends&apos; Tier List, it&apos;s
            often the better gift.
          </p>
        ),
      },
      {
        title: "16-pip Pokémon are rare",
        body: (
          <p>
            Pokémon that take 16 pips to catch are rare in this game. If one ranks decently high on your friends&apos;
            Tier List, consider sending its candy over a common Pokémon that sits a tier higher.
          </p>
        ),
      },
    ],
  },
  {
    id: "leveling",
    title: "What leveling actually does",
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
        body: <p>Berries get stronger with every level, so Berry Specialists get value out of each level all the way to the cap.</p>,
      },
      {
        title: "Skill Specialists with strength skills: level to the cap too",
        body: (
          <p>
            Skills like <b>Charge Strength M</b> and <b>Berry Burst</b> add strength for Snorlax, and berries add strength
            too. These Pokémon still want to trigger their skill, but it isn&apos;t their only source of strength, so
            leveling them to the cap is a real boost.
          </p>
        ),
      },
      {
        title: "Ingredient Specialists: aim for level 30, then 60",
        body: (
          <p>
            Ingredient Specialists get their biggest boosts at 30 and 60, when they unlock their second and third
            ingredients. Getting there takes a lot of candy, but after 60 they don&apos;t gain much beyond their sub skills
            at 70 and 80. Expect them to slide down your Tier List as your friends finish building theirs.
          </p>
        ),
      },
      {
        title: "Skill Specialists with support skills: level to their best sub skill, then stop",
        body: (
          <p>
            Skills like <b>Extra Tasty S</b> and <b>Dream Shard Magnet S</b> have no leveling milestones; their big
            boosts come from Main Skill Seeds. The best use of candy is to level them to their best sub skill and stop
            there.
          </p>
        ),
      },
    ],
  },
];
