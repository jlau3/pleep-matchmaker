-- One-time onboarding replay for the contextual-help release. In production,
-- apply AFTER the reviewed expected-candy-fit bundle, alongside this app release.
-- Reset instructional progress only: identities, privacy, votes, Spotlight,
-- friends, requests and availability stay intact. Dev migration history prevents
-- this from resetting players again on later deploys.
update public.profiles set help_seen_version=0, setup_done=false,
  vote_guide_seen=false, match_guide_seen=false;
