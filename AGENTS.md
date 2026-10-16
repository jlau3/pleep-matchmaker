# Development scope

- This assistant is the development agent. Use the existing non-main development branch, the dev database, and Vercel preview deployments.
- Keep application changes, migrations, and data cleanup in dev. Do not merge to main or make production changes as part of dev validation.
- Production work requires the user to confirm that dev works and explicitly authorize the move to production. Do not request production credentials for dev tasks.
- Provide the latest Vercel preview link when finishing a deployed change.
- The user approved the consolidated site wording pass. Keep My Votes; use Me for its navigation group and Profile for identity/privacy settings. Use icon, Friends to Find, Only by search, and Show community votes consistently. Use Top 3 Spotlight for the starred candy feature throughout the app; its purpose is to highlight candy players most want friends to send. Keep future Tier List display-style changes as discussion until requested.

- The current dev Tier List trial uses net support per 100 players: Want +1, Neutral 0, Don't Want -2. Negative scores go to Avoid in Standard/Fixed Scores; zero stays in C. Fixed Scores cutoffs are S 80+, A 50+, B 20+, C 0+. C is described as Lower priority. Keep SQL friend-card tiers consistent with Standard.
