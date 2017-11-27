import $ from 'jquery';

import Greasemonkey from './greasemonkey';
import Http from './http';

/* global console */

export default class Steam {
	static getPricesFor(steamAppIds, callback) {
		var gamePrices = {};
		$.each(steamAppIds, function(index, steamAppId) {
			// Check if the game's price has been retrieved lately
			var cachedPriceJson = Greasemonkey.getValue('priceCache.' + steamAppId, null);
			if (cachedPriceJson === null) {
				return;
			}
			 
			var cachedPrice = JSON.parse(cachedPriceJson);
			var cacheAge = new Date() - new Date(cachedPrice.freshTime);
			if (cacheAge > 3600 * 1000) {
				// Expired
				Greasemonkey.deleteValue('priceCache.' + steamAppId);
			} else {
				gamePrices[steamAppId] = {
					prices: cachedPrice.prices
				};
			}
		});
		$.each(gamePrices, function(steamAppId) {
			var index = steamAppIds.indexOf(steamAppId);
			if (index === -1) {
				return;
			}
			steamAppIds.splice(index, 1);
		});
		if (steamAppIds.length === 0 || steamAppIds.length === 1 && steamAppIds[0] === null) {
			// All prices cached, no API call necessary
			callback(true, gamePrices);
			return;
		}

		var url = 'http://store.steampowered.com/api/appdetails/';
		var urlParameters = {
			filters: 'price_overview',
			appids: steamAppIds.join(',')
		};
		var urlQuery = $.param(urlParameters);
		if (urlQuery) {
			url += '?' + urlQuery;
		}

		var cb = function(success, response) {
			console.debug('Steam Result', response);
			if (success) {
				$.each(response.data, function(key, datum) {
					if (!datum.success) {
						console.debug('Getting prices for ' + key + ' failed!');
						return;
					}
					// jscs:disable requireCamelCaseOrUpperCaseIdentifiers
					gamePrices[key] = {
						prices: datum.data.price_overview
					};

					var cachedPrice = {
						freshTime: new Date(),
						prices: datum.data.price_overview
					};
					// jscs:enable requireCamelCaseOrUpperCaseIdentifiers
					Greasemonkey.setValue('priceCache.' + key, JSON.stringify(cachedPrice));
				});
				callback(true, gamePrices);
			} else {
				callback(false, null);
			}
		};
		console.debug('Steam URL', url);
		Http.get(url, cb);
	}

}
