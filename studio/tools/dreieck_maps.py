"""„Dreimacs“-Look: nur der Kopf wird zum Dreieck (Spitze oben), der Rest der Cam bleibt normal.
Pro Zeile wird das Kopfband (Halbbreite R um cx) in ein Dreieck der Halbbreite T(y) gestaucht; der Hintergrund links/rechts
wird passend gedehnt, damit nichts doppelt erscheint. Unterhalb des Kinns (y1) bleibt alles unverändert.
Nutzung: python dreieck_maps.py <breite> <hoehe> <ausgabeordner> <cx> <R> <y1_anteil>  → xmap.pgm, ymap.pgm"""
import sys, numpy as np
W, H, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
cx = float(sys.argv[4]) if len(sys.argv) > 4 else W / 2
R = float(sys.argv[5]) if len(sys.argv) > 5 else W * 0.25
y1 = float(sys.argv[6]) * H if len(sys.argv) > 6 else 0.85 * H
Y, X = np.mgrid[0:H, 0:W].astype(np.float64)
T = R * np.clip(Y / y1, 0.02, 1.0) ** 0.9
d = X - cx
ad = np.abs(d)
inner = ad <= T
xs_in = cx + d * (R / T)
edge = np.where(d < 0, cx, W - cx)
xs_out = cx + np.sign(d) * (R + (ad - T) * (edge - R) / np.maximum(edge - T, 1))
xs = np.clip(np.where(inner, xs_in, xs_out), 0, W - 1)
def pgm(path, a):
    a = np.clip(a, 0, 65535).astype('>u2')
    with open(path, 'wb') as f:
        f.write(f'P5 {W} {H} 65535\n'.encode()); f.write(a.tobytes())
pgm(f'{out}/xmap.pgm', xs); pgm(f'{out}/ymap.pgm', Y)
print('karten ok', W, H, 'cx', cx, 'R', R, 'y1', y1)
