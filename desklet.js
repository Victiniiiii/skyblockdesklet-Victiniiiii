const Desklet = imports.ui.desklet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gio = imports.gi.Gio;

function main(metadata, desklet_id) {
	return new ScriptOutputDesklet(metadata, desklet_id);
}

var ScriptOutputDesklet = class ScriptOutputDesklet extends Desklet.Desklet {
	constructor(metadata, desklet_id) {
		super(metadata, desklet_id);

		this.metadata = metadata;

		this.box = new St.BoxLayout({ vertical: true });

		this.lastUpdatedLabel = new St.Label({ text: "Last Updated: N/A", name: "lastUpdatedLabel" });
		this.text = new St.Label({ text: "Loading..." });

		this.box.add(this.lastUpdatedLabel);
		this.box.add(this.text);

		this.setContent(this.box);

		this.update();
	}

	update() {
		let deskletPath = this.metadata.path;
		let scriptPath = GLib.build_filenamev([deskletPath, "script.sh"]);

		let [res, out, err, status] = GLib.spawn_command_line_sync(`/bin/bash "${scriptPath}"`);

		let currentTime = new Date();
		let currentTimeFormatted = currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

		let lastUpdatedText = "Last Updated: " + currentTimeFormatted;

		if (res && out) {
			this.text.set_text(out.toString().trim());
		} else {
			this.text.set_text("Error running script.");
		}

		this.lastUpdatedLabel.set_text(lastUpdatedText);

		// Schedule next run in 1800 seconds (30 minutes)
		Mainloop.timeout_add_seconds(1800, () => {
			this.update();
			return false;
		});
	}
};
