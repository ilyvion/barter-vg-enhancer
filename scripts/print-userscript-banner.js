const fs = require('fs');

const readStream = fs.createReadStream('dist/barter-vg-enhancer.user.js', {
	flags: 'r',
	encoding: 'utf-8',
	fd: null,
	mode: 0666,
	bufferSize: 64 * 1024
});

const USER_SCRIPT_END_MARKER = '==/UserScript==';

let userScriptBanner = '';
readStream.on('data', function(data) {
	userScriptBanner += data;

	const scriptEndIndex = userScriptBanner.indexOf(USER_SCRIPT_END_MARKER);

	if (scriptEndIndex > -1) {
		readStream.destroy();
		userScriptBanner = userScriptBanner.substr(0, scriptEndIndex + USER_SCRIPT_END_MARKER.length + 1);
		fs.writeFile('dist/barter-vg-enhancer.meta.js', userScriptBanner, (err) => {
			if (err) {
				console.error(err);
				return process.exit(1);
			}
		});
	}
});
