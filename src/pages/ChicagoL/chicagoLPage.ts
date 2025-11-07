import { SceneAppPage } from '@grafana/scenes';
import { chicagoLScene } from './chicagoLScene';
import { prefixRoute } from '../../utils/utils.routing';
import { ROUTES } from '../../constants';

export const chicagoLPage = new SceneAppPage({
  title: 'Chicago L Trains',
  url: prefixRoute(ROUTES.ChicagoL),
  routePath: ROUTES.ChicagoL,
  getScene: chicagoLScene,
});