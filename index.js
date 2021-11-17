const async = require('async');
const SteamID = require('steamid');
const request = require('request-retry-dayjs');
const SKU = require('tf2-sku-2');

const inherits = require('util').inherits;
const EventEmitter = require('events').EventEmitter;

const Listing = require('./classes/listing');

const EFailiureReason = require('./resources/EFailureReason');

class ListingManager {
    /**
     * Creates a new instance of the listing manager
     * @param {Object} options
     * @param {String} options.token The access token of the account being managed
     * @param {String} options.steamid The steamid of the account being managed
     * @param {String} options.userAgent The User-Agent header to be sent to bptf
     * @param {String} options.userID The cookie we get from bptf-login-2
     * @param {Number} [options.waitTime=10000] Time to wait before processing the queues
     * @param {Number} [options.batchSize=50]
     * @param {Object} options.schema Schema from the tf2-schema module (schemaManager.schema)
     */
    constructor(options) {
        options = options || {};

        EventEmitter.call(this);

        this.token = options.token;
        this.steamid = new SteamID(options.steamid);
        this.userAgent = options.userAgent;
        this.userID = options.userID;

        // Time to wait before sending request after enqueing action
        // Set default to 10 seconds:
        // Update September 1st, 2021: "Request limit exceeded: this endpoint only allows 15 calls per 60 seconds per user account. Try again in x seconds."
        this.waitTime = options.waitTime || 10000;
        // Amount of listings to create at once
        this.batchSize = options.batchSize || 50;

        this.cap = null;
        this.promotes = null;

        this.listings = [];

        this.actions = {
            create: [],
            remove: []
        };

        this.schema = options.schema || null;

        this._lastInventoryUpdate = null;
        this._createdListingsCount = 0;
        this._listings = {};
        this._actions = {
            create: {},
            remove: {}
        };
    }

    setUserID(userID) {
        this.userID = userID;
    }

    /**
     * Initializes the module
     * @param {Function} callback
     */
    init(callback) {
        if (this.ready) {
            callback(null);
            return;
        }

        if (!this.steamid.isValid()) {
            callback(new Error('Invalid / missing steamid64'));
            return;
        }

        if (this.schema === null) {
            callback(new Error('Missing schema from tf2-schema'));
            return;
        }

        this.registerUserAgent(err => {
            if (err) {
                return callback(err);
            }

            this._updateListings(err => {
                if (err) {
                    return callback(err);
                }

                this._updateInventory(() => {
                    this._startTimers();

                    this.ready = true;
                    this.emit('ready');

                    // Emit listings after initializing
                    this.emit('listings', this.listings);

                    // Start processing actions if there are any
                    this._processActions();

                    return callback(null);
                });
            });
        });
    }

