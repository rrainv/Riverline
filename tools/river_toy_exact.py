#!/usr/bin/env python3
"""Exact stdlib reference solutions for Kuhn Poker and Half-Street Clairvoyance River Game."""

from fractions import Fraction
import argparse
import json


def kuhn_exact():
    p0_value = Fraction(-1, 18)
    p1_value = -p0_value
    return {
        "game": "kuhn_poker",
        "p0_value_exact": str(p0_value),
        "p0_value": float(p0_value),
        "p1_value_exact": str(p1_value),
        "p1_value": float(p1_value),
    }


def clairvoyance_river_exact(pot=10, bet=10):
    """Half-street clairvoyance: OOP has 100% bluff-catcher, IP has 50% nuts / 50% air."""
    p = Fraction(pot)
    b = Fraction(bet)
    ip_air_bluff_freq = b / (p + b)
    oop_call_freq = p / (p + b)
    ip_total_bet_freq = Fraction(1, 2) * Fraction(1, 1) + Fraction(1, 2) * ip_air_bluff_freq
    oop_ev = Fraction(1, 2) * (Fraction(1, 1) - ip_air_bluff_freq) * p
    ip_ev = p - oop_ev
    return {
        "game": "clairvoyance_river",
        "pot": float(p),
        "bet": float(b),
        "ip_air_bluff_freq": float(ip_air_bluff_freq),
        "ip_total_bet_freq": float(ip_total_bet_freq),
        "oop_call_freq": float(oop_call_freq),
        "oop_ev": float(oop_ev),
        "ip_ev": float(ip_ev),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="Emit JSON output")
    args = parser.parse_args()
    payload = {
        "kuhn": kuhn_exact(),
        "clairvoyance": clairvoyance_river_exact(),
    }
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print("Kuhn:", payload["kuhn"])
        print("Clairvoyance:", payload["clairvoyance"])


if __name__ == "__main__":
    main()
