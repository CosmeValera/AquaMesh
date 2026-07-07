# Hosted Surface Cost Eval

Run: 2026-07-07T11:27:46.641Z
Mini model: gpt-5.4-mini
Nano model: gpt-5.4-nano
Pricing source: default_openai_rates_mini_0.75in_0.075cached_4.50out_nano_0.20in_0.02cached_1.25out

| Surface | Calls | Total cents | Avg cents/call | Best candidates |
| --- | ---: | ---: | ---: | --- |
| chat | 5 | 0.1226 | 0.0245 | nano_smalltalk: 0.0136c, q4, 29 words<br>nano_grounded_normal: 0.0188c, q4, 63 words<br>nano_source_gap_latest: 0.0131c, q5, 25 words<br>nano_multi_source_reasoning: 0.0320c, q4, 122 words<br>mini_source_gap_compare: 0.0452c, q5, 24 words |
| quiz | 5 | 1.5263 | 0.3053 | nano_current_medium_30: 0.3811c, q5, n=33<br>nano_lean_8: 0.1309c, q5, n=8<br>mini_blueprint_nano_10: 0.6383c, q3, n=10<br>mini_lean_8_compare: 0.3759c, q5, n=8 |
| flashcard | 5 | 0.8849 | 0.1770 | nano_current_medium_40: 0.1638c, q4, n=35<br>nano_lean_10: 0.0691c, q5, n=10<br>nano_technical_16: 0.0959c, q5, n=16<br>mini_blueprint_nano_12: 0.5562c, q5, n=12 |
| podcast | 5 | 0.7186 | 0.1437 | nano_current_target_520_850: 0.1127c, q5, 415 words, 2784 TTS chars<br>nano_compact_target_300_450: 0.0666c, q5, 232 words, 1495 TTS chars<br>nano_medium_target_420_620: 0.0788c, q5, 232 words, 1488 TTS chars<br>mini_current_target_520_850: 0.3480c, q5, 383 words, 2463 TTS chars<br>nano_current_long_source: 0.1125c, q5, 389 words, 2629 TTS chars |

## Calls

### chat
- nano_smalltalk (gpt-5.4-nano): 0.0136c, in 403, out 44
- nano_grounded_normal (gpt-5.4-nano): 0.0188c, in 415, out 84
- nano_source_gap_latest (gpt-5.4-nano): 0.0131c, in 410, out 39
- nano_multi_source_reasoning (gpt-5.4-nano): 0.0320c, in 545, out 169
- mini_source_gap_compare (gpt-5.4-mini): 0.0452c, in 410, out 32

### quiz
- nano_current_medium_30 (gpt-5.4-nano): 0.3811c, in 425, out 2981
- nano_lean_8 (gpt-5.4-nano): 0.1309c, in 410, out 982
- mini_blueprint_10 (gpt-5.4-mini): 0.4946c, in 462, out 1022
- mini_blueprint_nano_10 (gpt-5.4-nano): 0.1437c, in 1568, out 899
- mini_lean_8_compare (gpt-5.4-mini): 0.3759c, in 410, out 767

### flashcard
- nano_current_medium_40 (gpt-5.4-nano): 0.1638c, in 315, out 1260
- nano_lean_10 (gpt-5.4-nano): 0.0691c, in 315, out 502
- nano_technical_16 (gpt-5.4-nano): 0.0959c, in 319, out 716
- mini_blueprint_12 (gpt-5.4-mini): 0.4641c, in 344, out 974
- mini_blueprint_nano_12 (gpt-5.4-nano): 0.0921c, in 1522, out 493

### podcast
- nano_current_target_520_850 (gpt-5.4-nano): 0.1127c, in 368, out 843
- nano_compact_target_300_450 (gpt-5.4-nano): 0.0666c, in 344, out 478
- nano_medium_target_420_620 (gpt-5.4-nano): 0.0788c, in 353, out 574
- mini_current_target_520_850 (gpt-5.4-mini): 0.3480c, in 368, out 712
- nano_current_long_source (gpt-5.4-nano): 0.1125c, in 604, out 803
