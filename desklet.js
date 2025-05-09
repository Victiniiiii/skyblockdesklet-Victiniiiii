const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const byteArray = imports.byteArray;

function main(metadata, desklet_id) {
	const { container, label } = createUI();
	const desklet = new Desklet.Desklet(metadata, desklet_id);
	desklet.setContent(container);

	let session = null;

	const updateCompostPrices = () => {
		if (!session) {
			label.set_text("Network session not initialized.");
			return;
		}

		const message = Soup.Message.new("GET", "https://api.hypixel.net/skyblock/bazaar");
		if (!message) {
			label.set_text("Failed to create network message.");
			return;
		}

		session.send_async(message, GLib.PRIORITY_DEFAULT, null, (sess, result) => {
			let stream = null;
			try {
				stream = sess.send_finish(result);
				if (message.get_status() !== Soup.Status.OK) {
					label.set_text(`API error: ${message.get_status()} ${message.get_reason_phrase()}`);
					if (stream) stream.close(null);
					return;
				}

				const chunks = [];
				const CHUNK_SIZE = 8192;
				let readSize;

				do {
					const chunk = stream.read_bytes(CHUNK_SIZE, null);
					readSize = chunk.get_size();
					if (readSize > 0) chunks.push(chunk);
				} while (readSize > 0);

				if (chunks.length === 0) {
					stream.close(null);
					label.set_text("API returned an empty response.");
					global.log("API returned 200 OK but with an empty response body.");
					return;
				}

				const totalLength = chunks.reduce((sum, gbytes) => sum + gbytes.get_size(), 0);
				const completeBytes = new Uint8Array(totalLength);
				let offset = 0;

				for (let gbytes of chunks) {
					const chunk = byteArray.fromGBytes(gbytes);
					completeBytes.set(chunk, offset);
					offset += chunk.length;
				}

				const responseBody = byteArray.toString(completeBytes);
				stream.close(null);

				const json = JSON.parse(responseBody);
				const compost = json.products["COMPOST"];
				const buy = compost.buy_summary[0]?.pricePerUnit.toFixed(2) || "N/A";
				const sell = compost.sell_summary[0]?.pricePerUnit.toFixed(2) || "N/A";

				label.set_text(`COMPOST\nBuy: ${buy}\nSell: ${sell}`);
			} catch (err) {
				global.logError(`Error processing API response: ${err}`);
				label.set_text("Data parse error or network issue.");
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
			updateCompostPrices();
			return GLib.SOURCE_CONTINUE;
		});
	};

	const initialize = () => {
		GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
			try {
				session = new Soup.Session();
				updateCompostPrices();
			} catch (e) {
				global.logError(`Failed to initialize Soup.Session: ${e}`);
				label.set_text("Failed to initialize network session.");
			}
			return GLib.SOURCE_REMOVE;
		});
	};

	initialize();

	return desklet;
}

function createUI() {
	const container = new St.BoxLayout({ vertical: true, style_class: "compost-desklet" });
	const label = new St.Label({ text: "Loading..." });
	container.add(label);
	return { container, label };
}
