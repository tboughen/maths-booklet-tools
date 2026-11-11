---
type: 'regex'
target: 'last_message'
pattern: '^(?=[\s\S]*\bpupil (?:version|copy|diagram|sheet))(?=[\s\S]*\banswers? (?:version|copy|key|diagram|sheet))'
flags: 'i'
---
The reply gives both the pupil version and the answer version.
