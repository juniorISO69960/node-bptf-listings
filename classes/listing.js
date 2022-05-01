const SteamID = require('steamid');
const Currencies = require('@tf2autobot/tf2-currencies');
const SKU = require('@tf2autobot/tf2-sku');

class Listing {
    /**
     * Creates a new instance of the listing class
     * @param {Object} listing A backpack.tf listing object
     * @param {String} listing.id
     * @param {Number} listing.intent
     * @param {Object} listing.item
     * @param {Number} listing.appid
     * @param {Object} listing.currencies
     * @param {Number} listing.offers
     * @param {Number} listing.buyout
     * @param {String} listing.details
     * @param {Number} listing.promoted
     * @param {Number} listing.created
     * @param {Number} listing.bump
     * @param {Object} manager Instance of bptf-listings
     */
    constructor(listing, manager) {
        this.id = listing.id;
        this.steamid = new SteamID(listing.steamid);
        this.intent = listing.intent;
        this.item = listing.item;
        this.appid = listing.appid;
        this.currencies = new Currencies(listing.currencies);
        this.offers = listing.offers ?? 1;
        this.buyout = listing.buyout ?? 1;
        this.promoted = listing.promoted;
        this.details = listing.details;
        this.created = listing.created;
        this.bump = listing.bump;

        this._manager = manager;
    }

    /**
     * Gets the sku of the item in the listing
     * @return {String}
     */
    getSKU() {
        if (this.appid !== 440) {
            return null;
        }

        if (this.sku !== undefined) {
            return this.sku;
        }

        this.sku = SKU.fromObject(this.getItem());

        return this.sku;
    }

    /**
     * Returns the item in the listings
     * @return {Object}
     */
    getItem() {
        if (this.appid !== 440) {
            return this.item;
        }

        if (this.sku !== undefined) {
            return SKU.fromString(this.sku);
        }

        const item = {
            defindex: this.item.defindex,
            quality: this.item.quality,
            craftable: this.item.flag_cannot_craft !== true
        };

        const attributes = this._parseAttributes();

        for (const attribute in attributes) {
            if (!attributes.hasOwnProperty(attribute)) {
                continue;
            }

            item[attribute] = attributes[attribute];
        }

        // Adds default values
        return SKU.fromString(SKU.fromObject(item));
    }

    /**
     * Returns the name of the item in the listing
     * @return {String}
     */
    getName() {
        if (this.appid !== 440) {
            return null;
        }

        return this._manager.schema.getName(this.getItem());
    }

    /**
     * Changes specific properties and adds the job to the queue
     * @param {Object} properties
     * @param {Object} [properties.currencies] currencies
     * @param {String} [properties.details]
     */
    // @param {Number} [properties.quantity]
    update(properties) {
        this._manager.updateListing(this.id, properties);
    }

    /**
     * Enqueues the listing to be removed
     */
    remove() {
        this._manager.removeListing(this.id);
    }

    /**
     * Parses attributes
     * @return {Object}
     */
    _parseAttributes() {
        const attributes = {};

        if (this.item.attributes === undefined) {
            return attributes;
        }

        const attributesCount = this.item.attributes.length;

        for (let i = 0; i < attributesCount; i++) {
            const attribute = this.item.attributes[i];
            if (attribute.defindex == 2025) {
                // Killstreak tier/Killstreak Kit
                attributes.killstreak = attribute.float_value;
            } else if (attribute.defindex == 2027) {
                // Australium
                attributes.australium = true;
            } else if (attribute.defindex == 2053) {
                // Festivized
                attributes.festive = true;
            } else if (attribute.defindex == 134) {
                // Unusual effect for cosmetics
                attributes.effect = attribute.float_value;
            } else if (attribute.defindex == 2041) {
                // Unusual effect for Taunt
                attributes.effect = attribute.value;
            } else if (attribute.defindex == 834) {
                // War paint/Skins
                attributes.paintkit = attribute.value;
            } else if (attribute.defindex == 725) {
                // Wear
                attributes.wear = parseInt(parseFloat(attribute.float_value) * 5);
            } else if (attribute.defindex == 214) {
                // Strange as second quality
                if (this.item.quality !== 11) {
                    attributes.quality2 = 11;
                }
            } else if (attribute.defindex == 187) {
                // Crates
                attributes.crateseries = attribute.float_value;
            } else if (attribute.defindex == 2012) {
                // Target - Unusualifier/Strangifier/Killstreak Kit
                const value = parseInt(attribute.float_value);
                attributes[value > 6000 && value < 30000 ? 'output' : 'target'] = value;
            } else if (attribute.defindex == 142) {
                // Painted items, do not apply if it's a Paint Can
                if (
                    ![
                        5023, // Paint Can
                        5027, // Indubitably Green
                        5028, // Zepheniah's Greed
                        5029, // Noble Hatter's Violet
                        5030, // Color No. 216-190-216
                        5031, // A Deep Commitment to Purple
                        5032, // Mann Co. Orange
                        5033, // Muskelmannbraun
                        5034, // Peculiarly Drab Tincture
                        5035, // Radigan Conagher Brown
                        5036, // Ye Olde Rustic Colour
                        5037, // Australium Gold
                        5038, // Aged Moustache Grey
                        5039, // An Extraordinary Abundance of Tinge
                        5040, // A Distinctive Lack of Hue
                        5046, // Team Spirit
                        5051, // Pink as Hell
                        5052, // A Color Similar to Slate
                        5053, // Drably Olive
                        5054, // The Bitter Taste of Defeat and Lime
                        5055, // The Color of a Gentlemann's Business Pants
                        5056, // Dark Salmon Injustice
                        5060, // Operator's Overalls
                        5061, // Waterlogged Lab Coat
                        5062, // Balaclavas Are Forever
                        5063, // An Air of Debonair
                        5064, // The Value of Teamwork
                        5065, // Cream Spirit
                        5076, // A Mann's Mint
                        5077 // After Eight
                    ].includes(this.item.defindex)
                ) {
                    attributes.paint = attribute.float_value;
                }
            } else if (
                [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007].includes(attribute.defindex) &&
                attribute.is_output == true
            ) {
                if (attribute.attributes === undefined) {
                    attributes.outputQuality = parseInt(attribute.quality);

                    if (attributes.outputQuality === 14) {
                        // Chemistry Set Collector's
                        attributes.output = parseInt(attribute.itemdef);
                    } else {
                        // Chemistry Set Strangifier
                        attributes.target = parseInt(attribute.itemdef);
                    }
                } else {
                    // Killstreak Fabricator Kit: getting output, outputQuality and target

                    attributes.output = attribute.itemdef;
                    attributes.outputQuality = attribute.quality;

                    const attributes2 = attribute.attributes;
                    const attributes2Count = attributes2.length;

                    for (let i = 0; i < attributes2Count; i++) {
                        const attributes2Element = attributes2[i];
                        if (attributes2Element.defindex == 2012) {
                            const value = attributes2Element.float_value;
                            attributes.target = typeof value === 'string' ? parseInt(value) : value;
                        }
                    }
                }
            }
        }

        return attributes;
    }
}

module.exports = Listing;
