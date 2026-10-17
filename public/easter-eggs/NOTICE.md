# Snorlax surprise artwork

The Snorlax sprites requested for this feature are from Pokémon Emerald,
original game artwork by Game Freak / The Pokémon Company / Nintendo.
Sources supplied by the user:

- https://archives.bulbagarden.net/media/upload/4/47/Spr_3e_143.png
- https://archives.bulbagarden.net/media/upload/3/3f/Spr_3e_143_s.png

`scripts/prepare_snorlax.py` preserves the animated sprite frames and timing,
sets playback to one cycle, and extracts the first/last static frames used by
the interaction. Falling motion is applied separately in the page.
