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

		this.items = ["COMPOST", "ENCHANTED_BREAD", "HOT_POTATO_BOOK"];
		this.updateInterval = 30;

		try {
			this.settings = new Settings.DeskletSettings(this, metadata.uuid, desklet_id);

			this.settings.bindProperty(Settings.BindingDirection.IN, "items_list", "itemsList", null, null);

			this.settings.bindProperty(Settings.BindingDirection.IN, "update_interval", "updateInterval", null, null);

			this.settings.bindProperty(Settings.BindingDirection.IN, "apply_button", "applyButton", null, null);
		} catch (e) {
			global.logError("Failed to initialize settings: " + e);
		}

		this.setupUI();

		this.parseItemsList();
		this.update();

		this.setupUpdateLoop();
	},

	parseItemsList: function () {
		if (this.itemsList && this.itemsList.trim() !== "") {
			this.items = this.itemsList
				.split("\n")
				.map(item => item.trim())
				.filter(item => item !== "");
		}

		if (this.items.length === 0) {
			this.items = ["COMPOST"];
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
		this.mainBox = new St.BoxLayout({ vertical: true, width: 300 });

		this.lastUpdatedLabel = new St.Label({
			text: "Last Updated: N/A",
			style_class: "lastUpdatedLabel",
		});
		this.mainBox.add(this.lastUpdatedLabel);

		let separator = new St.BoxLayout({
			style_class: "separator",
			height: 1,
			y_expand: false,
		});
		this.mainBox.add(separator);

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
		this.parseItemsList();
		this.setupUpdateLoop();
		this.update();
	},

	update: function () {
		let deskletPath = this.metadata.path;
		let scriptPath = GLib.build_filenamev([deskletPath, "script.sh"]);

		this.contentBox.destroy_all_children();

		for (let i = 0; i < this.items.length; i++) {
			let itemName = this.items[i].trim();
			if (itemName === "") continue;

			itemName = itemName.replace(/"/g, '\\"');

			let command = `/bin/bash "${scriptPath}" "${itemName}"`;

			try {
				let [res, out] = GLib.spawn_command_line_sync(command);

				if (res && out) {
					let output = out.toString().trim();

					let itemBox = new St.BoxLayout({
						vertical: true,
						style_class: "item-box",
					});

					let lines = output.split("\n");
					for (let j = 0; j < lines.length; j++) {
						let line = lines[j].trim();
						if (line !== "") {
							let textLabel = new St.Label({ text: line });
							itemBox.add(textLabel);
						}
					}

					if (i < this.items.length - 1) {
						let itemSeparator = new St.BoxLayout({
							style_class: "item-separator",
							height: 1,
						});
						itemBox.add(itemSeparator);
					}

					this.contentBox.add(itemBox);
				} else {
					let errorLabel = new St.Label({
						text: "Error fetching " + this.items[i],
					});
					this.contentBox.add(errorLabel);
				}
			} catch (e) {
				global.logError("Error updating item " + itemName + ": " + e);
				let errorLabel = new St.Label({
					text: "Error: " + e.message,
				});
				this.contentBox.add(errorLabel);
			}
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
