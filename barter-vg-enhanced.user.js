// ==UserScript==
// @name         Barter.vg enhancer
// @namespace    https://alexanderschroeder.net/
// @version      0.1
// @description  Summarizes and compares all attributes in an offer for easy comparison of offer value
// @author       Alexander Krivács Schrøder
// @downloadURL  https://alexanderschroeder.net/userscripts/barter-vg-enhancer.user.js
// @match        https://barter.vg/u/*/o/*/
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.0/jquery.min.js
// @connect      store.steampowered.com
// @grant        GM_getValue
// @grant        GM_setValue
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

    var steamAppIdRegEx = /\/app\/(\d+)\//;
    var reviewScoreRegEx = /(\d+)% positive of (\d+) user reviews/;
    var tradeableRegEx = /(\d+) Barter.vg users have this tradable/;
    var wishlistRegEx = /(\d+) Barter.vg users wishlisted this game/;
    var bundleRegEx = /(\d+) bundles?: (.*)/;

    var tradeables = $('.tradables');
    var first = true;
    $.each(tradeables, function(_, tradeable) {
        var whose = $(tradeable).find('legend strong').html();

        var gameList = $(tradeable).find('.tradables_items_list li');
        console.log(gameList);
        var games = $.map(gameList, function(gameListEntry) {
            var gameName = $(gameListEntry).find('> strong > a').html();
            var reviewBox = $(gameListEntry).find('a[href*="#app_reviews_hash"]');
            if (reviewBox.length === 0) {
                console.error("Could not extract data about " + gameName);
                return null;
            }
            var steamAppId = reviewBox[0].pathname.match(steamAppIdRegEx)[1];
            var reviewScoreData = reviewBox.find('> abbr')[0].title.match(reviewScoreRegEx);
            var reviewPercentage = reviewScoreData[1];
            var reviewerCount = reviewScoreData[2];

            var gameInfoLine = reviewBox.parent();
            var gameInfoChildren = gameInfoLine.children();
            var hasStoreTag = gameInfoChildren[0].tagName === 'ABBR';
            var startIndex = hasStoreTag ? 2 : 1;
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

            return {
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
        delete gameStats.voteCount;
        var tradeRatio = gameStats.totalTradeable / gameStats.totalWishlist;
        if (tradeRatio < 1) {
            var fraction = realToFraction(tradeRatio, 0.000001);
            gameStats.tradeRatio = fraction.n + " : " + fraction.d;
            var fraction3 = getApproximateSmallestFraction($.extend({}, fraction));
            if (fraction.d !== fraction3.d && fraction.n !== fraction3.n) {
                gameStats.tradeRatioSmall = "(~" + fraction3.n + " : " + fraction3.d + ")";
            } else {
                gameStats.tradeRatioSmall = "";
            }
        } else if (tradeRatio > 1) {
            var fraction2 = realToFraction(1 / tradeRatio, 0.000001);
            gameStats.tradeRatio = fraction2.d + " : " + fraction2.n;
            var fraction4 = getApproximateSmallestFraction($.extend({}, fraction2));
            if (fraction2.d !== fraction4.d && fraction2.n !== fraction4.n) {
                gameStats.tradeRatioSmall = "(~" + fraction4.d + " : " + fraction4.n + ")";
            } else {
                gameStats.tradeRatioSmall = "";
            }
        } else {
            gameStats.tradeRatio = "1 : 1";
            gameStats.tradeRatioSmall = "";
        }

        var tradeSummary =
            '<p>Trade summary:</p>\
             <table>\
               <tr>\
                 <th>Games</th><td>{0}</td>\
               </tr>\
               <tr>\
                 <th>Games in bundles</th><td>{1}</td>\
               </tr>\
               <tr>\
                 <th>Total bundles</th><td>{8}</td>\
               </tr>\
               <tr>\
                 <th>Total tradeable</th><td>{2}</td>\
               </tr>\
               <tr>\
                 <th>Total wishlisted</th><td>{3}</td>\
               </tr>\
               <tr>\
                 <th>Average review score</th><td>{4}%</td>\
               </tr>\
               <tr>\
                 <th><span title="The more reviews it has, the proportionally larger that game\'s impact on the score" style="border-bottom: dotted 1px; cursor: help; font-size: 16px;">Average weighted review score</th><td>{5}%</td>\
               </tr>\
               <tr>\
                 <th>Trade ratio (H : W)</th><td>{6} {7}</td>\
               </tr>\
             </table>'.format(
            gameStats.games,
            gameStats.gamesInBundles,
            gameStats.totalTradeable,
            gameStats.totalWishlist,
            gameStats.averageReviewScore,
            gameStats.averageWeightedReviewScore,
            gameStats.tradeRatio,
            gameStats.tradeRatioSmall,
            gameStats.totalBundles);

        if (first) {
            $(tradeable).after(tradeSummary);
            first = false;
        } else {
            $(tradeable).before(tradeSummary);
        }
        console.log(gameStats);
    });
})();
