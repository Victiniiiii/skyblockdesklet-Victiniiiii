const Desklet = imports.ui.desklet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const ScrollView = imports.gi.St.ScrollView;

function main(metadata, desklet_id) {
	return new SkyblockPricesDesklet(metadata, desklet_id);
}

function SkyblockPricesDesklet(metadata, desklet_id) {
	this._init(metadata, desklet_id);
}

SkyblockPricesDesklet.prototype = {
	__proto__: Desklet.Desklet.prototype,

	_init: function (metadata, desklet_id) {
		Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

		this.bazaarItems = ["COMPOST", "ENCHANTED_BREAD", "HOT_POTATO_BOOK"];
		this.auctionItems = ["Chestplate_of_Divan", "Warden_Helmet", "Hyperion"];
		this.updateInterval = 30;
		this.use24HourFormat = true;
		this.buyOrSellInDiff = true;

		try {
			this.settings = new Settings.DeskletSettings(this, metadata.uuid, desklet_id);

			this.settings.bindProperty(Settings.BindingDirection.IN, "bazaar_items_list", "bazaarItemsList", null, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "auction_items_list", "auctionItemsList", null, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "update_interval", "updateInterval", null, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "use_24_hour_format", "use24HourFormat", null, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "buy_or_sell_in_diff", "buyOrSellInDiff", null, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "apply_button", "applyButton", null, null);
		} catch (e) {
			global.logError("Failed to initialize settings: " + e);
		}

		this.setupUI();

		this.parseItemsLists();
		this.update();

		this.setupUpdateLoop();
	},

	_runScriptAsync: function (command, container, expectedCoins) {
		const Gio = imports.gi.Gio;

		try {
			let [success, argv] = GLib.shell_parse_argv(command);
			if (!success) {
				throw new Error("Failed to parse command: " + command);
			}

			let proc = new Gio.Subprocess({
				argv: argv,
				flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
			});

			proc.init(null);
			proc.communicate_utf8_async(null, null, (proc, res) => {
				try {
					let [, stdout, stderr] = proc.communicate_utf8_finish(res);

					if (stderr && stderr.trim() !== "") {
						global.logError("Script error: " + stderr);
					}

					let output = stdout.trim();

					let itemBox = new St.BoxLayout({
						vertical: true,
						style_class: "item-box",
					});

					let lines = output
						.split("\n")
						.map(l => l.trim())
						.filter(l => l !== "");

					if (lines.length === 0) {
						let errorLabel = new St.Label({ text: "Empty response from script" });
						container.add(errorLabel);
						return;
					}

					let apiPrice = null;
					let borderStyle = "";

					if (expectedCoins !== null && lines.length > 1) {
						let priceMatch;

						if (lines[1].includes("Buy") && lines[1].includes("Sell")) {
							if (this.buyOrSellInDiff) {
								priceMatch = lines[1].match(/-\s*([\d,]+)/);
							} else {
								priceMatch = lines[1].match(/Buy\s+([\d,]+)/);
							}
						} else if (lines[1].includes("Lowest BIN:")) {
							priceMatch = lines[1].match(/Lowest BIN:\s+([\d,]+)/);
						}

						if (priceMatch && priceMatch[1]) {
							apiPrice = parseFloat(priceMatch[1].replace(/,/g, ""));

							if (!isNaN(apiPrice) && apiPrice > 0 && expectedCoins > 0) {
								let percentage = ((apiPrice - expectedCoins) / expectedCoins) * 100;
								let borderColor = this.getColorFromPercentage(percentage);
								borderStyle = `border: 2px solid ${borderColor}; border-radius: 10px; padding: 5px;`;
							}
						}
					}

					if (borderStyle) {
						itemBox.set_style(borderStyle);
					}

					lines.forEach((line, index) => {
						let label = new St.Label({
							text: line,
							style_class: index === 0 ? "item-name" : "item-price",
						});
						itemBox.add_actor(label);

						if (index < lines.length - 1) {
							let itemSeparator = new St.BoxLayout({ style_class: "item-separator" });
							itemBox.add_actor(itemSeparator);
						}
					});

					container.add_actor(itemBox);
				} catch (e) {
					global.logError("Async script output error: " + e.message);
					let errorLabel = new St.Label({ text: "Error parsing result" });
					container.add_actor(errorLabel);
				}
			});
		} catch (e) {
			global.logError("Failed to run async script: " + e.message);
			let errorLabel = new St.Label({ text: "Script failed to run" });
			container.add_actor(errorLabel);
		}
	},

	parseItemLine: function (itemLine) {
		let parts = itemLine.trim().split(/\s+/);
		let itemId = parts[0];
		let coinsValue = null;

		if (parts.length >= 2) {
			let possibleCoins = parseFloat(parts[1]);
			if (!isNaN(possibleCoins) && possibleCoins > 0) {
				coinsValue = possibleCoins;
			}
		}

		return { itemId: itemId, coins: coinsValue };
	},

	getColorFromPercentage: function (percentage) {
		let clampedPerc = Math.max(-100, Math.min(100, percentage));

		let r, g, b;

		if (clampedPerc <= -10) {
			let t = (clampedPerc + 100) / 90;
			r = Math.round(139 + (255 - 139) * t);
			g = 0;
			b = 0;
		} else if (clampedPerc <= 0) {
			let t = (clampedPerc + 10) / 10;
			r = 255;
			g = Math.round(255 * t);
			b = 0;
		} else if (clampedPerc <= 10) {
			let t = clampedPerc / 10;
			r = Math.round(255 * (1 - t));
			g = 255;
			b = 0;
		} else {
			let t = (clampedPerc - 10) / 90;
			r = 0;
			g = Math.round(255 - (255 - 100) * t);
			b = 0;
		}

		let alpha = 0.3 + (0.7 * Math.abs(clampedPerc)) / 100;

		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	},
	
	parseItemsLists: function () {
		if (this.bazaarItemsList && this.bazaarItemsList.trim() !== "") {
			this.bazaarItems = this.bazaarItemsList
				.split("\n")
				.map(item => this.parseItemLine(item))
				.filter(item => item.itemId !== "");
		}

		if (this.bazaarItems.length === 0) {
			this.bazaarItems = [{ itemId: "COMPOST", coins: null }];
		}

		if (this.auctionItemsList && this.auctionItemsList.trim() !== "") {
			this.auctionItems = this.auctionItemsList
				.split("\n")
				.map(item => this.parseItemLine(item))
				.filter(item => item.itemId !== "");
		}

		if (this.auctionItems.length === 0) {
			this.auctionItems = [{ itemId: "Chestplate_of_Divan", coins: null }];
		}
	},

	setupUpdateLoop: function () {
		if (this._updateLoop) {
			Mainloop.source_remove(this._updateLoop);
		}

		let interval = this.updateInterval * 60;
		this._updateLoop = Mainloop.timeout_add_seconds(interval, Lang.bind(this, this.update));
	},

	setupUI: function () {
		let deskletPath = this.metadata.path;
		let cssPath = GLib.build_filenamev([deskletPath, "stylesheet.css"]);

		if (GLib.file_test(cssPath, GLib.FileTest.EXISTS)) {
			let theme = St.ThemeContext.get_for_stage(global.stage);
			let themeCSS = theme.get_theme();
			try {
				themeCSS.load_stylesheet(cssPath);
			} catch (e) {
				global.logError("Failed to load CSS: " + e);
			}
		}

		this.mainBox = new St.BoxLayout({
			vertical: true,
			style_class: "skyblock-desklet",
		});

		this.lastUpdatedLabel = new St.Label({
			text: "Victiniiiii's Skyblock Desklet.\nLast Updated: N/A",
			style_class: "lastUpdatedLabel",
		});

		this.mainBox.add(this.lastUpdatedLabel);

		this.scrollView = new ScrollView({
			style_class: "scrollview",
			x_fill: true,
			y_fill: true,
			y_align: St.Align.START,
		});

		this.contentBox = new St.BoxLayout({ vertical: true });
		this.scrollView.add_actor(this.contentBox);
		this.mainBox.add(this.scrollView, { expand: true });

		this.setContent(this.mainBox);
	},

	on_apply_clicked: function () {
		global.log("Apply settings button clicked");
		this.parseItemsLists();
		this.setupUpdateLoop();
		this.update();
	},

	update: function () {
		let deskletPath = this.metadata.path;
		let scriptPath = GLib.build_filenamev([deskletPath, "script.sh"]);

		this.contentBox.destroy_all_children();

		let bazaarContainer = null;
		let auctionContainer = null;

		if (this.bazaarItems.length > 0) {
			bazaarContainer = new St.BoxLayout({
				vertical: true,
				style_class: "section-container",
			});
			bazaarContainer.add(
				new St.Label({
					text: "Bazaar Items",
					style_class: "section-header",
				})
			);
			bazaarContainer.add(
				new St.BoxLayout({
					style_class: "header-separator",
					height: 2,
				})
			);
			this.contentBox.add(bazaarContainer);

			for (let i = 0; i < this.bazaarItems.length; i++) {
				let item = this.bazaarItems[i];
				let name = item.itemId.trim();
				if (!name) continue;
				name = name.replace(/"/g, '\\"');
				let slot = new St.BoxLayout({ vertical: true });
				bazaarContainer.add(slot);
				let cmd = `/bin/bash "${scriptPath}" "bazaar" "${name}"`;
				this._runScriptAsync(cmd, slot, item.coins);
			}
		}

		if (this.auctionItems.length > 0) {
			auctionContainer = new St.BoxLayout({
				vertical: true,
				style_class: "section-container",
			});
			auctionContainer.add(
				new St.Label({
					text: "Auction House Items",
					style_class: "section-header",
				})
			);
			auctionContainer.add(
				new St.BoxLayout({
					style_class: "header-separator",
					height: 2,
				})
			);
			this.contentBox.add(auctionContainer);

			for (let i = 0; i < this.auctionItems.length; i++) {
				let item = this.auctionItems[i];
				let name = item.itemId.trim();
				if (!name) continue;
				name = name.replace(/"/g, '\\"');
				let slot = new St.BoxLayout({ vertical: true });
				auctionContainer.add(slot);
				let cmd = `/bin/bash "${scriptPath}" "auction" "${name}"`;
				this._runScriptAsync(cmd, slot, item.coins);
			}
		}

		let now = new Date();
		let fmt = now.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
			hour12: !this.use24HourFormat,
		});
		this.lastUpdatedLabel.set_text("Victiniiiii's Skyblock Desklet.\nLast Updated: " + fmt);

		return true;
	},

	on_desklet_removed: function () {
		if (this._updateLoop) {
			Mainloop.source_remove(this._updateLoop);
			this._updateLoop = null;
		}
	},
};
