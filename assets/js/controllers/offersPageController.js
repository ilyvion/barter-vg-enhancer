import $ from 'jquery';

import { Route } from '../modules/router';
import Http from '../modules/http';
import Fractions from '../modules/fractions';
import format from '../modules/format';
import Steam from '../modules/steam';

import variables from '../../generated/variables.pass2';

/* global console */

const GAME_STAT_TEMPLATE_OBJECT = {
	totalTradeable: 0,
	totalWishlist: 0,
	averageReviewScore: 0,
	averageWeightedReviewScore: 0,
	voteCount: 0,
	gamesInBundles: 0,
	games: 0,
	totalBundles: 0
};

function gameStatReducer(previousValue, currentValue) {
	'use strict';

	previousValue.totalTradeable += currentValue.tradeable;
	previousValue.totalWishlist += currentValue.wishlist;
	previousValue.averageReviewScore += currentValue.positiveUserReviewPercentage;
	previousValue.averageWeightedReviewScore += currentValue.positiveUserReviewPercentage * currentValue.totalUserReviews;
	previousValue.voteCount += currentValue.totalUserReviews;
	previousValue.gamesInBundles += currentValue.allBundleCount > 0 ? 1 : 0;
	previousValue.totalBundles += currentValue.allBundleCount;
	previousValue.games += 1;
	return previousValue;
}

function calculateGameStats(games) {
	'use strict';
	
	const gameStats = games.reduce(gameStatReducer, $.extend({}, GAME_STAT_TEMPLATE_OBJECT));
	
	gameStats.averageReviewScore = Number((gameStats.averageReviewScore / gameStats.games).toFixed(0));
	gameStats.averageWeightedReviewScore = Number((gameStats.averageWeightedReviewScore / gameStats.voteCount).toFixed(0));
	const tradeRatio = gameStats.totalTradeable / gameStats.totalWishlist;
	let fractions;
	if (tradeRatio < 1) {
		fractions = Fractions.getFractions(tradeRatio);
		gameStats.tradeRatioRounded = fractions.rounded.n + ' : ' + fractions.rounded.d;
		gameStats.tradeRatioActual = fractions.real.n + ' : ' + fractions.real.d;
		gameStats.tradeRatioSmallest = fractions.smallest.n + ' : ' + fractions.smallest.d;
	} else if (tradeRatio > 1) {
		fractions = Fractions.getFractions(1 / tradeRatio);
		gameStats.tradeRatioRounded = fractions.rounded.d + ' : ' + fractions.rounded.n;
		gameStats.tradeRatioActual = fractions.real.d + ' : ' + fractions.real.n;
		gameStats.tradeRatioSmallest = fractions.smallest.d + ' : ' + fractions.smallest.n;
	} else {
		gameStats.tradeRatioRounded = gameStats.tradeRatioActual = gameStats.tradeRatioSmallest = '1 : 1';
	}

	return gameStats;
}

function getGamesTradeSummary(games, idPrefix) {
	'use strict';

	const gameStats = calculateGameStats(games);
	const tradeSummary = format(variables.html.tradeSummary, gameStats.games, gameStats.gamesInBundles, gameStats.totalTradeable, gameStats.totalWishlist, gameStats.averageReviewScore, gameStats.averageWeightedReviewScore, gameStats.tradeRatioRounded, gameStats.tradeRatioSmallest, gameStats.totalBundles, gameStats.tradeRatioActual, gameStats.voteCount, (Math.log(gameStats.voteCount) / Math.log(2)).toFixed(2), idPrefix);
	return tradeSummary;
}

// jscs:disable requireCamelCaseOrUpperCaseIdentifiers
class GameOfferModel {
	constructor(gameItem) {
		this._gameItem = gameItem;
	}

	get itemId() {
		return this._gameItem.item_id;
	}

	get steamId() {
		return this._gameItem.sku;
	}

	get tradeable() {
		return this._gameItem.tradeable;
	}
	
	get wishlist() {
		return this._gameItem.wishlist;
	}

	get positiveUserReviewPercentage() {
		return this._gameItem.user_reviews_positive;
	}

	get totalUserReviews() {
		return this._gameItem.user_reviews_total;
	}

