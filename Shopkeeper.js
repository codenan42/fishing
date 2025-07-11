// Shopkeeper.js

export class Shopkeeper {
    constructor() {
        // Base prices per kg for different species
        this.basePricesPerKg = {
            "River Perch": 10,
            "Northern Pike": 15,
            "Common Bream": 8,
            // Add more species and their base prices here as they are defined
        };
        this.sizeBonusFactor = 2; // Extra gold per kg for size
    }

    getSellPrice(fishSpeciesName, fishSize) {
        if (typeof fishSpeciesName !== 'string' || typeof fishSize !== 'number' || fishSize <= 0) {
            console.error("Shopkeeper.getSellPrice: Invalid arguments.", fishSpeciesName, fishSize);
            return 0;
        }

        const basePrice = this.basePricesPerKg[fishSpeciesName];

        if (basePrice === undefined) {
            console.warn(`Shopkeeper.getSellPrice: No base price defined for species "${fishSpeciesName}". Defaulting to a low price.`);
            // Default to a generic low price if species not found, or handle as error
            return Math.round(fishSize * 5); // e.g., 5 gold per kg for unknown fish
        }

        const calculatedPrice = (basePrice * fishSize) + (fishSize * this.sizeBonusFactor);
        return Math.round(calculatedPrice); // Return whole number for gold
    }
}
