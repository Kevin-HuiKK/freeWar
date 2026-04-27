#!/usr/bin/env python3
"""Generate V3/data/map.json — 40 territories on a 1400×800 archipelago.

Six nations, each with one capital fortress (heavy DEF) and a mix of terrain
including some "natural fortress" choke points (mountain/fortress combos).
"""
import json, math, random, os

random.seed(7)

# (id, name_en, owner, terrain, isCapital, cx, cy)
TERRITORIES = [
    # === Forest Tribe (NW small island chain, 5) ===
    ("T01", "Forest Camp",   "teal",   "fortress", True,  170, 100),
    ("T02", "Old Trees",     "teal",   "forest",   False, 280,  90),
    ("T03", "Misty Vale",    "teal",   "forest",   False, 100, 200),
    ("T04", "Hunter Ridge",  "teal",   "mountain", False, 250, 200),
    ("T05", "Wild Glade",    "teal",   "forest",   False, 180, 250),

    # === Green Empire (N main island, 8) ===
    ("T06", "Green Capital", "green",  "fortress", True,  520, 130),
    ("T07", "Wheat Fields",  "green",  "plain",    False, 640, 200),
    ("T08", "Twin Rivers",   "green",  "plain",    False, 620,  80),
    ("T09", "Emerald Wood",  "green",  "forest",   False, 440, 220),
    ("T10", "North Watch",   "green",  "mountain", False, 580,  60),
    ("T11", "Mirror Lake",   "green",  "coast",    False, 410,  90),
    ("T12", "Royal Pasture", "green",  "plain",    False, 740, 130),
    ("T13", "Border Hill",   "green",  "mountain", False, 770, 240),

    # === Red Republic (E side, 8) ===
    ("T14", "Red Capital",   "red",    "fortress", True,  990, 240),
    ("T15", "Volcano",       "red",    "mountain", False,1080, 170),
    ("T16", "Burnt Plains",  "red",    "plain",    False, 920, 340),
    ("T17", "Steel Works",   "red",    "plain",    False,1080, 360),
    ("T18", "East Port",     "red",    "coast",    False,1230, 280),
    ("T19", "Frontier",      "red",    "plain",    False, 880, 130),
    ("T20", "Iron Pass",     "red",    "fortress", False,1170, 260),
    ("T21", "Lava Fields",   "red",    "mountain", False,1240, 180),

    # === Sand Kingdom (Center, 7) ===
    ("T22", "Sand Capital",  "yellow", "fortress", True,  620, 410),
    ("T23", "Gold Mine",     "yellow", "mountain", False, 520, 470),
    ("T24", "Oasis",         "yellow", "desert",   False, 720, 470),
    ("T25", "Sand Sea",      "yellow", "desert",   False, 640, 540),
    ("T26", "Crossroads",    "yellow", "plain",    False, 510, 360),
    ("T27", "Camel Road",    "yellow", "desert",   False, 770, 360),
    ("T28", "Salt Flats",    "yellow", "desert",   False, 510, 580),

    # === Blue Federation (SW small island, 6) ===
    ("T29", "Blue Bay",      "blue",   "fortress", True,  140, 580),
    ("T30", "South Reef",    "blue",   "coast",    False, 250, 660),
    ("T31", "White Beach",   "blue",   "plain",    False, 260, 540),
    ("T32", "West Cape",     "blue",   "coast",    False,  80, 470),
    ("T33", "Blue Hills",    "blue",   "forest",   False, 350, 590),
    ("T34", "Fishing Town",  "blue",   "coast",    False, 200, 690),

    # === Stone Alliance (SE side, 6) ===
    ("T35", "Stone Capital", "black",  "fortress", True, 1090, 580),
    ("T36", "Black Cliff",   "black",  "mountain", False,1210, 540),
    ("T37", "Coal Mine",     "black",  "mountain", False, 990, 640),
    ("T38", "Iron Hills",    "black",  "mountain", False,1180, 670),
    ("T39", "South Coast",   "black",  "coast",    False,1090, 740),
    ("T40", "Border Pass",   "black",  "fortress", False, 940, 560),
]

