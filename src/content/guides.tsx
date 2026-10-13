/**
 * The Guides tab: general advice on spending candy. Each section is a heading
 * and a list of tips; edit freely. New-Pokémon notes live in ./meta.tsx and
 * show above these.
 */
export interface GuideSection {
  id: string;
  title: string;
  intro?: React.ReactNode;
  tips: { title: string; body: React.ReactNode }[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "who-to-send",
    title: "Who to send candy to",
    tips: [
      {
        title: "Rare species cost more candy",
        // TODO(owner): fill in the per-level candy cost for each group.
        body: (
          <p>
            Mythicals, legendaries and pseudo-legendaries all need more candy per level than other species. A handful of
            candy goes less far for them, so a big gift matters more.
          </p>
        ),
      },
      {
        title: "16-pip Pokémon are rare",
        body: (
          <p>
            Pokémon that need 16 pips to catch are rare in this game. If one ranks decently high on your friends&apos;
            Tier List, consider sending its candy over a common Pokémon that sits a tier higher.
          </p>
        ),
      },
    ],
  },
  {
    id: "levelling",
    title: "What levelling actually does",
    intro: (
      <p>
        Pokémon help a little faster as they level up, but the effect is tiny. Levelling just for speed isn&apos;t a
        good use of candy; level a Pokémon when it reaches a sub skill (levels 10, 25, 50, 75 and 100) or a milestone
        that helps it a lot. What counts as a milestone depends on its specialty:
      </p>
    ),
    tips: [
      {
        title: "Berry Pokémon: level to the cap",
        body: (
          <p>
            Berries get stronger with level, so berry Pokémon get the most out of every level up to the cap.
          </p>
        ),
      },
      {
        title: "Skill Pokémon with strength skills: level to the cap too",
        body: (
          <>
            <p>
              Skills like <b>Charge Strength M</b> or <b>Berry Burst</b> are there to add strength for Snorlax, and
              berries are part of that strength. A skill Pokémon still wants to trigger its skill, but the skill
              isn&apos;t its only source of strength.
            </p>
            <p>Its berries scale with level like any berry Pokémon&apos;s, so levelling it to the cap is a real boost.</p>
          </>
        ),
      },
      {
        title: "Ingredient Pokémon: aim for level 60",
        body: (
          <p>
            Ingredient Pokémon get their biggest boost at level 60. Getting there takes a lot of candy, but after 60 they
            don&apos;t need much more. Keep that in mind when deciding how much to send.
          </p>
        ),
      },
      {
        title: "Skill Pokémon with support skills: level to their best sub skill, then stop",
        body: (
          <p>
            Skills like <b>Extra Tasty</b> or <b>Pot Up</b> don&apos;t have levelling milestones. Their big boosts come
            from Main Skill Seeds instead. The most efficient use of candy is to level them to their best sub skill and
            leave them there.
          </p>
        ),
      },
    ],
  },
];
