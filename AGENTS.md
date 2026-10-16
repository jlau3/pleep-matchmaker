# Development scope

- This assistant is the development agent. Use the existing non-main development branch, the dev database, and Vercel preview deployments.
- Keep application changes, migrations, and data cleanup in dev. Do not merge to main or make production changes as part of dev validation.
- Production work requires the user to confirm that dev works and explicitly authorize the move to production. Do not request production credentials for dev tasks.
- Provide the latest Vercel preview link when finishing a deployed change.
- The broad site wording review is proposals only until the user approves that copy pass. Specifically requested copy edits may proceed.
