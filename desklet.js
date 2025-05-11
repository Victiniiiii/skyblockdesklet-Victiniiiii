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

		try {
			this.settings = new Settings.DeskletSettings(this, metadata.uuid, desklet_id);

			this.settings.bindProperty(Settings.BindingDirection.IN, "bazaar_items_list", "bazaarItemsList", null, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "auction_items_list", "auctionItemsList", null, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "update_interval", "updateInterval", null, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "apply_button", "applyButton", null, null);
		} catch (e) {
			global.logError("Failed to initialize settings: " + e);
		}

		this.setupUI();

		this.parseItemsLists();
		this.update();

		this.setupUpdateLoop();
	},

	_runScriptAsync: function (command, container) {
		const Gio = imports.gi.Gio;

		try {
			let [success, argv] = GLib.shell_parse_argv(command);
			let proc = new Gio.Subprocess({
				argv: argv,
				flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
			});

			proc.init(null);
			proc.communicate_utf8_async(null, null, (proc, res) => {
				try {
					let [, stdout, stderr] = proc.communicate_utf8_finish(res);
					let output = stdout.trim();

					let itemBox = new St.BoxLayout({
						vertical: true,
						style_class: "item-box",
					});

					let lines = output
						.split("\n")
						.map(l => l.trim())
						.filter(l => l !== "");

					lines.forEach((line, index) => {
						let label = new St.Label({
							text: line,
							style_class: index === 0 ? "item-name" : "item-price",
						});
						itemBox.add(label);

						if (index < lines.length - 1) {
							let itemSeparator = new St.BoxLayout({ style_class: "item-separator" });
							itemBox.add(itemSeparator);
						}
					});

					container.add(itemBox);
				} catch (e) {
					global.logError("Async script output error: " + e.message);
					let errorLabel = new St.Label({ text: "Error parsing result" });
					container.add(errorLabel);
				}
			});
		} catch (e) {
			global.logError("Failed to run async script: " + e.message);
			let errorLabel = new St.Label({ text: "Script failed to run" });
			container.add(errorLabel);
		}
	},

	parseItemsLists: function () {
		if (this.bazaarItemsList && this.bazaarItemsList.trim() !== "") {
			this.bazaarItems = this.bazaarItemsList
				.split("\n")
				.map(item => item.trim())
				.filter(item => item !== "");
		}

		if (this.bazaarItems.length === 0) {
			this.bazaarItems = ["COMPOST"];
		}

		if (this.auctionItemsList && this.auctionItemsList.trim() !== "") {
			this.auctionItems = this.auctionItemsList
				.split("\n")
				.map(item => item.trim())
				.filter(item => item !== "");
		}

		if (this.auctionItems.length === 0) {
			this.auctionItems = ["Chestplate_of_Divan"];
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

			let bazaarHeader = new St.Label({
				text: "Bazaar Items",
				style_class: "section-header",
			});
			bazaarContainer.add(bazaarHeader);

			let headerSeparator = new St.BoxLayout({
				style_class: "header-separator",
				height: 2,
			});
			bazaarContainer.add(headerSeparator);

			this.contentBox.add(bazaarContainer);
		}

		for (let i = 0; i < this.bazaarItems.length; i++) {
			let itemName = this.bazaarItems[i].trim();
			if (itemName === "") continue;

			itemName = itemName.replace(/"/g, '\\"');
			let command = `/bin/bash "${scriptPath}" "bazaar" "${itemName}"`;

			this._runScriptAsync(command, bazaarContainer);
		}

		if (this.auctionItems.length > 0) {
			auctionContainer = new St.BoxLayout({
				vertical: true,
				style_class: "section-container",
			});

			let auctionHeader = new St.Label({
				text: "Auction House Items",
				style_class: "section-header",
			});
			auctionContainer.add(auctionHeader);

			let headerSeparator = new St.BoxLayout({
				style_class: "header-separator",
				height: 2,
			});
			auctionContainer.add(headerSeparator);

			this.contentBox.add(auctionContainer);
		}

		for (let i = 0; i < this.auctionItems.length; i++) {
			let itemName = this.auctionItems[i].trim();
			if (itemName === "") continue;

			itemName = itemName.replace(/"/g, '\\"');
			let command = `/bin/bash "${scriptPath}" "auction" "${itemName}"`;

			this._runScriptAsync(command, auctionContainer);
		}

		let currentTime = new Date();
		let currentTimeFormatted = currentTime.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
		this.lastUpdatedLabel.set_text("Victiniiiii's Skyblock Desklet.\nLast Updated: " + currentTimeFormatted);

		return true;
	},

	on_desklet_removed: function () {
		if (this._updateLoop) {
			Mainloop.source_remove(this._updateLoop);
			this._updateLoop = null;
		}
	},
};
