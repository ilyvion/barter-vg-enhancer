/* global GM_getValue, GM_setValue, GM_listValues, GM_deleteValue */

export default class Greasemonkey {
	static getValue(name, defaultValue) {
		return GM_getValue(name, defaultValue);
	}

	static setValue(name, value) {
		return GM_setValue(name, value);
	}

	static listValues() {
		return GM_listValues();
	}

	static deleteValue(name) {
		return GM_deleteValue(name);
	}
}
