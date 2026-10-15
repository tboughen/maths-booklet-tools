"""Scale the last post uniformly by 0.85, anchored on its wall base.

Its base centre is (441.5, 140.5). The two base ends remain on the
existing sloping wall edge. Rope attachment heights retain the original
5px separation: shrinking the post must not shrink the rope.
All other curves are retained exactly.
"""
import re

SCALE = .85
ANCHOR = (441.5, 140.5)
POST = [
    'C427.00,112.33 425.94,108.51 427.00,105.00',
    'C428.04,101.55 431.00,99.00 433.00,96.00',
    'C436.99,95.69 442.07,94.23 446.00,95.00',
    'C447.46,95.29 448.88,96.01 450.00,97.00',
    'C452.70,99.39 454.96,102.55 456.00,106.00',
    'C457.16,109.83 456.00,141.00 456.00,145.00',
    'C427.00,132.00 427.00,125.00 427.00,121.00',
]

def scaled_curve(curve):
    values=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',curve)))
    points=[(ANCHOR[0]+SCALE*(values[i]-ANCHOR[0]),
             ANCHOR[1]+SCALE*(values[i+1]-ANCHOR[1])) for i in range(0,6,2)]
    return 'C'+' '.join(f'{x:.4f},{y:.4f}' for x,y in points)

CHANGES={curve:scaled_curve(curve) for curve in POST}
# Keep the rope's original height and thickness; extend its end horizontally
# to the narrower post. The straight post sides meet those attachment heights.
CHANGES[POST[0]]='C429.1750,112.8805 428.2740,113.8085 429.1750,110.3250'
CHANGES[POST[-1]]='C429.1750,133.2750 429.1750,125.0000 429.1750,121.0000'
CHANGES.update({
    'C400.93,113.72 423.02,115.60 427.00,116.00':
    'C400.93,113.72 425.1950,115.6000 429.1750,116.0000',
    'C459.90,145.90 465.50,146.06 469.00,148.00':
    'C457.7250,145.2250 465.50,146.06 469.00,148.00',
    'C416.86,134.06 423.09,135.16 427.00,136.00':
    'C416.86,134.06 425.2650,135.8350 429.1750,136.6750',
    'C426.33,120.67 425.73,120.14 425.00,120.00':
    'C428.5050,120.6700 425.73,120.14 425.00,120.00',
})

def shrink_right_bollard(source):
    for before,after in CHANGES.items():
        assert source.count(before)==1, before
        source=source.replace(before,after)
    return source