	get allBundleCount() {
		return this._gameItem.bundles_all;
	}

	get prices() {
		return this._prices;
	}

	set prices(value) {
		this._prices = value;
	}

	get type() {
		return this._type;
	}

	set type(value) {
		this._type = value;
	}

	get element() {
		return this._element;
	}

	set element(value) {
		this._element = value;
	}

	get steamStorePriceElement() {
		return this._steamStorePriceElement;
	}

	set steamStorePriceElement(value) {
		this._steamStorePriceElement = value;
	}
	
	get tradeRatioElement() {
		return this._tradeRatioElement;
	}

	set tradeRatioElement(value) {
		this._tradeRatioElement = value;
	}
}
// jscs:enable requireCamelCaseOrUpperCaseIdentifiers

function addElementToGameOffers(tradeables, gameOffers) {
	'use strict';

	const tradablesItemsList = tradeables.find('.tradables_items_list li:not(.bold)');
	$.each(tradablesItemsList, (_, tradablesItems) => {
		const gameUrl = $(tradablesItems).find('.tradables_info > strong > a').attr('href');
		const urlRegex = /https:\/\/barter.vg\/i\/(\d+)\//;
		const match = urlRegex.exec(gameUrl);
		if (match !== null) {
			var gameOffer = gameOffers.find(go => {
				const matchItemId = Number(match[1]);
				return go.itemId === matchItemId;
			});
			if (gameOffer) {
				gameOffer.element = tradablesItems;
			} else {
				console.warn('Could not find HTML element for game', gameOffer.itemId);
			}
		}
	});
}

function createGameOffersFromOfferData(offerData, fromGames, toGames) {
	'use strict';

	const gameOffers = [];
	fromGames = fromGames || [];
	toGames = toGames || [];
	for (let gameKey in offerData.items.from) {
		if (offerData.items.from.hasOwnProperty(gameKey)) {
			const gameOffer = new GameOfferModel(offerData.items.from[gameKey]);
			gameOffer.type = 'from';
			fromGames.push(gameOffer);
			gameOffers.push(gameOffer);
		}
	}
	for (let gameKey in offerData.items.to) {
		if (offerData.items.to.hasOwnProperty(gameKey)) {
			const gameOffer = new GameOfferModel(offerData.items.to[gameKey]);
			gameOffer.type = 'to';
			toGames.push(gameOffer);
			gameOffers.push(gameOffer);
		}
	}

	return gameOffers;
}

function addGameDetails(gameOffers) {
	'use strict';

	gameOffers.forEach(gameOffer => {
		const tradeRatio = gameOffer.tradeable / gameOffer.wishlist;
		let fractions;
		let tradeRatioRounded;
		let tradeRatioActual;
		let tradeRatioSmallest;
		if (tradeRatio < 1) {
			fractions = Fractions.getFractions(tradeRatio);
			tradeRatioRounded = fractions.rounded.n + ' : ' + fractions.rounded.d;
			tradeRatioActual = fractions.real.n + ' : ' + fractions.real.d;
			tradeRatioSmallest = fractions.smallest.n + ' : ' + fractions.smallest.d;
		} else if (tradeRatio > 1) {
			fractions = Fractions.getFractions(1 / tradeRatio);
			tradeRatioRounded = fractions.rounded.d + ' : ' + fractions.rounded.n;
			tradeRatioActual = fractions.real.d + ' : ' + fractions.real.n;
			tradeRatioSmallest = fractions.smallest.d + ' : ' + fractions.smallest.n;
		} else {
			tradeRatioRounded = tradeRatioActual = tradeRatioSmallest = '1 : 1';
		}
		const gameElement = gameOffer.element;
		$(gameElement).css('position', 'relative');
		$(gameElement).find('.tradables_info').css('max-width', '380px');
		$(gameElement).append(format(variables.html.gameDetails, tradeRatioSmallest));
		var steamStorePriceElement = $(gameElement).find('.bve-game-details__steam-store-price');
		var tradeRatioElement = $(gameElement).find('.bve-game-details__trade-ratio');
		gameOffer.steamStorePriceElement = steamStorePriceElement.get(0);
		gameOffer.tradeRatioElement = tradeRatioElement.get(0);
	});
}

