const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

function MyDesklet(metadata, desklet_id) {
	this._init(metadata, desklet_id);
}

MyDesklet.prototype = {
	__proto__: Desklet.Desklet.prototype,

	_init: function (metadata, desklet_id) {
		Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);
		this.session = null;
		GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
			this._createSoupSession();
			return GLib.SOURCE_REMOVE;
		});
	},

	_createSoupSession: function () {
		try {
			this.session = new Soup.Session();
			this._initializeUI();
			this._updateCompostPrices();
		} catch (e) {
			global.logError(`Error creating Soup.Session or initial setup in _createSoupSession: ${e}`);
			this._showErrorUI("Failed to initialize network session.");
		}
	},

	_initializeUI: function () {
		if (!this.mainContainer) {
			this.mainContainer = new St.BoxLayout({ vertical: true, style_class: "compost-desklet" });
			this.label = new St.Label({ text: "Loading..." });
			this.mainContainer.add(this.label);
			this.setContent(this.mainContainer);
		} else {
			this.label.set_text("Loading...");
		}
	},

	_showErrorUI: function (message) {
		if (!this.mainContainer) {
			this.mainContainer = new St.BoxLayout({ vertical: true, style_class: "compost-desklet" });
			this.label = new St.Label({ text: message });
			this.mainContainer.add(this.label);
			this.setContent(this.mainContainer);
		} else {
			this.label.set_text(message);
		}
	},

	_updateCompostPrices: function () {
		if (!this.session) {
			this.label.set_text("Network session not initialized.");
			return;
		}

		let message = Soup.Message.new("GET", "https://api.hypixel.net/skyblock/bazaar");
		if (!message) {
			this.label.set_text("Failed to create network message.");
			return;
		}

		this.session.send_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
			let stream = null;
			try {
				stream = session.send_finish(result);

				if (message.get_status() !== Soup.Status.OK) {
					this.label.set_text(`API error: ${message.get_status()} ${message.get_reason_phrase()}`);
					if (stream) stream.close(null);
					return;
				}

				let all_gbytes_chunks = [];
				let bytes_read_this_iteration;
				const CHUNK_SIZE = 8192;

				do {
					let current_chunk_gbytes = stream.read_bytes(CHUNK_SIZE, null);
					bytes_read_this_iteration = current_chunk_gbytes.get_size();
					if (bytes_read_this_iteration > 0) {
						all_gbytes_chunks.push(current_chunk_gbytes);
					}
				} while (bytes_read_this_iteration > 0);

				if (all_gbytes_chunks.length === 0) {
					stream.close(null);
					this.label.set_text("API returned an empty response.");
					global.log("API returned 200 OK but with an empty response body.");
					return;
				}

				const byteArray = imports.byteArray;

				let totalLength = all_gbytes_chunks.reduce((sum, gbytes) => sum + gbytes.get_size(), 0);
				let complete_bytes = new Uint8Array(totalLength);
				let offset = 0;

				for (let gbytes of all_gbytes_chunks) {
					let chunk = byteArray.fromGBytes(gbytes);
					complete_bytes.set(chunk, offset);
					offset += chunk.length;
				}

				const response_body_data = byteArray.toString(complete_bytes);

				stream.close(null);

				let json = JSON.parse(response_body_data);
				let compost = json.products["COMPOST"];
				let buy = compost.buy_summary[0]?.pricePerUnit.toFixed(2) || "N/A";
				let sell = compost.sell_summary[0]?.pricePerUnit.toFixed(2) || "N/A";

				this.label.set_text(`COMPOST\nBuy: ${buy}\nSell: ${sell}`);
			} catch (err) {
				global.logError(`Error processing API response in _updateCompostPrices: ${err}`);
				this.label.set_text("Data parse error or network issue.");
				if (stream) {
					try {
						stream.close(null);
					} catch (closeErr) {
						global.logError(`Error closing stream: ${closeErr}`);
					}
				}
			}
		});

		GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
			this._updateCompostPrices();
			return GLib.SOURCE_CONTINUE;
		});
	},
};

function main(metadata, desklet_id) {
	return new MyDesklet(metadata, desklet_id);
}
