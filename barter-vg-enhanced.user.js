// ==UserScript==
// @name         Barter.vg enhancer
// @namespace    https://alexanderschroeder.net/
// @version      0.3
// @description  Summarizes and compares all attributes in an offer for easy comparison of offer value
// @homepage     https://github.com/alexschrod/barter-vg-enhancer
// @author       Alexander Krivács Schrøder
// @downloadURL  https://alexanderschroeder.net/userscripts/barter-vg-enhancer.user.js
// @supportURL   https://github.com/alexschrod/barter-vg-enhancer/issues
// @match        https://barter.vg/u/*/o/*/
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.0/jquery.min.js
// @connect      store.steampowered.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @noframes
// ==/UserScript==

/*jshint multistr: true */

(function() {
    'use strict';

    if (!String.prototype.format) {
        String.prototype.format = function() {
            var args = arguments;
            return this.replace(/{(\d+)}/g, function(match, number) {
                return typeof args[number] != 'undefined' ? args[number] : match;
            });
        };
    }

    function realToFraction(value, error) {
        if (error <= 0.0 || error >= 1.0) {
            throw "Must be between 0 and 1 (exclusive).";
        }

        var sign = Math.sign(value);
        if (sign == -1) {
            value = Math.abs(value);
        }

        if (sign !== 0) {
            error *= value;
        }

        var n = Math.trunc(value);
        value -= n;

        if (value < error) {
            return {"n": sign * n, "d": 1};
        }

        if (1 - error < value) {
            return {"n": sign * (n + 1), "d": 1};
        }

        var lower_n = 0;
        var lower_d = 1;

        var upper_n = 1;
        var upper_d = 1;

        while (true) {
            var middle_n = lower_n + upper_n;
            var middle_d = lower_d + upper_d;

            if (middle_d * (value + error) < middle_n) {
                upper_n = middle_n;
                upper_d = middle_d;
            } else if (middle_n < (value - error) * middle_d) {
                lower_n = middle_n;
                lower_d = middle_d;
            } else {
                return {"n": (n * middle_d + middle_n) * sign, "d": middle_d};
            }
        }
    }

    function getApproximateSmallestFraction(fraction) {
        while (fraction.n >= 10 && fraction.d >= 10) {
            fraction.n = Math.round(fraction.n / 10.0);
            fraction.d = Math.round(fraction.d / 10.0);
        }
        return fraction;
    }

    function getFractions(ratio) {
        var realFraction = realToFraction(ratio, 0.000001);
        var smallFraction = getApproximateSmallestFraction($.extend({}, realFraction));
        var smallestFraction = {n: 1, d: Math.trunc(smallFraction.d / smallFraction.n)};
        var digits = Math.trunc(Math.log10(smallestFraction.d));
        var rounded;
        if (digits > 1) {
            rounded = Math.round(smallestFraction.d / Math.pow(10, digits)) * Math.pow(10, digits);
        } else {
            rounded = Math.round(smallestFraction.d / 10) * 10;
            if (rounded === 0) rounded = 1;
        }
        var roundedFraction = {n: 1, d: rounded};

        return {
            real: realFraction,
            small : smallFraction,
            smallest: smallestFraction,
            rounded: roundedFraction
        };
    }

    var APPLICATION_JSON = 'application/json';
    var JSON_PROTECTION_PREFIX = /^\)\]\}',?\n/;
    var JSON_START = /^\[|^\{(?!\{)/;
    var JSON_ENDS = {
        '[': /]$/,
        '{': /}$/
    };

    function isJsonLike(str) {
        var jsonStart = str.match(JSON_START);
        return jsonStart && JSON_ENDS[jsonStart[0]].test(str);
    }

    function isString(value) {
        return typeof value === 'string';
    }

    function fromJson(json) {
        return isString(json) ? JSON.parse(json) : json;
    }

    function getHeaderFunction(headers) {
        var keyedHeaders = {};
        $.each(headers, function(_, value) {
            var splitValue = value.trim().split(':', 2);
            if (splitValue.length < 2) {
                return;
            }
            keyedHeaders[splitValue[0].trim()] =
                splitValue[1].trim();
        });
        return function(key) {
            return keyedHeaders[key] || null;
        };
    }

    function defaultHttpResponseTransform(data, headers) {
        if (!isString(data)) {
            return data;
        }
        var tempData = data.replace(JSON_PROTECTION_PREFIX, '').trim();
        if (!tempData) {
            return data;
        }
        var contentType = headers('Content-Type');
        if (contentType && contentType.indexOf(APPLICATION_JSON) === 0 || isJsonLike(tempData)) {
            data = fromJson(tempData);
        }
        return data;
    }

    function makeHttpGetRequest(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(gmResponse) {
                var headers = getHeaderFunction(gmResponse.responseHeaders.split('\n'));
                var responseData = gmResponse.response;

                responseData = defaultHttpResponseTransform(responseData, headers);
                var response = {
                    data: responseData,
                    status: gmResponse.status,
                    headers: headers,
                    statusText: gmResponse.statusText
                };

                callback(true, response);
            },
            onerror: function(gmResponse) {
                var headers = getHeaderFunction(gmResponse.responseHeaders.split('\n'));
                var responseData = gmResponse.response;

                responseData = defaultHttpResponseTransform(
                    responseData, headers);
                var response = {
                    data: responseData,
                    status: gmResponse.status,
                    headers: headers,
                    statusText: gmResponse.statusText
                };

                callback(false, response);
            }
        });
    }

    function getSteamPricesFor(steamAppIds, callback) {
        var gamePrices = {};
        $.each(steamAppIds, function(index, steamAppId) {
            // Check if the game's price has been retrieved lately
            var cachedPriceJson = GM_getValue("priceCache." + steamAppId, null);
            if (cachedPriceJson === null) {
                return;
            } else {
                var cachedPrice = JSON.parse(cachedPriceJson);
                var cacheAge = new Date() - new Date(cachedPrice.freshTime);
                if (cacheAge > 3600 * 1000) {
                    // Expired
                    GM_deleteValue("priceCache." + steamAppId);
                } else {
                    gamePrices[steamAppId] = {
                        prices: cachedPrice.prices
                    };
                }
            }
        });
        $.each(gamePrices, function(steamAppId) {
            var index = steamAppIds.indexOf(steamAppId);
            if (index === -1) {
                return;
            }
            steamAppIds.splice(index, 1);
        });
        if (steamAppIds.length === 0) {
            console.debug("all prices cached, no API call necessary!");
            callback(true, gamePrices);
            return;
        }

        var url = "http://store.steampowered.com/api/appdetails/";
        var urlParameters = {
            filters: "price_overview",
            appids: steamAppIds.join(",")
        };
        var urlQuery = $.param(urlParameters);
        if (urlQuery) {
            url += '?' + urlQuery;
        }

        var cb = function(success, response) {
            if (success) {
                $.each(response.data, function(key, datum) {
                    gamePrices[key] = {
                        prices: datum.data.price_overview
                    };

                    var cachedPrice = {
                        freshTime: new Date(),
                        prices: datum.data.price_overview
                    };
                    GM_setValue("priceCache." + key, JSON.stringify(cachedPrice));
                });
                callback(true, gamePrices);
            } else {
                callback(false, null);
            }
        };
        makeHttpGetRequest(url, cb);
    }

    var steamAppIdRegEx = /\/app\/(\d+)\//;
    var reviewScoreRegEx = /(\d+)% positive of (\d+) user reviews/;
    var tradeableRegEx = /(\d+) Barter.vg users have this tradable/;
    var wishlistRegEx = /(\d+) Barter.vg users wishlisted this game/;
    var bundleRegEx = /(\d+) bundles?: (.*)/;

    var tradeables = $('.tradables');
    var first = true;
    var allGames = [];
    var offeredGames = [];
    var requestedGames = [];
    $.each(tradeables, function(_, tradeable) {
        var whose = $(tradeable).find('legend strong').html();

        var gameList = $(tradeable).find('.tradables_items_list li');
        var games = $.map(gameList, function(gameListEntry) {
            var gameName = $(gameListEntry).find('> strong > a').html();
            var reviewBox = $(gameListEntry).find('a[href*="#app_reviews_hash"]');

            var steamAppId = null;
            var reviewPercentage = null;
            var reviewerCount = null;
            var gameInfoLine;
            var hasReviewCount = false;
            if (reviewBox.length === 0) {
                gameInfoLine = $(gameListEntry).find('a[title="Steam store page"]').parent().parent();
            } else {
                steamAppId = reviewBox[0].pathname.match(steamAppIdRegEx)[1];
                var reviewScoreData = reviewBox.find('> abbr')[0].title.match(reviewScoreRegEx);
                reviewPercentage = reviewScoreData[1];
                reviewerCount = reviewScoreData[2];
                gameInfoLine = reviewBox.parent();
                hasReviewCount = true;
            }

            var gameInfoChildren = gameInfoLine.children();
            if (gameInfoChildren.length === 0) {
                return null;
            }
            var hasStoreTag = gameInfoChildren[0].tagName === 'ABBR' && gameInfoChildren[0].children.length > 0;
            var startIndex = (hasStoreTag ? 2 : 1) - (hasReviewCount ? 0 : 1);
            var tradeableCount = gameInfoChildren[startIndex].title.match(tradeableRegEx)[1];
            var wishlistCount = gameInfoChildren[startIndex + 1].title.match(wishlistRegEx)[1];
            var isBundled = gameInfoChildren[startIndex + 2].tagName !== 'ABBR';
            var bundleCount = 0;
            var bundles = [];
            if (isBundled) {
                var bundleData = $(gameInfoChildren[startIndex + 2]).children()[0].title.match(bundleRegEx);
                bundleCount = bundleData[1];
                bundles = bundleData[2].split('; ');
            }

            var game = {
                element: gameListEntry,
                steamAppId: steamAppId,
                reviewScore: {
                    percentage: Number(reviewPercentage),
                    votes: Number(reviewerCount)
                },
                tradeable: Number(tradeableCount),
                wishlist: Number(wishlistCount),
                bundles: {
                    count: Number(bundleCount),
                    entries: bundles
                }
            };
            if (first) {
                offeredGames.push(game);
            } else {
                requestedGames.push(game);
            }
            return game;
        });
        $.each(games, function(_, game) {
            allGames.push(game);
        });

        var gameStats = games.reduce(function(previousValue, currentValue, currentIndex, array) {
            previousValue.totalTradeable += currentValue.tradeable;
            previousValue.totalWishlist += currentValue.wishlist;
            previousValue.averageReviewScore += currentValue.reviewScore.percentage;
            previousValue.averageWeightedReviewScore += currentValue.reviewScore.percentage * currentValue.reviewScore.votes;
            previousValue.voteCount += currentValue.reviewScore.votes;
            previousValue.gamesInBundles += (currentValue.bundles.count > 0) ? 1 : 0;
            previousValue.totalBundles += currentValue.bundles.count;
            previousValue.games += 1;
            return previousValue;
        }, {
            totalTradeable: 0,
            totalWishlist: 0,
            averageReviewScore: 0,
            averageWeightedReviewScore: 0,
            voteCount: 0,
            gamesInBundles: 0,
            games: 0,
            totalBundles: 0
        });

        gameStats.averageReviewScore = Number((gameStats.averageReviewScore / gameStats.games).toFixed(0));
        gameStats.averageWeightedReviewScore = Number((gameStats.averageWeightedReviewScore / gameStats.voteCount).toFixed(0));
        var tradeRatio = gameStats.totalTradeable / gameStats.totalWishlist;
        var fractions;
        if (tradeRatio < 1) {
            fractions = getFractions(tradeRatio);
            gameStats.tradeRatioRounded = fractions.rounded.n + " : " + fractions.rounded.d;
            gameStats.tradeRatioActual = fractions.real.n + " : " + fractions.real.d;
            gameStats.tradeRatioSmallest = fractions.smallest.n + " : " + fractions.smallest.d;
        } else if (tradeRatio > 1) {
            fractions = getFractions(1 / tradeRatio);
            gameStats.tradeRatioRounded = fractions.rounded.d + " : " + fractions.rounded.n;
            gameStats.tradeRatioActual = fractions.real.d + " : " + fractions.real.n;
            gameStats.tradeRatioSmallest = fractions.smallest.d + " : " + fractions.smallest.n;
        } else {
            gameStats.tradeRatioRounded = gameStats.tradeRatioActual = gameStats.tradeRatioSmallest = "1 : 1";
        }

        var tradeSummary =
            '<p>Trade summary:</p>\
             <table style="width: 100%;">\
               <tr>\
                 <th>Games in bundles</th><td>{1}</td>\
               </tr>\
               <tr>\
                 <th>Total bundles</th><td>{8}</td>\
               </tr>\
               <tr>\
                 <th>Average review score <span title="The more reviews it has, the proportionally larger that game\'s impact on the score" style="border-bottom: dotted 1px; cursor: help; font-size: 16px;">(weighted)</span></th><td>{4}% ({5}%)</td>\
               </tr>\
               <tr>\
                 <th>Number of reviews <span title="The binary logarithm of the number of reviews. A difference of +1 means &quot;twice as popular&quot;, and -1 means &quot;half as popular&quot;." style="border-bottom: dotted 1px; cursor: help; font-size: 16px;">(log<sub>2</sub>)</span></th><td>{10} ({11})</td>\
               </tr>\
               <tr>\
                 <th>Trade ratio (H : W)</th><td>rounded: {6},<br>small: {7},<br>actual: {9}</td>\
               </tr>\
               <tr>\
                 <th>Total price on Steam (ignoring any active discounts)</th><td id="{12}_total_value">Loading...</td>\
               </tr>\
               <tr>\
                 <th>Average price per game on Steam (ignoring any active discounts)</th><td id="{12}_average_value">Loading...</td>\
               </tr>\
             </table>'.format(
            gameStats.games,
            gameStats.gamesInBundles,
            gameStats.totalTradeable,
            gameStats.totalWishlist,
            gameStats.averageReviewScore,
            gameStats.averageWeightedReviewScore,
            gameStats.tradeRatioRounded,
            gameStats.tradeRatioSmallest,
            gameStats.totalBundles,
            gameStats.tradeRatioActual,
            gameStats.voteCount,
            (Math.log(gameStats.voteCount) / Math.log(2)).toFixed(2),
            first ? "offered" : "requested");

        if (first) {
            $(tradeable).after(tradeSummary);
            first = false;
        } else {
            $(tradeable).before(tradeSummary);
        }
    });

    var steamIds = [];
    $.each(allGames, function(_, game) {
        if ($.inArray(game.steamAppId, steamIds) !== -1) {
            return;
        }
        steamIds.push(game.steamAppId);
    });
    getSteamPricesFor(steamIds, function(success, gamePrices) {
        if (!success) {
            console.error("Error fetching game prices from Steam");
            return;
        }
        $.each(allGames, function(_, game) {
            if (game.steamAppId in gamePrices) {
                var gamePrice = gamePrices[game.steamAppId].prices;
                if (typeof gamePrice === 'undefined') {
                    gamePrice = {
                        final: 0,
                        initial: 0,
                        discount_percent: 0
                    };
                }
                game.price = gamePrice;
                var gameElement = game.element;
                $(gameElement).css("position", "relative");
                if (gamePrice.final === 0) {
                    $(gameElement).append('<div style="position: absolute; top: 0; right: 15px;">Steam Store Price: Free</div>');
                } else {
                    $(gameElement).append('<div style="position: absolute; top: 0; right: 15px;">Steam Store Price: {0} {1}</div>'
                                          .format(gamePrice.currency, gamePrice.discount_percent === 0 ?
                                                  gamePrice.final / 100.0 :
                                                  "{0} ({1}% off)".format(gamePrice.final / 100.0, gamePrice.discount_percent)));
                }
            } else {
                console.warn("Missing price for:", game.steamAppId);
            }
        });

        var currency = null;
        var offeredTotal = offeredGames.reduce(function(previousValue, currentValue, currentIndex, array) {
            if (currency === null && typeof currentValue.price.currency !== 'undefined') {
                currency = currentValue.price.currency;
            }
            return previousValue + currentValue.price.initial;
        }, 0);
        var offeredDiscountedTotal = offeredGames.reduce(function(previousValue, currentValue, currentIndex, array) {
            return previousValue + currentValue.price.final;
        }, 0);

        var requestedTotal = requestedGames.reduce(function(previousValue, currentValue, currentIndex, array) {
            if (currency === null && typeof currentValue.price.currency !== 'undefined') {
                currency = currentValue.price.currency;
            }
            return previousValue + currentValue.price.initial;
        }, 0);
        var requestedDiscountedTotal = requestedGames.reduce(function(previousValue, currentValue, currentIndex, array) {
            return previousValue + currentValue.price.final;
        }, 0);

        $("#offered_total_value").html('{0} {1} ({2})'.format(currency, offeredDiscountedTotal / 100.0, offeredTotal / 100.0));
        $("#requested_total_value").html('{0} {1} ({2})'.format(currency, requestedDiscountedTotal / 100.0, requestedTotal / 100.0));

        $("#offered_average_value").html('{0} {1} ({2})'.format(currency, (offeredDiscountedTotal / offeredGames.length / 100.0).toFixed(2), (offeredTotal / offeredGames.length / 100.0).toFixed(2)));
        $("#requested_average_value").html('{0} {1} ({2})'.format(currency, (requestedDiscountedTotal / requestedGames.length / 100.0).toFixed(2), (requestedTotal / requestedGames.length / 100.0).toFixed(2)));
    });
})();