export default class OffersPageController {
	static get routes() {
		return [
			new Route(
				/https:\/\/barter\.vg\/u\/.+\/o\/.+\//,
				this,
				this.prototype.index,
				() => $('.statusCurrent').text() !== 'Creating...'
			)
		];
	}

	index() {
		Http.get(`${window.location.href}json`, (result, response) => {
			if (!result) {
				console.error('Failed getting offer data from barter.vg');
				return;
			}

			const offerData = response.data;

			const fromGames = [];
			const toGames = [];
			const gameOffers = createGameOffersFromOfferData(offerData, fromGames, toGames);
			
			const tradeables = $('.tradables');
			addElementToGameOffers(tradeables, gameOffers);

			const fromIdPrefix = 'offered';
			const fromTradeSummary = getGamesTradeSummary(fromGames, fromIdPrefix);
			tradeables.eq(0).after(fromTradeSummary);
			
			const toIdPrefix = 'requested';
			const toTradeSummary = getGamesTradeSummary(toGames, toIdPrefix);
			tradeables.eq(1).before(toTradeSummary);

			addGameDetails(gameOffers);

			const fromTotalValue = $(`#${fromIdPrefix}_total_value`);
			const toTotalValue = $(`#${toIdPrefix}_total_value`);
			const fromAverageValue = $(`#${fromIdPrefix}_average_value`);
			const toAverageValue = $(`#${toIdPrefix}_average_value`);
			const allValues = fromTotalValue
				.add(toTotalValue)
				.add(fromAverageValue)
				.add(toAverageValue);

			let fromTotal = 0;
			let fromDiscountedTotal = 0;
			let toTotal = 0;
			let toDiscountedTotal = 0;
			let currency = null;
			const steamIds = gameOffers.map(go => go.steamId);
			Steam.getPricesFor(steamIds, (priceResult, gamePrices) => {
				if (!priceResult) {
					console.error('Error fetching game prices from Steam');
					allValues.html('Fetching prices failed!');
					return;
				}
				
					// jscs:disable requireCamelCaseOrUpperCaseIdentifiers
					for (let gamePriceIndex in gamePrices) {
						if (gamePrices.hasOwnProperty(gamePriceIndex)) {
						if (!currency) {
							currency = gamePrices[gamePriceIndex].prices.currency;
						}

						const gameOffer = gameOffers.find(go => go.steamId === gamePriceIndex);
						const gamePricesInfo = gamePrices[gamePriceIndex].prices;
						gameOffer.prices = gamePricesInfo;

						if (gamePricesInfo.final === 0) {
							$(gameOffer.steamStorePriceElement).html('Free').css('color', 'green');
						} else if (gamePricesInfo.discount_percent === 0) {
							$(gameOffer.steamStorePriceElement).html(format('{0} {1}', gamePricesInfo.final / 100.0, currency));
						} else {
							$(gameOffer.steamStorePriceElement).html(format('{0} {1} ({2}% off)', gamePricesInfo.final / 100.0, currency, gamePricesInfo.discount_percent));
						}

						if (gameOffer.type === 'from') {
							fromTotal += gamePricesInfo.initial;
							fromDiscountedTotal += gamePricesInfo.final;
						} else {
							toTotal += gamePricesInfo.initial;
							toDiscountedTotal += gamePricesInfo.final;
						}
						}
					}
					// jscs:enable requireCamelCaseOrUpperCaseIdentifiers

				fromTotalValue.html(format('{0} {2} ({1} {2})', (fromDiscountedTotal / 100.00).toFixed(2), (fromTotal / 100.0).toFixed(2), currency));
				fromAverageValue.html(format('{0} {2} ({1} {2})', (fromDiscountedTotal / fromGames.length / 100.0).toFixed(2), (fromTotal / fromGames.length / 100.0).toFixed(2), currency));
				toTotalValue.html(format('{0} {2} ({1} {2})', (toDiscountedTotal / 100.0).toFixed(2), (toTotal / 100.0).toFixed(2), currency));
				toAverageValue.html(format('{0} {2} ({1} {2})', (toDiscountedTotal / toGames.length / 100.0).toFixed(2), (toTotal / toGames.length / 100.0).toFixed(2), currency));

			});
			
		});
	}
}