# Hand-curated edges (a, b) = land neighbor, (a, b, True) = sea hop.
EDGES = [
    # Forest Tribe internal
    ("T01","T02"),("T01","T03"),("T01","T04"),("T01","T05"),
    ("T02","T04"),("T03","T05"),("T04","T05"),
    # Green Empire internal
    ("T06","T08"),("T06","T09"),("T06","T10"),("T06","T11"),
    ("T07","T08"),("T07","T09"),("T07","T12"),("T07","T13"),
    ("T08","T10"),("T09","T11"),("T12","T13"),("T10","T08"),
    # Red Republic internal
    ("T14","T15"),("T14","T16"),("T14","T17"),("T14","T19"),("T14","T20"),
    ("T15","T19"),("T15","T21"),("T16","T17"),("T17","T18"),("T17","T20"),
    ("T18","T20"),("T18","T21"),("T20","T21"),
    # Sand Kingdom internal
    ("T22","T23"),("T22","T24"),("T22","T25"),("T22","T26"),("T22","T27"),
    ("T23","T25"),("T23","T26"),("T23","T28"),("T24","T25"),("T24","T27"),
    ("T25","T28"),
    # Blue Federation internal
    ("T29","T30"),("T29","T31"),("T29","T32"),("T29","T34"),
    ("T30","T31"),("T30","T33"),("T30","T34"),("T31","T33"),("T32","T29"),
    # Stone Alliance internal
    ("T35","T36"),("T35","T37"),("T35","T38"),("T35","T39"),("T35","T40"),
    ("T36","T38"),("T37","T39"),("T37","T40"),("T38","T39"),
    # === Inter-nation borders (the hot fronts) ===
    # Green vs Sand
    ("T09","T26"),("T13","T27"),
    # Sand vs Red
    ("T27","T16"),("T13","T19"),
    # Sand vs Stone
    ("T28","T40"),("T25","T37"),
    # Sand vs Blue
    ("T26","T31"),("T28","T33"),
    # Red vs Stone
    ("T17","T36"),("T17","T20"),  # iron pass
    # Forest Tribe → Green (sea)
    ("T02","T11", True),("T04","T09", True),
    # Forest Tribe → Blue (sea)
    ("T03","T32", True),
    # Blue → Sand (sea via west)
    ("T32","T26", True),("T33","T23", True),
    # Stone → Red (sea hops)
    ("T36","T18", True),("T39","T28", True),
    # Blue → Stone (long sea)
    ("T34","T39", True),
]


def hex_polygon(cx, cy, r=58, irregularity=0.18):
    pts = []
    for i in range(6):
        angle = (i / 6) * 2 * math.pi + math.pi / 6
        rr = r * (1 + random.uniform(-irregularity, irregularity))
        x = cx + rr * math.cos(angle)
        y = cy + rr * math.sin(angle)
        pts.append([round(x, 1), round(y, 1)])
    return pts


def main():
    territories, by_id = [], {}
    for tid, name, owner, terrain, is_cap, cx, cy in TERRITORIES:
        # Capitals get bigger polygons
        r = 66 if is_cap else 56
        poly = hex_polygon(cx, cy, r=r)
        t = {
            "id": tid, "name": name, "owner": owner, "terrain": terrain,
            "polygon": poly, "center": [cx, cy],
            "isCapital": is_cap, "neighbors": [], "seaLinks": [],
        }
        territories.append(t)
        by_id[tid] = t

    for edge in EDGES:
        if len(edge) == 2:
            a, b = edge; sea = False
        else:
            a, b, sea = edge
        if sea:
            by_id[a]["seaLinks"].append(b)
            by_id[b]["seaLinks"].append(a)
        else:
            by_id[a]["neighbors"].append(b)
            by_id[b]["neighbors"].append(a)

    out = {
        "_note": "Hand-laid 40-territory map; 6 nations; fortress terrain marks natural strongpoints.",
        "width": 1400, "height": 800,
        "territories": territories,
    }
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "map.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(territories)} territories → {out_path}")


if __name__ == "__main__":
    main()
