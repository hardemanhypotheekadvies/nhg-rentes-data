# NHG-hypotheekrentes – Hardeman Hypotheekadvies

Dagelijks bijgewerkte, **indicatieve** NHG-hypotheekrentes voor de website van
[Hardeman Hypotheekadvies](https://hardemanhypotheekadvies.nl/).

## Wat staat hier

- `nhg-rentes.json` – per rentevaste periode (5, 10, 20 en 30 jaar) het gemiddelde van de
  **5 laagste NHG-rentes** voor een annuïteiten- of lineaire hypotheek, bij geldverstrekkers waarvoor
  Hardeman Hypotheekadvies bemiddelt en die hun rentes openbaar publiceren. Zonder kortingen die van
  voorwaarden afhangen (zoals een energielabel), behalve bij ING: daar telt de rente inclusief Actieve
  Betaalrekening Korting, zoals die in de gangbare rentelijsten staat.
- `bronnen.json` – per geldverstrekker de officiële bron en welk tarief meetelt.
- `scripts/valideer.mjs` – controleert het bestand vóór elke wijziging (geen dependencies, Node 18+).

## Hoe het werkt

1. Elke ochtend haalt een geplande taak de NHG-rentes op bij de officiële rentepagina's uit `bronnen.json`.
2. De taak berekent per periode het gemiddelde van de vijf laagste en schrijft `nhg-rentes.json`.
3. `node scripts/valideer.mjs nhg-rentes.json --vorige <vorige versie>` moet slagen; anders wordt er niets
   gewijzigd en blijft de vorige versie staan.
4. De website kopieert het bestand één keer per dag naar de eigen server; bezoekers maken geen contact met GitHub.

Zolang `"voorbeeld": true` in het bestand staat, toont de website niets.

## Disclaimer

De rentes zijn indicatief en geen advies of aanbod. De werkelijke rente hangt af van je situatie en de
voorwaarden van de geldverstrekker. Controleer altijd de actuele tarieven bij de geldverstrekker.
