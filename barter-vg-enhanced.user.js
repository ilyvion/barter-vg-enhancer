// ==UserScript==
// @name         Barter.vg enhancer
// @namespace    https://alexanderschroeder.net/
// @version      0.2
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
             <table>\
               <tr>\
                 <th>Games in bundles</th><td>{1}</td>\
               </tr>\
               <tr>\
                 <th>Total bundles</th><td>{8}</td>\
               </tr>\
               <tr>\
                 <th>Average review score</th><td>{4}%</td>\
               </tr>\
               <tr>\
                 <th><span title="The more reviews it has, the proportionally larger that game\'s impact on the score" style="border-bottom: dotted 1px; cursor: help; font-size: 16px;">Average weighted review score</th><td>{5}%</td>\
               </tr>\
               <tr>\
                 <th>Number of reviews (log<sub>2</sub>)</th><td>{10} ({11})</td>\
               </tr>\
               <tr>\
                 <th>Trade ratio (H : W)</th><td>rounded: {6},<br>small: {7},<br>actual: {9}</span</td>\
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
            Math.log(gameStats.voteCount).toFixed(2));

        if (first) {
            $(tradeable).after(tradeSummary);
            first = false;
        } else {
            $(tradeable).before(tradeSummary);
        }
    });
})();
