const async = require('async');
const SteamID = require('steamid');
const request = require('request-retry-dayjs');
const SKU = require('@tf2autobot/tf2-sku');

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
     * @param {String} options.userID The cookie we get from bptf-login
     * @param {Number} [options.waitTime=6000] Time to wait before processing the queues
     * @param {Number} [options.batchSize=100]
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
        // Set default to 6 seconds:
        // V2 api batch is rate limited to 10 req/minute.
        this.waitTime = options.waitTime || 6000;
        // Amount of listings to create at once
        this.batchSize = options.batchSize || 100;

        this.cap = null;
        this.promotes = null;

        // TODO: Archived listings management
        this.listings = [];

        this.actions = {
            create: [],
            remove: [],
            update: []
        };

        this.schema = options.schema || null;

        this._lastInventoryUpdate = null;
        this._createdListingsCount = 0;
        this._listings = {};
        this._actions = {
            create: {},
            remove: {},
            update: {}
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
            url: 'https://api.backpack.tf/api/agent/pulse',
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
        }).end();
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
            url: 'https://api.backpack.tf/api/agent/stop',
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
        }).end();
    }

    /**
     * Updates your inventory on backpack.tf
     * @param {Function} callback
     */
    _updateInventory(callback) {
        const options = {
            method: 'POST',
            url: `https://api.backpack.tf/api/inventory/${this.steamid.getSteamID64()}/refresh`,
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
        }).end();
    }

    // TODO: getArchiveListings

    /**
     * Gets the listings that you have on backpack.tf
     * @param {Function} callback
     */
    getListings(callback) {
        if (!this.token) {
            callback(new Error('No token set (yet)'));
            return;
        }

        // We will still use v1 for active listings

        const options = {
            method: 'GET',
            url: 'https://api.backpack.tf/api/classifieds/listings/v1',
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
            this.listings = body.listings.filter(raw => raw.appid == 440).map(raw => new Listing(raw, this, false));

            // Populate map
            this._listings = {};
            this.listings.forEach(listing => {
                this._listings[listing.intent == 0 ? listing.getSKU() : listing.item.id] = listing;
            });

            this._createdListingsCount = 0;

            // Go through create queue and find listings that need retrying
            this.actions.create.forEach(formatted => {
                if (formatted.retry !== undefined) {
                    // Look for a listing that has a matching sku / id
                    const match = this.findListing(formatted.intent === 0 ? formatted.sku : formatted.id);
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
        }).end();
    }

    // TODO: Find archived listing(s)

    /**
     * Searches for one specific listing by sku or assetid
     * @param {String|Number} search
     * @return {Listing} Returns matching listing
     */
    findListing(search) {
        return this._listings[search] === undefined ? null : this._listings[search];
    }

    /**
     * Finds all listings that match the sku of the item
     * @param {String} sku
     * @return {Array<Listing>} Returns matching listings
     */
    findListings(sku) {
        return this.listings.filter(listing => {
            return listing.getSKU() === sku;
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
            const match = this.findListing(formatted.intent === 0 ? formatted.sku : formatted.id);
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
            const match = this.findListing(formatted.intent === 0 ? formatted.sku : formatted.id);
            if (match !== null) {
                match.remove();
            }

            this._action('create', formatted);
        }
    }

    // TODO: Update archived listing(s)

    /**
     * Enqueues a list of listings to be made
     * @param {String} id listing ID
     * @param {Object} properties properties
     */
    updateListing(id, properties) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formatted = { id, body: properties };

        this._action('update', formatted);
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
        } else if (type === 'update') {
            // Might need to add something later
            this.actions[type] = this.actions[type].concat(array);
            doneSomething = true;
        }

        if (doneSomething) {
            this.emit('actions', this.actions);

            this._startTimeout();
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
            this.actions = { create: [], remove: [], update: [] };
            this._actions = { create: {}, remove: {}, update: {} };
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

        // Might need to do something here for update
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
                update: callback => {
                    this._update(callback);
                },
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
                    this.actions.update.length !== 0 ||
                    this._listingsWaitingForRetry() - this.actions.create.length !== 0
                ) {
                    this._processingActions = false;
                    // There are still things to do
                    this._startTimeout();
                    callback(null);
                } else {
                    // Queues are empty, get listings
                    this.getListings(() => {
                        this._processingActions = false;
                        this._startTimeout();
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

        const batch = this.actions.create
            .filter(listing => listing.attempt !== this._lastInventoryUpdate)
            .slice(0, this.batchSize);

        const options = {
            method: 'POST',
            url: 'https://api.backpack.tf/api/v2/classifieds/listings/batch',
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            },
            body: batch,
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            //TODO response
            if (err) {
                this.emit('createListingsError', err);
                return callback(err);
            }

            if (Array.isArray(body)) {
                let created = 0;
                let archived = 0;
                let errors = [];

                body.forEach((element, index) => {
                    if (element.result) {
                        // There are "archived":true,"status":"notEnoughCurrency", might be good to do something about it
                        created++;
                        this._createdListingsCount++;

                        if (element.result.archived === true) {
                            archived++;
                        }
                    } else if (element.error) {
                        errors.push({ listing: batch[index], error: element.error });
                    }

                    // element.error:
                    // error: {
                    //    message:
                    //    'Cannot relist listing (Non-Craftable Killstreak Batsaber Kit) as it already exists.'
                    // }
                });

                this.emit('createListingsSuccessful', { created, archived, errors });
            }

            this.actions.create = this.actions.create.filter(formatted => {
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
        }).end();
    }

    /**
     * Update all listings in the update queue
     * @param {Function} callback
     */
    _update(callback) {
        if (this.actions.update.length === 0) {
            callback(null, null);
            return;
        }

        const update =
            this.actions.update.length > this.batchSize
                ? this.actions.update.slice(0, this.batchSize)
                : this.actions.update;

        const options = {
            method: 'PATCH',
            url: 'https://api.backpack.tf/api/v2/classifieds/listings/batch',
            headers: {
                'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                Cookie: 'user-id=' + this.userID
            },
            qs: {
                token: this.token
            },
            body: update,
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                this.emit('updateListingsError', err);
                // Might need to do something if failed, like if item id not found.
                return callback(err);
            }

            this.emit('updateListingsSuccessful', { updated: body.updated?.length, errors: body.errors });

            update.forEach(el => {
                const index = this.listings.findIndex(listing => listing.id === el.id);
                if (index >= 0) {
                    for (const key in el.body) {
                        if (!Object.prototype.hasOwnProperty.call(this.listings[index], key)) return;
                        if (!Object.prototype.hasOwnProperty.call(el.body, key)) return;
                        this.listings[index][key] = el.body[key];
                    }
                    this._listings[
                        this.listings[index].intent === 0 ? this.listings[index].getSKU() : this.listings[index].item.id
                    ] = this.listings[index];
                }

                this.actions.update.shift();
            });

            this.emit('actions', this.actions);

            return callback(null, body);
        }).end();
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
            url: 'https://api.backpack.tf/api/classifieds/delete/v1', //keep using old api, as it does not seem to have any item limit
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

        request(options, (err, response, body) => {
            if (err) {
                this.emit('deleteListingsError', err);
                return callback(err);
            }

            this.emit('deleteListingsSuccessful', body);

            // Filter out listings that we just deleted
            this.actions.remove = this.actions.remove.filter(id => remove.indexOf(id) === -1);

            // Update cached listings
            this.listings = this.listings.filter(listing => remove.indexOf(listing.id) === -1);

            this.emit('actions', this.actions);

            return callback(null, body);
        }).end();
    }

    /**
     * Mass delete all listings
     * @param {Number} [intent] - Optionally only delete buy (0) or sell (1) orders
     * @param {Function} callback
     */
    deleteAllListings(intent, callback) {
        if (typeof intent === 'function' && !callback) callback = intent;

        //TODO: ratelimit - 60 sec

        const options = {
            method: 'DELETE',
            url: `https://api.backpack.tf/api/v2/classifieds/listings`, // 1 minute cooldown
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

        request(options, (err1, response1, body1) => {
            if (err1) {
                this.emit('massDeleteListingsError', err1);
                return callback(err1);
            }

            this.emit('massDeleteListingsSuccessful', body1);

            const options2 = {
                method: 'DELETE',
                url: `https://api.backpack.tf/api/v2/classifieds/archive`, // 1 minute cooldown
                headers: {
                    'User-Agent': this.userAgent ? this.userAgent : 'User Agent',
                    Cookie: 'user-id=' + this.userID
                },
                qs: {
                    token: this.token
                }
            };

            if ([0, 1].includes(intent)) {
                options2.body['intent'] = intent;
            }

            request(options2, (err2, response2, body2) => {
                if (err2) {
                    this.emit('massDeleteArchiveError', err2);
                    return callback(err2);
                }

                this.emit('massDeleteArchiveSuccessful', body2);

                return callback(null, { listings: body1, archive: body2 });
            }).end();
        }).end();
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

            const item = this._formatItem(listing);
            if (item === null) {
                return null;
            }
            listing.item = item;

            if (listing.promoted !== undefined) {
                delete listing.promoted;
            }
            // Keep sku for later
        }

        if (listing.offers === undefined) {
            listing.offers = 1;
        }

        if (listing.buyout === undefined) {
            listing.buyout = 1;
        }

        if (listing.timestamp !== undefined) {
            delete listing.timestamp;
        }

        if (listing.value !== undefined) {
            delete listing.value;
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
        return this._isSameByIdentifier(original, test.intent, test.intent === 0 ? test.sku : test.id);
    }

    _isSameByIdentifier(original, testIntent, testIdentifier) {
        if (original.intent !== testIntent) {
            return false;
        }

        const originalIdentifier = original.intent === 0 ? original.sku : original.id;

        return originalIdentifier === testIdentifier;
    }

    /**
     * Converts an sku into an item object that backpack.tf understands
     * @param {String} sku
     * @return {Object} Returns the formatted item, null if the item does not exist
     */
    _formatItem(listing) {
        const item = SKU.fromString(listing.sku);

        const schemaItem = this.schema.getItemByDefindex(item.defindex);

        if (schemaItem === null) {
            return null;
        }

        // Begin formatting "item"

        const formatItem = {
            defindex: item.defindex,
            quality: item.quality
        };

        if (!item.craftable) {
            formatItem['flag_cannot_craft'] = true;
        }

        // Temporarily Disabled: https://github.com/TF2Autobot/tf2autobot/pull/1025#issuecomment-1100455637
        // const quantity = listing.quantity;
        // if (typeof quantity === 'number' && quantity > 0) {
        //     formatItem['quantity'] = quantity;
        // }

        formatItem['attributes'] = [];

        if (item.killstreak !== 0) {
            formatItem['attributes'].push({
                defindex: 2025,
                float_value: item.killstreak
            });
        }
        if (typeof item.killstreaker === 'number') {
            formatItem['attributes'].push({
                defindex: 2013,
                float_value: item.killstreak
            });
        }
        if (typeof item.sheen === 'number') {
            formatItem['attributes'].push({
                defindex: 2014,
                float_value: item.killstreak
            });
        }

        if (item.australium) {
            formatItem['attributes'].push({
                defindex: 2027
            });
        }

        if (item.festive) {
            formatItem['attributes'].push({
                defindex: 2053,
                float_value: 1
            });
        }

        if (item.effect) {
            if (schemaItem['item_slot'] === 'taunt') {
                formatItem['attributes'].push({
                    defindex: 2041,
                    float_value: item.effect
                });
            } else {
                formatItem['attributes'].push({
                    defindex: 134,
                    float_value: item.effect
                });
            }
        }

        if (item.quality2) {
            if (item.quality !== 11) {
                formatItem['attributes'].push({
                    defindex: 214
                });
            }
        }

        if (typeof item.paintkit === 'number') {
            formatItem['attributes'].push({
                defindex: 834,
                value: item.paintkit
            });
        }

        if (item.wear) {
            formatItem['attributes'].push({
                defindex: 725,
                float_value: item.wear / 5 // 0.2, 0.4, 0.6, 0.8, 1
            });
        }

        if (item.crateseries) {
            formatItem['attributes'].push({
                defindex: 187,
                float_value: item.crateseries
            });
        }

        if (item.craftnumber) {
            formatItem['attributes'].push({
                defindex: 229,
                value: item.craftnumber
            });
        }

        if (item.paint) {
            formatItem['attributes'].push({
                defindex: 142,
                float_value: item.paint
            });
        }

        if (item.output) {
            // https://github.com/TF2Autobot/tf2autobot/issues/995#issuecomment-1043044308

            // Collector's Chemistry Set
            // 20007;6;od-1085;oq-14
            // itemdef: od (item.output)
            // quality: oq (item.outputQuality)
            // No attributes

            // Strangifier Chemistry Set
            // 20005;6;td-343;od-6522;oq-6
            // itemdef: od (item.output)
            // quality: oq (item.outputQuality)
            // attributes[defindex=2012, float_value: td (item.target)]

            // Fabricator Kit:
            // Generic (Rare):
            // 20002;6;kt-2;od-6523;oq-6
            // itemdef: od (item.output)
            // quality: oq (item.outputQuality)
            // No attributes

            // Non-Generic:
            // 20003;6;kt-3;td-595;od-6526;oq-6
            // itemdef: od (item.output)
            // quality: oq (item.outputQuality)
            // attributes[defindex=2012, float_value: td (item.target)]

            const recipe = {
                defindex: 2000, // Just use 2000...
                is_output: true,
                quantity: 1,
                itemdef: item.output,
                quality: item.outputQuality || 6
            };

            recipe['attributes'] = [];
            if (item.target) {
                recipe.attributes.push({
                    defindex: 2012,
                    float_value: item.target
                });
            }

            if (item.sheen) {
                recipe.attributes.push({
                    defindex: 2014, //killstreak sheen
                    float_value: item.sheen
                });
            }
            if (item.killstreaker) {
                recipe.attributes.push({
                    defindex: 2013, //killstreak effect (for professional KS)
                    float_value: item.killstreaker
                });
            }

            if (recipe['attributes'].length === 0) {
                delete recipe['attributes'];
            }

            formatItem['attributes'].push(recipe);
        } else if (typeof item.target === 'number') {
            // Killstreak Kit, Strangifier, Unusualifier
            formatItem['attributes'].push({
                defindex: 2012,
                float_value: item.target
            });
        }

        //Spells
        if (typeof item.spell?.[1004] === 'number') {
            formatItem['attributes'].push({
                defindex: 1004,
                float_value: item.spell[1004]
            });
        }
        if (typeof item.spell?.[1005] === 'number') {
            formatItem['attributes'].push({
                defindex: 1005,
                float_value: item.spell[1005]
            });
        }
        if (item.spell?.[1006]) {
            formatItem['attributes'].push({
                defindex: 1006
            });
        }
        if (item.spell?.[1007]) {
            formatItem['attributes'].push({
                defindex: 1007
            });
        }
        if (item.spell?.[1008]) {
            formatItem['attributes'].push({
                defindex: 1008
            });
        }
        if (item.spell?.[1009]) {
            formatItem['attributes'].push({
                defindex: 1009
            });
        }

        //Strange parts
        if (item.parts?.[0]) {
            formatItem['attributes'].push({
                defindex: 380, //Strange PART 1
                float_value: item.parts?.[0]
            });
        }
        if (item.parts?.[1]) {
            formatItem['attributes'].push({
                defindex: 382, //Strange PART 2
                float_value: item.parts?.[1]
            });
        }
        if (item.parts?.[2]) {
            formatItem['attributes'].push({
                defindex: 384, //Strange PART 3
                float_value: item.parts?.[2]
            });
        }

        // TODO: Validate, test

        if (formatItem['attributes'].length === 0) {
            delete formatItem['attributes'];
        }

        return formatItem;
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
