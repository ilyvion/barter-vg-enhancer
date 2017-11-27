import $ from 'jquery';

import Router from './modules/router';
import controllers from './controllers/controllers';

import variables from '../generated/variables.pass2';

$('head').append($('<style type="text/css">' + variables.css.style + '</style>'));

var router = new Router();
controllers.forEach(controller => {
	'use strict';

	router.registerRoutes(controller.routes);
});

router.route();
