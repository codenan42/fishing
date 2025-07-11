// PlayerInventory.js

export class PlayerInventory {
    constructor(startingGold = 100) {
        this.fishStock = []; // Array to store caught fish objects
        this.goldBalance = startingGold;
        this.nextFishId = 1; // Simple incrementing ID for unique fish instances
    }

    addFish(fishObject) {
        if (!fishObject || typeof fishObject.speciesName !== 'string' || typeof fishObject.size !== 'number') {
            console.error("PlayerInventory.addFish: Invalid fishObject received.", fishObject);
            return;
        }

        const inventoryFish = {
            id: this.nextFishId++,
            speciesName: fishObject.speciesName,
            size: fishObject.size,
            // baseValue could be calculated here or taken from fishObject if pre-calculated
            // For now, let's assume it might come with the fishObject or be set by shop later
            baseValue: fishObject.baseValue || Math.round(fishObject.size * 10) // Simple default value
        };

        this.fishStock.push(inventoryFish);
        console.log(`${inventoryFish.speciesName} (${inventoryFish.size}kg) added to inventory. ID: ${inventoryFish.id}`);
    }

    removeFish(fishId) {
        const initialLength = this.fishStock.length;
        this.fishStock = this.fishStock.filter(fish => fish.id !== fishId);
        if (this.fishStock.length < initialLength) {
            console.log(`Fish with ID ${fishId} removed from inventory.`);
            return true;
        }
        console.warn(`PlayerInventory.removeFish: Fish with ID ${fishId} not found.`);
        return false;
    }

    addGold(amount) {
        if (typeof amount === 'number' && amount > 0) {
            this.goldBalance += amount;
            console.log(`${amount} gold added. New balance: ${this.goldBalance}`);
        } else {
            console.error("PlayerInventory.addGold: Invalid amount.", amount);
        }
    }

    getFishStock() {
        // Return a copy to prevent external modification of the internal array
        return [...this.fishStock];
    }

    getGoldBalance() {
        return this.goldBalance;
    }
}
