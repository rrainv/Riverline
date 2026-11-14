#!/usr/bin/env python3
"""Independent exact Hold'em equity evaluator by full enumeration.

Source of golden numbers for Riverline. Never replace its output with a typed or model-estimated value.

Usage:
  python tools/eqexact.py --section8                  # JSON fixtures for all verified figures in 04_DESIGN_SPEC.md section 8
  python tools/eqexact.py match Ks8h4h AdKd QsQc      # 2-to-N player exact equity
  python tools/eqexact.py turn Qh7c2h AhKh QsQc       # Exact equity for every remaining turn card
  python tools/eqexact.py vs-any Ks8h4h KdJd          # Exact equity against all remaining two-card hands
"""
import itertools
import json
import sys

R = '23456789TJQKA'
SUIT_MAP = {'♠': 's', '♥': 'h', '♦': 'd', '♣': 'c'}


def rk(c):
    return R.index(c[0])


def parse_cards(spec):
    if isinstance(spec, (list, tuple)):
        return list(spec)
    s = spec.strip()
    for k, v in SUIT_MAP.items():
        s = s.replace(k, v)
    s = s.replace(' ', '').replace(',', '')
    if len(s) % 2 != 0:
        raise ValueError(f'Invalid card string: {spec!r}')
    cards = [s[i : i + 2] for i in range(0, len(s), 2)]
    for c in cards:
        if c[0] not in R or c[1] not in 'shdc':
            raise ValueError(f'Invalid card {c!r} in {spec!r}')
    return cards


def score(cards):
    ranks = sorted((rk(c) for c in cards), reverse=True)
    cnt = {}
    for r in ranks:
        cnt[r] = cnt.get(r, 0) + 1
    suits = {}
    for c in cards:
        suits.setdefault(c[1], []).append(rk(c))
    flush = None
    for s, v in suits.items():
        if len(v) >= 5:
            flush = sorted(v, reverse=True)

    def straight(vals):
        u = sorted(set(vals), reverse=True)
        if 12 in u:
            u.append(-1)
        for i in range(len(u) - 4):
            if u[i] - u[i + 4] == 4:
                return u[i]
        return None

    if flush:
        sf = straight(flush)
        if sf is not None:
            return (8, sf)
    groups = sorted(cnt.items(), key=lambda x: (x[1], x[0]), reverse=True)
    if groups[0][1] == 4:
        kick = max(r for r in cnt if r != groups[0][0])
        return (7, groups[0][0], kick)
    trips = [r for r, c in groups if c == 3]
    pairs = [r for r, c in groups if c == 2]
    if trips and (len(trips) > 1 or pairs):
        t = trips[0]
        p = max([x for x in trips[1:]] + pairs)
        return (6, t, p)
    if flush:
        return (5,) + tuple(flush[:5])
    st = straight(ranks)
    if st is not None:
        return (4, st)
    if trips:
        t = trips[0]
        k = [r for r in ranks if r != t][:2]
        return (3, t) + tuple(k)
    if len(pairs) >= 2:
        a, b = pairs[0], pairs[1]
        k = max(r for r in ranks if r not in (a, b))
        return (2, a, b, k)
    if pairs:
        p = pairs[0]
        k = [r for r in ranks if r != p][:3]
        return (1, p) + tuple(k)
    return (0,) + tuple(ranks[:5])


DECK = [r + s for r in R for s in 'shdc']


def eq_vs_hand(hero, vill, board):
    used = set(hero + vill + board)
    rest = [c for c in DECK if c not in used]
    w = t = n = 0
    for run in itertools.combinations(rest, 5 - len(board)):
        b = board + list(run)
        a = score(hero + b)
        v = score(vill + b)
        n += 1
        if a > v:
            w += 1
        elif a == v:
            t += 1
    return (w + t / 2) / n, w, t, n


