"use strict";

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const http = require("http");

// Load your modules here, e.g.:
// const fs = require("fs");

let adapter = null;
let ip = "";
let username = "";
let password = "";
const path = "/status.html";

class Youless extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "youless",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
		adapter = this;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		try {
			adapter.username = this.config.username;
			adapter.password = this.config.password;
			adapter.ip = this.config.ip;
			adapter.RefreshInterval = this.config.RefreshInterval;

			try {
				await adapter.RefreshValues();
			} catch (error) {
				adapter.log.debug("Error while refreshing values, device not reachable?  " + error);
			}
		} catch (error) {
			adapter.log.error(error);
		}
		adapter.refreshIntervalObject = setInterval(adapter.RefreshValues, adapter.RefreshInterval * 1000);
	}


	// Serialize objects into iobroker states
	async SaveValues(key, obj) {
		adapter.log.debug("SaveValues");

		try {
			const keys = Object.getOwnPropertyNames(obj);

			adapter.setObjectNotExistsAsync(key, {
				type: "folder",
				common: {
					name: key,
					type: "folder",
				},
				native: {},
			});

			let v;
			for (let i = 0; i < keys.length; i++) {
				if (obj[keys[i]] != null && obj[keys[i]] != undefined) {
					if (typeof obj[keys[i]] === "object") {
						adapter.log.debug("Object found");
						adapter.SaveValues(key + "." + keys[i], obj[keys[i]]);
					} else {
						// Replace commas by dots to get accepted as a number.
						try {
							obj[keys[i]] = obj[keys[i]].replace(",",".")
						} catch (exp) {
						}

						let type = "";
						if (isNaN(obj[keys[i]])) {
							type = "string";
							v = obj[keys[i]];
						} else if (typeof obj[keys[i]] == "boolean") {
							type = "boolean";
							if (obj[keys[i]] === "true") {
								v = true;
							} else {
								v = false;
							}
						} else {
							type = "number";
							v = parseFloat(obj[keys[i]]);
						}

						adapter.log.debug("Key: " + keys[i] + ", Value: " + obj[keys[i]] + ", Type: " + type);
						await adapter.setObjectNotExistsAsync(key + "." + keys[i], {
							type: "state",
							common: {
								name: keys[i],
								role: "value",
								read: true,
								write: true,
								type: type,
							},
							native: {},
						});
						adapter.setState(key + "." + keys[i], {
							val: v,
							ack: true,
						});
					}
				}
			}
		} catch (error) {
			adapter.log.error(error);
		}
	}

	RefreshValues() {
		try {
			var request = http.request(
				{ hostname: adapter.ip, path: "/a?f=j", auth: adapter.username + ":" + adapter.password },
				function (response) {
					try {
						response.setEncoding("utf8");
						response.on("data", function (chunk) {
							var obj = JSON.parse(chunk);
							adapter.SaveValues("energy", obj);
							});
					} catch (error) {
						adapter.log.error(error);
					}
				},
				function (error) {
					try {
						if (error.toString().indexOf("EHOSTUNREACH") >= 0) {
							// Host seems to be offline
							adapter.log.error("Host unreachable");
						}
					} catch (error) {
						adapter.log.error(error);
					}
				},
			);
			request.end();
			request.on("error", function (e) {
				console.error(e);
			});
			request = http.request(
				{ hostname: adapter.ip, path: "/d", auth: adapter.username + ":" + adapter.password },
				function (response) {
					try {
						response.setEncoding("utf8");
						response.on("data", function (chunk) {
							var obj = JSON.parse(chunk);
							adapter.SaveValues("device", obj)
						});
					} catch (error) {
						adapter.log.error(error);
					}
				},
				function (error) {
					try {
						if (error.toString().indexOf("EHOSTUNREACH") >= 0) {
							// Host seems to be offline
							adapter.log.error("Host unreachable");
						}
					} catch (error) {
						adapter.log.error(error);
					}
				},
			);
			request.end();
			request.on("error", function (e) {
				console.error(e);
			});
		} catch (error) {
			adapter.log.error(error);
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Youless(options);
} else {
	// otherwise start the instance directly
	new Youless();
}
