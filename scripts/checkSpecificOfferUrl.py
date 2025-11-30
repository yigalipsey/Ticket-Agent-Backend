import csv
import sys

fixture_id = sys.argv[1] if len(sys.argv) > 1 else None

# Read fixture info from DB (we'll get it from the offer)
# For now, let's search for Liverpool vs Wolverhampton matches
with open('data/p1-offers.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    matches = []
    for row in reader:
        if 'Liverpool' in row.get('home_team_name', '') and ('Wolverhampton' in row.get('away_team_name', '') or 'Wolves' in row.get('away_team_name', '')):
            matches.append(row)

print(f'Found {len(matches)} matches with Liverpool vs Wolverhampton/Wolves\n')
for i, m in enumerate(matches):
    print(f'Match {i+1}:')
    print(f"  Home: {m['home_team_name']}")
    print(f"  Away: {m['away_team_name']}")
    print(f"  Date: {m['date_start']}")
    print(f"  productURL: {m['productURL']}")
    print(f"  price: {m['price']}")
    print()