def eq_multiway(hands, board):
    hands = [parse_cards(h) for h in hands]
    board = parse_cards(board)
    used = set(board)
    for h in hands:
        used.update(h)
    rest = [c for c in DECK if c not in used]
    k = len(hands)
    shares = [0.0] * k
    wins = [0] * k
    ties = [0] * k
    n = 0
    for run in itertools.combinations(rest, 5 - len(board)):
        b = board + list(run)
        sc = [score(h + b) for h in hands]
        mx = max(sc)
        winners = [i for i, s in enumerate(sc) if s == mx]
        if len(winners) == 1:
            wins[winners[0]] += 1
            shares[winners[0]] += 1.0
        else:
            share = 1.0 / len(winners)
            for i in winners:
                ties[i] += 1
                shares[i] += share
        n += 1
    return {
        'runouts': n,
        'equities': [s / n for s in shares],
        'equities_pct_1dp': [round(100.0 * s / n, 1) for s in shares],
        'wins': wins,
        'ties': ties,
    }


def eq_vs_any(hero, board):
    hero = parse_cards(hero)
    board = parse_cards(board)
    used = set(hero + board)
    rest = [c for c in DECK if c not in used]
    w = t = n = 0
    to_come = 5 - len(board)
    for run in itertools.combinations(rest, to_come):
        b = board + list(run)
        hero_sc = score(hero + b)
        run_set = set(run)
        avail = [c for c in rest if c not in run_set]
        for vill in itertools.combinations(avail, 2):
            v_sc = score(list(vill) + b)
            n += 1
            if hero_sc > v_sc:
                w += 1
            elif hero_sc == v_sc:
                t += 1
    return {
        'combinations': n,
        'equity': (w + t / 2) / n,
        'equity_pct_1dp': round(100.0 * (w + t / 2) / n, 1),
        'win': w / n,
        'win_pct_1dp': round(100.0 * w / n, 1),
        'tie': t / n,
        'tie_pct_2dp': round(100.0 * t / n, 2),
        'wins': w,
        'ties': t,
    }


def turn_breakdown(hero, vill, flop):
    hero = parse_cards(hero)
    vill = parse_cards(vill)
    flop = parse_cards(flop)
    if len(flop) != 3:
        raise ValueError('turn_breakdown requires a 3-card flop')
    used = set(hero + vill + flop)
    rest = [c for c in DECK if c not in used]
    cards = {}
    for tc in rest:
        eq, w, t, n = eq_vs_hand(hero, vill, flop + [tc])
        cards[tc] = {
            'equity': eq,
            'equity_pct_1dp': round(100.0 * eq, 1),
            'wins': w,
            'ties': t,
            'rivers': n,
        }
    return cards


