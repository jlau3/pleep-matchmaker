-- Pumpkaboo and Gourgeist are one profile icon each now, not one per size
-- (scripts/build_avatars.py). Saved picks like 'pumpkaboo_small:happy' become
-- 'pumpkaboo:happy'; the app also reads the old keys. Safe to re-run.
update public.profiles
set game_avatar = regexp_replace(game_avatar, '^(pumpkaboo|gourgeist)_(small|medium|large|jumbo):', '\1:')
where game_avatar ~ '^(pumpkaboo|gourgeist)_(small|medium|large|jumbo):';
