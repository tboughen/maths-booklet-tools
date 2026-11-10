---
type: 'regex'
target: 'last_message'
pattern: '(?:can(?:''|’)?t|cannot|do(?:es)?n(?:''|’)?t|do(?:es)? not|is(?:n(?:''|’)?t| not)|not able to)[^.\n]{0,60}histogram|histograms?[^.\n]{0,60}(?:not supported|unsupported|isn(?:''|’)?t supported|aren(?:''|’)?t supported|not available)'
flags: 'i'
---
The reply says the connector cannot draw histograms.
