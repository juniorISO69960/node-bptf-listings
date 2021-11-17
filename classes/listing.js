const SteamID = require('steamid');
const Currencies = require('tf2-currencies-2');
const SKU = require('tf2-sku-2');

const pistolSkins = new Map();
pistolSkins
    .set(0, 15013)
    .set(18, 15018)
    .set(35, 15035)
    .set(41, 15041)
    .set(46, 15046)
    .set(56, 15056)
    .set(61, 15061)
    .set(63, 15060)
    .set(69, 15100)
    .set(70, 15101)
    .set(74, 15102)
    .set(78, 15126)
    .set(81, 15148);

const rocketLauncherSkins = new Map();
rocketLauncherSkins
    .set(1, 15014)
    .set(6, 15006)
    .set(28, 15028)
    .set(43, 15043)
    .set(52, 15052)
    .set(57, 15057)
    .set(60, 15081)
    .set(69, 15104)
    .set(70, 15105)
    .set(93, 15129)
    .set(79, 15130)
    .set(80, 15150);

const medicgunSkins = new Map();
medicgunSkins
    .set(2, 15010)
    .set(5, 15008)
    .set(25, 15025)
    .set(39, 15039)
    .set(50, 15050)
    .set(65, 15078)
    .set(72, 15097)
    .set(93, 15120)
    .set(78, 15121)
    .set(79, 15122)
    .set(81, 15145)
    .set(83, 15146);

const revolverSkins = new Map();
revolverSkins
    .set(3, 15011)
    .set(27, 15027)
    .set(42, 15042)
    .set(51, 15051)
    .set(63, 15064)
    .set(64, 15062)
    .set(65, 15063)
    .set(72, 15103)
    .set(93, 15127)
    .set(77, 15128)
    .set(81, 15149);

const stickybombSkins = new Map();
stickybombSkins
    .set(4, 15012)
    .set(8, 15009)
    .set(24, 15024)
    .set(38, 15038)
    .set(45, 15045)
    .set(48, 15048)
    .set(60, 15082)
    .set(62, 15083)
    .set(63, 15084)
    .set(68, 15113)
    .set(93, 15137)
    .set(78, 15138)
    .set(81, 15155);

const sniperRifleSkins = new Map();
sniperRifleSkins
    .set(7, 15007)
    .set(14, 15000)
    .set(19, 15019)
    .set(23, 15023)
    .set(33, 15033)
    .set(59, 15059)
    .set(62, 15070)
    .set(64, 15071)
    .set(65, 15072)
    .set(93, 15135)
    .set(66, 15111)
    .set(91, 15112)
    .set(78, 15136)
    .set(82, 15154);

const flameThrowerSkins = new Map();
flameThrowerSkins
    .set(9, 15005)
    .set(17, 15017)
    .set(30, 15030)
    .set(34, 15034)
    .set(49, 15049)
    .set(54, 15054)
    .set(60, 15066)
    .set(61, 15068)
    .set(62, 15067)
    .set(66, 15089)
    .set(91, 15090)
    .set(93, 15115)
    .set(80, 15141);

const minigunSkins = new Map();
minigunSkins
    .set(10, 15004)
    .set(20, 15020)
    .set(26, 15026)
    .set(31, 15031)
    .set(40, 15040)
    .set(55, 15055)
    .set(61, 15088)
    .set(62, 15087)
    .set(63, 15086)
    .set(70, 15098)
    .set(73, 15099)
    .set(93, 15123)
    .set(77, 15125)
    .set(78, 15124)
    .set(84, 15147);

const scattergunSkins = new Map();
scattergunSkins
    .set(11, 15002)
    .set(15, 15015)
    .set(21, 15021)
    .set(29, 15029)
    .set(36, 15036)
    .set(53, 15053)
    .set(61, 15069)
    .set(63, 15065)
    .set(69, 15106)
    .set(72, 15107)
    .set(74, 15108)
    .set(93, 15131)
    .set(83, 15157)
    .set(92, 15151);

const shotgunSkins = new Map();
shotgunSkins
    .set(12, 15003)
    .set(16, 15016)
    .set(44, 15044)
    .set(47, 15047)
    .set(60, 15085)
    .set(72, 15109)
    .set(93, 15132)
    .set(78, 15133)
    .set(86, 15152);

const smgSkins = new Map();
smgSkins
    .set(13, 15001)
    .set(22, 15022)
    .set(32, 15032)
    .set(37, 15037)
    .set(58, 15058)
    .set(65, 15076)
    .set(69, 15110)
    .set(79, 15134)
    .set(81, 15153);

const wrenchSkins = new Map();
wrenchSkins.set(60, 15074).set(61, 15073).set(64, 15075).set(75, 15114).set(77, 15140).set(78, 15139).set(82, 15156);

const grenadeLauncherSkins = new Map();
grenadeLauncherSkins
    .set(60, 15077)
    .set(63, 15079)
    .set(91, 15091)
    .set(68, 15092)
    .set(93, 15116)
    .set(77, 15117)
    .set(80, 15142)
    .set(84, 15158);

