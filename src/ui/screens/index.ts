import { nav } from '../nav';
import { campfireScreen, checkinScreen, dawnScreen, homeScreen, jobScreen, nightScreen, recapScreen, rescueScreen } from './game';
import { friendsScreen, shopScreen } from './extras';
import { use3D, worldScreen } from './world';

nav.home = (app) => app.show(use3D(app) ? worldScreen(app) : homeScreen(app));
nav.night = (app, n) => app.show(use3D(app) ? worldScreen(app) : nightScreen(app, n));
nav.job = (app, id) => app.show(jobScreen(app, id));
nav.campfire = (app) => app.show(use3D(app) ? worldScreen(app) : campfireScreen(app));
nav.recap = (app) => app.show(recapScreen(app));
nav.rescue = (app) => app.show(rescueScreen(app));
nav.checkin = (app, s) => app.show(checkinScreen(app, s));
nav.dawn = (app) => app.show(dawnScreen(app));
nav.shop = (app) => app.show(shopScreen(app));
nav.friends = (app) => app.show(friendsScreen(app));

export { nav };
