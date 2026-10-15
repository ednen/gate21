/** Every scene script, bundled for the demo build (the real app gets scenes from the API). */
import type { Scenario } from './scene';

import arrivalBronze from '../../../../content/scenarios/arrival-bronze.json';
import arrivalGold from '../../../../content/scenarios/arrival-gold.json';
import arrivalSilver from '../../../../content/scenarios/arrival-silver.json';
import cafeBronze from '../../../../content/scenarios/cafe-bronze.json';
import cafeGold from '../../../../content/scenarios/cafe-gold.json';
import cafeSilver from '../../../../content/scenarios/cafe-silver.json';
import fullTrip from '../../../../content/scenarios/full-trip.json';
import hotelBronze from '../../../../content/scenarios/hotel-bronze.json';
import hotelGold from '../../../../content/scenarios/hotel-gold.json';
import hotelSilver from '../../../../content/scenarios/hotel-silver.json';
import restaurantBronze from '../../../../content/scenarios/restaurant-bronze.json';
import restaurantGold from '../../../../content/scenarios/restaurant-gold.json';
import restaurantSilver from '../../../../content/scenarios/restaurant-silver.json';
import shoppingBronze from '../../../../content/scenarios/shopping-bronze.json';
import shoppingGold from '../../../../content/scenarios/shopping-gold.json';
import shoppingSilver from '../../../../content/scenarios/shopping-silver.json';
import transferBronze from '../../../../content/scenarios/transfer-bronze.json';
import transferGold from '../../../../content/scenarios/transfer-gold.json';
import transferSilver from '../../../../content/scenarios/transfer-silver.json';
import transportBronze from '../../../../content/scenarios/transport-bronze.json';
import transportGold from '../../../../content/scenarios/transport-gold.json';
import transportSilver from '../../../../content/scenarios/transport-silver.json';

export const scenarios: Record<string, Scenario> = Object.fromEntries(
  [arrivalBronze, arrivalGold, arrivalSilver, cafeBronze, cafeGold, cafeSilver, fullTrip, hotelBronze, hotelGold, hotelSilver, restaurantBronze, restaurantGold, restaurantSilver, shoppingBronze, shoppingGold, shoppingSilver, transferBronze, transferGold, transferSilver, transportBronze, transportGold, transportSilver].map((s) => [s.slug, s as Scenario]),
);
