# Development scope

- This assistant is the development agent. Use the existing non-main development branch, the dev database, and Vercel preview deployments.
- Keep application changes, migrations, and data cleanup in dev. Do not merge to main or make production changes as part of dev validation.
- Production work requires the user to confirm that dev works and explicitly authorize the move to production. Do not request production credentials for dev tasks.
- Provide the latest Vercel preview link when finishing a deployed change.
- The user approved the consolidated site wording pass. Keep My Votes; use Me for its navigation group and Profile for identity/privacy settings. Use icon, Friends to Find, Only by search, and Show community votes consistently. Use Top 3 Spotlight for the starred candy feature throughout the app; its purpose is to highlight candy players most want friends to send. Keep future Tier List display-style changes as discussion until requested.

- The current dev Tier List trial uses net support per 100 players: Want +1, Neutral 0, Don't Want -1. Negative scores go to Avoid in Standard/Fixed Scores; zero stays in C. Fixed Scores cutoffs are S 80+, A 50+, B 20+, C 0+. C is described as Lower priority. Keep SQL friend-card tiers consistent with Standard.
- Show Tier List support as whole numbers without a positive sign; retain the minus sign for negative scores and exact calculations for ranking. Tiny nonzero scores that would round to zero use <1 or −<1.
- Consensus shows Want/Neutral/Don't Want percentages instead of weighted support scores; its groups describe vote patterns, not score ranks.
- Consensus has three sections: Mostly Wanted, Mixed, Mostly Unwanted. Mixed includes Divisive and Mostly Neutral cards with small badges. A clear Want/Don't Want lead means the largest vote group and at least twice its opposing group; Divisive (25% on both sides) takes precedence.
