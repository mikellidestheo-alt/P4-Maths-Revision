import { nav } from '../nav';
import { campfireScreen, checkinScreen, dawnScreen, homeScreen, jobScreen, nightScreen, recapScreen, rescueScreen, restScreen } from './game';
import { friendsScreen, shopScreen } from './extras';
import { firstRunScreen, parentGateScreen, parentScreen } from './parent';

nav.home = (app) => app.show(homeScreen(app));
nav.firstRun = (app) => app.show(firstRunScreen(app));
nav.night = (app, n) => app.show(nightScreen(app, n));
nav.job = (app, id) => app.show(jobScreen(app, id));
nav.campfire = (app) => app.show(campfireScreen(app));
nav.recap = (app) => app.show(recapScreen(app));
nav.rescue = (app) => app.show(rescueScreen(app));
nav.checkin = (app, s) => app.show(checkinScreen(app, s));
nav.rest = (app) => app.show(restScreen(app));
nav.dawn = (app) => app.show(dawnScreen(app));
nav.shop = (app) => app.show(shopScreen(app));
nav.friends = (app) => app.show(friendsScreen(app));
nav.parentGate = (app) => app.show(parentGateScreen(app));
nav.parent = (app) => app.show(parentScreen(app));

export { nav };
