"""Trace the approved raster draft into self-contained SVG masters.

The input is read only. Paths retain its geometry; no font substitution is used.
Run with the bundled Python runtime (numpy and Pillow).
"""
from pathlib import Path
import argparse
import math
from wrapped_monogram import monogram_path
from bollard_perspective import shrink_right_bollard
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'brand'
NAVY, BLUE = '#173c65', '#0f62fe'


def simplify(points, epsilon=1.15):
    if len(points) <= 2:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    distances = [abs(dx * (a[1] - p[1]) - (a[0] - p[0]) * dy) / length
                 if length else math.dist(a, p) for p in points[1:-1]]
    if not distances or max(distances) <= epsilon:
        return [a, b]
    i = distances.index(max(distances)) + 1
    return simplify(points[:i + 1], epsilon)[:-1] + simplify(points[i:], epsilon)


def contours(mask):
    padded = np.pad(mask, 1)
    edges = {}
    def add(a, b):
        edges.setdefault(a, []).append(b)
    for y, x in zip(*np.where(mask & ~padded[:-2, 1:-1])):
        add((int(x), int(y)), (int(x + 1), int(y)))
    for y, x in zip(*np.where(mask & ~padded[1:-1, 2:])):
        add((int(x + 1), int(y)), (int(x + 1), int(y + 1)))
    for y, x in zip(*np.where(mask & ~padded[2:, 1:-1])):
        add((int(x + 1), int(y + 1)), (int(x), int(y + 1)))
    for y, x in zip(*np.where(mask & ~padded[1:-1, :-2])):
        add((int(x), int(y + 1)), (int(x), int(y)))
    loops = []
    while edges:
        start = next(iter(edges))
        points, current = [start], start
        while True:
            choices = edges[current]
            # Pixel corner contacts: follow the clockwise foreground boundary.
            if len(choices) > 1 and len(points) > 1:
                prev = points[-2]
                incoming = (current[0] - prev[0], current[1] - prev[1])
                choices.sort(key=lambda p: incoming[0] * (p[1] - current[1]) - incoming[1] * (p[0] - current[0]))
            following = choices.pop()
            if not choices:
                del edges[current]
            if following == start:
                break
            points.append(following)
            current = following
        area = sum(a[0] * b[1] - a[1] * b[0] for a, b in zip(points, points[1:] + points[:1])) / 2
        if abs(area) < 10:
            continue
        middle = max(range(len(points)), key=lambda i: math.dist(start, points[i]))
        poly = simplify(points[:middle + 1])[:-1] + simplify(points[middle:] + [start])[:-1]
        loops.append(poly)
    return loops


def unit(v):
    return v / max(0.00001, np.linalg.norm(v))


def path_data(loops):
    def f(p):
        return f'{p[0]:.2f},{p[1]:.2f}'
    paths = []
    for loop in loops:
        points = np.array(loop, dtype=float)
        tangents, corners = [], []
        for i, p in enumerate(points):
            a, b = unit(p-points[i-1]), unit(points[(i+1)%len(points)]-p)
            corners.append(np.dot(a,b) < math.cos(math.radians(35)))
            tangents.append(unit(a+b))
        commands = ['M'+f(points[0])]
        for i, p in enumerate(points):
            j = (i+1)%len(points)
            q = points[j]
            direction = unit(q-p)
            # Local controls cannot distort a corner or bow a long straight edge.
            distance = min(4, np.linalg.norm(q-p)/3)
            c1 = p + (direction if corners[i] else tangents[i])*distance
            c2 = q - (direction if corners[j] else tangents[j])*distance
            commands.append('C'+f(c1)+' '+f(c2)+' '+f(q))
        paths.append(' '.join(commands)+' Z')
    return ' '.join(paths)


def svg(width, height, content, title='Maths Dock'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"'
            f' role="img" aria-labelledby="title"><title id="title">{title}</title>{content}</svg>\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('approved_draft', type=Path)
    parser.add_argument('--output-root', type=Path, default=ROOT)
    args = parser.parse_args()
    out = args.output_root / 'public' / 'brand'
    image = np.array(Image.open(args.approved_draft).convert('RGB')).astype(int)
    # Approved full-size symbol occupies this rectangle in the review board.
    icon = image[100:426, 184:691]
    text = image[226:363, 764:1685]
    def navy(a):
        return (a[:, :, 2] > a[:, :, 0] + 35) & (a[:, :, 1] < 160) & (a[:, :, 0] < 120) & (a[:, :, 2] < 210)
    def blue(a):
        return (a[:, :, 2] > 210) & (a[:, :, 0] < 100) & (a[:, :, 1] < 190)
    wall_loops = contours(navy(icon))
    # Remove only the isolated M contour; a rectangular erase would also trim
    # the nearby sloping wall/rope edge above its right corner.
    wall_loops = [loop for loop in wall_loops if not (
        min(p[0] for p in loop) >= 113 and max(p[0] for p in loop) <= 307
        and min(p[1] for p in loop) >= 100 and max(p[1] for p in loop) <= 259)]
    shapes = {'wall': path_data(wall_loops), 'water': path_data(contours(blue(icon))),
              'wordmark': path_data(contours(navy(text)))}
    # The M has straight geometric edges, not the raster's incidental pixel noise.
    shapes['wall'] = shrink_right_bollard(shapes['wall'])
    shapes['wall'] += ' ' + monogram_path()
    out.mkdir(parents=True, exist_ok=True)
    def symbol(ink=NAVY, water=BLUE):
        return f'<path fill="{ink}" fill-rule="evenodd" d="{shapes["wall"]}"/><path fill="{water}" fill-rule="evenodd" d="{shapes["water"]}"/>'
    def lockup(ink=NAVY, water=BLUE):
        return symbol(ink, water) + f'<path transform="translate(580 126)" fill="{ink}" fill-rule="evenodd" d="{shapes["wordmark"]}"/>'
    (out / 'mathsdock-icon.svg').write_text(svg(507, 326, symbol()), encoding='utf-8')
    (out / 'mathsdock-icon-inverse.svg').write_text(svg(507, 326, symbol('#fff', '#2bb8ff')), encoding='utf-8')
    (out / 'mathsdock-logo.svg').write_text(svg(1501, 326, lockup()), encoding='utf-8')
    (out / 'mathsdock-logo-inverse.svg').write_text(svg(1501, 326, lockup('#fff', '#2bb8ff')), encoding='utf-8')
    (out / 'mathsdock-icon-mono.svg').write_text(svg(507, 326, symbol('currentColor', 'currentColor')), encoding='utf-8')
    # Full symbol retained in favicons, with a clear white ground in either browser theme.
    square = '<rect width="512" height="512" rx="64" fill="#fff"/><g transform="translate(26 108) scale(.9073)">' + symbol() + '</g>'
    (args.output_root / 'public' / 'favicon.svg').write_text(svg(512, 512, square), encoding='utf-8')
    social = '<rect width="1200" height="630" fill="#fff"/><g transform="translate(90 205) scale(.68)">' + lockup() + '</g>'
    (out / 'mathsdock-social.svg').write_text(svg(1200, 630, social), encoding='utf-8')
    print('Created six SVG masters and favicon.svg; outlined wordmark, no font dependencies.')


if __name__ == '__main__':
    main()
