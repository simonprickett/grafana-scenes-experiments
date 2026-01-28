import { SceneAppPage } from '@grafana/scenes';
import { londonTubeScene } from './londonTubeScene';
import { prefixRoute } from '../../utils/utils.routing';
import { ROUTES } from '../../constants';

export const londonTubePage = new SceneAppPage({
  title: 'Kings Cross St Pancras Tube',
  url: prefixRoute(ROUTES.LondonTube),
  routePath: ROUTES.LondonTube,
  getScene: londonTubeScene,
});