const knifeSkins = new Map();
knifeSkins
    .set(64, 15080)
    .set(69, 15094)
    .set(70, 15095)
    .set(71, 15096)
    .set(77, 15119)
    .set(78, 15118)
    .set(81, 15143)
    .set(82, 15144);

const stockDefindex = new Map();
stockDefindex
    .set(0, 190) // Bat
    .set(1, 191) // Bottle
    .set(2, 192) // Fireaxe
    .set(3, 193) // Club
    .set(4, 194) // Knife
    .set(5, 195) // Fists
    .set(6, 196) // Shovel
    .set(7, 197) // Wrench
    .set(8, 198) // Bonesaw
    .set(9, 199) // Shotgun - Engineer (Primary)
    .set(10, 199) // Shotgun - Soldier
    .set(11, 199) // Shotgun - Heavy
    .set(12, 199) // Shotgun - Pyro
    .set(13, 200) // Scattergun
    .set(14, 201) // Sniper Rifle
    .set(15, 202) // Minigun
    .set(16, 203) // SMG
    .set(17, 204) // Syringe Gun
    .set(18, 205) // Rocket Launcher
    .set(19, 206) // Grenade Launcher
    .set(20, 207) // Stickybomb Launcher
    .set(21, 208) // Flamethrower
    .set(22, 209) // Pistol - Engineer
    .set(23, 209) // Pistol - Scout
    .set(24, 210) // Revolver
    .set(25, 737) // Construction PDA
    .set(29, 211) // Medigun
    .set(30, 212) // Invis Watch
    .set(735, 736) // Sapper
    .set(1163, 489); // Power Up Canteen

const exclusiveGenuine = new Map();
exclusiveGenuine
    .set(810, 831) // Genuine Red-Tape Recorder
    .set(811, 832) // Genuine Huo-Long Heater
    .set(812, 833) // Genuine Flying Guillotine
    .set(813, 834) // Genuine Neon Annihilator
    .set(814, 835) // Genuine Triad Trinket
    .set(815, 836) // Genuine Champ Stamp
    .set(816, 837) // Genuine Marxman
    .set(817, 838) // Genuine Human Cannonball
    .set(30720, 30740) // Genuine Arkham Cowl
    .set(30721, 30741) // Genuine Firefly
    .set(30724, 30739); // Genuine Fear Monger

