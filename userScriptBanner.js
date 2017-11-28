/* 
 * Copyright (C) 2017 Alexander Krivács Schrøder <alexschrod@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var userScriptBanner =
`// ==UserScript==
// @name         Barter.vg enhancer
// @namespace    https://alexanderschroeder.net/
// @version      <%= pkg.version %>
// @description  Summarizes and compares all attributes in an offer for easy comparison of offer value
// @homepage     https://github.com/alexschrod/barter-vg-enhancer
// @author       Alexander Krivács Schrøder
// @updateURL    https://alexanderschroeder.net/userscripts/barter-vg-enhancer.meta.js
// @downloadURL  https://alexanderschroeder.net/userscripts/barter-vg-enhancer.user.js
// @supportURL   https://github.com/alexschrod/barter-vg-enhancer/issues
// @match        https://barter.vg/*
// @connect      barter.vg
// @connect      store.steampowered.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @noframes
// ==/UserScript==`;

module.exports = userScriptBanner;
