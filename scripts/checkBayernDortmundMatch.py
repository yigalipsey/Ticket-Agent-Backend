import csv

with open('data/p1-offers.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    matches = []
    for row in reader:
        if 'Bayern' in row.get('away_team_name', '') and 'Dortmund' in row.get('home_team_name', '') and '2026-02-28' in row.get('date_start', ''):
            matches.append(row)

print(f'Found {len(matches)} matches\n')
for i, m in enumerate(matches):
    print(f'Match {i+1}:')
    print(f"  Home: {m['home_team_name']}")
    print(f"  Away: {m['away_team_name']}")
    print(f"  Date: {m['date_start']}")
    print(f"  productURL: {m['productURL']}")
    print(f"  price: {m['price']}")
    print()



