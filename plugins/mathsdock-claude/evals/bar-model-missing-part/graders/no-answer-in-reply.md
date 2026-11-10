---
type: 'regex'
target: 'last_message'
pattern: '(?:other part|missing part|answer)\s*(?:is|=|:)\s*28\b'
flags: 'i'
match: 'not_contains'
---
The reply does not give the answer.
