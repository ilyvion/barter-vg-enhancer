import $ from 'jquery';

const APPLICATION_JSON = 'application/json';
const JSON_PROTECTION_PREFIX = /^\)\]\}',?\n/;
const JSON_START = /^\[|^\{(?!\{)/;
const JSON_ENDS = {
	'[': /]$/,
	'{': /}$/
};

function isJsonLike(str) {
	'use strict';

	var jsonStart = str.match(JSON_START);
	return jsonStart && JSON_ENDS[jsonStart[0]].test(str);
}

function isString(value) {
	'use strict';

	return typeof value === 'string';
}

function fromJson(json) {
	'use strict';

	return isString(json) ? JSON.parse(json) : json;
}

function getHeaderFunction(headers) {
	'use strict';

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
	'use strict';

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

export default class Http {
	static get(url, callback) {
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

				responseData = defaultHttpResponseTransform(responseData, headers);
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
}
