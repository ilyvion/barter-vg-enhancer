import { Route } from '../modules/router';

import $ from 'jquery';

/* global console */

export default class OffersPageController {
	static get routes() {
		return [
			new Route(
				/https:\/\/barter\.vg\/u\/.+\/o\/.+\//,
				this,
				this.prototype.index,
				() => $('.statusCurrent').text() !== "Creating..."
			)
		];
	}

	index() {
		console.log('OffersPageController.index');
	}
}