    /**
     * (Re)-register user-agent to backpack.tf.
     * @description Bumps listings and gives you lightning icon on listings if you have set a tradeofferurl in your settings (https://backpack.tf/settings)
     * @param {Function} callback
     */
    registerUserAgent(callback) {
        if (!this.token) {
            callback(new Error('No token set (yet)'));
            return;
        }

        const options = {
            method: 'POST',
            url: 'https://backpack.tf/api/agent/pulse',
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            },
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            this.emit('pulse', {
                status: body.status,
                current_time: body.current_time,
                expire_at: body.expire_at,
                client: body.client
            });

            return callback(null, body);
        });
    }

    /**
     * Unregister user-agent to backpack.tf.
     * @description Prematurely declare the user as no longer being under control of the user agent. Should be used as part of a clean shutdown.
     * @param {Function} callback
     */
    stopUserAgent(callback) {
        if (!this.token) {
            callback(new Error('No token set (yet)'));
            return;
        }

        const options = {
            method: 'POST',
            url: 'https://backpack.tf/api/agent/stop',
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            },
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            this.emit('pulse', { status: body.status });

            return callback(null, body);
        });
    }

    /**
     * Updates your inventory on backpack.tf
     * @param {Function} callback
     */
    _updateInventory(callback) {
        const options = {
            method: 'POST',
            url: `https://backpack.tf/api/inventory/${this.steamid.getSteamID64()}/refresh`,
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            },
            gzip: true,
            json: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            if (response.status >= 400) {
                return callback(new Error(response.status + ' (' + response.statusText + ')'));
            }

            const time = body.last_update;

            if (this._lastInventoryUpdate === null) {
                this._lastInventoryUpdate = time;
            } else if (time !== this._lastInventoryUpdate) {
                // The inventory has updated on backpack.tf
                this._lastInventoryUpdate = time;

                this.emit('inventory', this._lastInventoryUpdate);

                // The inventory has been updated on backpack.tf, try and make listings
                this._processActions();
            }

            return callback(null);
        });
    }

    /**
     * Gets the listings that you have on backpack.tf
     * @param {Function} callback
     */
    getListings(callback) {
        if (!this.token) {
            callback(new Error('No token set (yet)'));
            return;
        }

        const options = {
            method: 'GET',
            url: 'https://backpack.tf/api/classifieds/listings/v1',
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            },
            body: {
                automatic: 'all'
            },
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            this.cap = body.cap;
            this.promotes = body.promotes_remaining;
            this.listings = body.listings.filter(raw => raw.appid == 440).map(raw => new Listing(raw, this));

            // Populate map
            this._listings = {};
            this.listings.forEach(listing => {
                this._listings[listing.intent == 0 ? listing.getName() : listing.item.id] = listing;
            });

            this._createdListingsCount = 0;

            // Go through create queue and find listings that need retrying
            this.actions.create.forEach(formatted => {
                if (formatted.retry !== undefined) {
                    // Look for a listing that has a matching sku / id
                    const match = this.findListing(
                        formatted.intent == 0 ? formatted.sku : formatted.id,
                        formatted.intent
                    );
                    if (match !== null) {
                        // Found match, remove the listing and unset retry property
                        match.remove();
                    }
                }
            });

            if (this.ready) {
                this.emit('listings', this.listings);
            }

            return callback(null, body);
        });
    }

    /**
     * Searches for one specific listing by sku or assetid
     * @param {String|Number} search sku or assetid
     * @param {Number} intent 0 for buy, 1 for sell
     * @return {Listing} Returns matching listing
     */
    findListing(search, intent) {
        const identifier = intent == 0 ? this.schema.getName(SKU.fromString(search)) : search;
        return this._listings[identifier] === undefined ? null : this._listings[identifier];
    }

    /**
     * Finds all listings that match the name of the item
     * @param {String} sku
     * @return {Array<Listing>} Returns matching listings
     */
    findListings(sku) {
        const name = this.schema.getName(SKU.fromString(sku));

        return this.listings.filter(listing => {
            return listing.getName() === name;
        });
    }

    /**
     * Enqueues a list of listings to be made
     * @param {Array<Object>} listings
     */
    createListings(listings) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formattedArr = listings.map(value => this._formatListing(value)).filter(formatted => formatted !== null);

        const remove = [];

        formattedArr.forEach(formatted => {
            const match = this.findListing(formatted.intent == 1 ? formatted.id : formatted.sku, formatted.intent);
            if (match !== null) {
                remove.push(match.id);
            }
        });

        this._action('remove', remove);
        this._action('create', formattedArr);
    }

    /**
     * Enqueues a list of listings to be made
     * @param {Object} listing
     */
    createListing(listing) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formatted = this._formatListing(listing);

        if (formatted !== null) {
            const match = this.findListing(formatted.intent == 1 ? formatted.id : formatted.sku, formatted.intent);
            if (match !== null) {
                match.remove();
            }

            this._action('create', formatted);
        }
    }

    /**
     * Enqueues a list of listings to be made
     * @param {String} id listing ID
     * @param {Object} properties properties
     */
    updateListing(id, properties) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }
        const options = {
            method: "PATCH",
            url: `https://backpack.tf/api/v2/classifieds/listings/${id}`,
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            },
            body: properties,
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                this.emit('updateListingsError', err);
                return callback(err);
            }
            this.emit('updateListingsSuccessful', response);

            const index = this.listings.findIndex((listing) => listing.id===id);
            if(index >= 0) {
                for(const key in properties){
                    if(!Object.prototype.hasOwnProperty.call(this.listings[index], key)) return;
                    if(!Object.prototype.hasOwnProperty.call(properties, key)) return;
                    this.listings[index][key] = properties[key];
                }
                this._listings[this.listings[index].intent == 0 ? this.listings[index].getName() : this.listings[index].item.id] = this.listings[index];
            }
        });
    }

    /**
     * Enqueus a list of listings or listing ids to be removed
     * @param {Array<Object>|Array<String>} listings
     */
    removeListings(listings) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formatted = listings.map(value => (!isObject(value) ? value : value.id));

        this._action('remove', formatted);
    }

    /**
     * Enqueus a list of listings or listing ids to be removed
     * @param {Object|String} listing
     */
    removeListing(listing) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        if (!isObject(listing)) {
            this._action('remove', listing);
        } else {
            this._action('remove', listing.id);
        }
    }

    /**
     * Function used to enqueue jobs
     * @param {String} type
     * @param {Array<Object>|Array<String>|Object|String} value
     */
    _action(type, value) {
        const array = Array.isArray(value) ? value : [value];

        if (array.length === 0) {
            return;
        }

        let doneSomething = false;

        if (type === 'remove') {
            const noMatch = array.filter(id => this.actions.remove.indexOf(id) === -1);
            if (noMatch.length !== 0) {
                this.actions[type] = this.actions[type].concat(noMatch);
                doneSomething = true;
            }
        } else if (type === 'create') {
            // Find listings that we should make
            const newest = array.filter(formatted => this._isNewest(formatted));

            // Find listings that has old listings
            const hasOld = newest.filter(formatted => this._hasOld(formatted));

            // Set new
            newest.forEach(formatted => this._setNew(formatted));

            hasOld.forEach(formatted => this._removeEnqueued(formatted));

            if (newest.length !== 0) {
                this.actions[type] = this.actions[type].concat(newest);
                doneSomething = true;
            }
        }

        if (doneSomething) {
            this.emit('actions', this.actions);

            if (this.actions.create.length >= this.batchSize) {
                clearTimeout(this._timeout);
                this._processActions();
            } else {
                this._startTimeout();
            }
        }
    }

    _setNew(formatted) {
        const identifier = formatted.intent == 0 ? formatted.sku : formatted.id;

        if (this._actions.create[identifier] === undefined || this._actions.create[identifier].time < formatted.time) {
            // First time we see the item, it is new
            this._actions.create[identifier] = formatted;
        }
    }

    _hasOld(formatted) {
        const identifier = formatted.intent == 0 ? formatted.sku : formatted.id;

        if (this._actions.create[identifier] === undefined) {
            return false;
        }

        // Returns true if listing in map is older
        return this._actions.create[identifier].time < formatted.time;
    }

    _isNewest(formatted) {
        const identifier = formatted.intent == 0 ? formatted.sku : formatted.id;

        if (this._actions.create[identifier] === undefined) {
            return true;
        }

        if (this._actions.create[identifier].time < formatted.time) {
            // This listing is newer that the old one
            return true;
        }

        // Listing is not the newest
        return false;
    }

    /**
     * Starts user-agent and inventory timers
     */
    _startTimers() {
        this._updateListingsInterval = setInterval(
            ListingManager.prototype._updateListings.bind(this, () => {}),
            90000
        );
        this._userAgentInterval = setInterval(
            ListingManager.prototype._renewUserAgent.bind(this, () => {}),
            360000 // 6 minutes
        );
        this._inventoryInterval = setInterval(
            ListingManager.prototype._updateInventory.bind(this, () => {}),
            60000
        );
    }

    /**
     * Stops all timers and timeouts and clear values to default
     */
    shutdown() {
        // Stop timers
        clearTimeout(this._timeout);
        clearInterval(this._updateListingsInterval);
        clearInterval(this._userAgentInterval);
        clearInterval(this._inventoryInterval);

        this.stopUserAgent(() => {
            // Reset values
            this.ready = false;
            this.listings = [];
            this.cap = null;
            this.promotes = null;
            this.actions = { create: [], remove: [] };
            this._actions = { create: {}, remove: {} };
            this._lastInventoryUpdate = null;
            this._createdListingsCount = 0;
        });
    }

    /**
     * Starts timeout used to process actions
     */
    _startTimeout() {
        clearTimeout(this._timeout);
        this._timeout = setTimeout(ListingManager.prototype._processActions.bind(this), this.waitTime);
    }

    /**
     * Renew user-agent
     * @param {Function} callback
     */
    _renewUserAgent(callback) {
        async.series(
            [
                callback => {
                    this.registerUserAgent(callback);
                }
            ],
            err => {
                return callback(err);
            }
        );
    }

    /**
     * Gets listings
     * @param {Function} callback
     */
    _updateListings(callback) {
        async.series(
            [
                callback => {
                    this.getListings(callback);
                }
            ],
            err => {
                return callback(err);
            }
        );
    }

    /**
     * Processes action queues
     * @param {Function} [callback]
     */
    _processActions(callback) {
        if (callback === undefined) {
            callback = noop;
        }

        if (
            this._processingActions === true ||
            (this.actions.remove.length === 0 &&
                this._listingsWaitingForRetry() +
                    this._listingsWaitingForInventoryCount() -
                    this.actions.create.length ===
                    0)
        ) {
            callback(null);
            return;
        }

        this._processingActions = true;

        async.series(
            {
                delete: callback => {
                    this._delete(callback);
                },
                create: callback => {
                    this._create(callback);
                }
            },
            (err, result) => {
                // TODO: Only get listings if we created or deleted listings

                if (
                    this.actions.remove.length !== 0 ||
                    this._listingsWaitingForRetry() - this.actions.create.length !== 0
                ) {
                    this._processingActions = false;
                    // There are still things to do
                    this._processActions();
                    callback(null);
                } else {
                    // Queues are empty, get listings
                    this.getListings(() => {
                        this._processingActions = false;
                        this._processActions();
                        callback(null);
                    });
                }
            }
        );
    }

    /**
     * Creates a batch of listings from the queue
     * @param {Function} callback
     */
    _create(callback) {
        if (this.actions.create.length === 0) {
            callback(null, null);
            return;
        }

        if (this.listings.length + this._createdListingsCount >= this.cap) {
            // Reached listing cap, clear create queue
            this.actions.create = [];
            this._actions.create = {};
            callback(null, null);
            return;
        }

        // TODO: Don't send sku and attempt time to backpack.tf
        // TODO: Use the POST /classifieds/listings endpoint so that we can create specific buy orders (painted/spelled/parts etc)
        // https://cdn.discordapp.com/attachments/666909760666468377/849319429271191652/Screenshot_137.png

        const batch = this.actions.create
            .filter(listing => listing.attempt !== this._lastInventoryUpdate)
            .slice(0, this.batchSize);

        const options = {
            method: 'POST',
            url: 'https://backpack.tf/api/classifieds/list/v1',
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            },
            body: {
                listings: batch
            },
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                this.emit('createListingsError', err);
                return callback(err);
            }

            const waitForInventory = [];
            const retryListings = [];

            for (const identifier in body.listings) {
                if (!body.listings.hasOwnProperty(identifier)) {
                    continue;
                }

                const listing = body.listings[identifier];
                if (listing.hasOwnProperty('error')) {
                    if (listing.error === '' || listing.error == EFailiureReason.ItemNotInInventory) {
                        waitForInventory.push(identifier);
                    } else if (
                        listing.error.indexOf('as it already exists') !== -1 ||
                        listing.error == EFailiureReason.RelistTimeout
                    ) {
                        // This error should be extremely rare

                        // Find listing matching the identifier in create queue
                        const match = this.actions.create.find(formatted =>
                            this._isSameByIdentifier(formatted, formatted.intent, identifier)
                        );

                        if (match !== undefined) {
                            // If we can't find the listing, then it was already removed / we can't identify the item / we can't properly list the item (FISK!!!)
                            retryListings.push(match.intent == 0 ? identifier : match.id);
                        }
                    }
                } else {
                    this._createdListingsCount++;
                }
            }

            this.actions.create = this.actions.create.filter(formatted => {
                if (formatted.intent == 1 && waitForInventory.indexOf(formatted.id) !== -1) {
                    if (formatted.attempt !== undefined) {
                        // We have already tried to list before, remove it from the queue
                        return false;
                    }

                    // We should wait for the inventory to update
                    formatted.attempt = this._lastInventoryUpdate;
                    return true;
                }

                const name = formatted.intent == 0 ? this.schema.getName(SKU.fromString(formatted.sku)) : null;

                if (
                    formatted.retry !== true &&
                    retryListings.indexOf(formatted.intent == 0 ? name : formatted.id) !== -1
                ) {
                    // A similar listing was already made, we will need to remove the old listing and then try and add this one again
                    formatted.retry = true;
                    return true;
                }

                const index = batch.findIndex(v => this._isSame(formatted, v));

                if (index !== -1) {
                    // Listing was created, remove it from the batch and from the actions map
                    delete this._actions.create[formatted.intent == 0 ? formatted.sku : formatted.id];
                    batch.splice(index, 1);
                }

                return index === -1;
            });

            this.emit('actions', this.actions);

            callback(null, body);
        });
    }

    /**
     * Removes all listings in the remove queue
     * @param {Function} callback
     */
    _delete(callback) {
        if (this.actions.remove.length === 0) {
            callback(null, null);
            return;
        }

        const batchSize = this.actions.remove.length > 1000 ? 1000 : this.actions.remove.length;
        const remove = this.actions.remove.slice(0, batchSize);

        const options = {
            method: 'DELETE',
            url: 'https://backpack.tf/api/classifieds/delete/v1',
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            },
            body: {
                listing_ids: remove
            },
            json: true,
            gzip: true
        };

        // if (batchSize === 1) {
        //     options = {
        //         method: 'DELETE',
        //         url: `https://backpack.tf/api/classifieds/listings/${remove[0]}`,
        //         headers: {
        //             'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
        //             Cookie: 'user-id=' + this.userID
        //         },
        //         qs: {
        //             token: this.token
        //         }
        //     };
        // } else {

        // }

        request(options, (err, response, body) => {
            if (err) {
                this.emit('deleteListingsError', err);
                return callback(err);
            }

            this.emit('deleteListingsSuccessful', response);

            // Filter out listings that we just deleted
            this.actions.remove = this.actions.remove.filter(id => remove.indexOf(id) === -1);

            // Update cached listings
            this.listings = this.listings.filter(listing => remove.indexOf(listing.id) === -1);

            this.emit('actions', this.actions);

            return callback(null, body);
        });
    }

    /**
     * Mass delete all listings
     * @param {Number} intent - Optionally only delete buy (0) or sell (1) orders
     * @param {Function} callback
     */
    deleteAllListings(intent, callback) {
        const options = {
            method: 'DELETE',
            url: `https://backpack.tf/api/classifieds/listings/`,
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            }
        };

        if ([0, 1].includes(intent)) {
            options.body['intent'] = intent;
        }

        request(options, (err, response, body) => {
            if (err) {
                this.emit('deleteListingsError', err);
                return callback(err);
            }

            this.emit('massDeleteListings', response);

            return callback(null, body);
        });
    }

    /**
     * Formats a listing so that it is ready to be sent to backpack.tf
     * @param {Object} listing
     * @return {Object} listing if formatted correctly, null if not
     */
    _formatListing(listing) {
        if (listing.time === undefined) {
            // If a time is not added then ignore the listing (this is to make sure that the listings are up to date)
            return null;
        }

        if (listing.intent == 0) {
            if (listing.sku === undefined) {
                return null;
            }

            const item = this._formatItem(listing.sku);
            if (item === null) {
                return null;
            }
            listing.item = item;

            if (listing.promoted !== undefined) {
                delete listing.promoted;
            }
            // Keep sku for later
        }

        return listing;
    }

    /**
     * Removes a matching enqueued listing
     * @param {Object} formatted Formatted listing
     * @return {Boolean} True if removed anything
     */
    _removeEnqueued(formatted) {
        let removed = false;

        for (let i = this.actions.create.length - 1; i >= 0; i--) {
            const v = this.actions.create[i];

            if (!this._isSame(formatted, v)) {
                continue;
            }

            if (!this._isNewest(formatted)) {
                this.actions.create.splice(i, 1);
                removed = true;
                break;
            }
        }

        return removed;
    }

    _isSame(original, test) {
        return this._isSameByIdentifier(
            original,
            test.intent,
            test.intent == 0 ? this.schema.getName(SKU.fromString(test.sku)) : test.id
        );
    }

    _isSameByIdentifier(original, testIntent, testIdentifier) {
        if (original.intent !== testIntent) {
            return false;
        }

        const originalIdentifier =
            original.intent == 0 ? this.schema.getName(SKU.fromString(original.sku)) : original.id;

        return originalIdentifier === testIdentifier;
    }

    /**
     * Converts an sku into an item object that backpack.tf understands
     * @param {String} sku
     * @return {Object} Returns the formatted item, null if the item does not exist
     */
    _formatItem(sku) {
        const item = SKU.fromString(sku);

        const schemaItem = this.schema.getItemByDefindex(item.defindex);

        if (schemaItem === null) {
            return null;
        }

        const name = this.schema.getName(
            {
                defindex: item.defindex,
                quality: 6,
                festive: item.festive,
                killstreak: item.killstreak,
                australium: item.australium,
                target: item.target,
                paintkit: item.paintkit,
                wear: item.wear
            },
            false
        );

        const nameLowered = name.toLowerCase();

        const isUnusualifier = nameLowered.includes('unusualifier') && item.target !== null;

        const isStrangifierChemistrySet =
            nameLowered.includes('chemistry set') &&
            item.target !== null &&
            item.output !== null &&
            item.outputQuality !== null;

        const isCollectorsChemistrySet =
            nameLowered.includes('chemistry set') &&
            item.target === null &&
            item.output !== null &&
            item.outputQuality !== null;

        const isStrangifier = nameLowered.includes('strangifier') && item.target !== null;

        const isFabricator =
            nameLowered.includes('fabricator') &&
            item.target !== null &&
            item.output !== null &&
            item.outputQuality !== null;
        const isGenericFabricator =
            nameLowered.includes('fabricator') &&
            item.target === null &&
            item.output !== null &&
            item.outputQuality !== null;

        const isKillstreakKit = nameLowered.includes('kit') && item.killstreak !== 0 && item.target !== null;
        const isGenericKillstreakKit = nameLowered.includes('kit') && item.killstreak !== 0 && item.target === null;

        const isMustUseNameForKillstreak =
            item.killstreak !== 0
                ? item.target !== null
                    ? true
                    : !isUnusualifier &&
                      !isStrangifierChemistrySet &&
                      !isCollectorsChemistrySet &&
                      !isStrangifier &&
                      !isFabricator &&
                      !isGenericFabricator &&
                      !isKillstreakKit &&
                      !isGenericKillstreakKit
                    ? true
                    : false
                : false;

        const isNotUsingDefindex =
            isMustUseNameForKillstreak || item.festive || item.australium || item.paintkit || item.wear;

        const formatted = {
            item_name: isFabricator
                ? item.killstreak === 2
                    ? 'Specialized Killstreak Fabricator'
                    : 'Professional Killstreak Fabricator'
                : isKillstreakKit
                ? item.killstreak === 1
                    ? 'Killstreak Kit'
                    : item.killstreak === 2
                    ? 'Specialized Killstreak Kit'
                    : 'Professional Killstreak Kit'
                : isNotUsingDefindex
                ? name
                : item.defindex
        };

        formatted.quality =
            (item.quality2 !== null ? this.schema.getQualityById(item.quality2) + ' ' : '') +
            this.schema.getQualityById(item.quality);

        formatted.craftable = item.craftable ? 1 : 0;

        formatted.priceindex =
            item.effect !== null
                ? item.effect
                : item.crateseries !== null
                ? item.crateseries
                : isUnusualifier || isStrangifier
                ? item.target
                : isFabricator
                ? `${item.output}-${item.outputQuality}-${item.target}`
                : isKillstreakKit
                ? `${item.killstreak}-${item.target}`
                : isStrangifierChemistrySet
                ? `${item.target}-${item.outputQuality}-${item.output}`
                : isCollectorsChemistrySet
                ? `${item.output}-${item.outputQuality}`
                : isGenericFabricator
                ? `${item.output}-${item.outputQuality}-0`
                : undefined;

        if (!formatted.priceindex) {
            delete formatted.priceindex;
        }

        return formatted;
    }

    /**
     * Returns the amount of listings that are waiting for the inventory to update
     * @return {Number}
     */
    _listingsWaitingForInventoryCount() {
        return this.actions.create.filter(
            listing => listing.intent == 1 && listing.attempt === this._lastInventoryUpdate
        ).length;
    }

    /**
     * Returns the amount of listings that are waiting for the listings to be updated
     * @return {Number}
     */
    _listingsWaitingForRetry() {
        return this.actions.create.filter(listing => listing.retry !== undefined).length;
    }
}

inherits(ListingManager, EventEmitter);

module.exports = ListingManager;
module.exports.Listing = Listing;

module.exports.EFailiureReason = EFailiureReason;

function noop() {}

/*!
 * isobject <https://github.com/jonschlinkert/isobject>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */
function isObject(val) {
    return val != null && typeof val === 'object' && Array.isArray(val) === false;
}
