#!/usr/bin/env python3
"""Generate V3/data/map.json — 28 territories on islands.

Hand-laid out centers for 5 nations (player + 4 AI). Each territory gets a
slightly-irregular hex polygon. Adjacency is hand-curated to match the
intended island geography (land-bridges within an island, sea hops between
islands handled later by amphibious units).
"""
import json, math, random, os

random.seed(42)

# Format: (id, name, owner, terrain, isCapital, cx, cy)
# owner codes: blue/green/red/yellow/teal (青林=teal)
TERRITORIES = [
    # --- 蓝海联邦 (player, SW small island) ---
    ("T01", "蓝湾港",   "blue",   "coast",    True,   140, 510),
    ("T02", "南珊瑚礁", "blue",   "coast",    False,  220, 580),
    ("T03", "白沙滩",   "blue",   "plain",    False,  240, 480),
    ("T04", "西海岬",   "blue",   "coast",    False,  100, 410),
    ("T05", "蓝山林",   "blue",   "forest",   False,  320, 540),
    ("T06", "渔村",     "blue",   "coast",    False,  180, 620),

    # --- 青林部落 (NW small island) ---
    ("T07", "青林营地", "teal",   "forest",   True,   180, 110),
    ("T08", "古树林",   "teal",   "forest",   False,  280, 80),
    ("T09", "薄雾谷",   "teal",   "forest",   False,  120, 200),
    ("T10", "猎人岭",   "teal",   "mountain", False,  280, 180),

    # --- 绿原帝国 (N of main island) ---
    ("T11", "绿原都城", "green",  "plain",    True,   480, 130),
    ("T12", "麦田",     "green",  "plain",    False,  580, 200),
    ("T13", "翠林",     "green",  "forest",   False,  420, 220),
    ("T14", "北哨所",   "green",  "mountain", False,  560, 90),
    ("T15", "镜湖",     "green",  "coast",    False,  390, 90),
    ("T16", "皇家牧场", "green",  "plain",    False,  680, 150),

    # --- 黄沙王国 (center) ---
    ("T17", "黄沙王城", "yellow", "desert",   True,   560, 320),
    ("T18", "金矿",     "yellow", "mountain", False,  470, 380),
    ("T19", "绿洲",     "yellow", "desert",   False,  640, 380),
    ("T20", "沙海",     "yellow", "desert",   False,  560, 440),
    ("T21", "丘陵",     "yellow", "mountain", False,  450, 290),
    ("T22", "驼商道",   "yellow", "desert",   False,  680, 280),

    # --- 红焰共和国 (E of main island) ---
    ("T23", "红焰首府", "red",    "plain",    True,   880, 230),
    ("T24", "火山口",   "red",    "mountain", False,  990, 180),
    ("T25", "焦土平原", "red",    "plain",    False,  820, 340),
    ("T26", "钢铁厂",   "red",    "plain",    False,  960, 320),
    ("T27", "东港",     "red",    "coast",    False,  1050, 280),
    ("T28", "边境村",   "red",    "plain",    False,  790, 130),
]

# Hand-curated adjacency (id pairs). Each entry adds bidirectional edge.
# Includes both land bridges and short sea-strait crossings.
EDGES = [
    # 蓝海联邦 internal
    ("T01","T03"),("T01","T04"),("T01","T06"),("T03","T05"),("T05","T02"),
    ("T02","T06"),("T03","T02"),("T04","T03"),
    # 青林部落 internal
    ("T07","T08"),("T07","T09"),("T07","T10"),("T08","T10"),("T09","T10"),
    # 绿原帝国 internal
    ("T11","T13"),("T11","T15"),("T11","T14"),("T11","T12"),("T12","T16"),
    ("T12","T13"),("T13","T15"),("T14","T16"),("T14","T15"),
    # 黄沙王国 internal
    ("T17","T18"),("T17","T19"),("T17","T20"),("T17","T21"),("T17","T22"),
    ("T18","T20"),("T19","T20"),("T19","T22"),("T21","T18"),
    # 红焰共和国 internal
    ("T23","T24"),("T23","T25"),("T23","T26"),("T23","T28"),("T24","T26"),
    ("T24","T28"),("T25","T26"),("T26","T27"),
    # Inter-nation borders (the contested fronts)
    ("T13","T21"),  # 绿原-黄沙
    ("T12","T22"),  # 绿原-黄沙
    ("T16","T22"),  # 绿原-红焰
    ("T22","T25"),  # 黄沙-红焰
    ("T19","T25"),  # 黄沙-红焰
    ("T28","T16"),  # 红焰-绿原
    ("T14","T28"),  # 绿原-红焰
    # Sea crossings (only for naval / amphibious units, marked sea=true)
    # 蓝海->黄沙
    ("T05","T18", True), ("T04","T13", True),
    # 青林->绿原
    ("T08","T15", True), ("T10","T13", True),
]


def hex_polygon(cx, cy, r=55, irregularity=0.18):
    """Generate a 6-sided polygon with slight per-vertex radius noise."""
    pts = []
    for i in range(6):
        angle = (i / 6) * 2 * math.pi + math.pi / 6  # flat-top hex
        rr = r * (1 + random.uniform(-irregularity, irregularity))
        x = cx + rr * math.cos(angle)
        y = cy + rr * math.sin(angle)
        pts.append([round(x, 1), round(y, 1)])
    return pts


def main():
    territories = []
    by_id = {}
    for tid, name, owner, terrain, is_cap, cx, cy in TERRITORIES:
        poly = hex_polygon(cx, cy)
        t = {
            "id": tid,
            "name": name,
            "owner": owner,
            "terrain": terrain,
            "polygon": poly,
            "center": [cx, cy],
            "isCapital": is_cap,
            "neighbors": [],
            "seaLinks": [],
        }
        territories.append(t)
        by_id[tid] = t

    for edge in EDGES:
        if len(edge) == 2:
            a, b = edge
            sea = False
        else:
            a, b, sea = edge
        if sea:
            by_id[a]["seaLinks"].append(b)
            by_id[b]["seaLinks"].append(a)
        else:
            by_id[a]["neighbors"].append(b)
            by_id[b]["neighbors"].append(a)

    out = {
        "_note": "Hand-laid map; polygons generated by tools/gen_map.py.",
        "width": 1200,
        "height": 700,
        "territories": territories,
    }
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "map.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(territories)} territories → {out_path}")


if __name__ == "__main__":
    main()