const exclusiveGenuineReversed = new Map();
exclusiveGenuineReversed
    .set(831, 810) // Red-Tape Recorder
    .set(832, 811) // Huo-Long Heater
    .set(833, 812) // Flying Guillotine
    .set(834, 813) // Neon Annihilator
    .set(835, 814) // Triad Trinket
    .set(836, 815) // Champ Stamp
    .set(837, 816) // Marxman
    .set(838, 817) // Human Cannonball
    .set(30740, 30720) // Arkham Cowl
    .set(30741, 30721) // Firefly
    .set(30739, 30724); // Fear Monger

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
        this.offers = listing.offers === 1;
        this.buyout = listing.buyout === 1;
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

        return SKU.fromObject(this.getItem());
    }

    /**
     * Returns the item in the listings
     * @return {Object}
     */
    getItem() {
        if (this.appid !== 440) {
            return this.item;
        }

        const item = {
            defindex: this.item.defindex,
            quality: this.item.quality,
            craftable: this.item.flag_cannot_craft !== true
        };

        // Backpack.tf uses item_name for when making listings, meaning that the defindex in some cases is incorrect

        const schemaItem = this._manager.schema.getItemByDefindex(item.defindex);
        const schemaItems = this._manager.schema.raw.schema.items;
        const schemaItemByName = schemaItems.find(
            v => v.name === schemaItem.item_name && schemaItem.item_quality !== 0
        );

        if (schemaItemByName !== undefined) {
            item.defindex = schemaItemByName.defindex;
        }

        const attributes = this._parseAttributes();

        for (const attribute in attributes) {
            if (!attributes.hasOwnProperty(attribute)) {
                continue;
            }

            item[attribute] = attributes[attribute];
        }

        // Fix Defindex for Stock weapons or Exclusive Genuine Items

        const itemName = this.item.name;

        item.defindex = stockDefindex.has(item.defindex)
            ? stockDefindex.get(item.defindex)
            : item.quality === 1 && exclusiveGenuine.has(item.defindex)
            ? exclusiveGenuine.get(item.defindex)
            : item.quality !== 1 && exclusiveGenuineReversed.has(item.defindex)
            ? exclusiveGenuineReversed.get(item.defindex)
            : itemName.includes('Medic Mask')
            ? 272
            : item.defindex;

        const isCollectorChemistrySet = itemName.includes('Chemistry Set') && itemName.includes("Collector's");
        const isKitFabricator = itemName.includes('Kit Fabricator');
        const isKillstreakKit =
            itemName.includes('Killstreak') &&
            itemName.includes('Kit') &&
            !itemName.includes('Fabricator') &&
            !itemName.includes('Professional') &&
            !itemName.includes('Specialized');
        const isSpecializedKillstreakKit =
            itemName.includes('Specialized Killstreak') &&
            itemName.includes('Kit') &&
            !itemName.includes('Fabricator') &&
            !itemName.includes('Professional');
        const isProfessionalKillstreakKit =
            itemName.includes('Professional Killstreak') &&
            itemName.includes('Kit') &&
            !itemName.includes('Fabricator') &&
            !itemName.includes('Specialized');
        const isSkin = item.paintkit && !itemName.includes('War Paint');
        const isWarPaint = item.paintkit && itemName.includes('War Paint');
        const isStrangifier = itemName.includes('Strangifier') && !itemName.includes('Chemistry Set');

        if (
            isCollectorChemistrySet ||
            isKitFabricator ||
            isKillstreakKit ||
            isSpecializedKillstreakKit ||
            isProfessionalKillstreakKit ||
            isSkin ||
            isWarPaint ||
            isStrangifier
        ) {
            if (isCollectorChemistrySet) {
                if (itemName.includes("Collector's Festive")) {
                    item.defindex = 20007;
                } else if (itemName.includes("Collector's")) {
                    item.defindex = 20006;
                }
            }

            if (isKitFabricator) {
                if (itemName.includes('Professional Killstreak')) {
                    item.defindex = 20003;
                    item.killstreak = 3;
                } else if (itemName.includes('Specialized Killstreak')) {
                    item.defindex = 20002;
                    item.killstreak = 2;
                }
            }

            if (isKillstreakKit) {
                // Killstreak Kit
                item.defindex = 6527;
                item.killstreak = 1;
            }

            if (isSpecializedKillstreakKit) {
                // Specialized Killstreak Kit
                item.defindex = 6523;
                item.killstreak = 2;
            }

            if (isProfessionalKillstreakKit) {
                // Professional Killstreak Kit
                item.defindex = 6526;
                item.killstreak = 3;
            }

            if (isStrangifier) {
                const name = itemName.replace('Strangifier', '').trim();

                const itemsCount = schemaItems.length;

                for (let i = 0; i < itemsCount; i++) {
                    const it = schemaItems[i];
                    if (it.name.startsWith(name) && it.name.endsWith(' Strangifier')) {
                        item.defindex = it.defindex;
                        break;
                    }
                }
            }

            if (isSkin) {
                if (
                    (item.paintkit >= 0 && item.paintkit <= 66) ||
                    (item.paintkit >= 68 && item.paintkit <= 75) ||
                    (item.paintkit >= 77 && item.paintkit <= 84) ||
                    [86, 91, 92, 93].includes(item.paintkit)
                ) {
                    // Special Skins, but still need to filter because not everything is special

                    item.defindex = itemName.includes('Pistol')
                        ? pistolSkins.has(item.paintkit)
                            ? pistolSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Rocket Launcher')
                        ? rocketLauncherSkins.has(item.paintkit)
                            ? rocketLauncherSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Medi Gun')
                        ? medicgunSkins.get(item.paintkit)
                            ? medicgunSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Revolver')
                        ? revolverSkins.has(item.paintkit)
                            ? revolverSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Stickybomb Launcher')
                        ? stickybombSkins.has(item.paintkit)
                            ? stickybombSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Sniper Rifle')
                        ? sniperRifleSkins.has(item.paintkit)
                            ? sniperRifleSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Flame Thrower')
                        ? flameThrowerSkins.has(item.paintkit)
                            ? flameThrowerSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Minigun')
                        ? minigunSkins.has(item.paintkit)
                            ? minigunSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Scattergun')
                        ? scattergunSkins.has(item.paintkit)
                            ? scattergunSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Shotgun')
                        ? shotgunSkins.has(item.paintkit)
                            ? shotgunSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('SMG')
                        ? smgSkins.has(item.paintkit)
                            ? smgSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Grenade Launcher')
                        ? grenadeLauncherSkins.has(item.paintkit)
                            ? grenadeLauncherSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Wrench')
                        ? wrenchSkins.has(item.paintkit)
                            ? wrenchSkins.get(item.paintkit)
                            : item.defindex
                        : itemName.includes('Knife')
                        ? knifeSkins.has(item.paintkit)
                            ? knifeSkins.get(item.paintkit)
                            : item.defindex
                        : item.defindex;
                }
            }

            if (isWarPaint) {
                const itemNamePaintKit = `Paintkit ${item.paintkit}`;
                if (!item.quality) {
                    item.quality = 15;
                }

                const itemsCount = schemaItems.length;

                for (let i = 0; i < itemsCount; i++) {
                    const it = schemaItems[i];
                    if (it.name == itemNamePaintKit) {
                        item.defindex = it.defindex;
                        break;
                    }
                }
            }
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
     * @param {Number} [properties.quantity]
     */
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
