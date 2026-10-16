# Development scope

- This assistant is the development agent. Use the existing non-main development branch, the dev database, and Vercel preview deployments.
- Keep application changes, migrations, and data cleanup in dev. Do not merge to main or make production changes as part of dev validation.
- Production work requires the user to confirm that dev works and explicitly authorize the move to production. Do not request production credentials for dev tasks.
- Provide the latest Vercel preview link when finishing a deployed change.
- The user approved the consolidated site wording pass. Keep My Votes; use Me for its navigation group and Profile for identity/privacy settings. Use icon, Friends to Find, Only by search, and Show community votes consistently. Use Top 3 Spotlight for the starred candy feature throughout the app; its purpose is to highlight candy players most want friends to send. Keep future Tier List display-style changes as discussion until requested.

- The current dev Tier List trial uses Want +1, Neutral 0, Don't Want -0.5 per player who has seen the candy (My Friends uses its voting friend count). Negative scores go to F; zero stays in C. Percentile splits positive scores 10/20/30/40, keeping ties together; the highest tie is always S. Fixed Scores cutoffs are S 75+, A 50+, B 25+, C 0+. Keep SQL friend-card tiers consistent with Percentile.
- Show scores as whole numbers toward zero, without a positive sign; retain the minus sign and full precision for ranking. Tiny nonzero scores use <1 or −<1. Positive scores display /100. Counts are public from 10 players seen; Everyone rankings and Spotlight require 50.
- Preserve the selected style explicitly in shared URLs, including style=standard (Percentile). Ordinary navigation restores the last-used style. Include ranking style in exports.
- Match demand blends real voting friends with five Everyone stand-ins. Each directional score shows its source: Everyone estimate, Friends + Everyone, or Friends. My Friends calculates Everyone rates once per RPC, with no persistent cache. Missing-score explanations distinguish the viewer's votes from the other player's votes.
- Consensus shows Want/Neutral/Don't Want percentages instead of weighted support scores; its groups describe vote patterns, not score ranks.
- Consensus has three sections: Mostly Wanted, Mixed, Mostly Unwanted. Mixed includes Divisive and Mostly Neutral cards with small badges. A clear Want/Don't Want lead means the largest vote group and at least twice its opposing group; Divisive (at least one-third on both sides) takes precedence.
