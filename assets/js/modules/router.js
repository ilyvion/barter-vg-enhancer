export default class Router {
	constructor() {
		this.routes = [];
	}

	registerRoutes(routes) {
		var self = this;
		routes.forEach(route => {
			self.routes.push(route);
		});
	}

	route() {
		var chosenRoute = null;
		this.routes.forEach(route => {
			if (chosenRoute !== null) {
				// Route has already been chosen, skip checking the rest
				return;
			}

			if (route.regex.test(window.location.href)) {
				if (!route.hasPredicate) {
					chosenRoute = route;
					return;
				}

				if (route.predicate()) {
					chosenRoute = route;
				}
			}
		});

		if (chosenRoute !== null) {
			var controller = new chosenRoute.controller();
			chosenRoute.action.call(controller);
			return true;
		}

		return false;
	}
}
 
export class Route {
	constructor(regex, controller, action, predicate) {
		this._regex = regex;
		this._controller = controller;
		this._action = action;
		this._predicate = predicate;
	}

	get regex() {
		return this._regex;
	}

	get controller() {
		return this._controller;
	}

	get action() {
		return this._action;
	}

	get predicate() {
		return this._predicate;
	}

	get hasPredicate() {
		return this._predicate !== null;
	}
}