def section8_fixtures():
    eq1, w1, t1, n1 = eq_vs_hand(['Ad', 'Kd'], ['Qs', 'Qc'], ['Ks', '8h', '4h'])
    eq3, w3, t3, n3 = eq_vs_hand(['Ah', 'Kh'], ['Qs', 'Qc'], ['Qh', '7c', '2h'])
    tb = turn_breakdown(['Ah', 'Kh'], ['Qs', 'Qc'], ['Qh', '7c', '2h'])
    mw3_flop = eq_multiway([['Ah', 'Kh'], ['Qs', 'Qc'], ['Th', '9h']], ['Qh', '7c', '2h'])
    mw3_turn = eq_multiway([['Ah', 'Kh'], ['Qs', 'Qc'], ['Th', '9h']], ['Qh', '7c', '2h', '3h'])
    mw4_flop = eq_multiway([['Ah', 'Kh'], ['Qs', 'Qc'], ['Th', '9h'], ['7d', '7s']], ['Qh', '7c', '2h'])
    return {
        'generator': 'python tools/eqexact.py --section8',
        'fixtures': {
            'AdKd_vs_QsQc_on_Ks8h4h': {
                'equity_pct_1dp': round(100.0 * eq1, 1),
                'wins': w1,
                'ties': t1,
                'runouts': n1,
            },
            'AhKh_vs_QsQc_on_Qh7c2h': {
                'equity_pct_1dp': round(100.0 * eq3, 1),
                'wins': w3,
                'ties': t3,
                'runouts': n3,
                'turn_cards': tb,
            },
            'three_way_Qh7c2h': mw3_flop,
            'three_way_Qh7c2h3h': mw3_turn,
            'four_way_Qh7c2h': mw4_flop,
            'pot_odds_call_9_into_27': {
                'call': 9,
                'pot_before_call': 27,
                'equity_needed_pct_1dp': round(100.0 * (9 / (27 + 9)), 1),
            },
            'pot_odds_call_1_7_into_6_7': {
                'call': 1.7,
                'pot_before_call': 6.7,
                'equity_needed_pct_1dp': round(100.0 * (1.7 / (6.7 + 1.7)), 1),
            },
            'pot_odds_call_90_into_110': {
                'call': 90,
                'pot_before_call': 110,
                'equity_needed_pct_1dp': round(100.0 * (90 / (110 + 90)), 1),
            },
            'pot_odds_call_2_5_into_4': {
                'call': 2.5,
                'pot_before_call': 4,
                'equity_needed_pct_1dp': round(100.0 * (2.5 / (4 + 2.5)), 1),
            },
            'duel_bet_3_75_into_5': {
                'bet': 3.75,
                'pot_before_bet': 5,
                'opponent_equity_needed_pct_1dp': round(100.0 * (3.75 / (5 + 3.75 + 3.75)), 1),
                'called_pot_bb': 5 + 3.75 + 3.75,
                'effective_stack_behind_bb': 93.75,
                'spr': round(93.75 / (5 + 3.75 + 3.75), 1),
            },
            'headsup_open_2_5': {
                'limp_check_pot_bb': 2.0,
                'raise_to_bb': 2.5,
                'called_pot_bb': 5.0,
                'effective_stack_behind_bb': 97.5,
                'spr': round(97.5 / 5.0, 1),
            },
            'all_in_luck_40bb_91_2pct': {
                'stack_each_bb': 40.0,
                'final_pot_bb': 80.0,
                'equity': eq1,
                'equity_pct_1dp': round(100.0 * eq1, 1),
                'expected_net_bb': round(80.0 * eq1 - 40.0, 1),
                'actual_net_bb': 40.0,
                'luck_bb': round(40.0 - (80.0 * eq1 - 40.0), 1),
            },
            'review_call_90_into_200_25_6pct': {
                'already_in_bb': 10.0,
                'call_bb': 90.0,
                'total_invested_bb': 100.0,
                'final_pot_bb': 200.0,
                'equity': eq3,
                'equity_pct_1dp': round(100.0 * eq3, 1),
                'exact_expected_share_bb': round(200.0 * eq3, 2),
                'displayed_pct_expected_share_bb': round(200.0 * (round(100.0 * eq3, 1) / 100.0), 1),
                'displayed_pct_hand_ev_bb': round(200.0 * (round(100.0 * eq3, 1) / 100.0) - 100.0, 1),
                'displayed_pct_call_vs_fold_ev_bb': round(200.0 * (round(100.0 * eq3, 1) / 100.0) - 90.0, 1),
                'displayed_pct_runout_luck_bb': round(-100.0 - (200.0 * (round(100.0 * eq3, 1) / 100.0) - 100.0), 1),
            },
        },
    }


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] == '--section8':
        out = section8_fixtures()
        if '--with-vs-any' in args:
            out['fixtures']['KdJd_vs_any_on_Ks8h4h'] = eq_vs_any(['Kd', 'Jd'], ['Ks', '8h', '4h'])
        print(json.dumps(out, indent=2))
    elif args[0] == 'match' and len(args) >= 4:
        print(json.dumps(eq_multiway(args[2:], args[1]), indent=2))
    elif args[0] == 'turn' and len(args) == 4:
        print(json.dumps(turn_breakdown(args[2], args[3], args[1]), indent=2))
    elif args[0] == 'vs-any' and len(args) == 3:
        print(json.dumps(eq_vs_any(args[2], args[1]), indent=2))
    else:
        print(__doc__.strip(), file=sys.stderr)
        sys.exit(2)
