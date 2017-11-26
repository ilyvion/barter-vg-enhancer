import Router from './modules/router';
import controllers from './controllers/controllers';

var router = new Router();
controllers.forEach(controller => {
	'use strict';

	router.registerRoutes(controller.routes);
});

router.route();
