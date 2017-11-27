// ==UserScript==
// @name         Barter.vg enhancer
// @namespace    https://alexanderschroeder.net/
// @version      0.4
// @description  Summarizes and compares all attributes in an offer for easy comparison of offer value
// @homepage     https://github.com/alexschrod/barter-vg-enhancer
// @author       Alexander Krivács Schrøder
// @downloadURL  https://alexanderschroeder.net/userscripts/barter-vg-enhancer.user.js
// @supportURL   https://github.com/alexschrod/barter-vg-enhancer/issues
// @match        https://barter.vg/*
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

    function creatingPage() {
        var tradeables = $('.tradables');

        $.each(tradeables, function(_, tradeable) {
            var whose = $(tradeable).find('legend strong').html();

            var gameList = $(tradeable).find('.collection tr:has(input[type="checkbox"])');
            var games = $.map(gameList, function(gameListEntry) {
                if ($(gameListEntry).find('> td').length !== 4)
                    return null;
                
                // Add column for price
                $(gameListEntry).append('<td>Loading price...</td>');
                
                // Add column for ratio
                $(gameListEntry).append('<td>Loading ratio...</td>');
                console.log(gameListEntry);
            });
        });
    }

    // /u/*/o/*/
    var offersPageRegex = /https:\/\/barter\.vg\/u\/.+\/o\/.+\//;
    var offersListPageRegex = /https:\/\/barter\.vg\/u\/.+\/o\//;
    if (offersPageRegex.test(window.location.href) && $('.statusCurrent').text() !== "Creating...") {
        offersPage();
    } else if ((offersPageRegex.test(window.location.href) || offersListPageRegex.test(window.location.href)) && $('.statusCurrent').text() === "Creating...") {
        creatingPage();
    } else {
        console.log(window.location.href);
    }
})();
